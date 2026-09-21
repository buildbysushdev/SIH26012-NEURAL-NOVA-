from datetime import datetime, timezone
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    """
    Standardized response model for service health check.
    Ensures type safety and consistent API documentation via OpenAPI/Swagger.
    """
    status: str = Field(..., description="Current system operational status, e.g., 'healthy'")
    service: str = Field(..., description="Service identifier name")
    version: str = Field(..., description="Current API build version")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Current UTC timestamp"
    )
    details: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Optional diagnostic and environment information"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "status": "healthy",
                "service": "MPLAD Risk Intelligence API",
                "version": "0.1.0",
                "timestamp": "2026-09-17T05:15:00Z",
                "details": {
                    "environment": "development",
                    "framework": "FastAPI"
                }
            }
        }
    }
