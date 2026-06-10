from typing import Any

from fastapi import APIRouter

from app.core.ai_client import ai_service_request

router = APIRouter()


@router.post("/generate")
def generate(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/flashcards/generate", body)
