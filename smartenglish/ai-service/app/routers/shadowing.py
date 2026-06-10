from fastapi import APIRouter

from app.schemas.ai_core import AiResponse
from app.schemas.shadowing import ShadowingAnalyzeRequest
from app.services.shadowing_ai import analyze_shadowing

router = APIRouter(prefix="/ai/shadowing", tags=["Shadowing AI"])


@router.post("/analyze", response_model=AiResponse)
def analyze(request: ShadowingAnalyzeRequest) -> AiResponse:
    return analyze_shadowing(request)
