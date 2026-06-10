from typing import Any

from fastapi import APIRouter

from app.core.ai_client import ai_service_request

router = APIRouter()


@router.post("/grade")
def grade(body: dict[str, Any]) -> dict:
    return ai_service_request("POST", "/ai/writing/grade", body)
