import json
import os
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator


def _use_pgvector() -> bool:
    return os.getenv("USE_PGVECTOR", "false").strip().lower() in {"1", "true", "yes", "on"}


class VectorType(TypeDecorator[list[float] | None]):
    """Optional vector type.

    USE_PGVECTOR=true + PostgreSQL => native vector(4)
    Otherwise => JSON text fallback.
    """

    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):  # type: ignore[override]
        if dialect.name == "postgresql" and _use_pgvector():
            return dialect.type_descriptor(Vector(4))
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value: Any, dialect: Any):
        if value is None:
            return None

        if dialect.name == "postgresql" and _use_pgvector():
            if isinstance(value, str):
                try:
                    loaded = json.loads(value)
                    if isinstance(loaded, list):
                        return [float(v) for v in loaded]
                except Exception:
                    return None
            if isinstance(value, list):
                return [float(v) for v in value]
            return None

        if isinstance(value, str):
            return value
        if isinstance(value, list):
            return json.dumps([float(v) for v in value])
        return None

    def process_result_value(self, value: Any, dialect: Any):
        if value is None:
            return None
        if isinstance(value, list):
            return [float(v) for v in value]
        if isinstance(value, str):
            try:
                loaded = json.loads(value)
                if isinstance(loaded, list):
                    return [float(v) for v in loaded]
            except Exception:
                return None
        return None
