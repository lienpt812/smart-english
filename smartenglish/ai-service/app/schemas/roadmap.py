from typing import Any

from pydantic import BaseModel, Field


class RoadmapGenerateRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    profile: dict[str, Any] = Field(default_factory=dict)
    skill_scores: dict[str, Any] = Field(default_factory=dict)
    recent_activity: list[dict[str, Any]] = Field(default_factory=list, max_length=80)
    learning_errors: list[dict[str, Any]] = Field(default_factory=list, max_length=30)
    target_weeks: int = Field(default=4, ge=1, le=12)
    target_cert: str | None = Field(default=None, max_length=40)
    use_ai_generation: bool = True


class RoadmapUpdateRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    current_plan: dict[str, Any] = Field(default_factory=dict)
    progress_snapshot: dict[str, Any] = Field(default_factory=dict)
    new_activity: list[dict[str, Any]] = Field(default_factory=list, max_length=80)
    use_ai_generation: bool = True
