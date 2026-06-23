from typing import List
from pydantic import AnyHttpUrl, EmailStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="ignore"
    )

    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "ORBX ERP"
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # DB Config
    DATABASE_URL: str

    # First Superuser / Admin Config
    FIRST_SUPERUSER_EMAIL: EmailStr = "admin@orbx.com"
    FIRST_SUPERUSER_PASSWORD: str = "AdminPassword123"
    FIRST_COMPANY_NAME: str = "ORBX Corporation"
    FIRST_BRANCH_NAME: str = "Headquarters"
    FIRST_BRANCH_CODE: str = "HQ"

    # Email / SMTP Config
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = ""


settings = Settings()
