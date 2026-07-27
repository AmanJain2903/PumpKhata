import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your-super-secret-key-change-in-prod")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    FIRST_SUPER_ADMIN_EMAIL: str = os.getenv("FIRST_SUPER_ADMIN_EMAIL", "")

    class Config:
        env_file = ".env"

settings = Settings()
