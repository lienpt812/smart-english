import re
from difflib import SequenceMatcher

from app.schemas.ai_core import AiGenerateRequest, AiResponse, AiScoreRequest, AiTranscribeRequest
from app.schemas.dictation import (
    DictationScoreRequest,
    DictationSegmentRequest,
    DictationTranscribeRequest,
)
from app.services.ai_core import ai_generate, ai_score, ai_transcribe


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9']+", text.lower())


def _word_accuracy(expected: str, typed: str) -> dict:
    expected_tokens = _tokens(expected)
    typed_tokens = _tokens(typed)
    matcher = SequenceMatcher(a=expected_tokens, b=typed_tokens)
    matched = sum(block.size for block in matcher.get_matching_blocks())
    total = max(len(expected_tokens), 1)
    accuracy = round((matched / total) * 100, 2)
    missing = [token for token in expected_tokens if token not in typed_tokens]
    extra = [token for token in typed_tokens if token not in expected_tokens]
    return {
        "accuracy": accuracy,
        "matched_words": matched,
        "expected_words": len(expected_tokens),
        "typed_words": len(typed_tokens),
        "missing_words": missing[:20],
        "extra_words": extra[:20],
    }


def transcribe_media(request: DictationTranscribeRequest) -> AiResponse:
    return ai_transcribe(
        AiTranscribeRequest(
            user_id=request.user_id,
            feature="dictation_transcribe",
            media_url=request.media_url,
            audio_base64=request.audio_base64,
            audio_mime_type=request.audio_mime_type,
            prompt=(
                "Transcribe this audio for dictation practice. Return JSON with "
                "transcript and optional sentence-level segments containing start_ms, "
                "end_ms, and text."
            ),
        )
    )


def segment_transcript(request: DictationSegmentRequest) -> AiResponse:
    return ai_generate(
        AiGenerateRequest(
            user_id=request.user_id,
            feature="dictation_segment",
            response_format="json",
            temperature=0.1,
            prompt=(
                f"Language: {request.language_code}\n\n"
                f"Transcript:\n{request.transcript}"
            ),
            instruction=(
                "Split this transcript into dictation-friendly sentence segments. "
                "Return JSON array only. Each item must include position, text, "
                "normalized_text, start_ms, and end_ms. If timestamps are unknown, "
                "estimate monotonically increasing timestamps."
            ),
        )
    )


def score_dictation(request: DictationScoreRequest) -> AiResponse:
    deterministic = _word_accuracy(request.expected_text, request.typed_text)
    if not request.use_ai_feedback:
        return AiResponse(
            provider="local",
            model="deterministic-word-accuracy",
            operation="score",
            output="Deterministic dictation scoring completed.",
            data=deterministic,
            usage={
                "user_id": request.user_id,
                "feature": "dictation_score",
                "operation": "score",
                "cache_hit": False,
                "input_chars": len(request.expected_text) + len(request.typed_text),
                "output_chars": 0,
                "estimated_input_tokens": 0,
                "estimated_output_tokens": 0,
                "estimated_cost_units": 0,
            },
        )

    response = ai_score(
        AiScoreRequest(
            user_id=request.user_id,
            feature="dictation_score",
            submission=(
                f"Expected text:\n{request.expected_text}\n\n"
                f"Learner typed text:\n{request.typed_text}\n\n"
                f"Deterministic word accuracy: {deterministic}"
            ),
            rubric={
                "task": "dictation",
                "criteria": [
                    "exact word match",
                    "missing words",
                    "extra words",
                    "near-match spelling",
                    "meaning-preserving minor mistakes",
                ],
            },
            max_score=100,
        )
    )
    return response.model_copy(update={"data": deterministic})
