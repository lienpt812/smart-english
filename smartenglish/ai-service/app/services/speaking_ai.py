import re

from app.schemas.ai_core import AiChatRequest, AiMessage, AiResponse, AiScoreRequest, AiTranscribeRequest
from app.schemas.speaking import SpeakingEvaluateRequest, SpeakingRoleplayRequest
from app.services.ai_core import ai_chat, ai_score, ai_transcribe


def _word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9']+", text))


def _local_speaking_feedback(prompt: str, transcript: str, task_type: str) -> dict:
    words = _word_count(transcript)
    prompt_keywords = set(re.findall(r"[a-z]{4,}", prompt.lower()))
    transcript_keywords = set(re.findall(r"[a-z]{4,}", transcript.lower()))
    coverage = len(prompt_keywords & transcript_keywords) / max(len(prompt_keywords), 1)
    vocabulary = min(100, max(20, words * 2.2))
    coherence = round(coverage * 100, 2)
    fluency = min(100, max(20, words * 1.6))
    pronunciation = 70 if transcript else 0
    overall = round(
        pronunciation * 0.25
        + fluency * 0.25
        + vocabulary * 0.25
        + coherence * 0.25,
        2,
    )
    return {
        "pronunciation_score": round(pronunciation, 2),
        "fluency_score": round(fluency, 2),
        "vocabulary_score": round(vocabulary, 2),
        "coherence_score": round(coherence, 2),
        "overall_score": overall,
        "word_count": words,
        "task_type": task_type,
        "notes": [
            "Local fallback uses transcript heuristics only.",
            "Use AI feedback and audio input for richer pronunciation/coherence evaluation.",
        ],
    }


def evaluate_speaking(request: SpeakingEvaluateRequest) -> AiResponse:
    transcript = request.learner_transcript or ""

    if not transcript and (request.audio_base64 or request.recording_url):
        transcription = ai_transcribe(
            AiTranscribeRequest(
                user_id=request.user_id,
                feature="speaking_transcribe",
                media_url=request.recording_url,
                audio_base64=request.audio_base64,
                audio_mime_type=request.audio_mime_type,
                prompt="Transcribe this learner speaking response as accurately as possible.",
                use_cache=False,
            )
        )
        transcript = transcription.output

    deterministic = _local_speaking_feedback(request.prompt, transcript, request.task_type)
    if not request.use_ai_feedback:
        return AiResponse(
            provider="local",
            model="deterministic-speaking-rubric",
            operation="score",
            output="Deterministic speaking feedback completed.",
            data=deterministic,
            usage={
                "user_id": request.user_id,
                "feature": "speaking_evaluate",
                "operation": "score",
                "cache_hit": False,
                "input_chars": len(request.prompt) + len(transcript),
                "output_chars": 0,
                "estimated_input_tokens": 0,
                "estimated_output_tokens": 0,
                "estimated_cost_units": 0,
            },
        )

    response = ai_score(
        AiScoreRequest(
            user_id=request.user_id,
            feature="speaking_evaluate",
            submission=(
                f"Task type: {request.task_type}\n"
                f"Learner level: {request.learner_level or 'unknown'}\n"
                f"Prompt:\n{request.prompt}\n\n"
                f"Learner transcript:\n{transcript}\n\n"
                f"Local speaking metrics:\n{deterministic}"
            ),
            rubric={
                "criteria": [
                    "pronunciation",
                    "fluency",
                    "vocabulary range",
                    "coherence",
                    "actionable next practice",
                ],
                "output": "Return JSON with scores, feedback, corrections, and next_drill.",
            },
            max_score=100,
        )
    )
    return response.model_copy(update={"data": deterministic})


def roleplay_turn(request: SpeakingRoleplayRequest) -> AiResponse:
    system_prompt = (
        f"You are a {request.persona}. Scenario: {request.scenario}. "
        f"Learner level: {request.learner_level or 'unknown'}. "
        "Keep replies natural, short, and interactive. "
        "If mode is coach, add one brief correction after your reply."
    )
    messages = request.messages or [
        AiMessage(role="user", content="Please start the roleplay.")
    ]
    return ai_chat(
        AiChatRequest(
            user_id=request.user_id,
            feature="speaking_roleplay",
            system_prompt=system_prompt,
            messages=messages,
            temperature=0.7 if request.mode == "conversation" else 0.4,
            use_cache=False,
        )
    )
