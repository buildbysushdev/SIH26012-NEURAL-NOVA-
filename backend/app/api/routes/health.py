import sys
from fastapi import APIRouter, status
from app.models.schemas import HealthCheckResponse

router = APIRouter(prefix="/health", tags=["Health & Diagnostics"])


@router.get(
    "",
    response_model=HealthCheckResponse,
    status_code=status.HTTP_200_OK,
    summary="System Health & Diagnostic Check",
    description="Returns service uptime status, API version, and runtime diagnostics for monitoring."
)
async def check_health() -> HealthCheckResponse:
    """
    Endpoint for liveness/readiness probes and basic verification.
    """
    return HealthCheckResponse(
        status="healthy",
        service="MPLAD Risk Intelligence API",
        version="0.1.0",
        details={
            "python_version": sys.version.split()[0],
            "framework": "FastAPI",
            "environment": "development",
            "system": "SIH26102 - Neural Nova"
        }
    )
