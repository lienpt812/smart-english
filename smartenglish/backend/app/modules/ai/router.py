from typing import Any

from fastapi import APIRouter

from app.core.ai_client import ai_service_request

router = APIRouter()


@router.get("/health")
def ai_health() -> dict:
    return ai_service_request("GET", "/ai/health")


@router.get("/usage/{user_id}")
def usage(user_id: str) -> dict:
    return ai_service_request("GET", f"/ai/usage/{user_id}")


@router.post("/chat")
def chat(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/chat", body)


@router.post("/generate")
def generate(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/generate", body)


@router.post("/score")
def score(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/score", body)


@router.post("/transcribe")
def transcribe(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/transcribe", body)
