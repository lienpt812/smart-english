import redis

from app.core.config import settings


def check_redis() -> bool:
    try:
        client = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=1)
        return bool(client.ping())
    except Exception:
        return False
