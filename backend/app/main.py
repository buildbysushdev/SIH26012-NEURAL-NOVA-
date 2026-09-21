from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health

app = FastAPI(
    title="MPLAD Risk Intelligence System API",
    description=(
        "Backend API for SIH26102 (Team Neural Nova). Provides decision-support "
        "risk prioritization for MPLAD scheme audits using unsupervised anomaly "
        "detection, geospatial analysis, NLP duplicate checks, and sanction-time interception."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure Cross-Origin Resource Sharing (CORS) for local frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Default React/Vite port
        "http://localhost:5173",  # Default Vite port
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers with version prefix
app.include_router(health.router, prefix="/api/v1")


@app.get("/", tags=["Root"])
async def root():
    """
    Root landing endpoint redirecting users/auditors to the documentation.
    """
    return {
        "message": "Welcome to the MPLAD Risk Intelligence API",
        "documentation": "/docs",
        "health_check": "/api/v1/health",
        "project": "SIH26102 - Team Neural Nova"
    }
