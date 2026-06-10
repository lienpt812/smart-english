from typing import Any

import requests
from fastapi import HTTPException

from app.core.config import settings


def ai_service_request(method: str, path: str, payload: dict[str, Any] | None = None) -> dict:
    base_url = settings.ai_service_url.rstrip("/")
    url = f"{base_url}{path}"

    try:
        response = requests.request(
            method,
            url,
            json=payload,
            timeout=30,
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "AI_SERVICE_UNAVAILABLE",
                "message": "Backend API could not reach AI Service.",
                "aiServiceUrl": settings.ai_service_url,
                "error": str(exc),
            },
        ) from exc

    try:
        body = response.json()
    except ValueError:
        body = {"raw": response.text}

    if response.status_code >= 400:
        raise HTTPException(
            status_code=response.status_code,
            detail={
                "code": "AI_SERVICE_ERROR",
                "message": "AI Service returned an error.",
                "upstreamStatus": response.status_code,
                "upstream": body,
            },
        )

    return body
