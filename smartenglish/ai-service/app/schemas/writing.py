from typing import Any

from pydantic import BaseModel, Field


class WritingGradeRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    prompt: str = Field(min_length=1, max_length=6000)
    content: str = Field(min_length=1, max_length=50000)
    task_type: str = Field(default="essay", max_length=80)
    learner_level: str | None = Field(default=None, max_length=8)
    rubric: dict[str, Any] = Field(default_factory=dict)
    max_score: float = Field(default=100, gt=0)
    use_ai_feedback: bool = True
