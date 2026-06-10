from fastapi import APIRouter

from app.schemas.ai_core import AiResponse
from app.schemas.flashcards import FlashcardGenerateRequest
from app.services.flashcards_ai import generate_flashcards

router = APIRouter(prefix="/ai/flashcards", tags=["Flashcards AI"])


@router.post("/generate", response_model=AiResponse)
def generate(request: FlashcardGenerateRequest) -> AiResponse:
    return generate_flashcards(request)
