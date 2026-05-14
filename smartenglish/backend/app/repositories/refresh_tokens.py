import psycopg


def insert_refresh_token(conn: psycopg.Connection, user_id: str, token_hash: str, expires_at) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
            VALUES (%s, %s, %s)
            """,
            (user_id, token_hash, expires_at),
        )


def consume_refresh_token(conn: psycopg.Connection, token_hash: str) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM refresh_tokens
            WHERE token_hash = %s AND expires_at > now()
            RETURNING *
            """,
            (token_hash,),
        )
        return cur.fetchone()


def revoke_refresh_token(conn: psycopg.Connection, token_hash: str) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM refresh_tokens WHERE token_hash = %s", (token_hash,))
