import json
from typing import Any

from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator


class VectorType(TypeDecorator[list[float] | None]):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            return value
        return json.dumps(value)

    def process_result_value(self, value: Any, dialect: Any) -> list[float] | None:
        if value is None:
            return None
        if isinstance(value, list):
            return value
        try:
            loaded = json.loads(value)
            if isinstance(loaded, list):
                return [float(v) for v in loaded]
        except Exception:
            return None
        return None
