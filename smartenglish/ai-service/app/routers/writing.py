from fastapi import APIRouter

from app.schemas.ai_core import AiResponse
from app.schemas.writing import WritingGradeRequest
from app.services.writing_ai import grade_writing

router = APIRouter(prefix="/ai/writing", tags=["Writing AI"])


@router.post("/grade", response_model=AiResponse)
def grade(request: WritingGradeRequest) -> AiResponse:
    return grade_writing(request)
