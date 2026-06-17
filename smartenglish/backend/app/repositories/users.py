import psycopg


def upsert_user_from_google(conn: psycopg.Connection, profile: dict) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO backend_users (google_sub, email, display_name, avatar_url)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (google_sub) DO UPDATE SET
              email = EXCLUDED.email,
              display_name = COALESCE(EXCLUDED.display_name, backend_users.display_name),
              avatar_url = COALESCE(EXCLUDED.avatar_url, backend_users.avatar_url),
              updated_at = now()
            RETURNING *
            """,
            (
                profile["google_sub"],
                profile["email"],
                profile.get("display_name"),
                profile.get("avatar_url"),
            ),
        )
        return cur.fetchone()


def ensure_user_stats(conn: psycopg.Connection, user_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO user_stats (user_id) VALUES (%s) ON CONFLICT (user_id) DO NOTHING",
            (user_id,),
        )


def find_user_by_id(conn: psycopg.Connection, user_id: str) -> dict | None:
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM backend_users WHERE id = %s", (user_id,))
        return cur.fetchone()


def find_user_stats(conn: psycopg.Connection, user_id: str) -> dict | None:
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM user_stats WHERE user_id = %s", (user_id,))
        return cur.fetchone()


def update_user_profile(conn: psycopg.Connection, user_id: str, patch: dict) -> dict | None:
    fields: list[str] = []
    values: list[object] = []

    mapping = {
        "locale": "locale",
        "placementCompleted": "placement_completed",
        "placementSkipped": "placement_skipped",
    }

    for key, column in mapping.items():
        if key in patch:
            fields.append(f"{column} = %s")
            values.append(patch[key])

    if not fields:
        return find_user_by_id(conn, user_id)

    fields.append("updated_at = now()")
    values.append(user_id)

    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE backend_users SET {', '.join(fields)} WHERE id = %s RETURNING *",
            values,
        )
        return cur.fetchone()
