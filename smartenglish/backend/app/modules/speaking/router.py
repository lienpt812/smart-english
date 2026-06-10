from typing import Any

from fastapi import APIRouter

from app.core.ai_client import ai_service_request

router = APIRouter()


@router.post("/evaluate")
def evaluate(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/speaking/evaluate", body)


@router.post("/roleplay")
def roleplay(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/speaking/roleplay", body)


@router.post("/drill")
def drill(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/speaking/drill", body)
