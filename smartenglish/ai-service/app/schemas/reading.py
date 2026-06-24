from typing import Literal

from pydantic import BaseModel, Field


class ReadingExplainRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    term: str = Field(min_length=1, max_length=120)
    sentence: str | None = Field(default=None, max_length=1000)
    passage_context: str | None = Field(default=None, max_length=6000)
    learner_level: str | None = Field(default=None, max_length=8)


class ReadingQuizRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    passage_title: str = Field(default="Reading passage", max_length=240)
    passage_body: str = Field(min_length=120, max_length=20000)
    learner_level: str | None = Field(default=None, max_length=8)
    question_count: int = Field(default=5, ge=1, le=12)
    question_type: Literal["mcq", "mixed"] = "mcq"


class ReadingGenerateRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    learner_level: str = Field(default="B1", max_length=8)
    topic: str = Field(default="daily life", min_length=2, max_length=80)
    word_count: int = Field(default=220, ge=120, le=650)
    question_count: int = Field(default=5, ge=1, le=10)


class ReadingSummarizeRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    passage_title: str = Field(default="Reading passage", max_length=240)
    passage_body: str = Field(min_length=120, max_length=20000)
    learner_level: str | None = Field(default=None, max_length=8)
    output_language: Literal["en", "vi", "mixed"] = "mixed"


class ReadingDifficultyRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    passage_title: str = Field(default="Reading passage", max_length=240)
    passage_body: str = Field(min_length=120, max_length=20000)
    learner_level: str | None = Field(default=None, max_length=8)
