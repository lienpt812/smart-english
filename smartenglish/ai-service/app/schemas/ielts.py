from typing import Any, Literal

from pydantic import BaseModel, Field


IeltsSkill = Literal["listening", "reading", "writing", "speaking"]
IeltsMode = Literal["mini", "skill", "full"]


class IeltsGenerateRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    mode: IeltsMode = "mini"
    skills: list[IeltsSkill] = Field(default_factory=lambda: ["reading", "writing"], max_length=4)
    question_count: int = Field(default=8, ge=1, le=80)
    task_type: str | None = Field(default=None, max_length=80)
    topic: str | None = Field(default=None, max_length=160)
    target_band: float | None = Field(default=None, ge=0, le=9)
    learner_level: str | None = Field(default=None, max_length=8)
    use_ai_generation: bool = True


class IeltsScoreRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    tasks: list[dict[str, Any]] = Field(min_length=1, max_length=100)
    responses: dict[str, Any] = Field(default_factory=dict)
    elapsed_seconds: int | None = Field(default=None, ge=0)
    use_ai_feedback: bool = True


class IeltsAnalyzeRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    attempt: dict[str, Any] = Field(default_factory=dict)
    skill_results: dict[str, Any] = Field(default_factory=dict)
    recent_attempts: list[dict[str, Any]] = Field(default_factory=list, max_length=20)
    use_ai_feedback: bool = True
