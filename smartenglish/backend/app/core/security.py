from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import Any

import jwt
from fastapi import Header, HTTPException, status

from app.core.config import settings


def sign_access_token(user_id: str, email: str) -> dict:
    now = datetime.now(timezone.utc)
    expires = now + timedelta(seconds=settings.jwt_access_expires_sec)
    token = jwt.encode(
        {
            "sub": user_id,
            "email": email,
            "iat": int(now.timestamp()),
            "exp": int(expires.timestamp()),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )
    return {"token": token, "expiresInSec": settings.jwt_access_expires_sec}


def verify_access_token(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Missing bearer token"},
        )

    token = authorization[7:].strip()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Invalid or expired token"},
        )

    return {"user_id": payload["sub"], "email": payload.get("email")}


def generate_refresh_token_raw() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def refresh_expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_expires_days)
