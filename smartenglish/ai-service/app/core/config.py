from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Backward-compatible global provider. New code should prefer the
    # task-specific provider settings below.
    ai_provider: str = "gemini"

    ai_text_provider: str = "gemini"
    ai_stt_provider: str = "groq"
    ai_audio_provider: str = "gemini"

    gemini_api_key: str = ""
    gemini_api_keys: str = ""
    gemini_api_base: str = "https://generativelanguage.googleapis.com/v1beta"
    gemini_model: str = "gemini-2.5-flash"
    gemini_audio_model: str = "gemini-2.5-flash"

    groq_api_key: str = ""
    groq_api_base: str = "https://api.groq.com/openai/v1"
    groq_whisper_model: str = "whisper-large-v3-turbo"

    ai_cache_ttl_seconds: int = 3600
    ai_daily_request_limit: int = 100
    ai_request_timeout_seconds: int = 30
    redis_url: str = "redis://localhost:6379"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
