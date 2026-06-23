from __future__ import annotations

import base64
import hashlib
import json
import mimetypes
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException

from app.core.config import settings
from app.schemas.ai_core import (
    AiChatRequest,
    AiGenerateRequest,
    AiOperation,
    AiResponse,
    AiScoreRequest,
    AiTranscribeRequest,
    AiUsage,
)


@dataclass
class CacheItem:
    expires_at: float
    value: AiResponse


@dataclass
class UsageEvent:
    created_at: float
    user_id: str
    feature: str
    operation: AiOperation
    cache_hit: bool
    estimated_cost_units: float


_cache: dict[str, CacheItem] = {}
_request_counts: dict[str, tuple[int, float]] = {}
_usage_events: list[UsageEvent] = []
_gemini_key_index = 0


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _cache_key(operation: AiOperation, payload: dict[str, Any]) -> str:
    raw = _json_dumps({"operation": operation, "payload": payload})
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _count_chars(value: Any) -> int:
    return len(_json_dumps(value))


def _estimate_tokens(chars: int) -> int:
    return max(1, round(chars / 4))


def _usage(
    *,
    user_id: str,
    feature: str,
    operation: AiOperation,
    cache_hit: bool,
    input_chars: int,
    output: str,
) -> AiUsage:
    output_chars = len(output)
    input_tokens = _estimate_tokens(input_chars)
    output_tokens = _estimate_tokens(output_chars)
    cost_units = round((input_tokens * 0.25 + output_tokens) / 1000, 6)
    return AiUsage(
        user_id=user_id,
        feature=feature,
        operation=operation,
        cache_hit=cache_hit,
        input_chars=input_chars,
        output_chars=output_chars,
        estimated_input_tokens=input_tokens,
        estimated_output_tokens=output_tokens,
        estimated_cost_units=cost_units,
    )


def _record_usage(usage: AiUsage) -> None:
    _usage_events.append(
        UsageEvent(
            created_at=time.time(),
            user_id=usage.user_id,
            feature=usage.feature,
            operation=usage.operation,
            cache_hit=usage.cache_hit,
            estimated_cost_units=usage.estimated_cost_units,
        )
    )
    del _usage_events[:-1000]


def _check_rate_limit(user_id: str) -> None:
    now = time.time()
    window_seconds = 24 * 60 * 60
    count, reset_at = _request_counts.get(user_id, (0, now + window_seconds))

    if now >= reset_at:
        count = 0
        reset_at = now + window_seconds

    if count >= settings.ai_daily_request_limit:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "ai_daily_limit_reached",
                "limit": settings.ai_daily_request_limit,
                "resetAt": reset_at,
            },
        )

    _request_counts[user_id] = (count + 1, reset_at)


def _get_cached(key: str) -> AiResponse | None:
    item = _cache.get(key)
    if not item:
        return None
    if item.expires_at <= time.time():
        _cache.pop(key, None)
        return None
    return item.value


def _set_cached(key: str, value: AiResponse) -> None:
    _cache[key] = CacheItem(
        expires_at=time.time() + settings.ai_cache_ttl_seconds,
        value=value,
    )


def _gemini_api_keys() -> list[str]:
    keys = [
        key.strip()
        for key in settings.gemini_api_keys.split(",")
        if key.strip()
    ]
    if settings.gemini_api_key.strip():
        keys.append(settings.gemini_api_key.strip())
    return list(dict.fromkeys(keys))


def _next_gemini_key() -> str:
    global _gemini_key_index
    keys = _gemini_api_keys()
    if not keys:
        return ""
    key = keys[_gemini_key_index % len(keys)]
    _gemini_key_index = (_gemini_key_index + 1) % len(keys)
    return key


def _gemini_generate_text(
    *,
    contents: list[dict[str, Any]],
    system_instruction: str | None,
    temperature: float,
) -> str:
    api_keys = _gemini_api_keys()
    if not api_keys:
        joined = " ".join(
            part.get("text", "")
            for content in contents
            for part in content.get("parts", [])
            if isinstance(part, dict)
        ).strip()
        preview = joined[:500] if joined else "No prompt provided."
        return f"[mock:{settings.ai_provider}] {preview}"

    model = urllib.parse.quote(settings.gemini_model, safe="")
    payload: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {"temperature": temperature},
    }
    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    last_error: dict[str, Any] | None = None
    for _ in range(len(api_keys)):
        api_key = _next_gemini_key()
        url = (
            f"{settings.gemini_api_base}/models/{model}:generateContent"
            f"?key={urllib.parse.quote(api_key)}"
        )
        request = urllib.request.Request(
            url,
            data=_json_dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=settings.ai_request_timeout_seconds) as response:
                body = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            last_error = {
                "error": "gemini_http_error",
                "upstream_status": exc.code,
                "detail": detail,
            }
            if exc.code in {429, 500, 502, 503, 504}:
                continue
            raise HTTPException(status_code=502, detail=last_error) from exc
        except Exception as exc:
            last_error = {"error": "gemini_request_failed", "detail": str(exc)}
            continue

        candidates = body.get("candidates") or []
        if not candidates:
            last_error = {"error": "gemini_empty_response", "raw": body}
            continue

        parts = candidates[0].get("content", {}).get("parts", [])
        text_parts = [part.get("text", "") for part in parts if isinstance(part, dict)]
        output = "\n".join(part for part in text_parts if part).strip()
        if output:
            return output
        last_error = {"error": "gemini_empty_text", "raw": body}

    raise HTTPException(status_code=502, detail=last_error or {"error": "gemini_all_keys_failed"})


