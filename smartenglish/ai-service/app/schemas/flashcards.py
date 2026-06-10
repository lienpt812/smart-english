from typing import Literal

from pydantic import BaseModel, Field


class FlashcardGenerateRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    source_text: str = Field(min_length=1, max_length=20000)
    learner_level: str | None = Field(default=None, max_length=8)
    target_cert: str | None = Field(default=None, max_length=40)
    count: int = Field(default=10, ge=1, le=40)
    language_hint: Literal["en", "vi", "mixed"] = "mixed"
    include_image_prompts: bool = True
