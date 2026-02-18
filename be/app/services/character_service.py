from __future__ import annotations

from sqlalchemy import select

from app.api.schemas import CharacterCardMeta, CharacterCardResponse, CharacterOut, CharacterSummary, WarningItem
from app.db.models import Character, SubtitleLine
from app.rag.evidence_select import build_evidences_from_lines
from app.rag.validator import sanitize_evidences


def get_character_card(db, *, character_id: str, episode_id: str, current_time_ms: int) -> CharacterCardResponse | None:
    character = db.scalar(select(Character).where(Character.id == character_id))
    if character is None:
        return None

    alias_texts = [alias.alias_text for alias in character.aliases]

    lines = list(
        db.scalars(
            select(SubtitleLine)
            .where(
                SubtitleLine.episode_id == episode_id,
                SubtitleLine.start_ms <= current_time_ms,
            )
            .order_by(SubtitleLine.start_ms.desc())
            .limit(80)
        ).all()
    )

    lower_aliases = {character.canonical_name.lower(), *(text.lower() for text in alias_texts)}
    matched = []
    for line in lines:
        hay = f'{line.speaker_text or ""} {line.text}'.lower()
        if any(alias in hay for alias in lower_aliases):
            matched.append(line)
        if len(matched) >= 4:
            break

    matched = list(reversed(matched))
    warnings: list[WarningItem] = []
    evidences = build_evidences_from_lines(matched, max_lines_per_evidence=2)
    evidences = sanitize_evidences(
        db,
        evidences=evidences,
        episode_id=episode_id,
        current_time_ms=current_time_ms,
        warnings=warnings,
    )

    if matched:
        summary_text = f"{character.canonical_name}는 현재 시점까지 주요 장면에서 반복적으로 언급됩니다."
        key_events = [f'[{line.start_ms}] {line.text}' for line in matched[:3]]
    else:
        summary_text = f'현재 시점 기준으로 {character.canonical_name}의 직접 근거가 부족합니다.'
        key_events = []
        warnings.append(
            WarningItem(code='EVIDENCE_INSUFFICIENT', message='인물 요약 근거를 충분히 확보하지 못했습니다.')
        )

    return CharacterCardResponse(
        meta=CharacterCardMeta(
            character_id=character.id,
            episode_id=episode_id,
            current_time_ms=current_time_ms,
            spoiler_guard_applied=True,
        ),
        character=CharacterOut(
            id=character.id,
            title_id=character.title_id,
            canonical_name=character.canonical_name,
            description=character.description,
            aliases=alias_texts,
        ),
        summary=CharacterSummary(text=summary_text, key_events=key_events),
        evidences=evidences,
        warnings=warnings,
    )
