from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    app_name: str = 'NetPlus MVP API'
    api_version: str = '0.1.0'
    environment: str = Field(default='development')

    database_url: str = Field(default='sqlite:///./netplus.db')
    openai_api_key: str | None = Field(default=None)
    openai_model: str = Field(default='gpt-4o-mini')
    use_openai: bool = Field(default=False)

    chunk_size_lines: int = Field(default=6)
    retrieval_top_k: int = Field(default=8)

    auth_jwt_secret: str = Field(default='change-me-in-env')
    auth_jwt_exp_minutes: int = Field(default=60 * 24 * 7)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
