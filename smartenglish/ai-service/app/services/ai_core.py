from __future__ import annotations

import base64
import hashlib
import json
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


def _gemini_generate_text(
    *,
    contents: list[dict[str, Any]],
    system_instruction: str | None,
    temperature: float,
) -> str:
    if not settings.gemini_api_key:
        joined = " ".join(
            part.get("text", "")
            for content in contents
            for part in content.get("parts", [])
            if isinstance(part, dict)
        ).strip()
        preview = joined[:500] if joined else "No prompt provided."
        return f"[mock:{settings.ai_provider}] {preview}"

    model = urllib.parse.quote(settings.gemini_model, safe="")
    url = (
        f"{settings.gemini_api_base}/models/{model}:generateContent"
        f"?key={urllib.parse.quote(settings.gemini_api_key)}"
    )
    payload: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {"temperature": temperature},
    }
    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

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
        raise HTTPException(status_code=502, detail={"error": "gemini_http_error", "detail": detail}) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail={"error": "gemini_request_failed", "detail": str(exc)}) from exc

    candidates = body.get("candidates") or []
    if not candidates:
        raise HTTPException(status_code=502, detail={"error": "gemini_empty_response", "raw": body})

    parts = candidates[0].get("content", {}).get("parts", [])
    text_parts = [part.get("text", "") for part in parts if isinstance(part, dict)]
    return "\n".join(part for part in text_parts if part).strip()


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
