from fastapi import APIRouter

from app.schemas.ai_core import AiResponse
from app.schemas.dictation import (
    DictationScoreRequest,
    DictationSegmentRequest,
    DictationTranscribeRequest,
)
from app.services.dictation_ai import score_dictation, segment_transcript, transcribe_media

router = APIRouter(prefix="/ai/dictation", tags=["Dictation AI"])


@router.post("/transcribe", response_model=AiResponse)
def transcribe(request: DictationTranscribeRequest) -> AiResponse:
    return transcribe_media(request)


@router.post("/segment", response_model=AiResponse)
def segment(request: DictationSegmentRequest) -> AiResponse:
    return segment_transcript(request)


@router.post("/score", response_model=AiResponse)
def score(request: DictationScoreRequest) -> AiResponse:
    return score_dictation(request)
