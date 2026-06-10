import re

from app.schemas.ai_core import (
    AiChatRequest,
    AiGenerateRequest,
    AiMessage,
    AiResponse,
    AiScoreRequest,
    AiTranscribeRequest,
)
from app.schemas.speaking import (
    SpeakingDrillRequest,
    SpeakingEvaluateRequest,
    SpeakingRoleplayRequest,
)
from app.services.ai_core import ai_chat, ai_generate, ai_score, ai_transcribe


def _word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9']+", text))


def _local_speaking_feedback(prompt: str, transcript: str, task_type: str) -> dict:
    words = _word_count(transcript)
    transcript_tokens = re.findall(r"[a-z0-9']+", transcript.lower())
    prompt_keywords = set(re.findall(r"[a-z]{4,}", prompt.lower()))
    transcript_keywords = set(re.findall(r"[a-z]{4,}", transcript.lower()))
    coverage = len(prompt_keywords & transcript_keywords) / max(len(prompt_keywords), 1)
    filler_patterns = ["um", "uh", "erm", "like", "you know", "actually", "basically"]
    filler_counts = {
        filler: len(re.findall(rf"\b{re.escape(filler)}\b", transcript.lower()))
        for filler in filler_patterns
    }
    filler_total = sum(filler_counts.values())
    vocabulary_diversity = round(
        (len(set(transcript_tokens)) / max(len(transcript_tokens), 1)) * 100,
        2,
    )
    vocabulary = min(100, max(20, words * 2.2))
    coherence = round(coverage * 100, 2)
    fluency = max(0, min(100, max(20, words * 1.6) - filler_total * 3))
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
        "filler_words": {key: value for key, value in filler_counts.items() if value},
        "filler_word_total": filler_total,
        "vocabulary_diversity": vocabulary_diversity,
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


def generate_pronunciation_drill(request: SpeakingDrillRequest) -> AiResponse:
    return ai_generate(
        AiGenerateRequest(
            user_id=request.user_id,
            feature="speaking_drill",
            response_format="json",
            temperature=0.25,
            prompt=(
                f"Drill type: {request.drill_type}\n"
                f"Learner level: {request.learner_level or 'unknown'}\n"
                f"Target sound: {request.target_sound or 'infer from target text'}\n"
                f"Issue summary: {request.issue_summary or 'not provided'}\n\n"
                f"Target text:\n{request.target_text}"
            ),
            instruction=(
                "Create a focused speaking drill. Return JSON with target_sound, "
                "mouth_position_hint, minimal_pairs, warmup_words, practice_sentences, "
                "shadowing_line, self_check_rubric, and next_step."
            ),
        )
    )
