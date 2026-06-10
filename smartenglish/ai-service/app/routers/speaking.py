from fastapi import APIRouter

from app.schemas.ai_core import AiResponse
from app.schemas.speaking import SpeakingDrillRequest, SpeakingEvaluateRequest, SpeakingRoleplayRequest
from app.services.speaking_ai import (
    evaluate_speaking,
    generate_pronunciation_drill,
    roleplay_turn,
)

router = APIRouter(prefix="/ai/speaking", tags=["Speaking AI"])


@router.post("/evaluate", response_model=AiResponse)
def evaluate(request: SpeakingEvaluateRequest) -> AiResponse:
    return evaluate_speaking(request)


@router.post("/roleplay", response_model=AiResponse)
def roleplay(request: SpeakingRoleplayRequest) -> AiResponse:
    return roleplay_turn(request)


@router.post("/drill", response_model=AiResponse)
def drill(request: SpeakingDrillRequest) -> AiResponse:
    return generate_pronunciation_drill(request)
