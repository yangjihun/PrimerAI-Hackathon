"""migrate subtitle_chunks.embedding to pgvector

Revision ID: 0006_pgvector_subtitle_chunks
Revises: 0005_title_thumbnail_url
Create Date: 2026-02-20 00:00:00.000000
"""

from collections.abc import Sequence
import os

from alembic import op


revision: str = "0006_pgvector_subtitle_chunks"
down_revision: str | None = "0005_title_thumbnail_url"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    if os.getenv("USE_PGVECTOR", "false").strip().lower() not in {"1", "true", "yes", "on"}:
        return

    try:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    except Exception:
        # Managed PostgreSQL without pgvector installed: skip migration gracefully.
        return
    op.execute(
        """
        ALTER TABLE subtitle_chunks
        ALTER COLUMN embedding TYPE vector(4)
        USING CASE
            WHEN embedding IS NULL OR btrim(embedding) = '' THEN NULL
            ELSE embedding::vector(4)
        END
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_subtitle_chunks_embedding_cosine
        ON subtitle_chunks
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    if os.getenv("USE_PGVECTOR", "false").strip().lower() not in {"1", "true", "yes", "on"}:
        return

    op.execute("DROP INDEX IF EXISTS ix_subtitle_chunks_embedding_cosine")
    op.execute(
        """
        ALTER TABLE subtitle_chunks
        ALTER COLUMN embedding TYPE text
        USING embedding::text
        """
    )
