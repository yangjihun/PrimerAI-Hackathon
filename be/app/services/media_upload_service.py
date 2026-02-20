from __future__ import annotations

import hashlib
import re
import time

from app.core.config import get_settings


def _sanitize_filename(raw: str) -> str:
    stem = raw.rsplit('.', 1)[0].strip().lower()
    stem = re.sub(r'[^a-z0-9_-]+', '-', stem)
    stem = re.sub(r'-{2,}', '-', stem).strip('-')
    return stem or 'video'


def build_cloudinary_video_upload_signature(
    *,
    episode_id: str,
    filename: str,
) -> dict[str, str]:
    return build_cloudinary_upload_signature(
        resource_type='video',
        asset_prefix='episode',
        entity_id=episode_id,
        filename=filename,
    )


def build_cloudinary_image_upload_signature(
    *,
    title_id: str,
    filename: str,
) -> dict[str, str]:
    return build_cloudinary_upload_signature(
        resource_type='image',
        asset_prefix='title',
        entity_id=title_id,
        filename=filename,
    )


def build_cloudinary_upload_signature(
    *,
    resource_type: str,
    asset_prefix: str,
    entity_id: str,
    filename: str,
) -> dict[str, str]:
    settings = get_settings()
    cloud_name = (settings.cloudinary_cloud_name or '').strip()
    api_key = (settings.cloudinary_api_key or '').strip()
    api_secret = (settings.cloudinary_api_secret or '').strip()
    folder = settings.cloudinary_folder.strip() or 'netplus'
    if not cloud_name or not api_key or not api_secret:
        raise ValueError('Cloudinary settings are missing.')

    timestamp = str(int(time.time()))
    safe_name = _sanitize_filename(filename)
    public_id = f'{asset_prefix}-{entity_id}-{safe_name}'

    params_to_sign = f'folder={folder}&public_id={public_id}&timestamp={timestamp}'
    signature = hashlib.sha1(f'{params_to_sign}{api_secret}'.encode('utf-8')).hexdigest()

    return {
        'upload_url': f'https://api.cloudinary.com/v1_1/{cloud_name}/{resource_type}/upload',
        'api_key': api_key,
        'timestamp': timestamp,
        'folder': folder,
        'public_id': public_id,
        'signature': signature,
    }
