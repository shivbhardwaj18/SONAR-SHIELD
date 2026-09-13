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
    parse_metadata_csv,
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
    """Loads and registers the Mumbai Harbor demo sonar dataset and auto-runs the full pipeline."""
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
            "message": f"Successfully loaded and processed demo survey '{result.get('name')}' with {result['total_images']} sonar frames across all intelligence layers.",
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
    start_lat: Optional[float] = Form(None),
    start_lon: Optional[float] = Form(None),
    files: List[UploadFile] = File(...)
):
    """
    Accepts single or multi-image upload of side-scan sonar imagery, with optional survey_info.json and metadata.csv.
    Validates, assigns metadata, and stores in SQLite.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    # Preliminary pass: inspect if survey_info.json or metadata.csv are present in files
    temp_dir = os.path.join(UPLOAD_DIR, "staging_" + os.urandom(4).hex())
    os.makedirs(temp_dir, exist_ok=True)

    csv_metadata = {}
    json_info = {}
    image_files = []

    for file in files:
        fname = file.filename or "unknown"
        f_lower = fname.lower()
        if f_lower.endswith(".csv"):
            csv_path = os.path.join(temp_dir, "metadata.csv")
            with open(csv_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            csv_metadata = parse_metadata_csv(csv_path)
        elif f_lower.endswith(".json"):
            json_path = os.path.join(temp_dir, "survey_info.json")
            with open(json_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            try:
                with open(json_path, "r", encoding="utf-8-sig") as jf:
                    json_info = json.load(jf)
            except Exception as e:
                print(f"Notice: Failed to parse uploaded JSON file {fname}: {e}")
        else:
            image_files.append(file)

    # Determine final survey name and description
    final_name = (
        json_info.get("survey_name") 
        or json_info.get("name") 
        or (survey_name.strip() if survey_name and survey_name.strip() != "Custom Acoustic Survey" else None)
        or json_info.get("survey_id")
        or survey_name 
        or "Custom Acoustic Survey"
    )

    final_desc = (
        json_info.get("description")
        or json_info.get("desc")
        or survey_description
        or "User uploaded side-scan sonar image batch"
    )

    # Determine base coordinates (from survey_info.json, or form, or open sea default 18.9150, 72.8700)
    base_lat = float(
        json_info.get("base_latitude") 
        or json_info.get("latitude") 
        or json_info.get("start_lat") 
        or (start_lat if start_lat is not None else 18.9150)
    )
    base_lon = float(
        json_info.get("base_longitude") 
        or json_info.get("longitude") 
        or json_info.get("start_lon") 
        or (start_lon if start_lon is not None else 72.8700)
    )

    survey_meta = {
        "source": "User Upload",
        "coordinate_mode": "OPENSTREETMAP / SURVEY METADATA",
        "base_latitude": base_lat,
        "base_longitude": base_lon
    }
    if json_info:
        survey_meta.update(json_info)

    survey_id = register_survey_in_db(
        name=final_name,
        description=final_desc,
        is_demo=False,
        metadata=survey_meta
    )

    survey_upload_dir = os.path.join(UPLOAD_DIR, survey_id)
    os.makedirs(survey_upload_dir, exist_ok=True)

    # Move staged files if any
    if os.path.exists(os.path.join(temp_dir, "metadata.csv")):
        shutil.move(os.path.join(temp_dir, "metadata.csv"), os.path.join(survey_upload_dir, "metadata.csv"))
    if os.path.exists(os.path.join(temp_dir, "survey_info.json")):
        shutil.move(os.path.join(temp_dir, "survey_info.json"), os.path.join(survey_upload_dir, "survey_info.json"))
    shutil.rmtree(temp_dir, ignore_errors=True)

    saved_images = []
    skipped_files = []

    for idx, file in enumerate(image_files, start=1):
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

        img_meta = csv_metadata.get(filename, {})
        custom_lat = img_meta.get("lat")
        custom_lon = img_meta.get("lon")

        image_id = register_image_in_db(
            survey_id=survey_id,
            filename=filename,
            filepath=target_path,
            meta=meta,
            frame_index=idx,
            is_demo=False,
            custom_lat=custom_lat,
            custom_lon=custom_lon,
            base_lat=base_lat,
            base_lon=base_lon
        )

        saved_images.append({
            "id": image_id,
            "filename": filename,
            "frame_id": f"FRAME_{idx:04d}",
            "dimensions": f"{meta['width']}x{meta['height']}",
            "latitude": custom_lat if custom_lat is not None else base_lat,
            "longitude": custom_lon if custom_lon is not None else base_lon,
            "size_kb": meta["file_size_kb"]
        })

    if not saved_images:
        raise HTTPException(
            status_code=400,
            detail=f"None of the uploaded files were valid images. Errors: {skipped_files}"
        )

    return {
        "status": "success",
        "survey_id": survey_id,
        "survey_name": final_name,
        "total_uploaded": len(saved_images),
        "total_skipped": len(skipped_files),
        "has_custom_metadata": bool(csv_metadata),
        "has_survey_info": bool(json_info),
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
