from typing import Any

from app.core.config import settings
from app.schemas.ai_core import AiGenerateRequest, AiResponse, AiScoreRequest
from app.schemas.listening import (
    ListeningAudioRequest,
    ListeningDialogueRequest,
    ListeningQuizRequest,
    ListeningScoreRequest,
)
from app.services.ai_core import ai_generate, ai_score


def generate_listening_dialogue(request: ListeningDialogueRequest) -> AiResponse:
    return ai_generate(
        AiGenerateRequest(
            user_id=request.user_id,
            feature="listening_dialogue",
            response_format="json",
            temperature=0.45,
            prompt=(
                f"Topic: {request.topic}\n"
                f"Learner level: {request.learner_level or 'unknown'}\n"
                f"Target cert: {request.target_cert or 'general English'}\n"
                f"Content kind: {request.content_kind}\n"
                f"Speaker count: {request.speaker_count}\n"
                f"Approx duration seconds: {request.duration_seconds}"
            ),
            instruction=(
                "Create an active listening lesson. Return JSON with title, topic, "
                "level, content_kind, transcript_text, dialogue_turns, key_vocabulary, "
                "listening_focus, dictation_segments, shadowing_lines, and tts_hints. "
                "Keep language natural and level-appropriate."
            ),
        )
    )


def generate_active_listening_quiz(request: ListeningQuizRequest) -> AiResponse:
    return ai_generate(
        AiGenerateRequest(
            user_id=request.user_id,
            feature="listening_quiz",
            response_format="json",
            temperature=0.25,
            prompt=(
                f"Title: {request.title}\n"
                f"Learner level: {request.learner_level or 'unknown'}\n"
                f"Question count: {request.question_count}\n"
                f"Question types: {', '.join(request.question_types)}\n\n"
                f"Transcript:\n{request.transcript}"
            ),
            instruction=(
                "Generate active listening comprehension questions. Return JSON with "
                "questions array only. Each question must include id, question_type, "
                "prompt, choices, answer, explanation, transcript_evidence, and "
                "skill_focus. Include MCQ, true/false, short answer, or fill blank "
                "according to the requested types."
            ),
        )
    )


def _normalize_answer(value: Any) -> str:
    return str(value).strip().lower()


def _deterministic_score(request: ListeningScoreRequest) -> dict:
    results: list[dict] = []
    correct = 0

    for index, question in enumerate(request.questions):
        question_id = str(question.get("id") or index)
        answer = question.get("answer", {})
        expected = answer.get("correctIndex", answer.get("text", answer.get("value", "")))
        learner_answer = request.responses.get(question_id, request.responses.get(str(index), ""))
        is_correct = _normalize_answer(expected) == _normalize_answer(learner_answer)
        if is_correct:
            correct += 1
        results.append(
            {
                "question_id": question_id,
                "correct": is_correct,
                "expected": expected,
                "response": learner_answer,
                "explanation": question.get("explanation"),
            }
        )

    total = max(len(request.questions), 1)
    score = round((correct / total) * 100, 2)
    return {
        "score": score,
        "max_score": 100,
        "correct_count": correct,
        "question_count": total,
        "results": results,
    }


def score_active_listening(request: ListeningScoreRequest) -> AiResponse:
    deterministic = _deterministic_score(request)
    if not request.use_ai_feedback:
        return AiResponse(
            provider="local",
            model="deterministic-listening-quiz",
            operation="score",
            output="Deterministic active listening scoring completed.",
            data=deterministic,
            usage={
                "user_id": request.user_id,
                "feature": "listening_score",
                "operation": "score",
                "cache_hit": False,
                "input_chars": sum(len(str(item)) for item in request.questions)
                + len(str(request.responses)),
                "output_chars": 0,
                "estimated_input_tokens": 0,
                "estimated_output_tokens": 0,
                "estimated_cost_units": 0,
            },
        )

    response = ai_score(
        AiScoreRequest(
            user_id=request.user_id,
            feature="listening_score",
            submission=(
                f"Questions:\n{request.questions}\n\n"
                f"Learner responses:\n{request.responses}\n\n"
                f"Deterministic scoring:\n{deterministic}"
            ),
            rubric={
                "task": "active_listening_quiz",
                "criteria": [
                    "detail comprehension",
                    "main idea",
                    "inference",
                    "short answer tolerance",
                    "actionable listening feedback",
                ],
            },
            max_score=100,
        )
    )
    return response.model_copy(update={"data": deterministic})


def prepare_listening_audio(request: ListeningAudioRequest) -> AiResponse:
    data = {
        "provider": settings.ai_audio_provider,
        "model": settings.gemini_audio_model,
        "render_mode": request.render_mode,
        "voice": request.voice or "default",
        "speed": request.speed,
        "title": request.title,
        "segments": request.dialogue
        or [{"speaker": "Narrator", "text": request.transcript}],
        "status": "metadata_ready",
        "note": (
            "Use this payload to render audio with Gemini TTS when available, "
            "or Web Speech API on the frontend for local playback."
        ),
    }
    return AiResponse(
        provider=settings.ai_audio_provider,
        model=settings.gemini_audio_model,
        operation="generate",
        output="Listening audio render metadata prepared.",
        data=data,
        usage={
            "user_id": request.user_id,
            "feature": "listening_audio",
            "operation": "generate",
            "cache_hit": False,
            "input_chars": len(request.transcript),
            "output_chars": len(str(data)),
            "estimated_input_tokens": max(1, len(request.transcript) // 4),
            "estimated_output_tokens": max(1, len(str(data)) // 4),
            "estimated_cost_units": 0,
        },
    )
