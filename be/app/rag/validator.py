from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.schemas import AnswerPayload, Evidence, Interpretation, WarningItem
from app.db.models import SubtitleLine

UNCERTAIN_HINTS = ('확실', '어렵', '가능', '추정', '단정')


def _is_assertive(conclusion: str) -> bool:
    if any(token in conclusion for token in UNCERTAIN_HINTS):
        return False
    return conclusion.rstrip().endswith('다.')


def sanitize_evidences(
    db: Session,
    *,
    evidences: list[Evidence],
    episode_id: str,
    current_time_ms: int,
    warnings: list[WarningItem],
) -> list[Evidence]:
    sanitized: list[Evidence] = []

    for evidence in evidences:
        clean_lines = []
        for line in evidence.lines[:2]:
            subtitle = db.scalar(select(SubtitleLine).where(SubtitleLine.id == line.subtitle_line_id))
            if subtitle is None:
                warnings.append(
                    WarningItem(code='EVIDENCE_LINE_REMOVED', message='존재하지 않는 근거 라인이 제거되었습니다.')
                )
                continue
            if subtitle.episode_id != episode_id:
                warnings.append(
                    WarningItem(code='EVIDENCE_EPISODE_MISMATCH', message='다른 회차 근거가 제거되었습니다.')
                )
                continue
            if subtitle.start_ms > current_time_ms:
                warnings.append(
                    WarningItem(code='TIME_GUARD_EVIDENCE_REMOVED', message='현재 시점 이후 근거가 제거되었습니다.')
                )
                continue

            line.start_ms = subtitle.start_ms
            line.end_ms = subtitle.end_ms
            line.speaker_text = subtitle.speaker_text
            line.text = subtitle.text
            clean_lines.append(line)

        if clean_lines:
            evidence.lines = clean_lines
            evidence.representative_time_ms = clean_lines[0].start_ms
            sanitized.append(evidence)

    return sanitized


def enforce_degrade_if_needed(
    answer: AnswerPayload,
    evidences: list[Evidence],
    warnings: list[WarningItem],
) -> AnswerPayload:
    if evidences:
        return answer

    if _is_assertive(answer.conclusion):
        warnings.append(
            WarningItem(
                code='ASSERTIVE_WITHOUT_EVIDENCE',
                message='근거가 부족해 단정 표현을 완화했습니다.',
            )
        )

    warnings.append(
        WarningItem(
            code='EVIDENCE_INSUFFICIENT',
            message='현재 시점까지의 자막에서 질문에 대한 직접 근거를 찾지 못했어요.',
        )
    )

    return AnswerPayload(
        conclusion='현재 시점 자막만으로는 질문에 직접 답할 근거가 부족해.',
        context=['질문 시점을 조금 뒤로 이동하거나, 인물/대사를 포함해 다시 물어봐줘.'],
        interpretations=[
            Interpretation(label='핵심', text='현재 구간에서 확인 가능한 직접 근거가 없습니다.', confidence=0.3),
        ],
        overall_confidence=0.3,
    )
