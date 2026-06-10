from typing import Any

from fastapi import APIRouter

from app.core.ai_client import ai_service_request

router = APIRouter()


@router.post("/transcribe")
def transcribe(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/dictation/transcribe", body)


@router.post("/segment")
def segment(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/dictation/segment", body)


@router.post("/score")
def score(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/dictation/score", body)
