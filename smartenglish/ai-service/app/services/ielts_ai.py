import re
from typing import Any

from app.schemas.ai_core import AiGenerateRequest, AiResponse, AiScoreRequest
from app.schemas.ielts import IeltsAnalyzeRequest, IeltsGenerateRequest, IeltsScoreRequest
from app.services.ai_core import ai_generate, ai_score


def _fallback_tasks(request: IeltsGenerateRequest) -> list[dict[str, Any]]:
    topic = request.topic or "daily learning habits"
    tasks: list[dict[str, Any]] = []
    for index, skill in enumerate(request.skills):
        if skill == "listening":
            tasks.append(
                {
                    "id": "ielts-listening-1",
                    "skill": "listening",
                    "task_type": "mcq",
                    "title": "Listening Section 1",
                    "prompt": "Listen to a conversation about a study schedule. What does the speaker decide to do?",
                    "transcript": "I will study vocabulary in the morning and do listening practice after lunch.",
                    "choices": ["Study vocabulary in the morning", "Cancel all lessons", "Write an essay at night", "Take a holiday"],
                    "answer": {"correctIndex": 0},
                    "explanation": "The speaker says they will study vocabulary in the morning.",
                }
            )
        elif skill == "reading":
            tasks.append(
                {
                    "id": "ielts-reading-1",
                    "skill": "reading",
                    "task_type": "mcq",
                    "title": "Reading Passage",
                    "passage": (
                        "Small habits can make language learning more sustainable. "
                        "When learners repeat a useful action every day, they reduce the effort needed to begin."
                    ),
                    "prompt": "What is the main idea of the passage?",
                    "choices": [
                        "Daily habits can support steady progress",
                        "Long sessions are always necessary",
                        "Vocabulary should be avoided",
                        "Studying should be random",
                    ],
                    "answer": {"correctIndex": 0},
                    "explanation": "The passage emphasizes repeated small habits.",
                }
            )
        elif skill == "writing":
            tasks.append(
                {
                    "id": "ielts-writing-1",
                    "skill": "writing",
                    "task_type": request.task_type or "task_2",
                    "title": "Writing Task 2",
                    "prompt": (
                        f"Some people believe that {topic} is more important than natural talent. "
                        "To what extent do you agree or disagree?"
                    ),
                    "time_limit_minutes": 40,
                    "min_words": 250,
                    "rubric": ["Task Response", "Coherence and Cohesion", "Lexical Resource", "Grammar"],
                }
            )
        else:
            tasks.append(
                {
                    "id": "ielts-speaking-1",
                    "skill": "speaking",
                    "task_type": "part_2",
                    "title": "Speaking Part 2",
                    "prompt": f"Describe a time when {topic} helped you improve. You should say what happened and why it mattered.",
                    "prep_seconds": 60,
                    "speak_seconds": 120,
                    "rubric": ["Fluency", "Lexical Resource", "Grammar", "Pronunciation"],
                }
            )
        if len(tasks) >= request.question_count:
            break
    return tasks


def generate_ielts_mock(request: IeltsGenerateRequest) -> AiResponse:
    fallback = {
        "title": f"IELTS {request.mode.title()} Practice",
        "mode": request.mode,
        "topic": request.topic or "daily learning habits",
        "target_band": request.target_band,
        "tasks": _fallback_tasks(request),
    }
    if not request.use_ai_generation:
        return AiResponse(
            provider="local",
            model="deterministic-ielts-generator",
            operation="generate",
            output="Deterministic IELTS practice generated.",
            data=fallback,
            usage={
                "user_id": request.user_id,
                "feature": "ielts_generate",
                "operation": "generate",
                "cache_hit": False,
                "input_chars": len(str(request.model_dump())),
                "output_chars": len(str(fallback)),
                "estimated_input_tokens": 0,
                "estimated_output_tokens": 0,
                "estimated_cost_units": 0,
            },
        )

    response = ai_generate(
        AiGenerateRequest(
            user_id=request.user_id,
            feature="ielts_generate",
            response_format="json",
            temperature=0.35,
            prompt=(
                f"Mode: {request.mode}\n"
                f"Skills: {request.skills}\n"
                f"Question/task count: {request.question_count}\n"
                f"Task type: {request.task_type or 'mixed'}\n"
                f"Topic: {request.topic or 'general'}\n"
                f"Target band: {request.target_band or 'unknown'}\n"
                f"Learner level: {request.learner_level or 'unknown'}"
            ),
            instruction=(
                "Generate IELTS-style practice without copying real exam content. Return JSON with title, "
                "mode, duration_minutes, tasks. Tasks must include id, skill, task_type, title, prompt, "
                "choices/answer for objective tasks, transcript or passage when needed, and rubric for "
                "writing/speaking."
            ),
        )
    )
    return response.model_copy(update={"data": fallback})


def _word_count(value: Any) -> int:
    return len(re.findall(r"[A-Za-z0-9']+", str(value or "")))


