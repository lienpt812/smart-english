from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.database import get_connection
from app.core.security import verify_access_token
from app.repositories.users import find_user_by_id, update_user_profile
from app.schemas.user import serialize_user

router = APIRouter()


class UserPatch(BaseModel):
    locale: str | None = Field(default=None, max_length=16)
    placementCompleted: bool | None = None
    placementSkipped: bool | None = None


@router.get("")
@router.get("/")
def me(auth: dict = Depends(verify_access_token)) -> dict:
    with get_connection() as conn:
        user = find_user_by_id(conn, auth["user_id"])

    if not user:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "User not found"},
        )

    return {"user": serialize_user(user)}


@router.patch("")
@router.patch("/")
def patch_me(body: UserPatch, auth: dict = Depends(verify_access_token)) -> dict:
    patch = body.model_dump(exclude_unset=True)

    with get_connection() as conn:
        user = update_user_profile(conn, auth["user_id"], patch)
        conn.commit()

    if not user:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "User not found"},
        )

    return {"user": serialize_user(user)}
