import re
from difflib import SequenceMatcher

from app.schemas.ai_core import AiResponse, AiScoreRequest, AiTranscribeRequest
from app.schemas.shadowing import ShadowingAnalyzeRequest
from app.services.ai_core import ai_score, ai_transcribe


def _normalize(text: str) -> str:
    return " ".join(re.findall(r"[a-z0-9']+", text.lower()))


def _similarity(reference: str, learner: str) -> float:
    reference_norm = _normalize(reference)
    learner_norm = _normalize(learner)
    if not reference_norm or not learner_norm:
        return 0
    return round(SequenceMatcher(a=reference_norm, b=learner_norm).ratio() * 100, 2)


def _local_feedback(reference_text: str, learner_text: str, mode: str) -> dict:
    similarity = _similarity(reference_text, learner_text)
    pronunciation = similarity
    fluency = max(0, min(100, similarity - 5 if len(learner_text) < len(reference_text) * 0.75 else similarity))
    rhythm = max(0, min(100, similarity - 3 if mode == "simultaneous" else similarity))
    intonation = max(0, min(100, similarity - 8))
    overall = round((pronunciation * 0.35 + fluency * 0.25 + rhythm * 0.2 + intonation * 0.2), 2)
    return {
        "pronunciation_score": round(pronunciation, 2),
        "fluency_score": round(fluency, 2),
        "rhythm_score": round(rhythm, 2),
        "intonation_score": round(intonation, 2),
        "overall_score": overall,
        "alignment_similarity": similarity,
        "mode": mode,
        "notes": [
            "Local fallback uses transcript similarity, not acoustic pronunciation analysis.",
            "Use AI feedback with audio input for richer pronunciation/rhythm feedback.",
        ],
    }


def analyze_shadowing(request: ShadowingAnalyzeRequest) -> AiResponse:
    learner_text = request.learner_transcript or ""

    if not learner_text and (request.audio_base64 or request.recording_url):
        transcription = ai_transcribe(
            AiTranscribeRequest(
                user_id=request.user_id,
                feature="shadowing_transcribe",
                media_url=request.recording_url,
                audio_base64=request.audio_base64,
                audio_mime_type=request.audio_mime_type,
                prompt="Transcribe this learner shadowing recording as accurately as possible.",
                use_cache=False,
            )
        )
        learner_text = transcription.output

    deterministic = _local_feedback(request.reference_text, learner_text, request.mode)
    if not request.use_ai_feedback:
        return AiResponse(
            provider="local",
            model="deterministic-shadowing-alignment",
            operation="score",
            output="Deterministic shadowing analysis completed.",
            data=deterministic,
            usage={
                "user_id": request.user_id,
                "feature": "shadowing_analyze",
                "operation": "score",
                "cache_hit": False,
                "input_chars": len(request.reference_text) + len(learner_text),
                "output_chars": 0,
                "estimated_input_tokens": 0,
                "estimated_output_tokens": 0,
                "estimated_cost_units": 0,
            },
        )

    response = ai_score(
        AiScoreRequest(
            user_id=request.user_id,
            feature="shadowing_analyze",
            submission=(
                f"Shadowing mode: {request.mode}\n\n"
                f"Reference text:\n{request.reference_text}\n\n"
                f"Learner transcript:\n{learner_text}\n\n"
                f"Deterministic alignment metrics:\n{deterministic}"
            ),
            rubric={
                "task": "shadowing",
                "criteria": [
                    "pronunciation accuracy",
                    "fluency",
                    "rhythm",
                    "intonation",
                    "word stress",
                    "connected speech",
                ],
            },
            max_score=100,
        )
    )
    return response.model_copy(update={"data": deterministic})
