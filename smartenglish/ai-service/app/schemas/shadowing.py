from typing import Literal

from pydantic import BaseModel, Field


class ShadowingAnalyzeRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    reference_text: str = Field(min_length=1, max_length=4000)
    learner_transcript: str | None = Field(default=None, max_length=4000)
    recording_url: str | None = Field(default=None, max_length=2048)
    audio_base64: str | None = Field(default=None, max_length=12_000_000)
    audio_mime_type: str | None = Field(default=None, max_length=120)
    mode: Literal["script_visible", "script_hidden", "simultaneous"] = "script_visible"
    use_ai_feedback: bool = True
