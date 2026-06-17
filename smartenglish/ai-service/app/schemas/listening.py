from typing import Any, Literal

from pydantic import BaseModel, Field


class ListeningDialogueRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    topic: str = Field(min_length=1, max_length=240)
    learner_level: str | None = Field(default=None, max_length=8)
    content_kind: Literal["dialogue", "monologue", "story", "lecture", "interview"] = "dialogue"
    duration_seconds: int = Field(default=90, ge=30, le=600)
    speaker_count: int = Field(default=2, ge=1, le=4)
    target_cert: str | None = Field(default=None, max_length=40)


class ListeningQuizRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    title: str = Field(default="Listening lesson", max_length=240)
    transcript: str = Field(min_length=1, max_length=60000)
    learner_level: str | None = Field(default=None, max_length=8)
    question_count: int = Field(default=5, ge=1, le=15)
    question_types: list[Literal["mcq", "true_false", "short_answer", "fill_blank"]] = Field(
        default_factory=lambda: ["mcq", "true_false"],
        max_length=4,
    )


class ListeningScoreRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    questions: list[dict[str, Any]] = Field(min_length=1, max_length=30)
    responses: dict[str, Any] = Field(default_factory=dict)
    use_ai_feedback: bool = True


class ListeningAudioRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    title: str = Field(default="Listening lesson", max_length=240)
    transcript: str = Field(min_length=1, max_length=60000)
    dialogue: list[dict[str, Any]] = Field(default_factory=list, max_length=80)
    voice: str | None = Field(default=None, max_length=80)
    speed: float = Field(default=1.0, ge=0.5, le=1.5)
    render_mode: Literal["gemini_tts", "web_speech"] = "gemini_tts"
