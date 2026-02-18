from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.schemas import Evidence, EvidenceLine
from app.db.models import Evidence as EvidenceModel
from app.db.models import EvidenceLine as EvidenceLineModel
from app.db.models import SubtitleLine


def _line_to_schema(line: SubtitleLine) -> EvidenceLine:
    return EvidenceLine(
        subtitle_line_id=line.id,
        start_ms=line.start_ms,
        end_ms=line.end_ms,
        speaker_text=line.speaker_text,
        text=line.text,
    )


def load_evidences_for_relation(
    db: Session,
    *,
    relation_id: str,
    episode_id: str,
    current_time_ms: int,
) -> list[Evidence]:
    evidence_rows = list(
        db.scalars(
            select(EvidenceModel)
            .where(
                EvidenceModel.relation_id == relation_id,
                EvidenceModel.episode_id == episode_id,
                EvidenceModel.representative_time_ms <= current_time_ms,
            )
            .order_by(EvidenceModel.representative_time_ms.desc())
            .limit(2)
        ).all()
    )

    out: list[Evidence] = []
    for row in evidence_rows:
        links = list(
            db.scalars(
                select(EvidenceLineModel)
                .where(EvidenceLineModel.evidence_id == row.id)
                .order_by(EvidenceLineModel.order_index.asc())
                .limit(2)
            ).all()
        )
        lines: list[EvidenceLine] = []
        for link in links:
            line = db.scalar(
                select(SubtitleLine).where(
                    SubtitleLine.id == link.subtitle_line_id,
                    SubtitleLine.episode_id == episode_id,
                    SubtitleLine.start_ms <= current_time_ms,
                )
            )
            if line:
                lines.append(_line_to_schema(line))

        if lines:
            out.append(
                Evidence(
                    evidence_id=row.id,
                    representative_time_ms=row.representative_time_ms,
                    summary=row.summary,
                    lines=lines,
                )
            )
    return out
