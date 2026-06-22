from fastapi import APIRouter

from app.schemas.ai_core import AiResponse
from app.schemas.toeic import ToeicAnalyzeRequest, ToeicGenerateRequest, ToeicScoreRequest
from app.services.toeic_ai import analyze_toeic_attempt, generate_toeic_test, score_toeic_attempt

router = APIRouter(prefix="/ai/toeic", tags=["TOEIC AI"])


@router.post("/generate", response_model=AiResponse)
def generate(request: ToeicGenerateRequest) -> AiResponse:
    return generate_toeic_test(request)


@router.post("/score", response_model=AiResponse)
def score(request: ToeicScoreRequest) -> AiResponse:
    return score_toeic_attempt(request)


@router.post("/analyze", response_model=AiResponse)
def analyze(request: ToeicAnalyzeRequest) -> AiResponse:
    return analyze_toeic_attempt(request)
