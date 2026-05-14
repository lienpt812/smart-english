from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import get_connection
from app.core.security import (
    generate_refresh_token_raw,
    hash_refresh_token,
    refresh_expires_at,
    sign_access_token,
)
from app.repositories.refresh_tokens import (
    consume_refresh_token,
    insert_refresh_token,
    revoke_refresh_token,
)
from app.repositories.users import ensure_user_stats, find_user_by_id, upsert_user_from_google
from app.schemas.user import serialize_user

router = APIRouter()


class GoogleAuthBody(BaseModel):
    credential: str | None = None
    idToken: str | None = None


class RefreshBody(BaseModel):
    refreshToken: str


class LogoutBody(BaseModel):
    refreshToken: str | None = None


def verify_google_credential(raw_token: str) -> dict:
    if not settings.google_client_id:
        raise HTTPException(
            status_code=503,
            detail={"code": "GOOGLE_CLIENT_ID_MISSING", "message": "GOOGLE_CLIENT_ID is not configured"},
        )

    try:
        payload = id_token.verify_oauth2_token(
            raw_token,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_GOOGLE_TOKEN", "message": "Invalid Google credential"},
        )

    email = payload.get("email")
    sub = payload.get("sub")
    if not email or not sub:
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_GOOGLE_TOKEN", "message": "Google token is missing email or subject"},
        )

    return {
        "google_sub": sub,
        "email": email,
        "display_name": payload.get("name"),
        "avatar_url": payload.get("picture"),
    }


@router.post("/google")
def google_login(body: GoogleAuthBody) -> dict:
    credential = body.credential or body.idToken
    if not credential:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION", "message": "Missing credential or idToken"},
        )

    profile = verify_google_credential(credential)
    refresh_raw = generate_refresh_token_raw()

    with get_connection() as conn:
        user = upsert_user_from_google(conn, profile)
        ensure_user_stats(conn, str(user["id"]))
        insert_refresh_token(conn, str(user["id"]), hash_refresh_token(refresh_raw), refresh_expires_at())
        conn.commit()

    access = sign_access_token(str(user["id"]), user["email"])

    return {
        "accessToken": access["token"],
        "refreshToken": refresh_raw,
        "expiresIn": access["expiresInSec"],
        "tokenType": "Bearer",
        "user": serialize_user(user),
    }


@router.post("/refresh")
def refresh(body: RefreshBody) -> dict:
    new_refresh_raw = generate_refresh_token_raw()

    with get_connection() as conn:
        consumed = consume_refresh_token(conn, hash_refresh_token(body.refreshToken))
        if not consumed:
            raise HTTPException(
                status_code=401,
                detail={"code": "INVALID_REFRESH", "message": "Refresh token is invalid or expired"},
            )

        user = find_user_by_id(conn, str(consumed["user_id"]))
        if not user:
            raise HTTPException(
                status_code=401,
                detail={"code": "INVALID_REFRESH", "message": "User does not exist"},
            )

        insert_refresh_token(conn, str(user["id"]), hash_refresh_token(new_refresh_raw), refresh_expires_at())
        conn.commit()

    access = sign_access_token(str(user["id"]), user["email"])
    return {
        "accessToken": access["token"],
        "refreshToken": new_refresh_raw,
        "expiresIn": access["expiresInSec"],
        "tokenType": "Bearer",
    }


@router.post("/logout", status_code=204)
def logout(body: LogoutBody) -> None:
    if not body.refreshToken:
        return

    with get_connection() as conn:
        revoke_refresh_token(conn, hash_refresh_token(body.refreshToken))
        conn.commit()
