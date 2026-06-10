from fastapi import APIRouter

from app.schemas.ai_core import AiResponse
from app.schemas.reading import ReadingExplainRequest, ReadingQuizRequest
from app.services.reading_ai import explain_vocabulary, generate_comprehension_quiz

router = APIRouter(prefix="/ai/reading", tags=["Reading AI"])


@router.post("/explain", response_model=AiResponse)
def explain(request: ReadingExplainRequest) -> AiResponse:
    return explain_vocabulary(request)


@router.post("/quiz", response_model=AiResponse)
def quiz(request: ReadingQuizRequest) -> AiResponse:
    return generate_comprehension_quiz(request)
