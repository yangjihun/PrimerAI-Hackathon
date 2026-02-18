from pydantic import BaseModel


class LLMResult(BaseModel):
    data: dict
    raw_text: str | None = None
