from __future__ import annotations

import json
import logging
from typing import Any

from app.core.config import get_settings

logger = logging.getLogger(__name__)

try:
    from openai import OpenAI
except Exception:  # pragma: no cover - optional dependency at runtime
    OpenAI = None  # type: ignore[assignment]

try:
    from langsmith.wrappers import wrap_openai
except Exception:  # pragma: no cover - optional dependency at runtime
    wrap_openai = None  # type: ignore[assignment]


class OpenAIClient:
    def __init__(self) -> None:
        settings = get_settings()
        self._enabled = bool(settings.use_openai and settings.openai_api_key)
        self.model = settings.openai_model
        self._client = None
        if self._enabled and OpenAI is not None:
            client = OpenAI(api_key=settings.openai_api_key)
            self._client = wrap_openai(client) if wrap_openai is not None else client

    @property
    def enabled(self) -> bool:
        return bool(self._client)

    def complete_json(self, *, system_prompt: str, user_prompt: str) -> dict[str, Any] | None:
        if not self._client:
            return None

        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_prompt},
                ],
                response_format={'type': 'json_object'},
                temperature=0.2,
            )
            content = response.choices[0].message.content or '{}'
            return json.loads(content)
        except Exception as exc:  # pragma: no cover - network dependent
            logger.warning('OpenAI JSON completion failed: %s', exc)
            return None

    def stream_text(self, *, system_prompt: str, user_prompt: str, on_token) -> str | None:
        if not self._client:
            return None

        chunks: list[str] = []
        try:
            stream = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_prompt},
                ],
                temperature=0.2,
                stream=True,
            )
            for event in stream:
                delta = event.choices[0].delta.content if event.choices else None
                if not delta:
                    continue
                chunks.append(delta)
                on_token(delta)
            return ''.join(chunks).strip()
        except Exception as exc:  # pragma: no cover - network dependent
            logger.warning('OpenAI text streaming failed: %s', exc)
            return None
