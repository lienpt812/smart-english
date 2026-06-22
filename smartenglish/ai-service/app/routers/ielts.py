from fastapi import APIRouter

from app.schemas.ai_core import AiResponse
from app.schemas.ielts import IeltsAnalyzeRequest, IeltsGenerateRequest, IeltsScoreRequest
from app.services.ielts_ai import analyze_ielts_attempt, generate_ielts_mock, score_ielts_attempt

router = APIRouter(prefix="/ai/ielts", tags=["IELTS AI"])


@router.post("/generate", response_model=AiResponse)
def generate(request: IeltsGenerateRequest) -> AiResponse:
    return generate_ielts_mock(request)


@router.post("/score", response_model=AiResponse)
def score(request: IeltsScoreRequest) -> AiResponse:
    return score_ielts_attempt(request)


@router.post("/analyze", response_model=AiResponse)
def analyze(request: IeltsAnalyzeRequest) -> AiResponse:
    return analyze_ielts_attempt(request)
