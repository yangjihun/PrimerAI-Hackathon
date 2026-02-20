"""add title thumbnail_url

Revision ID: 0005_title_thumbnail_url
Revises: 0004_episode_video_url
Create Date: 2026-02-20 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '0005_title_thumbnail_url'
down_revision: str | None = '0004_episode_video_url'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('titles', sa.Column('thumbnail_url', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('titles', 'thumbnail_url')

