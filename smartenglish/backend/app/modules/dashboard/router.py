from fastapi import APIRouter, Depends, HTTPException

from app.core.database import get_connection
from app.core.security import verify_access_token
from app.repositories.users import find_user_by_id, find_user_stats

router = APIRouter()


@router.get("/summary")
def summary(auth: dict = Depends(verify_access_token)) -> dict:
    top_errors: list[dict] = []
    with get_connection() as conn:
        user = find_user_by_id(conn, auth["user_id"])
        if not user:
            raise HTTPException(
                status_code=404,
                detail={"code": "NOT_FOUND", "message": "User not found"},
            )
        stats = find_user_stats(conn, auth["user_id"])
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT skill, error_type, message, severity, occurrences, last_seen_at
                    FROM learning_errors
                    WHERE user_id = %s
                    ORDER BY occurrences DESC, last_seen_at DESC
                    LIMIT 5
                    """,
                    (auth["user_id"],),
                )
                top_errors = list(cur.fetchall())
        except Exception:
            conn.rollback()
            top_errors = []

    return {
        "phase": "1",
        "user": {
            "id": user["id"],
            "displayName": user["display_name"],
            "avatarUrl": user["avatar_url"],
            "placementCompleted": user["placement_completed"],
            "placementSkipped": user["placement_skipped"],
        },
        "skills": {
            "listening": stats["skill_listening"] if stats else None,
            "speaking": stats["skill_speaking"] if stats else None,
            "reading": stats["skill_reading"] if stats else None,
            "writing": stats["skill_writing"] if stats else None,
        },
        "streak": {
            "currentDays": stats["streak_current"] if stats else 0,
            "longestDays": stats["streak_longest"] if stats else 0,
        },
        "srs": {
            "dueToday": stats["srs_due_today"] if stats else 0,
            "newCards": stats["srs_new_cards"] if stats else 0,
        },
        "roadmap": {
            "completedPercent": stats["roadmap_completed_pct"] if stats else 0,
            "nextMilestone": stats["next_milestone"] if stats else None,
        },
        "topErrors": top_errors,
        "notes": "Dashboard summary includes legacy stats plus M7-M11 learning error signals when the Supabase schema is available.",
    }
