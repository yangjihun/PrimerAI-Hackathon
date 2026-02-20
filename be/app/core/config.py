from functools import lru_cache

from pydantic import Field, model_validator
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
    cors_allowed_origins: str = Field(default='http://localhost:5173,http://localhost:3000')
    admin_email: str | None = Field(default=None)
    cloudinary_cloud_name: str | None = Field(default=None)
    cloudinary_api_key: str | None = Field(default=None)
    cloudinary_api_secret: str | None = Field(default=None)
    cloudinary_folder: str = Field(default='netplus')

    chunk_size_lines: int = Field(default=6)
    retrieval_top_k: int = Field(default=8)

    auth_jwt_secret: str = Field(default='change-me-in-env')
    auth_jwt_exp_minutes: int = Field(default=60 * 24 * 7)
    redis_url: str | None = Field(default=None)
    redis_cache_ttl_seconds: int = Field(default=1800)
    chat_history_window: int = Field(default=8)
    use_pgvector: bool = Field(default=False)

    @property
    def is_development(self) -> bool:
        return self.environment.lower() in {'development', 'dev', 'local'}

    @model_validator(mode='after')
    def validate_security_settings(self):
        # Keep tests lightweight while blocking unsafe defaults for real runs.
        if self.environment.lower() == 'test':
            return self
        if not self.auth_jwt_secret or self.auth_jwt_secret == 'change-me-in-env':
            raise ValueError('AUTH_JWT_SECRET must be set to a strong value.')
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
