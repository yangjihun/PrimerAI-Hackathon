from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_admin_user, get_db
from app.api.errors import validation_error
from app.api.schemas import (
    Episode,
    EpisodeCreateRequest,
    EpisodeVideoUpdateRequest,
    ImageUploadSignatureRequest,
    ImageUploadSignatureResponse,
    IngestSubtitleLinesResponse,
    SubtitleLineBulkRequest,
    Title,
    TitleCreateRequest,
    TitleThumbnailUpdateRequest,
    AuthUser,
    VideoUploadSignatureRequest,
    VideoUploadSignatureResponse,
)
from app.db.models import Episode as EpisodeModel
from app.db.models import SubtitleLine, Title as TitleModel
from app.services.media_upload_service import (
    build_cloudinary_image_upload_signature,
    build_cloudinary_video_upload_signature,
)

router = APIRouter(prefix='/ingest', tags=['Ingestion'])


def _now() -> datetime:
    return datetime.now(timezone.utc)


@router.post('/titles', response_model=Title, status_code=status.HTTP_201_CREATED)
def ingest_title(
    payload: TitleCreateRequest,
    db: Session = Depends(get_db),
    _: AuthUser = Depends(get_admin_user),
) -> Title:
    row = TitleModel(
        name=payload.name.strip(),
        description=payload.description,
        thumbnail_url=payload.thumbnail_url,
        created_at=_now(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return Title(
        id=row.id,
        name=row.name,
        description=row.description,
        thumbnail_url=row.thumbnail_url,
        created_at=row.created_at.isoformat() if row.created_at else None,
    )


@router.post('/episodes', response_model=Episode, status_code=status.HTTP_201_CREATED)
def ingest_episode(
    payload: EpisodeCreateRequest,
    db: Session = Depends(get_db),
    _: AuthUser = Depends(get_admin_user),
) -> Episode:
    title = db.scalar(select(TitleModel).where(TitleModel.id == payload.title_id))
    if title is None:
        raise validation_error('Invalid request.', {'field': 'title_id', 'reason': 'Title not found'})

    row = EpisodeModel(
        title_id=payload.title_id,
        season=payload.season,
        episode_number=payload.episode_number,
        name=payload.name,
        duration_ms=payload.duration_ms,
        video_url=payload.video_url,
        created_at=_now(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return Episode(
        id=row.id,
        title_id=row.title_id,
        season=row.season,
        episode_number=row.episode_number,
        name=row.name,
        duration_ms=row.duration_ms,
        video_url=row.video_url,
    )


@router.patch('/episodes/{episode_id}/video-url', response_model=Episode)
def update_episode_video_url(
    episode_id: str,
    payload: EpisodeVideoUpdateRequest,
    db: Session = Depends(get_db),
    _: AuthUser = Depends(get_admin_user),
) -> Episode:
    row = db.scalar(select(EpisodeModel).where(EpisodeModel.id == episode_id))
    if row is None:
        raise validation_error('Invalid request.', {'field': 'episode_id', 'reason': 'Episode not found'})

    row.video_url = payload.video_url.strip()
    db.add(row)
    db.commit()
    db.refresh(row)
    return Episode(
        id=row.id,
        title_id=row.title_id,
        season=row.season,
        episode_number=row.episode_number,
        name=row.name,
        duration_ms=row.duration_ms,
        video_url=row.video_url,
    )


@router.patch('/titles/{title_id}/thumbnail-url', response_model=Title)
def update_title_thumbnail_url(
    title_id: str,
    payload: TitleThumbnailUpdateRequest,
    db: Session = Depends(get_db),
    _: AuthUser = Depends(get_admin_user),
) -> Title:
    row = db.scalar(select(TitleModel).where(TitleModel.id == title_id))
    if row is None:
        raise validation_error('Invalid request.', {'field': 'title_id', 'reason': 'Title not found'})

    row.thumbnail_url = payload.thumbnail_url.strip()
    db.add(row)
    db.commit()
    db.refresh(row)
    return Title(
        id=row.id,
        name=row.name,
        description=row.description,
        thumbnail_url=row.thumbnail_url,
        created_at=row.created_at.isoformat() if row.created_at else None,
    )


@router.delete('/titles/{title_id}/thumbnail-url', response_model=Title)
def delete_title_thumbnail_url(
    title_id: str,
    db: Session = Depends(get_db),
    _: AuthUser = Depends(get_admin_user),
) -> Title:
    row = db.scalar(select(TitleModel).where(TitleModel.id == title_id))
    if row is None:
        raise validation_error('Invalid request.', {'field': 'title_id', 'reason': 'Title not found'})

    row.thumbnail_url = None
    db.add(row)
    db.commit()
    db.refresh(row)
    return Title(
        id=row.id,
        name=row.name,
        description=row.description,
        thumbnail_url=row.thumbnail_url,
        created_at=row.created_at.isoformat() if row.created_at else None,
    )


@router.delete('/episodes/{episode_id}/video-url', response_model=Episode)
def delete_episode_video_url(
    episode_id: str,
    db: Session = Depends(get_db),
    _: AuthUser = Depends(get_admin_user),
) -> Episode:
    row = db.scalar(select(EpisodeModel).where(EpisodeModel.id == episode_id))
    if row is None:
        raise validation_error('Invalid request.', {'field': 'episode_id', 'reason': 'Episode not found'})

    row.video_url = None
    db.add(row)
    db.commit()
    db.refresh(row)
    return Episode(
        id=row.id,
        title_id=row.title_id,
        season=row.season,
        episode_number=row.episode_number,
        name=row.name,
        duration_ms=row.duration_ms,
        video_url=row.video_url,
    )


@router.post('/video-upload-signature', response_model=VideoUploadSignatureResponse)
def issue_video_upload_signature(
    payload: VideoUploadSignatureRequest,
    db: Session = Depends(get_db),
    _: AuthUser = Depends(get_admin_user),
) -> VideoUploadSignatureResponse:
    episode_exists = db.scalar(select(EpisodeModel.id).where(EpisodeModel.id == payload.episode_id))
    if episode_exists is None:
        raise validation_error('Invalid request.', {'field': 'episode_id', 'reason': 'Episode not found'})
    try:
        signed = build_cloudinary_video_upload_signature(
            episode_id=payload.episode_id,
            filename=payload.filename,
        )
    except ValueError as exc:
        raise validation_error('Invalid request.', {'field': 'cloudinary', 'reason': str(exc)})
    return VideoUploadSignatureResponse(**signed)


@router.post('/image-upload-signature', response_model=ImageUploadSignatureResponse)
def issue_image_upload_signature(
    payload: ImageUploadSignatureRequest,
    db: Session = Depends(get_db),
    _: AuthUser = Depends(get_admin_user),
) -> ImageUploadSignatureResponse:
    title_exists = db.scalar(select(TitleModel.id).where(TitleModel.id == payload.title_id))
    if title_exists is None:
        raise validation_error('Invalid request.', {'field': 'title_id', 'reason': 'Title not found'})
    try:
        signed = build_cloudinary_image_upload_signature(
            title_id=payload.title_id,
            filename=payload.filename,
        )
    except ValueError as exc:
        raise validation_error('Invalid request.', {'field': 'cloudinary', 'reason': str(exc)})
    return ImageUploadSignatureResponse(**signed)


@router.post('/subtitle-lines:bulk', response_model=IngestSubtitleLinesResponse, status_code=status.HTTP_202_ACCEPTED)
def ingest_subtitle_lines_bulk(
    payload: SubtitleLineBulkRequest,
    db: Session = Depends(get_db),
    _: AuthUser = Depends(get_admin_user),
) -> IngestSubtitleLinesResponse:
    episode_ids = sorted({line.episode_id for line in payload.lines})
    existing_episodes = set(
        db.scalars(select(EpisodeModel.id).where(EpisodeModel.id.in_(episode_ids))).all()
    )
    missing = [episode_id for episode_id in episode_ids if episode_id not in existing_episodes]
    if missing:
        raise validation_error(
            'Invalid request.',
            {'field': 'episode_id', 'reason': f'Episode not found: {missing[0]}'},
        )

    inserted = 0
    for line in payload.lines:
        row = SubtitleLine(
            episode_id=line.episode_id,
            start_ms=line.start_ms,
            end_ms=line.end_ms,
            speaker_text=line.speaker_text,
            speaker_character_id=line.speaker_character_id,
            text=line.text,
            created_at=_now(),
        )
        db.add(row)
        inserted += 1

    db.commit()
    return IngestSubtitleLinesResponse(
        inserted_count=inserted,
        queued_embedding_jobs=inserted,
    )

