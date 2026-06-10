import re

from app.schemas.ai_core import AiResponse, AiScoreRequest
from app.schemas.writing import WritingGradeRequest
from app.services.ai_core import ai_score


def _word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9']+", text))


def _local_writing_feedback(request: WritingGradeRequest) -> dict:
    words = _word_count(request.content)
    sentences = max(1, len(re.findall(r"[.!?]+", request.content)))
    avg_sentence_length = round(words / sentences, 2)
    length_score = min(100, round((words / 250) * 100, 2))
    sentence_score = 85 if 8 <= avg_sentence_length <= 28 else 65
    overall = round(length_score * 0.45 + sentence_score * 0.25 + 20, 2)
    overall = max(0, min(100, overall))
    return {
        "total_score": overall,
        "max_score": request.max_score,
        "word_count": words,
        "avg_sentence_length": avg_sentence_length,
        "rubric_breakdown": {
            "task_achievement": round(overall * 0.95, 2),
            "coherence_and_cohesion": round(sentence_score, 2),
            "lexical_resource": round(overall * 0.9, 2),
            "grammar_range_accuracy": round(overall * 0.85, 2),
        },
        "inline_comments": [],
        "strengths": ["Local fallback checked length and sentence balance."],
        "issues": [
            "Local fallback cannot deeply assess grammar, coherence, or task achievement.",
            "Enable AI feedback for rubric grading and inline comments.",
        ],
        "revised_sample": None,
    }


def grade_writing(request: WritingGradeRequest) -> AiResponse:
    deterministic = _local_writing_feedback(request)
    if not request.use_ai_feedback:
        return AiResponse(
            provider="local",
            model="deterministic-writing-rubric",
            operation="score",
            output="Deterministic writing feedback completed.",
            data=deterministic,
            usage={
                "user_id": request.user_id,
                "feature": "writing_grade",
                "operation": "score",
                "cache_hit": False,
                "input_chars": len(request.prompt) + len(request.content),
                "output_chars": 0,
                "estimated_input_tokens": 0,
                "estimated_output_tokens": 0,
                "estimated_cost_units": 0,
            },
        )

    response = ai_score(
        AiScoreRequest(
            user_id=request.user_id,
            feature="writing_grade",
            submission=(
                f"Task type: {request.task_type}\n"
                f"Learner level: {request.learner_level or 'unknown'}\n"
                f"Prompt:\n{request.prompt}\n\n"
                f"Student writing:\n{request.content}\n\n"
                f"Local writing metrics:\n{deterministic}"
            ),
            rubric=request.rubric
            or {
                "criteria": [
                    "Task Achievement",
                    "Coherence and Cohesion",
                    "Lexical Resource",
                    "Grammatical Range and Accuracy",
                ],
                "inline_comments": "Return comments with start, end, label, message, suggestion.",
            },
            max_score=request.max_score,
        )
    )
    return response.model_copy(update={"data": deterministic})
