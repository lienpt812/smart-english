from fastapi import FastAPI

from app.core.config import settings
from app.routers.ai_core import router as ai_core_router
from app.routers.dictation import router as dictation_router
from app.routers.flashcards import router as flashcards_router
from app.routers.listening import router as listening_router
from app.routers.reading import router as reading_router
from app.routers.shadowing import router as shadowing_router
from app.routers.speaking import router as speaking_router
from app.routers.writing import router as writing_router

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
            "textProvider": settings.ai_text_provider,
            "sttProvider": settings.ai_stt_provider,
            "audioProvider": settings.ai_audio_provider,
            "geminiConfigured": bool(settings.gemini_api_key),
            "groqConfigured": bool(settings.groq_api_key),
        },
    }


@app.get("/version")
def version() -> dict:
    return {
        "name": "smartenglish-ai-service",
        "version": "0.2.0-m3-ai-core",
        "providers": {
            "text": settings.ai_text_provider,
            "stt": settings.ai_stt_provider,
            "audio": settings.ai_audio_provider,
        },
        "models": {
            "gemini": settings.gemini_model,
            "geminiAudio": settings.gemini_audio_model,
            "groqWhisper": settings.groq_whisper_model,
        },
    }


@app.get("/ai/health")
def ai_health() -> dict:
    return {
        "ok": True,
        "providers": {
            "text": settings.ai_text_provider,
            "stt": settings.ai_stt_provider,
            "audio": settings.ai_audio_provider,
        },
        "models": {
            "gemini": settings.gemini_model,
            "geminiAudio": settings.gemini_audio_model,
            "groqWhisper": settings.groq_whisper_model,
        },
        "configured": {
            "gemini": bool(settings.gemini_api_key),
            "groq": bool(settings.groq_api_key),
        },
        "cacheTtlSeconds": settings.ai_cache_ttl_seconds,
        "dailyRequestLimit": settings.ai_daily_request_limit,
    }


app.include_router(ai_core_router)
app.include_router(dictation_router)
app.include_router(flashcards_router)
app.include_router(listening_router)
app.include_router(reading_router)
app.include_router(shadowing_router)
app.include_router(speaking_router)
app.include_router(writing_router)
