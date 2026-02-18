from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import delete, select

from app.db.base import Base
from app.db.models import (
    Character,
    CharacterAlias,
    Episode,
    Evidence,
    EvidenceLine,
    Relation,
    SubtitleLine,
    Title,
)
from app.db.session import SessionLocal, engine


def now():
    return datetime.now(timezone.utc)


def run() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        db.execute(delete(EvidenceLine))
        db.execute(delete(Evidence))
        db.execute(delete(Relation))
        db.execute(delete(CharacterAlias))
        db.execute(delete(Character))
        db.execute(delete(SubtitleLine))
        db.execute(delete(Episode))
        db.execute(delete(Title))
        db.commit()

        title = Title(id=str(uuid4()), name='Demo Thriller A', description='NetPlus hackathon demo dataset', created_at=now())
        db.add(title)

        episode = Episode(
            id=str(uuid4()),
            title_id=title.id,
            season=1,
            episode_number=1,
            name='Episode 1',
            duration_ms=1_200_000,
            created_at=now(),
        )
        db.add(episode)

        char_a = Character(id=str(uuid4()), title_id=title.id, canonical_name='A', description='형사', created_at=now())
        char_b = Character(id=str(uuid4()), title_id=title.id, canonical_name='B', description='용의자', created_at=now())
        char_c = Character(id=str(uuid4()), title_id=title.id, canonical_name='C', description='중재자', created_at=now())
        db.add_all([char_a, char_b, char_c])
        db.flush()

        db.add_all(
            [
                CharacterAlias(id=str(uuid4()), character_id=char_a.id, alias_text='팀장', alias_type='HONORIFIC', confidence=0.8, created_at=now()),
                CharacterAlias(id=str(uuid4()), character_id=char_b.id, alias_text='형', alias_type='HONORIFIC', confidence=0.7, created_at=now()),
            ]
        )

        subtitle_specs = [
            (30_000, 33_000, 'A', '너, 그때 거기 없었잖아.'),
            (40_000, 43_000, 'B', '난 혼자 있었어.'),
            (55_000, 58_000, 'C', '둘 다 진정해. 증거부터 보자.'),
            (90_000, 93_000, 'A', '말이 계속 바뀌고 있어.'),
            (130_000, 134_000, 'B', '숨기는 건 있지만 배신은 아니야.'),
            (170_000, 173_000, 'C', '지금은 서로 믿기 어렵겠지.'),
            (220_000, 224_000, 'A', '팀장이 왜 그걸 알고 있지?'),
            (260_000, 263_000, 'B', '내가 본 건 일부뿐이야.'),
            (310_000, 314_000, 'C', '오해일 수도 있으니 단정하지 말자.'),
            (380_000, 384_000, 'A', '그래도 네 알리바이는 맞지 않아.'),
            (450_000, 454_000, 'B', '시간을 더 줘. 설명할게.'),
            (520_000, 524_000, 'C', '지금은 정보가 부족해.'),
            (600_000, 603_000, 'A', '너, 그때 거기 없었잖아.'),
        ]

        lines = []
        for start_ms, end_ms, speaker, text in subtitle_specs:
            line = SubtitleLine(
                id=str(uuid4()),
                episode_id=episode.id,
                start_ms=start_ms,
                end_ms=end_ms,
                speaker_text=speaker,
                text=text,
                created_at=now(),
            )
            lines.append(line)
        db.add_all(lines)
        db.flush()

        relation = Relation(
            id=str(uuid4()),
            title_id=title.id,
            from_character_id=char_a.id,
            to_character_id=char_b.id,
            relation_type='MISTRUST',
            is_hypothesis=False,
            confidence=0.72,
            valid_from_time_ms=30_000,
            valid_to_time_ms=None,
            created_at=now(),
            updated_at=now(),
        )
        db.add(relation)
        db.flush()

        evidence = Evidence(
            id=str(uuid4()),
            title_id=title.id,
            episode_id=episode.id,
            relation_id=relation.id,
            message_id=None,
            summary='A의 의심을 촉발한 발언',
            representative_time_ms=30_000,
            created_at=now(),
        )
        db.add(evidence)
        db.flush()

        db.add(
            EvidenceLine(
                evidence_id=evidence.id,
                subtitle_line_id=lines[0].id,
                order_index=0,
            )
        )

        db.commit()
        print('Seed complete')
        print(f'title_id={title.id}')
        print(f'episode_id={episode.id}')
    finally:
        db.close()


if __name__ == '__main__':
    run()
