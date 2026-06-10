from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.ai_core import AiMessage


class SpeakingEvaluateRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    prompt: str = Field(min_length=1, max_length=6000)
    learner_transcript: str | None = Field(default=None, max_length=8000)
    recording_url: str | None = Field(default=None, max_length=2048)
    audio_base64: str | None = Field(default=None, max_length=12_000_000)
    audio_mime_type: str | None = Field(default=None, max_length=120)
    learner_level: str | None = Field(default=None, max_length=8)
    task_type: str = Field(default="short_answer", max_length=80)
    use_ai_feedback: bool = True


class SpeakingRoleplayRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    scenario: str = Field(min_length=1, max_length=4000)
    learner_level: str | None = Field(default=None, max_length=8)
    persona: str = Field(default="friendly English conversation partner", max_length=240)
    messages: list[AiMessage] = Field(default_factory=list, max_length=30)
    mode: Literal["coach", "conversation"] = "conversation"
