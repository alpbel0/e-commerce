from fastapi import FastAPI

from app.config import settings
from app.schemas.health import HealthResponse

app = FastAPI(title="ecommerce-ai-service")


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "ecommerce-ai-service", "status": "running"}


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        environment=settings.app_env,
        backend_base_url=settings.backend_base_url
    )