def _score_task(task: dict[str, Any], response: Any) -> dict[str, Any]:
    skill = str(task.get("skill") or "reading")
    if skill in {"listening", "reading"}:
        expected = str(task.get("answer", {}).get("correctIndex", "")).strip().lower()
        actual = str(response).strip().lower()
        correct = expected == actual
        band = 7.0 if correct else 4.5
        return {
            "task_id": task.get("id"),
            "skill": skill,
            "correct": correct,
            "band": band,
            "feedback": task.get("explanation") or "Review the passage/audio evidence.",
        }

    words = _word_count(response)
    if skill == "writing":
        band = min(8.0, max(4.0, 4.0 + words / 90))
        feedback = "Good start. Add clearer development, examples, and more precise vocabulary."
    else:
        band = min(8.0, max(4.0, 5.0 + words / 80))
        feedback = "Focus on fluency, topic development, pronunciation clarity, and fewer pauses."
    return {
        "task_id": task.get("id"),
        "skill": skill,
        "correct": None,
        "band": round(band * 2) / 2,
        "word_count": words,
        "feedback": feedback,
    }


def _deterministic_score(request: IeltsScoreRequest) -> dict[str, Any]:
    results = []
    skill_totals: dict[str, list[float]] = {}
    for index, task in enumerate(request.tasks):
        task_id = str(task.get("id") or index)
        result = _score_task(task, request.responses.get(task_id, request.responses.get(str(index), "")))
        results.append(result)
        skill_totals.setdefault(result["skill"], []).append(float(result["band"]))

    skill_bands = {
        skill: round((sum(values) / len(values)) * 2) / 2
        for skill, values in skill_totals.items()
        if values
    }
    overall = round((sum(skill_bands.values()) / max(len(skill_bands), 1)) * 2) / 2
    return {
        "overall_band": overall,
        "skill_bands": skill_bands,
        "results": results,
        "elapsed_seconds": request.elapsed_seconds,
        "recommendation": "Review the lowest skill band first, then retake a focused mini mock.",
    }


def score_ielts_attempt(request: IeltsScoreRequest) -> AiResponse:
    deterministic = _deterministic_score(request)
    if not request.use_ai_feedback:
        return AiResponse(
            provider="local",
            model="deterministic-ielts-score",
            operation="score",
            output="Deterministic IELTS scoring completed.",
            data=deterministic,
            usage={
                "user_id": request.user_id,
                "feature": "ielts_score",
                "operation": "score",
                "cache_hit": False,
                "input_chars": len(str(request.tasks)) + len(str(request.responses)),
                "output_chars": len(str(deterministic)),
                "estimated_input_tokens": 0,
                "estimated_output_tokens": 0,
                "estimated_cost_units": 0,
            },
        )

    response = ai_score(
        AiScoreRequest(
            user_id=request.user_id,
            feature="ielts_score",
            submission=f"IELTS tasks and learner responses:\n{request.model_dump()}\n\nLocal scoring:\n{deterministic}",
            rubric={
                "task": "ielts_mock_band_estimation",
                "criteria": [
                    "IELTS band accuracy",
                    "skill-specific strengths",
                    "skill-specific weaknesses",
                    "next practice plan",
                ],
            },
            max_score=9,
        )
    )
    return response.model_copy(update={"data": deterministic})


def analyze_ielts_attempt(request: IeltsAnalyzeRequest) -> AiResponse:
    local = {
        "weak_skills": [
            skill
            for skill, value in (request.skill_results or {}).items()
            if isinstance(value, (int, float)) and value < 6.0
        ],
        "recommendations": [
            "Practice one weak IELTS skill before a full mock.",
            "Use Writing and Speaking pages for deeper AI feedback.",
            "Track band estimates over time instead of judging one attempt alone.",
        ],
        "recent_attempt_count": len(request.recent_attempts),
    }
    if not request.use_ai_feedback:
        return AiResponse(
            provider="local",
            model="deterministic-ielts-analysis",
            operation="generate",
            output="Deterministic IELTS analysis completed.",
            data=local,
            usage={
                "user_id": request.user_id,
                "feature": "ielts_analyze",
                "operation": "generate",
                "cache_hit": False,
                "input_chars": len(str(request.model_dump())),
                "output_chars": len(str(local)),
                "estimated_input_tokens": 0,
                "estimated_output_tokens": 0,
                "estimated_cost_units": 0,
            },
        )

    response = ai_generate(
        AiGenerateRequest(
            user_id=request.user_id,
            feature="ielts_analyze",
            response_format="json",
            temperature=0.25,
            prompt=f"Attempt:\n{request.attempt}\n\nSkill results:\n{request.skill_results}\n\nRecent attempts:\n{request.recent_attempts}",
            instruction=(
                "Analyze IELTS performance. Return JSON with overall_band_explanation, weak_skills, "
                "skill_feedback, recommended_drills, next_mock_strategy, and 7_day_plan."
            ),
        )
    )
    return response.model_copy(update={"data": local})
