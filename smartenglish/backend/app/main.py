from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import check_postgres, run_migrations
from app.core.redis import check_redis
from app.modules.ai.router import router as ai_router
from app.modules.auth.router import router as auth_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.dictation.router import router as dictation_router
from app.modules.flashcards.router import router as flashcards_router
from app.modules.listening.router import router as listening_router
from app.modules.placement.router import router as placement_router
from app.modules.reading.router import router as reading_router
from app.modules.shadowing.router import router as shadowing_router
from app.modules.speaking.router import router as speaking_router
from app.modules.toeic.router import router as toeic_router
from app.modules.users.router import router as users_router
from app.modules.writing.router import router as writing_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    yield


app = FastAPI(
    title="Smart English Backend API",
    version="0.4.0-ai-wrappers",
    description="Backend API modular monolith for SmartEnglish.",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    postgres = check_postgres()
    redis = check_redis()
    return {
        "ok": postgres and redis,
        "services": {
            "backendApi": True,
            "postgres": postgres,
            "redis": redis,
            "aiServiceUrl": settings.ai_service_url,
        },
    }


@app.get("/api/version")
def version() -> dict:
    return {
        "name": "smartenglish-backend-api",
        "architecture": "fastapi-modular-monolith",
        "version": "0.4.0-ai-wrappers",
        "aiServiceUrl": settings.ai_service_url,
    }


app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(users_router, prefix="/api/me", tags=["Users"])
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(ai_router, prefix="/api/ai", tags=["AI Core"])
app.include_router(flashcards_router, prefix="/api/flashcards", tags=["Flashcards"])
app.include_router(listening_router, prefix="/api/listening", tags=["Listening"])
app.include_router(placement_router, prefix="/api/placement", tags=["Placement"])
app.include_router(reading_router, prefix="/api/reading", tags=["Reading"])
app.include_router(dictation_router, prefix="/api/dictation", tags=["Dictation"])
app.include_router(shadowing_router, prefix="/api/shadowing", tags=["Shadowing"])
app.include_router(speaking_router, prefix="/api/speaking", tags=["Speaking"])
app.include_router(toeic_router, prefix="/api/toeic", tags=["TOEIC"])
app.include_router(writing_router, prefix="/api/writing", tags=["Writing"])
