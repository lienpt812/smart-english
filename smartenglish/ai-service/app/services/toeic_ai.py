import json
import re
from typing import Any

from app.schemas.ai_core import AiGenerateRequest, AiResponse, AiScoreRequest
from app.schemas.toeic import ToeicAnalyzeRequest, ToeicGenerateRequest, ToeicScoreRequest
from app.services.ai_core import ai_generate, ai_score


PART_NAMES = {
    1: "Photographs",
    2: "Question-Response",
    3: "Conversations",
    4: "Talks",
    5: "Incomplete Sentences",
    6: "Text Completion",
    7: "Reading Comprehension",
}


def _parse_json_output(output: str) -> dict[str, Any] | None:
    text = output.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"\s*```$", "", text).strip()
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        return None


def _normalize_generated_test(value: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    questions = value.get("questions")
    if not isinstance(questions, list) or not questions:
        return fallback

    normalized_questions: list[dict[str, Any]] = []
    for index, raw_question in enumerate(questions):
        if not isinstance(raw_question, dict):
            continue
        part = int(raw_question.get("part") or fallback["questions"][index % len(fallback["questions"])]["part"])
        choices = raw_question.get("choices")
        if not isinstance(choices, list) or len(choices) < 2:
            continue
        answer = raw_question.get("answer") if isinstance(raw_question.get("answer"), dict) else {}
        correct_index = int(answer.get("correctIndex", answer.get("correct_index", 0)) or 0)
        normalized_questions.append(
            {
                "id": str(raw_question.get("id") or f"toeic-ai-{part}-{index + 1}"),
                "section": raw_question.get("section") or _part_section(part),
                "part": part,
                "part_name": raw_question.get("part_name") or PART_NAMES.get(part, f"Part {part}"),
                "question_number": int(raw_question.get("question_number") or index + 1),
                "prompt": str(raw_question.get("prompt") or "").strip(),
                "choices": [str(choice).strip() for choice in choices if str(choice).strip()],
                "answer": {"correctIndex": max(0, min(correct_index, len(choices) - 1))},
                "explanation": str(raw_question.get("explanation") or "").strip(),
                "difficulty": raw_question.get("difficulty") or fallback.get("difficulty"),
                "passage": raw_question.get("passage"),
                "audio_script": raw_question.get("audio_script"),
                "image_description": raw_question.get("image_description"),
            }
        )

    if not normalized_questions:
        return fallback

    return {
        **fallback,
        **{key: value.get(key) for key in ["title", "mode", "duration_minutes"] if value.get(key) is not None},
        "questions": normalized_questions,
        "question_count": len(normalized_questions),
    }


def _part_section(part: int) -> str:
    return "listening" if part <= 4 else "reading"


def _fallback_questions(request: ToeicGenerateRequest) -> list[dict[str, Any]]:
    parts = request.parts or ([1, 2, 3, 4] if request.section == "listening" else [5, 6, 7])
    if request.section:
      parts = [part for part in parts if _part_section(part) == request.section] or parts

    questions: list[dict[str, Any]] = []
    for index in range(request.question_count):
        part = parts[index % len(parts)]
        section = _part_section(part)
        question_id = f"toeic-{part}-{index + 1}"
        if part == 5:
            prompt = "The marketing team will submit the final report _____ Friday."
            choices = ["by", "at", "of", "for"]
            explanation = "'By Friday' means no later than Friday."
        elif part == 6:
            prompt = "Choose the best phrase to complete the business email: We appreciate your _____ response."
            choices = ["prompt", "promptly", "prompted", "promptness"]
            explanation = "An adjective is needed before 'response', so 'prompt' is correct."
        elif part == 7:
            prompt = "According to the notice, why should employees update their contact information?"
            choices = [
                "To receive emergency alerts",
                "To apply for a promotion",
                "To change their work schedule",
                "To order office supplies",
            ]
            explanation = "The notice asks for updated details so emergency alerts can reach employees."
        elif part == 1:
            prompt = "Select the statement that best describes the picture."
            choices = [
                "A woman is typing at a desk.",
                "A man is boarding a train.",
                "Several boxes are stacked outdoors.",
                "A car is being repaired.",
            ]
            explanation = "The correct statement should match the visual scene."
        elif part == 2:
            prompt = "Where is the nearest conference room?"
            choices = ["On the second floor.", "At three o'clock.", "Yes, it is confirmed.", "For the sales team."]
            explanation = "A where-question needs a location answer."
        elif part == 3:
            prompt = "What are the speakers mainly discussing?"
            choices = ["A meeting schedule", "A restaurant menu", "A travel delay", "A product refund"]
            explanation = "The dialogue context points to arranging a meeting."
        else:
            prompt = "What is the purpose of the announcement?"
            choices = ["To introduce a policy change", "To advertise a concert", "To cancel a shipment", "To hire a designer"]
            explanation = "The talk announces a workplace policy update."

        questions.append(
            {
                "id": question_id,
                "section": section,
                "part": part,
                "part_name": PART_NAMES[part],
                "question_number": index + 1,
                "prompt": prompt,
                "choices": choices,
                "answer": {"correctIndex": 0},
                "explanation": explanation,
                "difficulty": request.difficulty,
                "passage": (
                    "Company Notice: Please update your contact information by Friday "
                    "so the HR team can send emergency alerts."
                    if part == 7
                    else None
                ),
                "audio_script": (
                    "Where is the nearest conference room? It is on the second floor."
                    if section == "listening"
                    else None
                ),
            }
        )
    return questions


def generate_toeic_test(request: ToeicGenerateRequest) -> AiResponse:
    fallback = {
        "title": f"TOEIC {request.mode.title()} Practice",
        "mode": request.mode,
        "topic": request.topic or "workplace English",
        "target_score": request.target_score,
        "question_count": request.question_count,
        "questions": _fallback_questions(request),
    }
    if not request.use_ai_generation:
        return AiResponse(
            provider="local",
            model="deterministic-toeic-generator",
            operation="generate",
            output="Deterministic TOEIC practice generated.",
            data=fallback,
            usage={
                "user_id": request.user_id,
                "feature": "toeic_generate",
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
            feature="toeic_generate",
            response_format="json",
            temperature=0.35,
            prompt=(
                f"Mode: {request.mode}\n"
                f"Section: {request.section or 'mixed'}\n"
                f"Parts: {request.parts}\n"
                f"Question count: {request.question_count}\n"
                f"Difficulty: {request.difficulty}\n"
                f"Topic: {request.topic or 'workplace English'}\n"
                f"Target score: {request.target_score or 'unknown'}\n"
                f"Variation seed: {request.variation_seed or 'none'}\n"
                "Create a fresh set. Do not reuse the same wording, names, company names, passages, "
                "or answer choices from previous generations."
            ),
            instruction=(
                "Generate a TOEIC practice test in ETS-like structure without copying real ETS content. "
                "Return JSON with title, mode, duration_minutes, questions. Each question must include "
                "id, section, part, part_name, question_number, prompt, choices, answer.correctIndex, "
                "explanation, difficulty, and optional passage/audio_script/image_description. Make every "
                "question unique within this test. For Part 6 and Part 7, include realistic business passages. "
                "For Listening parts, include audio_script. Keep answer choices plausible and avoid duplicate stems."
            ),
            use_cache=False,
        )
    )
    parsed = _parse_json_output(response.output)
    generated = _normalize_generated_test(parsed, fallback) if parsed else fallback
    return response.model_copy(update={"data": generated})


def _answer_index(value: Any) -> str:
    if isinstance(value, dict):
        value = value.get("choiceIndex", value.get("correctIndex", value.get("value", "")))
    return str(value).strip().lower()


def _score_questions(request: ToeicScoreRequest) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    section_counts = {"listening": {"correct": 0, "total": 0}, "reading": {"correct": 0, "total": 0}}
    part_counts: dict[str, dict[str, int]] = {}

    for index, question in enumerate(request.questions):
        question_id = str(question.get("id") or index)
        expected = question.get("answer", {}).get("correctIndex", "")
        response = request.responses.get(question_id, request.responses.get(str(index), ""))
        correct = _answer_index(expected) == _answer_index(response)
        section = str(question.get("section") or _part_section(int(question.get("part") or 5)))
        part = str(question.get("part") or "unknown")
        section_counts.setdefault(section, {"correct": 0, "total": 0})
        part_counts.setdefault(part, {"correct": 0, "total": 0})
        section_counts[section]["total"] += 1
        part_counts[part]["total"] += 1
        if correct:
            section_counts[section]["correct"] += 1
            part_counts[part]["correct"] += 1
        results.append(
            {
                "question_id": question_id,
                "section": section,
                "part": int(question.get("part") or 0),
                "correct": correct,
                "response": response,
                "expected": expected,
                "explanation": question.get("explanation"),
            }
        )

    total = max(len(request.questions), 1)
    correct_total = sum(1 for item in results if item["correct"])
    percent = round(correct_total / total * 100, 2)
    listening_percent = (
        round(section_counts["listening"]["correct"] / section_counts["listening"]["total"] * 100, 2)
        if section_counts["listening"]["total"]
        else 0
    )
    reading_percent = (
        round(section_counts["reading"]["correct"] / section_counts["reading"]["total"] * 100, 2)
        if section_counts["reading"]["total"]
        else 0
    )
    estimated_score = max(10, min(990, int(round(percent / 100 * 990 / 5) * 5)))
    return {
        "score": estimated_score,
        "percent": percent,
        "correct_count": correct_total,
        "question_count": total,
        "listening_percent": listening_percent,
        "reading_percent": reading_percent,
        "section_breakdown": section_counts,
        "part_breakdown": part_counts,
        "elapsed_seconds": request.elapsed_seconds,
        "results": results,
    }


def score_toeic_attempt(request: ToeicScoreRequest) -> AiResponse:
    deterministic = _score_questions(request)
    if not request.use_ai_feedback:
        return AiResponse(
            provider="local",
            model="deterministic-toeic-score",
            operation="score",
            output="Deterministic TOEIC scoring completed.",
            data=deterministic,
            usage={
                "user_id": request.user_id,
                "feature": "toeic_score",
                "operation": "score",
                "cache_hit": False,
                "input_chars": len(str(request.questions)) + len(str(request.responses)),
                "output_chars": len(str(deterministic)),
                "estimated_input_tokens": 0,
                "estimated_output_tokens": 0,
                "estimated_cost_units": 0,
            },
        )

    response = ai_score(
        AiScoreRequest(
            user_id=request.user_id,
            feature="toeic_score",
            submission=f"TOEIC questions and learner answers:\n{request.model_dump()}\n\nLocal scoring:\n{deterministic}",
            rubric={
                "task": "toeic_practice_analysis",
                "criteria": [
                    "accuracy by TOEIC part",
                    "listening vs reading balance",
                    "common distractor patterns",
                    "next practice recommendation",
                ],
            },
            max_score=990,
        )
    )
    return response.model_copy(update={"data": deterministic})


def analyze_toeic_attempt(request: ToeicAnalyzeRequest) -> AiResponse:
    local = {
        "weak_parts": [
            str(item.get("part"))
            for item in request.question_results
            if item.get("correct") is False and item.get("part") is not None
        ][:5],
        "recommendations": [
            "Review explanations for missed questions.",
            "Practice one weak TOEIC part before taking another timed set.",
            "Track listening and reading separately to avoid hiding skill gaps.",
        ],
        "recent_attempt_count": len(request.recent_attempts),
    }
    if not request.use_ai_feedback:
        return AiResponse(
            provider="local",
            model="deterministic-toeic-analysis",
            operation="generate",
            output="Deterministic TOEIC analysis completed.",
            data=local,
            usage={
                "user_id": request.user_id,
                "feature": "toeic_analyze",
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
            feature="toeic_analyze",
            response_format="json",
            temperature=0.25,
            prompt=f"Attempt:\n{request.attempt}\n\nQuestion results:\n{request.question_results}\n\nRecent attempts:\n{request.recent_attempts}",
            instruction=(
                "Analyze TOEIC performance. Return JSON with estimated_score_explanation, weak_parts, "
                "error_patterns, recommended_drills, next_test_strategy, and 7_day_plan."
            ),
        )
    )
    return response.model_copy(update={"data": local})
