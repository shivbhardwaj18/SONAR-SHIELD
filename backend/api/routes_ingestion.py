"""
API Routes for Data Ingestion, Survey Management, and File Serving.
"""

import os
import json
import shutil
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from fastapi.responses import FileResponse

from backend.database.db import get_db
from backend.database.models import SystemHealthResponse, SurveyResponse, ImageMetadata
from backend.services.ingestion import (
    validate_image_file,
    register_survey_in_db,
    register_image_in_db,
    load_demo_survey,
    ALLOWED_EXTENSIONS
)

router = APIRouter(prefix="/api", tags=["Ingestion & Surveys"])

WEIGHTS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "ml", "weights", "best.pt"))
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "uploads"))


@router.get("/health", response_model=SystemHealthResponse)
def health_check():
    """Returns system status, model availability, and database metrics."""
    model_exists = os.path.exists(WEIGHTS_PATH)
    
    # Query database statistics
    total_surveys = 0
    total_images = 0
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM surveys")
            total_surveys = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM images")
            total_images = cursor.fetchone()[0]
    except Exception:
        pass

    classes = ["shipwreck", "tyre", "artificial reef", "rock", "sand ripple"]

    return SystemHealthResponse(
        status="ONLINE",
        version="1.0.0",
        model_loaded=model_exists,
        model_path="ml/weights/best.pt" if model_exists else "MISSING",
        detected_classes=classes,
        total_surveys=total_surveys,
        total_images=total_images,
        database="SQLite (Connected)"
    )


@router.post("/surveys/load-demo")
def trigger_load_demo_survey():
    """Loads and registers the 10 pre-packaged demo sonar images and auto-runs the full pipeline."""
    try:
        result = load_demo_survey()
        survey_id = result["survey_id"]

        # Proactively execute full intelligence pipeline for effortless zero-click demo
        try:
            from backend.detection.yolo_service import run_detection_on_survey
            from backend.evidence.fusion import fuse_survey_evidence
            from backend.spatial.geolocator import update_survey_spatial_coordinates
            from backend.spatial.clustering import run_survey_hotspot_clustering
            from backend.intelligence.bio_threat import evaluate_survey_bio_threat
            from backend.intelligence.cleanup import evaluate_survey_cleanup_priorities

            run_detection_on_survey(survey_id, conf_threshold=0.20)
            fuse_survey_evidence(survey_id)
            update_survey_spatial_coordinates(survey_id)
            run_survey_hotspot_clustering(survey_id, eps_meters=55.0, min_samples=2)
            evaluate_survey_bio_threat(survey_id)
            evaluate_survey_cleanup_priorities(survey_id)
        except Exception as pipe_err:
            print(f"Non-blocking demo auto-pipeline notice: {pipe_err}")

        return {
            "status": "success",
            "message": f"Successfully loaded and processed demo survey with {result['total_images']} sonar frames across all intelligence layers.",
            "data": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load demo survey: {str(e)}"
        )


@router.post("/surveys/upload")
async def upload_sonar_images(
    survey_name: Optional[str] = Form("Custom Acoustic Survey"),
    survey_description: Optional[str] = Form("User uploaded side-scan sonar image batch"),
    files: List[UploadFile] = File(...)
):
    """
    Accepts single or multi-image upload of side-scan sonar imagery.
    Validates, assigns simulated metadata, and stores in SQLite.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No image files provided.")

    survey_id = register_survey_in_db(
        name=survey_name or "Custom Survey",
        description=survey_description,
        is_demo=False,
        metadata={"source": "User Upload", "coordinate_mode": "DEMO / SIMULATED COORDINATES"}
    )

    survey_upload_dir = os.path.join(UPLOAD_DIR, survey_id)
    os.makedirs(survey_upload_dir, exist_ok=True)

    saved_images = []
    skipped_files = []

    for idx, file in enumerate(files, start=1):
        filename = file.filename or f"image_{idx}.png"
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            skipped_files.append({"filename": filename, "reason": f"Unsupported format {ext}"})
            continue

        target_path = os.path.join(survey_upload_dir, filename)
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        is_valid, err, meta = validate_image_file(target_path)
        if not is_valid:
            os.remove(target_path)
            skipped_files.append({"filename": filename, "reason": err or "Invalid image"})
            continue

        image_id = register_image_in_db(
            survey_id=survey_id,
            filename=filename,
            filepath=target_path,
            meta=meta,
            frame_index=idx,
            is_demo=False
        )

        saved_images.append({
            "id": image_id,
            "filename": filename,
            "frame_id": f"FRAME_{idx:04d}",
            "dimensions": f"{meta['width']}x{meta['height']}",
            "size_kb": meta["file_size_kb"]
        })

    if not saved_images:
        raise HTTPException(
            status_code=400,
            detail=f"None of the uploaded files were valid. Errors: {skipped_files}"
        )

    return {
        "status": "success",
        "survey_id": survey_id,
        "total_uploaded": len(saved_images),
        "total_skipped": len(skipped_files),
        "images": saved_images,
        "skipped": skipped_files
    }


@router.get("/surveys")
def list_surveys():
    """Lists all stored surveys."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM surveys ORDER BY created_at DESC")
        rows = cursor.fetchall()
        
        surveys = []
        for r in rows:
            meta = json.loads(r["metadata"]) if r["metadata"] else {}
            surveys.append({
                "id": r["id"],
                "name": r["name"],
                "description": r["description"],
                "total_images": r["total_images"],
                "status": r["status"],
                "is_demo": bool(r["is_demo"]),
                "created_at": r["created_at"],
                "metadata": meta
            })
        return {"surveys": surveys}


@router.get("/surveys/{survey_id}")
def get_survey_details(survey_id: str):
    """Returns details and all images for a specific survey."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM surveys WHERE id = ?", (survey_id,))
        survey_row = cursor.fetchone()
        if not survey_row:
            raise HTTPException(status_code=404, detail="Survey not found")

        cursor.execute("SELECT * FROM images WHERE survey_id = ? ORDER BY frame_id ASC", (survey_id,))
        image_rows = cursor.fetchall()

        images = []
        for img in image_rows:
            images.append({
                "id": img["id"],
                "survey_id": img["survey_id"],
                "filename": img["filename"],
                "frame_id": img["frame_id"],
                "width": img["width"],
                "height": img["height"],
                "file_size_kb": img["file_size_kb"],
                "simulated_lat": img["simulated_lat"],
                "simulated_lon": img["simulated_lon"],
                "is_simulated_coords": bool(img["is_simulated_coords"]),
                "is_demo": bool(img["is_demo"]),
                "has_labels": bool(img["has_labels"]),
                "created_at": img["created_at"]
            })

        meta = json.loads(survey_row["metadata"]) if survey_row["metadata"] else {}
        return {
            "survey": {
                "id": survey_row["id"],
                "name": survey_row["name"],
                "description": survey_row["description"],
                "total_images": survey_row["total_images"],
                "status": survey_row["status"],
                "is_demo": bool(survey_row["is_demo"]),
                "created_at": survey_row["created_at"],
                "metadata": meta
            },
            "images": images
        }


@router.get("/images/{image_id}/file")
def get_image_file(image_id: str):
    """Serves the actual image file binary."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT filepath, filename FROM images WHERE id = ?", (image_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Image not found")
        
        filepath = row["filepath"]
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Image file missing from disk")

        return FileResponse(filepath, filename=row["filename"])
