from pydantic import BaseModel, Field


class DictationTranscribeRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    media_url: str | None = Field(default=None, max_length=2048)
    audio_base64: str | None = Field(default=None, max_length=12_000_000)
    audio_mime_type: str | None = Field(default=None, max_length=120)
    language_code: str = Field(default="en", max_length=16)


class DictationSegmentRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    transcript: str = Field(min_length=1, max_length=60000)
    language_code: str = Field(default="en", max_length=16)


class DictationScoreRequest(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    expected_text: str = Field(min_length=1, max_length=4000)
    typed_text: str = Field(min_length=1, max_length=4000)
    use_ai_feedback: bool = True
