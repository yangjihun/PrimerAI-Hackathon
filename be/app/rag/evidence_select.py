from __future__ import annotations

from uuid import uuid4

from app.api.schemas import Evidence, EvidenceLine
from app.db.models import SubtitleLine


def build_evidences_from_lines(lines: list[SubtitleLine], max_lines_per_evidence: int = 2) -> list[Evidence]:
    if not lines:
        return []

    selected = lines[: max(1, max_lines_per_evidence)]
    evidence_lines = [
        EvidenceLine(
            subtitle_line_id=line.id,
            start_ms=line.start_ms,
            end_ms=line.end_ms,
            speaker_text=line.speaker_text,
            text=line.text,
        )
        for line in selected
    ]

    summary = selected[0].text[:60]
    evidence = Evidence(
        evidence_id=str(uuid4()),
        representative_time_ms=selected[0].start_ms,
        summary=summary,
        lines=evidence_lines,
    )
    return [evidence]
