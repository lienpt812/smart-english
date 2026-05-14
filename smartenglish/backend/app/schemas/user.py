from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class PublicUser(BaseModel):
    id: UUID
    email: EmailStr
    displayName: str | None
    avatarUrl: str | None
    locale: str
    placementCompleted: bool
    placementSkipped: bool
    createdAt: datetime
    updatedAt: datetime


def serialize_user(row: dict) -> dict:
    return {
        "id": row["id"],
        "email": row["email"],
        "displayName": row["display_name"],
        "avatarUrl": row["avatar_url"],
        "locale": row["locale"],
        "placementCompleted": row["placement_completed"],
        "placementSkipped": row["placement_skipped"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }
