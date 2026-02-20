from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    PrimaryKeyConstraint,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import VectorType


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_uuid() -> str:
    return str(uuid4())


class Title(Base):
    __tablename__ = 'titles'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    episodes: Mapped[list['Episode']] = relationship(back_populates='title', cascade='all, delete-orphan')


class Episode(Base):
    __tablename__ = 'episodes'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    title_id: Mapped[str] = mapped_column(String(36), ForeignKey('titles.id', ondelete='CASCADE'), nullable=False)
    season: Mapped[int] = mapped_column(Integer, nullable=False)
    episode_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str | None] = mapped_column(Text)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    video_url: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    title: Mapped['Title'] = relationship(back_populates='episodes')
    subtitle_lines: Mapped[list['SubtitleLine']] = relationship(back_populates='episode', cascade='all, delete-orphan')


class User(Base):
    __tablename__ = 'users'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class SubtitleLine(Base):
    __tablename__ = 'subtitle_lines'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    episode_id: Mapped[str] = mapped_column(String(36), ForeignKey('episodes.id', ondelete='CASCADE'), nullable=False)
    start_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    end_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    speaker_text: Mapped[str | None] = mapped_column(Text)
    speaker_character_id: Mapped[str | None] = mapped_column(String(36), ForeignKey('characters.id', ondelete='SET NULL'))
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    episode: Mapped['Episode'] = relationship(back_populates='subtitle_lines')


class SubtitleChunk(Base):
    __tablename__ = 'subtitle_chunks'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    episode_id: Mapped[str] = mapped_column(String(36), ForeignKey('episodes.id', ondelete='CASCADE'), nullable=False)
    start_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    end_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    text_concat: Mapped[str] = mapped_column(Text, nullable=False)
    subtitle_line_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    embedding: Mapped[list[float] | None] = mapped_column(VectorType)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class Character(Base):
    __tablename__ = 'characters'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    title_id: Mapped[str] = mapped_column(String(36), ForeignKey('titles.id', ondelete='CASCADE'), nullable=False)
    canonical_name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    aliases: Mapped[list['CharacterAlias']] = relationship(back_populates='character', cascade='all, delete-orphan')


class CharacterAlias(Base):
    __tablename__ = 'character_aliases'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    character_id: Mapped[str] = mapped_column(String(36), ForeignKey('characters.id', ondelete='CASCADE'), nullable=False)
    alias_text: Mapped[str] = mapped_column(Text, nullable=False)
    alias_type: Mapped[str | None] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    character: Mapped['Character'] = relationship(back_populates='aliases')


class Relation(Base):
    __tablename__ = 'relations'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    title_id: Mapped[str] = mapped_column(String(36), ForeignKey('titles.id', ondelete='CASCADE'), nullable=False)
    from_character_id: Mapped[str] = mapped_column(String(36), ForeignKey('characters.id', ondelete='CASCADE'), nullable=False)
    to_character_id: Mapped[str] = mapped_column(String(36), ForeignKey('characters.id', ondelete='CASCADE'), nullable=False)
    relation_type: Mapped[str] = mapped_column(Text, nullable=False, default='UNKNOWN')
    is_hypothesis: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    valid_from_time_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    valid_to_time_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class Evidence(Base):
    __tablename__ = 'evidences'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    title_id: Mapped[str] = mapped_column(String(36), ForeignKey('titles.id', ondelete='CASCADE'), nullable=False)
    episode_id: Mapped[str] = mapped_column(String(36), ForeignKey('episodes.id', ondelete='CASCADE'), nullable=False)
    relation_id: Mapped[str | None] = mapped_column(String(36), ForeignKey('relations.id', ondelete='SET NULL'))
    message_id: Mapped[str | None] = mapped_column(String(36), ForeignKey('chat_messages.id', ondelete='SET NULL'))
    summary: Mapped[str | None] = mapped_column(Text)
    representative_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    lines: Mapped[list['EvidenceLine']] = relationship(back_populates='evidence', cascade='all, delete-orphan')


class EvidenceLine(Base):
    __tablename__ = 'evidence_lines'
    __table_args__ = (PrimaryKeyConstraint('evidence_id', 'subtitle_line_id'),)

    evidence_id: Mapped[str] = mapped_column(String(36), ForeignKey('evidences.id', ondelete='CASCADE'), nullable=False)
    subtitle_line_id: Mapped[str] = mapped_column(String(36), ForeignKey('subtitle_lines.id', ondelete='CASCADE'), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    evidence: Mapped['Evidence'] = relationship(back_populates='lines')
    subtitle_line: Mapped['SubtitleLine'] = relationship()


class ChatSession(Base):
    __tablename__ = 'chat_sessions'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    title_id: Mapped[str] = mapped_column(String(36), ForeignKey('titles.id', ondelete='CASCADE'), nullable=False)
    episode_id: Mapped[str] = mapped_column(String(36), ForeignKey('episodes.id', ondelete='CASCADE'), nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(36))
    current_time_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    meta: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class ChatMessage(Base):
    __tablename__ = 'chat_messages'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey('chat_sessions.id', ondelete='CASCADE'), nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    current_time_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    model: Mapped[str | None] = mapped_column(Text)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    related_relation_id: Mapped[str | None] = mapped_column(String(36), ForeignKey('relations.id', ondelete='SET NULL'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


Index('ix_subtitle_lines_episode_start', SubtitleLine.episode_id, SubtitleLine.start_ms)
Index('ix_subtitle_chunks_episode_start', SubtitleChunk.episode_id, SubtitleChunk.start_ms)
Index(
    'ix_relations_title_from_to_validfrom',
    Relation.title_id,
    Relation.from_character_id,
    Relation.to_character_id,
    Relation.valid_from_time_ms,
)
