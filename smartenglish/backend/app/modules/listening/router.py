from typing import Any

from fastapi import APIRouter

from app.core.ai_client import ai_service_request

router = APIRouter()


@router.post("/dialogue")
def dialogue(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/listening/dialogue", body)


@router.post("/quiz")
def quiz(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/listening/quiz", body)


@router.post("/score")
def score(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/listening/score", body)


@router.post("/audio")
def audio(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/listening/audio", body)
