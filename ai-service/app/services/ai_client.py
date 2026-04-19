"""AI service client for calling backend query executor."""

import httpx
from typing import Optional

from app.config import settings
from app.schemas.query_executor import QueryExecutorRequest, QueryExecutorResponse


class AIClient:
    """HTTP client for backend communication."""

    def __init__(self):
        self.base_url = settings.backend_base_url
        self.service_secret = settings.ai_service_key
        self.timeout = settings.query_timeout_seconds

    def _get_headers(self) -> dict:
        """Get headers for AI -> Backend calls."""
        return {
            "X-AI-Service-Key": self.service_secret,
            "Content-Type": "application/json"
        }

    async def execute_query(
        self, 
        request: QueryExecutorRequest
    ) -> QueryExecutorResponse:
        """
        Call backend query executor endpoint.
        
        Args:
            request: QueryExecutorRequest with SQL and parameters
            
        Returns:
            QueryExecutorResponse with results or error
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/internal/chat/execute",
                    json=request.model_dump(by_alias=True, mode="json"),
                    headers=self._get_headers()
                )
                
                if response.status_code == 200:
                    return QueryExecutorResponse(**response.json())
                elif response.status_code == 403:
                    return QueryExecutorResponse(
                        request_id=request.request_id,
                        error="Authentication failed",
                    )
                else:
                    return QueryExecutorResponse(
                        request_id=request.request_id,
                        error=f"Backend returned status {response.status_code}",
                    )
                    
            except httpx.TimeoutException:
                return QueryExecutorResponse(
                    request_id=request.request_id,
                    error="Query timeout",
                )
            except Exception as e:
                return QueryExecutorResponse(
                    request_id=request.request_id,
                    error=str(e),
                )

    async def get_schema(self) -> Optional[dict]:
        """
        Get schema from backend internal endpoint.
        
        Returns:
            Schema dict or None if unavailable
        """
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/internal/schema",
                    headers=self._get_headers()
                )
                
                if response.status_code == 200:
                    return response.json()
                return None
                
            except Exception:
                return None


# Singleton instance
ai_client = AIClient()
