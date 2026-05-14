from fastapi import FastAPI

from app.core.config import settings

app = FastAPI(
    title="SmartEnglish AI Service",
    version="0.1.0",
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
        "version": "0.1.0",
        "provider": settings.ai_provider,
    }


@app.get("/ai/health")
def ai_health() -> dict:
    return {"ok": True}
