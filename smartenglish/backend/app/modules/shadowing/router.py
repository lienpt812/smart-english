from typing import Any

from fastapi import APIRouter

from app.core.ai_client import ai_service_request

router = APIRouter()


@router.post("/analyze")
def analyze(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/shadowing/analyze", body)
