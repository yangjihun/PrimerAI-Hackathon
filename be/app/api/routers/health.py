from datetime import datetime, timezone

from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(prefix='', tags=['Health'])


@router.get('/health')
def health_check() -> dict[str, object]:
    settings = get_settings()
    return {
        'ok': True,
        'version': settings.api_version,
        'time': datetime.now(timezone.utc).isoformat(),
    }
