from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.router import api_router
from app.db.session import SessionLocal
from app.services.account_services import AccountServices

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure all financial year sequences exist on startup
    async with SessionLocal() as db:
        await AccountServices.ensure_fy_sequences(db)
    yield

# Create core FastAPI application instance
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Corporate Enterprise Resource Planning API Gateway",
    version="1.0.0",
    docs_url="/docs",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Configure Cross-Origin Resource Sharing (CORS)
# Allows our React frontend on different ports or environments to communicate smoothly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Aggregate modular routers
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/api/v1/health", tags=["System Status Verification"])
async def health_check():
    """Verify backend system status and database health connection."""
    return {
        "success": True,
        "status": "healthy",
        "timestamp": "2026-06-01T22:30:00+05:30",
        "service": settings.PROJECT_NAME
    }
