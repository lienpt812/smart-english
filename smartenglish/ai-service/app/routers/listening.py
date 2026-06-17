from fastapi import APIRouter

from app.schemas.ai_core import AiResponse
from app.schemas.listening import (
    ListeningAudioRequest,
    ListeningDialogueRequest,
    ListeningQuizRequest,
    ListeningScoreRequest,
)
from app.services.listening_ai import (
    generate_active_listening_quiz,
    generate_listening_dialogue,
    prepare_listening_audio,
    score_active_listening,
)

router = APIRouter(prefix="/ai/listening", tags=["Listening AI"])


@router.post("/dialogue", response_model=AiResponse)
def dialogue(request: ListeningDialogueRequest) -> AiResponse:
    return generate_listening_dialogue(request)


@router.post("/quiz", response_model=AiResponse)
def quiz(request: ListeningQuizRequest) -> AiResponse:
    return generate_active_listening_quiz(request)


@router.post("/score", response_model=AiResponse)
def score(request: ListeningScoreRequest) -> AiResponse:
    return score_active_listening(request)


@router.post("/audio", response_model=AiResponse)
def audio(request: ListeningAudioRequest) -> AiResponse:
    return prepare_listening_audio(request)
