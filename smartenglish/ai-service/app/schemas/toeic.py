from typing import Any, Literal

from pydantic import BaseModel, Field


ToeicSection = Literal["listening", "reading"]
ToeicTestMode = Literal["mini", "section", "full"]


class ToeicGenerateRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    mode: ToeicTestMode = "mini"
    section: ToeicSection | None = None
    parts: list[int] = Field(default_factory=lambda: [5, 6, 7], max_length=7)
    question_count: int = Field(default=10, ge=1, le=100)
    difficulty: int = Field(default=2, ge=1, le=5)
    topic: str | None = Field(default=None, max_length=160)
    target_score: int | None = Field(default=None, ge=10, le=990)
    use_ai_generation: bool = True


class ToeicScoreRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    questions: list[dict[str, Any]] = Field(min_length=1, max_length=200)
    responses: dict[str, Any] = Field(default_factory=dict)
    elapsed_seconds: int | None = Field(default=None, ge=0)
    use_ai_feedback: bool = True


class ToeicAnalyzeRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    attempt: dict[str, Any] = Field(default_factory=dict)
    question_results: list[dict[str, Any]] = Field(default_factory=list, max_length=200)
    recent_attempts: list[dict[str, Any]] = Field(default_factory=list, max_length=20)
    use_ai_feedback: bool = True
