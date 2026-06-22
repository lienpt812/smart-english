from fastapi import APIRouter

from app.schemas.ai_core import AiResponse
from app.schemas.roadmap import RoadmapGenerateRequest, RoadmapUpdateRequest
from app.services.roadmap_ai import generate_roadmap, update_roadmap

router = APIRouter(prefix="/ai/roadmap", tags=["AI Roadmap"])


@router.post("/generate", response_model=AiResponse)
def generate(request: RoadmapGenerateRequest) -> AiResponse:
    return generate_roadmap(request)


@router.post("/update", response_model=AiResponse)
def update(request: RoadmapUpdateRequest) -> AiResponse:
    return update_roadmap(request)
