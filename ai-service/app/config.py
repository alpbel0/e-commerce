from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    # Application
    app_env: str = "dev"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    # Backend Integration
    backend_base_url: str = "http://localhost:8080"
    backend_service_secret: str = ""  # AI -> Backend auth secret

    # AI Service Security
    ai_service_key: str = ""  # Shared secret for Backend <-> AI calls

    # LLM Provider (OpenRouter)
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # Model per Agent
    ai_model_guardrails: str = "google/gemini-3.1-pro-preview"
    ai_model_sql: str = "openai/gpt-5.4-mini"
    ai_model_repair: str = "anthropic/claude-sonnet-4.6"
    ai_model_analysis: str = "anthropic/claude-haiku-4.5"
    ai_model_visualization: str = "anthropic/claude-haiku-4.5"
    ai_model_embedding: str = "openai/text-embedding-3-small"

    # Embedding Guardrails
    embedding_guardrails_enabled: bool = True
    embedding_similarity_high_threshold: float = 0.58
    embedding_similarity_medium_threshold: float = 0.35

    # SQL Execution Limits
    sql_max_rows: int = 500
    sql_default_limit: int = 100
    sql_max_retries: int = 2
    query_timeout_seconds: int = 10

    # Session & Memory
    session_idle_ttl_minutes: int = 60
    chat_memory_pairs: int = 4

    # Schema Cache
    schema_cache_ttl_seconds: int = 300

    # Development Mode
    ai_mock_mode: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._validate_secrets()

    def _validate_secrets(self) -> None:
        """Validate that required secrets are configured outside local dev."""
        if self.app_env == "dev":
            return

        missing = []
        if not self.ai_service_key:
            missing.append("AI_SERVICE_KEY")
        if missing:
            raise ValueError(f"Missing required secrets: {', '.join(missing)}")

    @property
    def is_mock_mode(self) -> bool:
        return self.ai_mock_mode

    def get_model_for_agent(self, agent: str) -> Optional[str]:
        """Get model name for a specific agent."""
        agent_map = {
            "guardrails": self.ai_model_guardrails,
            "sql": self.ai_model_sql,
            "repair": self.ai_model_repair,
            "analysis": self.ai_model_analysis,
            "visualization": self.ai_model_visualization,
            "embedding": self.ai_model_embedding,
        }
        return agent_map.get(agent.lower())


settings = Settings()
