from __future__ import annotations

from collections import Counter

from sqlalchemy import func, select

from app.api.schemas import ResolveCandidate, ResolveEntityMeta, ResolveEntityRequest, ResolveEntityResponse, WarningItem
from app.db.models import Character, CharacterAlias, SubtitleLine


def resolve_entity(db, req: ResolveEntityRequest) -> ResolveEntityResponse:
    warnings: list[WarningItem] = []
    mention_lower = req.mention_text.strip().lower()

    alias_rows = list(
        db.execute(
            select(CharacterAlias, Character)
            .join(Character, Character.id == CharacterAlias.character_id)
            .where(
                Character.title_id == req.title_id,
                func.lower(CharacterAlias.alias_text) == mention_lower,
            )
            .order_by(CharacterAlias.confidence.desc())
            .limit(5)
        ).all()
    )

    candidates: list[ResolveCandidate] = []
    for alias, character in alias_rows:
        candidates.append(
            ResolveCandidate(
                character_id=character.id,
                canonical_name=character.canonical_name,
                reason=f"alias '{alias.alias_text}' 일치",
                confidence=min(1.0, max(0.0, alias.confidence)),
            )
        )

    if not candidates:
        lines = list(
            db.scalars(
                select(SubtitleLine)
                .where(
                    SubtitleLine.episode_id == req.episode_id,
                    SubtitleLine.start_ms <= req.current_time_ms,
                    SubtitleLine.text.ilike(f'%{req.mention_text}%'),
                )
                .order_by(SubtitleLine.start_ms.desc())
                .limit(20)
            ).all()
        )

        speaker_counter = Counter(line.speaker_text for line in lines if line.speaker_text)
        characters = list(db.scalars(select(Character).where(Character.title_id == req.title_id)).all())

        for speaker, freq in speaker_counter.most_common(5):
            match = next(
                (char for char in characters if char.canonical_name.lower() == speaker.lower()),
                None,
            )
            if match:
                candidates.append(
                    ResolveCandidate(
                        character_id=match.id,
                        canonical_name=match.canonical_name,
                        reason='자막 화자와 인물명이 일치',
                        confidence=min(0.7, 0.35 + freq * 0.08),
                    )
                )

    if not candidates:
        warnings.append(
            WarningItem(code='ENTITY_NOT_RESOLVED', message='현재 시점 기준으로 인물 후보를 찾지 못했습니다.')
        )

    return ResolveEntityResponse(
        meta=ResolveEntityMeta(
            title_id=req.title_id,
            episode_id=req.episode_id,
            current_time_ms=req.current_time_ms,
            spoiler_guard_applied=True,
        ),
        mention_text=req.mention_text,
        candidates=candidates,
        warnings=warnings,
    )
