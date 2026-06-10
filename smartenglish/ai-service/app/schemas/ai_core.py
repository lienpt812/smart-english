from typing import Any, Literal

from pydantic import BaseModel, Field


AiOperation = Literal["chat", "generate", "score", "transcribe"]


class AiMessage(BaseModel):
    role: Literal["system", "user", "assistant"] = "user"
    content: str = Field(min_length=1, max_length=12000)


class AiRequestBase(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    feature: str = Field(default="core", max_length=80)
    temperature: float = Field(default=0.3, ge=0, le=2)
    use_cache: bool = True


class AiChatRequest(AiRequestBase):
    session_id: str | None = Field(default=None, max_length=128)
    system_prompt: str | None = Field(default=None, max_length=4000)
    messages: list[AiMessage] = Field(min_length=1, max_length=40)


class AiGenerateRequest(AiRequestBase):
    prompt: str = Field(min_length=1, max_length=24000)
    instruction: str | None = Field(default=None, max_length=4000)
    response_format: Literal["text", "json"] = "text"


class AiScoreRequest(AiRequestBase):
    submission: str = Field(min_length=1, max_length=24000)
    rubric: dict[str, Any] = Field(default_factory=dict)
    max_score: float = Field(default=100, gt=0)


class AiTranscribeRequest(AiRequestBase):
    media_url: str | None = Field(default=None, max_length=2048)
    audio_base64: str | None = Field(default=None, max_length=12_000_000)
    audio_mime_type: str | None = Field(default=None, max_length=120)
    prompt: str | None = Field(default=None, max_length=4000)


class AiUsage(BaseModel):
    user_id: str
    feature: str
    operation: AiOperation
    cache_hit: bool
    input_chars: int
    output_chars: int
    estimated_input_tokens: int
    estimated_output_tokens: int
    estimated_cost_units: float


class AiResponse(BaseModel):
    ok: bool = True
    provider: str
    model: str
    operation: AiOperation
    output: str
    data: dict[str, Any] = Field(default_factory=dict)
    usage: AiUsage
