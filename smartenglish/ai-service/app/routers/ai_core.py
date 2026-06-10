from fastapi import APIRouter

from app.schemas.ai_core import (
    AiChatRequest,
    AiGenerateRequest,
    AiResponse,
    AiScoreRequest,
    AiTranscribeRequest,
)
from app.services.ai_core import (
    ai_chat,
    ai_generate,
    ai_score,
    ai_transcribe,
    usage_summary,
)

router = APIRouter(prefix="/ai", tags=["AI Core"])


@router.post("/chat", response_model=AiResponse)
def chat(request: AiChatRequest) -> AiResponse:
    return ai_chat(request)


@router.post("/generate", response_model=AiResponse)
def generate(request: AiGenerateRequest) -> AiResponse:
    return ai_generate(request)


@router.post("/score", response_model=AiResponse)
def score(request: AiScoreRequest) -> AiResponse:
    return ai_score(request)


@router.post("/transcribe", response_model=AiResponse)
def transcribe(request: AiTranscribeRequest) -> AiResponse:
    return ai_transcribe(request)


@router.get("/usage/{user_id}")
def usage(user_id: str) -> dict:
    return usage_summary(user_id)
