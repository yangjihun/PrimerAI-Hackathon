from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.db.base import Base
from app.db.models import Episode, SubtitleChunk, SubtitleLine, Title
from app.main import create_app


@pytest.fixture(scope='function')
def db_session() -> Session:
    engine = create_engine(
        'sqlite+pysqlite://',
        future=True,
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    seed_minimal_data(session)
    session.commit()
    yield session
    session.close()
    engine.dispose()


def seed_minimal_data(session: Session) -> None:
    now = datetime.now(timezone.utc)
    title = Title(id=str(uuid4()), name='Test Title', description='test', created_at=now)
    episode = Episode(
        id=str(uuid4()),
        title_id=title.id,
        season=1,
        episode_number=1,
        name='Ep1',
        duration_ms=10_000,
        created_at=now,
    )
    line1 = SubtitleLine(
        id=str(uuid4()),
        episode_id=episode.id,
        start_ms=1000,
        end_ms=1200,
        speaker_text='A',
        text='A says first clue',
        created_at=now,
    )
    line2 = SubtitleLine(
        id=str(uuid4()),
        episode_id=episode.id,
        start_ms=2000,
        end_ms=2200,
        speaker_text='B',
        text='B gives later clue',
        created_at=now,
    )
    chunk = SubtitleChunk(
        id=str(uuid4()),
        episode_id=episode.id,
        start_ms=1000,
        end_ms=2200,
        text_concat='A says first clue B gives later clue',
        subtitle_line_ids=[line1.id, line2.id],
        embedding=[0.1, 0.2, 0.3, 0.4],
        created_at=now,
    )

    session.add_all([title, episode, line1, line2, chunk])
    session.flush()

    session.info['title_id'] = title.id
    session.info['episode_id'] = episode.id


@pytest.fixture(scope='function')
def client(db_session: Session) -> TestClient:
    app = create_app()

    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    return TestClient(app)


@pytest.fixture(scope='function')
def ids(db_session: Session) -> dict[str, str]:
    return {
        'title_id': db_session.info['title_id'],
        'episode_id': db_session.info['episode_id'],
    }
