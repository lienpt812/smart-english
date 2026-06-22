from typing import Any

from fastapi import APIRouter

from app.core.ai_client import ai_service_request

router = APIRouter()


@router.post("/generate")
def generate(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/toeic/generate", body)


@router.post("/score")
def score(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/toeic/score", body)


@router.post("/analyze")
def analyze(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/toeic/analyze", body)
