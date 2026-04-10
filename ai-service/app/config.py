from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "dev"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    backend_base_url: str = "http://localhost:8080"
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "e-commerce"
    db_username: str = "postgres"
    db_password: str = "postgres"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
