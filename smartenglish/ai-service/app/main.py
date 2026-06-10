from fastapi import FastAPI

from app.core.config import settings
from app.routers.ai_core import router as ai_core_router
from app.routers.dictation import router as dictation_router
from app.routers.reading import router as reading_router

app = FastAPI(
    title="SmartEnglish AI Service",
    version="0.2.0-m3-ai-core",
    description="Dedicated AI boundary for prompts, provider calls, quota, and cost tracking.",
)


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "services": {
            "aiService": True,
            "provider": settings.ai_provider,
            "configured": bool(settings.gemini_api_key),
        },
    }


@app.get("/version")
def version() -> dict:
    return {
        "name": "smartenglish-ai-service",
        "version": "0.2.0-m3-ai-core",
        "provider": settings.ai_provider,
        "model": settings.gemini_model,
    }


@app.get("/ai/health")
def ai_health() -> dict:
    return {
        "ok": True,
        "provider": settings.ai_provider,
        "model": settings.gemini_model,
        "configured": bool(settings.gemini_api_key),
        "cacheTtlSeconds": settings.ai_cache_ttl_seconds,
        "dailyRequestLimit": settings.ai_daily_request_limit,
    }


app.include_router(ai_core_router)
app.include_router(dictation_router)
app.include_router(reading_router)
