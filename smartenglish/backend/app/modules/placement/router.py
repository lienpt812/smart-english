import json
import re
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.ai_client import ai_service_request

router = APIRouter()

TargetCert = Literal["TOEIC", "IELTS", "COMMUNICATION"]
QuestionSkill = Literal["grammar", "vocabulary", "reading"]


class PlacementGenerateRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    target_cert: TargetCert = "TOEIC"
    preferred_level: str | None = Field(default=None, max_length=8)
    question_count: int = Field(default=10, ge=6, le=20)


class PlacementQuestion(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    skill: QuestionSkill
    prompt: str = Field(min_length=1, max_length=2000)
    choices: list[str] = Field(min_length=4, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    explanation: str = Field(default="", max_length=1000)


class PlacementSubmitRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    target_cert: TargetCert = "TOEIC"
    questions: list[PlacementQuestion] = Field(min_length=1, max_length=20)
    answers: dict[str, int] = Field(default_factory=dict)


def _extract_json_object(text: str) -> dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
      pass

    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fenced:
        return json.loads(fenced.group(1))

    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        return json.loads(text[start : end + 1])

    raise ValueError("AI response did not contain a JSON object.")


def _normalize_questions(raw_questions: Any, question_count: int) -> list[dict[str, Any]]:
    if not isinstance(raw_questions, list):
        raise ValueError("AI response field `questions` must be a list.")

    normalized: list[dict[str, Any]] = []
    for index, item in enumerate(raw_questions[:question_count], start=1):
        if not isinstance(item, dict):
            continue
        question = PlacementQuestion(
            id=str(item.get("id") or f"q{index}"),
            skill=item.get("skill") if item.get("skill") in {"grammar", "vocabulary", "reading"} else "grammar",
            prompt=str(item.get("prompt") or ""),
            choices=[str(choice) for choice in item.get("choices", [])],
            correct_index=int(item.get("correct_index", item.get("correctIndex", 0))),
            explanation=str(item.get("explanation") or ""),
        )
        normalized.append(question.model_dump())

    if len(normalized) < 6:
        raise ValueError("AI response did not include enough valid placement questions.")

    return normalized


def _level_from_score(percent: float) -> str:
    if percent < 20:
        return "A1"
    if percent < 38:
        return "A2"
    if percent < 58:
        return "B1"
    if percent < 76:
        return "B2"
    if percent < 90:
        return "C1"
    return "C2"


@router.post("/generate")
def generate_placement(body: PlacementGenerateRequest) -> dict:
    prompt = f"""
Create a short English placement test for SmartEnglish.

Learner target: {body.target_cert}
Preferred starting level: {body.preferred_level or "unknown"}
Question count: {body.question_count}

Return only valid JSON with this exact shape:
{{
  "title": "string",
  "estimated_minutes": number,
  "instructions": "string",
  "questions": [
    {{
      "id": "q1",
      "skill": "grammar" | "vocabulary" | "reading",
      "prompt": "question text",
      "choices": ["A", "B", "C", "D"],
      "correct_index": 0,
      "explanation": "short explanation"
    }}
  ]
}}

Use a balanced CEFR range from A1 to C1, avoid trick questions, and make the
questions appropriate for Vietnamese learners preparing for {body.target_cert}.
""".strip()

    response = ai_service_request(
        "POST",
        "/ai/generate",
        {
            "user_id": body.user_id,
            "feature": "placement_test_generate",
            "temperature": 0.5,
            "use_cache": False,
            "response_format": "json",
            "instruction": "Return strict JSON only.",
            "prompt": prompt,
        },
    )

    try:
        parsed = _extract_json_object(response.get("output", ""))
        questions = _normalize_questions(parsed.get("questions"), body.question_count)
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "PLACEMENT_AI_BAD_RESPONSE",
                "message": "AI did not return a valid placement test.",
                "error": str(exc),
            },
        ) from exc

    return {
        "title": parsed.get("title") or f"{body.target_cert} Placement Test",
        "estimatedMinutes": int(parsed.get("estimated_minutes") or 10),
        "instructions": parsed.get("instructions") or "Choose the best answer for each question.",
        "questions": questions,
        "provider": response.get("provider"),
        "model": response.get("model"),
    }


@router.post("/submit")
def submit_placement(body: PlacementSubmitRequest) -> dict:
    total = len(body.questions)
    correct = 0
    breakdown = {"grammar": {"correct": 0, "total": 0}, "vocabulary": {"correct": 0, "total": 0}, "reading": {"correct": 0, "total": 0}}
    review: list[dict[str, Any]] = []

    for question in body.questions:
        answer = body.answers.get(question.id)
        is_correct = answer == question.correct_index
        if is_correct:
            correct += 1
            breakdown[question.skill]["correct"] += 1
        breakdown[question.skill]["total"] += 1
        review.append(
            {
                "id": question.id,
                "skill": question.skill,
                "correct": is_correct,
                "selectedIndex": answer,
                "correctIndex": question.correct_index,
                "explanation": question.explanation,
            }
        )

    percent = round((correct / total) * 100, 1) if total else 0
    level = _level_from_score(percent)

    return {
        "level": level,
        "score": correct,
        "total": total,
        "percent": percent,
        "targetCert": body.target_cert,
        "breakdown": breakdown,
        "review": review,
        "recommendation": (
            f"Current estimated level: {level}. Use this as the starting level "
            f"for {body.target_cert} practice and update it after more submissions."
        ),
    }
