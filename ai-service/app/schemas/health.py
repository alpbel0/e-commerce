from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    environment: str
    backend_base_url: str

