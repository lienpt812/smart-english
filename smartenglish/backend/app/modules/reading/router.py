from typing import Any

from fastapi import APIRouter

from app.core.ai_client import ai_service_request

router = APIRouter()


@router.post("/explain")
def explain(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/reading/explain", body)


@router.post("/quiz")
def quiz(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/reading/quiz", body)


@router.post("/generate")
def generate(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/reading/generate", body)


@router.post("/summarize")
def summarize(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/reading/summarize", body)


@router.post("/difficulty")
def difficulty(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/reading/difficulty", body)
