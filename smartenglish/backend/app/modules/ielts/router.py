from typing import Any

from fastapi import APIRouter

from app.core.ai_client import ai_service_request

router = APIRouter()


@router.post("/generate")
def generate(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/ielts/generate", body)


@router.post("/score")
def score(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/ielts/score", body)


@router.post("/analyze")
def analyze(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/ielts/analyze", body)
