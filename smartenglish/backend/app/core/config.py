from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    api_public_url: str = "http://localhost:4000"
    ai_service_url: str = "http://localhost:4200"
    database_url: str = "postgresql://smartenglish:smartenglish@localhost:5432/smartenglish"
    redis_url: str = "redis://localhost:6379"
    frontend_url: str = "http://localhost:3000"
    google_client_id: str = ""
    jwt_secret: str = "change-me-dev-secret-min-16chars"
    jwt_access_expires_sec: int = 900
    jwt_refresh_expires_days: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
