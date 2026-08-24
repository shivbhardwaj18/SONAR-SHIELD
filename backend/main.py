"""
Main FastAPI Application Entrypoint for SONAR-SHIELD.
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.database.db import init_db
from backend.api.routes_ingestion import router as ingestion_router
from backend.api.routes_detection import router as detection_router
from backend.api.routes_preprocessing import router as preprocessing_router
from backend.api.routes_evidence import router as evidence_router
from backend.api.routes_filtering import router as filtering_router
from backend.api.routes_spatial import router as spatial_router
from backend.api.routes_intelligence import router as intelligence_router
from backend.api.routes_export import router as export_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables
    init_db()
    print("SONAR-SHIELD Database Initialized.")
    yield
    # Shutdown: clean up if needed
    print("SONAR-SHIELD Server Shutting Down.")


app = FastAPI(
    title="SONAR-SHIELD Core API",
    description="AI-Powered Underwater Marine Debris and Anomaly Detection & Reasoning System",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(ingestion_router)
app.include_router(detection_router)
app.include_router(preprocessing_router)
app.include_router(evidence_router)
app.include_router(filtering_router)
app.include_router(spatial_router)
app.include_router(intelligence_router)
app.include_router(export_router)

# Mount static uploads, crops, and evidence directory
uploads_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "uploads"))
crops_path = os.path.join(uploads_path, "crops")
evidence_path = os.path.join(uploads_path, "evidence")
os.makedirs(crops_path, exist_ok=True)
os.makedirs(evidence_path, exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory=uploads_path), name="uploads")


@app.get("/")
def root():
    return {
        "project": "SONAR-SHIELD",
        "description": "AI-Powered Automated Underwater Marine Debris and Anomaly Detection System",
        "status": "OPERATIONAL",
        "docs_url": "/docs",
        "api_health": "/api/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
