"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-02-18 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '0001_initial'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'titles',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'episodes',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('title_id', sa.String(length=36), nullable=False),
        sa.Column('season', sa.Integer(), nullable=False),
        sa.Column('episode_number', sa.Integer(), nullable=False),
        sa.Column('name', sa.Text(), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['title_id'], ['titles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'subtitle_lines',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('episode_id', sa.String(length=36), nullable=False),
        sa.Column('start_ms', sa.Integer(), nullable=False),
        sa.Column('end_ms', sa.Integer(), nullable=False),
        sa.Column('speaker_text', sa.Text(), nullable=True),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['episode_id'], ['episodes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'subtitle_chunks',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('episode_id', sa.String(length=36), nullable=False),
        sa.Column('start_ms', sa.Integer(), nullable=False),
        sa.Column('end_ms', sa.Integer(), nullable=False),
        sa.Column('text_concat', sa.Text(), nullable=False),
        sa.Column('subtitle_line_ids', sa.JSON(), nullable=False),
        sa.Column('embedding', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['episode_id'], ['episodes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'characters',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('title_id', sa.String(length=36), nullable=False),
        sa.Column('canonical_name', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['title_id'], ['titles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'character_aliases',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('character_id', sa.String(length=36), nullable=False),
        sa.Column('alias_text', sa.Text(), nullable=False),
        sa.Column('alias_type', sa.Text(), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['character_id'], ['characters.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'relations',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('title_id', sa.String(length=36), nullable=False),
        sa.Column('from_character_id', sa.String(length=36), nullable=False),
        sa.Column('to_character_id', sa.String(length=36), nullable=False),
        sa.Column('relation_type', sa.Text(), nullable=False),
        sa.Column('is_hypothesis', sa.Boolean(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('valid_from_time_ms', sa.Integer(), nullable=False),
        sa.Column('valid_to_time_ms', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['from_character_id'], ['characters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['title_id'], ['titles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['to_character_id'], ['characters.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'chat_sessions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('title_id', sa.String(length=36), nullable=False),
        sa.Column('episode_id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=True),
        sa.Column('current_time_ms', sa.Integer(), nullable=False),
        sa.Column('meta', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['episode_id'], ['episodes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['title_id'], ['titles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'chat_messages',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('session_id', sa.String(length=36), nullable=False),
        sa.Column('role', sa.Text(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('current_time_ms', sa.Integer(), nullable=False),
        sa.Column('model', sa.Text(), nullable=True),
        sa.Column('prompt_tokens', sa.Integer(), nullable=True),
        sa.Column('completion_tokens', sa.Integer(), nullable=True),
        sa.Column('related_relation_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['related_relation_id'], ['relations.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['session_id'], ['chat_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'evidences',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('title_id', sa.String(length=36), nullable=False),
        sa.Column('episode_id', sa.String(length=36), nullable=False),
        sa.Column('relation_id', sa.String(length=36), nullable=True),
        sa.Column('message_id', sa.String(length=36), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('representative_time_ms', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['episode_id'], ['episodes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['message_id'], ['chat_messages.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['relation_id'], ['relations.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['title_id'], ['titles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'evidence_lines',
        sa.Column('evidence_id', sa.String(length=36), nullable=False),
        sa.Column('subtitle_line_id', sa.String(length=36), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['evidence_id'], ['evidences.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['subtitle_line_id'], ['subtitle_lines.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('evidence_id', 'subtitle_line_id'),
    )

    op.create_index('ix_subtitle_lines_episode_start', 'subtitle_lines', ['episode_id', 'start_ms'])
    op.create_index('ix_subtitle_chunks_episode_start', 'subtitle_chunks', ['episode_id', 'start_ms'])
    op.create_index(
        'ix_relations_title_from_to_validfrom',
        'relations',
        ['title_id', 'from_character_id', 'to_character_id', 'valid_from_time_ms'],
    )


def downgrade() -> None:
    op.drop_index('ix_relations_title_from_to_validfrom', table_name='relations')
    op.drop_index('ix_subtitle_chunks_episode_start', table_name='subtitle_chunks')
    op.drop_index('ix_subtitle_lines_episode_start', table_name='subtitle_lines')

    op.drop_table('evidence_lines')
    op.drop_table('evidences')
    op.drop_table('chat_messages')
    op.drop_table('chat_sessions')
    op.drop_table('relations')
    op.drop_table('character_aliases')
    op.drop_table('characters')
    op.drop_table('subtitle_chunks')
    op.drop_table('subtitle_lines')
    op.drop_table('episodes')
    op.drop_table('titles')
