import json
import re
from typing import Any

from app.schemas.ai_core import AiGenerateRequest, AiResponse
from app.schemas.roadmap import RoadmapGenerateRequest, RoadmapUpdateRequest
from app.services.ai_core import ai_generate


SKILLS = ["listening", "speaking", "reading", "writing"]


def _weak_skills(skill_scores: dict[str, Any], learning_errors: list[dict[str, Any]]) -> list[str]:
    scored = []
    for skill in SKILLS:
        try:
            scored.append((skill, float(skill_scores.get(skill, 0) or 0)))
        except (TypeError, ValueError):
            scored.append((skill, 0))
    error_counts: dict[str, int] = {}
    for item in learning_errors:
        skill = str(item.get("skill") or "").lower()
        if skill in SKILLS:
            error_counts[skill] = error_counts.get(skill, 0) + int(item.get("occurrences") or 1)
    scored.sort(key=lambda item: (item[1], -error_counts.get(item[0], 0)))
    return [skill for skill, _ in scored[:2]]


def _fallback_plan(request: RoadmapGenerateRequest) -> dict[str, Any]:
    target = request.target_cert or request.profile.get("target_cert") or "GENERAL"
    level = request.profile.get("level") or "B1"
    weak = _weak_skills(request.skill_scores, request.learning_errors)
    weeks = []
    for week in range(1, request.target_weeks + 1):
        focus = weak[(week - 1) % max(len(weak), 1)] if weak else SKILLS[(week - 1) % len(SKILLS)]
        weeks.append(
            {
                "week": week,
                "title": f"Week {week}: strengthen {focus}",
                "focus_skill": focus,
                "goal": f"Move {focus} practice from awareness to consistent output.",
                "tasks": [
                    {"type": "practice", "label": f"Complete 2 focused {focus} sessions", "minutes": 40},
                    {"type": "review", "label": "Review saved errors and convert useful items to flashcards", "minutes": 20},
                    {"type": "mock", "label": f"Take one short {target} checkpoint", "minutes": 30},
                ],
                "milestone": f"Finish a timed {focus} task with clear review notes.",
            }
        )
    return {
        "title": f"{target} roadmap from {level}",
        "target_cert": target,
        "starting_level": level,
        "target_weeks": request.target_weeks,
        "weak_skills": weak,
        "strategy": "Use short focused practice blocks, then recycle mistakes into SRS and weekly checkpoints.",
        "weeks": weeks,
        "success_metrics": [
            "Study at least 4 days per week",
            "Complete one mock checkpoint per week",
            "Reduce repeated learning errors in the weakest skills",
        ],
    }


def _with_default_task_status(plan: dict[str, Any]) -> dict[str, Any]:
    weeks = plan.get("weeks")
    if not isinstance(weeks, list):
        return plan
    for week in weeks:
        if not isinstance(week, dict):
            continue
        tasks = week.get("tasks")
        if not isinstance(tasks, list):
            continue
        for task in tasks:
            if isinstance(task, dict):
                task["status"] = task.get("status") or "not_started"
    return plan


def _parse_json_output(output: str) -> dict[str, Any] | None:
    text = output.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"\s*```$", "", text).strip()
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        return None


def generate_roadmap(request: RoadmapGenerateRequest) -> AiResponse:
    fallback = _with_default_task_status(_fallback_plan(request))
    if not request.use_ai_generation:
        return AiResponse(
            provider="local",
            model="deterministic-roadmap-planner",
            operation="generate",
            output="Deterministic learning roadmap generated.",
            data=fallback,
            usage={
                "user_id": request.user_id,
                "feature": "roadmap_generate",
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
            feature="roadmap_generate",
            response_format="json",
            temperature=0.35,
            prompt=(
                f"Profile:\n{request.profile}\n\n"
                f"Skill scores:\n{request.skill_scores}\n\n"
                f"Recent activity:\n{request.recent_activity}\n\n"
                f"Learning errors:\n{request.learning_errors}\n\n"
                f"Target weeks: {request.target_weeks}\n"
                f"Target certificate: {request.target_cert or request.profile.get('target_cert') or 'general'}\n\n"
                "Use the learner's real level, goal, weak skills, errors, and recent activity. If data is sparse, "
                "make reasonable starter assumptions and say that in the strategy."
            ),
            instruction=(
                "Create a personalized English learning roadmap that is practical, learner-specific, and achievable "
                "within the requested number of weeks. Return strict JSON with title, target_cert, starting_level, "
                "target_weeks, weak_skills, strategy, weeks, and success_metrics. Each week must include week, title, "
                "focus_skill, goal, tasks, and milestone. Each task must include type, label, minutes, and status. "
                "Set every new task status to not_started. Use 20-60 minute tasks, avoid vague advice, match the "
                "learner's available timeline, and make the workload realistic for steady weekly progress. Prioritize "
                "the learner's target certificate, current level, recurring errors, scores, and actual recent activity."
            ),
        )
    )
    data = _parse_json_output(response.output) or fallback
    return response.model_copy(update={"data": _with_default_task_status(data)})


def update_roadmap(request: RoadmapUpdateRequest) -> AiResponse:
    current = request.current_plan or {}
    data = {
        **current,
        "update_note": "Roadmap refreshed with the latest activity snapshot.",
        "progress_snapshot": request.progress_snapshot,
    }
    if not request.use_ai_generation:
        return AiResponse(
            provider="local",
            model="deterministic-roadmap-updater",
            operation="generate",
            output="Deterministic roadmap update completed.",
            data=data,
            usage={
                "user_id": request.user_id,
                "feature": "roadmap_update",
                "operation": "generate",
                "cache_hit": False,
                "input_chars": len(str(request.model_dump())),
                "output_chars": len(str(data)),
                "estimated_input_tokens": 0,
                "estimated_output_tokens": 0,
                "estimated_cost_units": 0,
            },
        )

    response = ai_generate(
        AiGenerateRequest(
            user_id=request.user_id,
            feature="roadmap_update",
            response_format="json",
            temperature=0.25,
            prompt=f"Current plan:\n{current}\n\nProgress snapshot:\n{request.progress_snapshot}\n\nNew activity:\n{request.new_activity}",
            instruction=(
                "Refresh this roadmap based on new activity. Preserve useful goals, adjust weak-skill focus, "
                "and return the same roadmap JSON shape plus update_note."
            ),
        )
    )
    return response.model_copy(update={"data": data})