def _groq_transcribe(request: AiTranscribeRequest) -> str:
    if not settings.groq_api_key:
        source = request.media_url or "inline audio"
        return f"[mock:groq:{settings.groq_whisper_model}] Transcription placeholder for {source}."

    boundary = f"----SmartEnglish{hashlib.sha256(str(time.time()).encode()).hexdigest()[:16]}"
    fields: list[tuple[str, str]] = [
        ("model", settings.groq_whisper_model),
        ("response_format", "verbose_json"),
        ("temperature", "0"),
    ]
    if request.prompt:
        fields.append(("prompt", request.prompt))

    file_name = "audio.mp3"
    file_bytes: bytes
    mime_type = request.audio_mime_type or "audio/mpeg"

    if request.audio_base64:
        try:
            file_bytes = base64.b64decode(request.audio_base64, validate=True)
        except Exception as exc:
            raise HTTPException(status_code=422, detail="audio_base64 is not valid base64.") from exc
    elif request.media_url:
        try:
            with urllib.request.urlopen(request.media_url, timeout=settings.ai_request_timeout_seconds) as media_response:
                file_bytes = media_response.read()
                content_type = media_response.headers.get("Content-Type")
                if content_type:
                    mime_type = content_type.split(";")[0]
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail={"error": "media_download_failed", "detail": str(exc)},
            ) from exc
        extension = mimetypes.guess_extension(mime_type) or ".mp3"
        file_name = f"audio{extension}"
    else:
        raise HTTPException(
            status_code=422,
            detail="Provide either media_url or audio_base64 for transcription.",
        )

    chunks: list[bytes] = []
    for name, value in fields:
        chunks.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"),
                f"{value}\r\n".encode("utf-8"),
            ]
        )

    chunks.extend(
        [
            f"--{boundary}\r\n".encode("utf-8"),
            f'Content-Disposition: form-data; name="file"; filename="{file_name}"\r\n'.encode("utf-8"),
            f"Content-Type: {mime_type}\r\n\r\n".encode("utf-8"),
            file_bytes,
            b"\r\n",
            f"--{boundary}--\r\n".encode("utf-8"),
        ]
    )

    api_base = settings.groq_api_base.rstrip("/")
    http_request = urllib.request.Request(
        f"{api_base}/audio/transcriptions",
        data=b"".join(chunks),
        headers={
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(http_request, timeout=settings.ai_request_timeout_seconds) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail={"error": "groq_http_error", "detail": detail}) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail={"error": "groq_request_failed", "detail": str(exc)}) from exc

    if isinstance(body, dict):
        return body.get("text") or _json_dumps(body)
    return str(body)


def _run_core(
    *,
    operation: AiOperation,
    user_id: str,
    feature: str,
    temperature: float,
    use_cache: bool,
    cache_payload: dict[str, Any],
    provider_payload: dict[str, Any],
    system_instruction: str | None,
) -> AiResponse:
    key = _cache_key(operation, cache_payload)

    if use_cache:
        cached = _get_cached(key)
        if cached:
            usage = cached.usage.model_copy(update={"cache_hit": True})
            response = cached.model_copy(update={"usage": usage})
            _record_usage(usage)
            return response

    _check_rate_limit(user_id)

    output = _gemini_generate_text(
        contents=provider_payload["contents"],
        system_instruction=system_instruction,
        temperature=temperature,
    )
    usage = _usage(
        user_id=user_id,
        feature=feature,
        operation=operation,
        cache_hit=False,
        input_chars=_count_chars(cache_payload),
        output=output,
    )
    response = AiResponse(
        provider=settings.ai_provider,
        model=settings.gemini_model,
        operation=operation,
        output=output,
        usage=usage,
    )

    if use_cache:
        _set_cached(key, response)
    _record_usage(usage)
    return response


