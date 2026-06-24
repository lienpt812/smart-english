from fastapi import APIRouter

from app.schemas.ai_core import AiResponse
from app.schemas.reading import (
    ReadingDifficultyRequest,
    ReadingExplainRequest,
    ReadingGenerateRequest,
    ReadingQuizRequest,
    ReadingSummarizeRequest,
)
from app.services.reading_ai import (
    assess_reading_difficulty,
    explain_vocabulary,
    generate_comprehension_quiz,
    generate_reading_passage,
    summarize_reading,
)

router = APIRouter(prefix="/ai/reading", tags=["Reading AI"])


@router.post("/explain", response_model=AiResponse)
def explain(request: ReadingExplainRequest) -> AiResponse:
    return explain_vocabulary(request)


@router.post("/quiz", response_model=AiResponse)
def quiz(request: ReadingQuizRequest) -> AiResponse:
    return generate_comprehension_quiz(request)


@router.post("/generate", response_model=AiResponse)
def generate(request: ReadingGenerateRequest) -> AiResponse:
    return generate_reading_passage(request)


@router.post("/summarize", response_model=AiResponse)
def summarize(request: ReadingSummarizeRequest) -> AiResponse:
    return summarize_reading(request)


@router.post("/difficulty", response_model=AiResponse)
def difficulty(request: ReadingDifficultyRequest) -> AiResponse:
    return assess_reading_difficulty(request)