def ai_chat(request: AiChatRequest) -> AiResponse:
    system_prompt = request.system_prompt
    contents = [
        {
            "role": "model" if message.role == "assistant" else "user",
            "parts": [{"text": message.content}],
        }
        for message in request.messages
        if message.role != "system"
    ]
    system_messages = [message.content for message in request.messages if message.role == "system"]
    if system_messages:
        system_prompt = "\n".join([system_prompt or "", *system_messages]).strip()

    return _run_core(
        operation="chat",
        user_id=request.user_id,
        feature=request.feature,
        temperature=request.temperature,
        use_cache=request.use_cache,
        cache_payload=request.model_dump(),
        provider_payload={"contents": contents},
        system_instruction=system_prompt,
    )


def ai_generate(request: AiGenerateRequest) -> AiResponse:
    instruction = request.instruction
    if request.response_format == "json":
        instruction = "\n".join(
            part for part in [instruction, "Return valid JSON only."] if part
        )

    return _run_core(
        operation="generate",
        user_id=request.user_id,
        feature=request.feature,
        temperature=request.temperature,
        use_cache=request.use_cache,
        cache_payload=request.model_dump(),
        provider_payload={"contents": [{"role": "user", "parts": [{"text": request.prompt}]}]},
        system_instruction=instruction,
    )


def ai_score(request: AiScoreRequest) -> AiResponse:
    rubric = _json_dumps(request.rubric) if request.rubric else "{}"
    prompt = (
        "Grade this English-learning submission. "
        "Return JSON with total, max_total, rubric_breakdown, strengths, issues, and next_steps.\n\n"
        f"Max score: {request.max_score}\n"
        f"Rubric: {rubric}\n\n"
        f"Submission:\n{request.submission}"
    )

    response = _run_core(
        operation="score",
        user_id=request.user_id,
        feature=request.feature,
        temperature=request.temperature,
        use_cache=request.use_cache,
        cache_payload=request.model_dump(),
        provider_payload={"contents": [{"role": "user", "parts": [{"text": prompt}]}]},
        system_instruction="You are a strict but helpful English examiner. Return valid JSON only.",
    )
    return response.model_copy(update={"data": {"max_score": request.max_score}})


def ai_transcribe(request: AiTranscribeRequest) -> AiResponse:
    if not request.media_url and not request.audio_base64:
        raise HTTPException(
            status_code=422,
            detail="Provide either media_url or audio_base64 for transcription.",
        )

    if settings.ai_stt_provider.lower() == "groq":
        key = _cache_key("transcribe", request.model_dump())
        if request.use_cache:
            cached = _get_cached(key)
            if cached:
                usage = cached.usage.model_copy(update={"cache_hit": True})
                response = cached.model_copy(update={"usage": usage})
                _record_usage(usage)
                return response

        _check_rate_limit(request.user_id)
        output = _groq_transcribe(request)
        usage = _usage(
            user_id=request.user_id,
            feature=request.feature,
            operation="transcribe",
            cache_hit=False,
            input_chars=_count_chars(request.model_dump(exclude={"audio_base64"})),
            output=output,
        )
        response = AiResponse(
            provider="groq",
            model=settings.groq_whisper_model,
            operation="transcribe",
            output=output,
            usage=usage,
        )
        if request.use_cache:
            _set_cached(key, response)
        _record_usage(usage)
        return response

    parts: list[dict[str, Any]] = []
    prompt = request.prompt or "Transcribe the English audio. Include sentence-level timestamps if available."
    parts.append({"text": prompt})

    if request.audio_base64:
        mime_type = request.audio_mime_type or "audio/mpeg"
        try:
            base64.b64decode(request.audio_base64, validate=True)
        except Exception as exc:
            raise HTTPException(status_code=422, detail="audio_base64 is not valid base64.") from exc
        parts.append({"inlineData": {"mimeType": mime_type, "data": request.audio_base64}})
    elif request.media_url:
        parts.append({"text": f"Media URL: {request.media_url}"})

    return _run_core(
        operation="transcribe",
        user_id=request.user_id,
        feature=request.feature,
        temperature=request.temperature,
        use_cache=request.use_cache,
        cache_payload=request.model_dump(),
        provider_payload={"contents": [{"role": "user", "parts": parts}]},
        system_instruction="You are an accurate English transcription engine.",
    )


def usage_summary(user_id: str) -> dict[str, Any]:
    events = [event for event in _usage_events if event.user_id == user_id]
    total_cost = round(sum(event.estimated_cost_units for event in events), 6)
    by_feature: dict[str, int] = {}
    for event in events:
        by_feature[event.feature] = by_feature.get(event.feature, 0) + 1
    count, reset_at = _request_counts.get(user_id, (0, time.time() + 24 * 60 * 60))
    return {
        "user_id": user_id,
        "events": len(events),
        "by_feature": by_feature,
        "estimated_cost_units": total_cost,
        "daily_limit": settings.ai_daily_request_limit,
        "daily_used": count,
        "daily_reset_at": reset_at,
    }
