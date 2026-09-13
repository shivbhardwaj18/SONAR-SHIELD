"""
API Routes for YOLO Object Detection, Target Extraction, and Bounding Box Telemetry.
"""

import os
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse

from backend.database.db import get_db
from backend.detection.yolo_service import (
    run_detection_on_image,
    run_detection_on_survey,
    CROPS_DIR
)

router = APIRouter(prefix="/api", tags=["YOLO Detection & Analysis"])


@router.post("/images/{image_id}/run-detection")
def detect_single_image(
    image_id: str,
    conf_threshold: float = Query(0.20, ge=0.05, le=0.95, description="Confidence threshold"),
    iou_threshold: float = Query(0.45, ge=0.10, le=0.90, description="IoU NMS threshold")
):
    """Executes YOLO detector on a single sonar frame and saves detections to database."""
    try:
        result = run_detection_on_image(
            image_id=image_id,
            conf_threshold=conf_threshold,
            iou_threshold=iou_threshold,
            re_detect=True
        )
        return {
            "status": "success",
            "data": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Detection failed on image {image_id}: {str(e)}"
        )


@router.post("/surveys/{survey_id}/run-detection")
def detect_entire_survey(
    survey_id: str,
    conf_threshold: float = Query(0.20, ge=0.05, le=0.95, description="Confidence threshold"),
    iou_threshold: float = Query(0.45, ge=0.10, le=0.90, description="IoU NMS threshold")
):
    """Batch-executes YOLO detector across all frames in the survey."""
    try:
        result = run_detection_on_survey(
            survey_id=survey_id,
            conf_threshold=conf_threshold,
            iou_threshold=iou_threshold
        )
        return {
            "status": "success",
            "message": f"Processed {result['total_frames_processed']} frames, extracted {result['total_detections']} detections.",
            "data": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch detection failed for survey {survey_id}: {str(e)}"
        )


@router.get("/images/{image_id}/detections")
def get_image_detections(image_id: str):
    """Retrieves all detections and bounding boxes for a specific sonar frame."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM images WHERE id = ?", (image_id,))
        img = cursor.fetchone()
        if not img:
            raise HTTPException(status_code=404, detail="Image not found")

        cursor.execute("SELECT * FROM detections WHERE image_id = ? ORDER BY confidence DESC", (image_id,))
        rows = cursor.fetchall()

        detections = []
        for r in rows:
            w = img["width"]
            h = img["height"]
            x1, y1, x2, y2 = r["bbox_x1"], r["bbox_y1"], r["bbox_x2"], r["bbox_y2"]
            norm_box = [
                round((x1 + x2) / 2.0 / w, 6),
                round((y1 + y2) / 2.0 / h, 6),
                round((x2 - x1) / w, 6),
                round((y2 - y1) / h, 6)
            ]
            detections.append({
                "id": r["id"],
                "image_id": r["image_id"],
                "survey_id": r["survey_id"],
                "class_id": r["class_id"],
                "class_name": r["class_name"],
                "confidence": r["confidence"],
                "bbox_x1": x1,
                "bbox_y1": y1,
                "bbox_x2": x2,
                "bbox_y2": y2,
                "box_width": max(1, x2 - x1),
                "box_height": max(1, y2 - y1),
                "bbox": [x1, y1, x2, y2],
                "bbox_normalized": norm_box,
                "shape_score": r["shape_score"],
                "shadow_score": r["shadow_score"],
                "context_score": r["context_score"],
                "artificiality_score": r["artificiality_score"],
                "status": r["status"],
                "review_status": r["review_status"],
                "simulated_lat": r["simulated_lat"],
                "simulated_lon": r["simulated_lon"],
                "created_at": r["created_at"]
            })

        return {
            "image": {
                "id": img["id"],
                "filename": img["filename"],
                "frame_id": img["frame_id"],
                "width": img["width"],
                "height": img["height"],
                "simulated_lat": img["simulated_lat"],
                "simulated_lon": img["simulated_lon"]
            },
            "total_detections": len(detections),
            "detections": detections
        }


@router.get("/surveys/{survey_id}/detections")
def get_survey_detections(
    survey_id: str,
    class_name: Optional[str] = Query(None, description="Filter by class name"),
    min_confidence: Optional[float] = Query(None, description="Filter by minimum confidence"),
    status_filter: Optional[str] = Query(None, description="Filter by status")
):
    """Retrieves all detections across a survey with optional filters."""
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM detections WHERE survey_id = ?"
        params = [survey_id]

        if class_name:
            query += " AND class_name = ?"
            params.append(class_name)
        if min_confidence is not None:
            query += " AND confidence >= ?"
            params.append(min_confidence)
        if status_filter:
            query += " AND status = ?"
            params.append(status_filter)

        query += " ORDER BY confidence DESC"
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()

        detections = []
        for r in rows:
            x1, y1, x2, y2 = r["bbox_x1"], r["bbox_y1"], r["bbox_x2"], r["bbox_y2"]
            detections.append({
                "id": r["id"],
                "image_id": r["image_id"],
                "survey_id": r["survey_id"],
                "class_id": r["class_id"],
                "class_name": r["class_name"],
                "confidence": r["confidence"],
                "bbox_x1": x1,
                "bbox_y1": y1,
                "bbox_x2": x2,
                "bbox_y2": y2,
                "box_width": max(1, x2 - x1),
                "box_height": max(1, y2 - y1),
                "bbox": [x1, y1, x2, y2],
                "shape_score": r["shape_score"],
                "shadow_score": r["shadow_score"],
                "context_score": r["context_score"],
                "artificiality_score": r["artificiality_score"],
                "status": r["status"],
                "review_status": r["review_status"],
                "simulated_lat": r["simulated_lat"],
                "simulated_lon": r["simulated_lon"],
                "created_at": r["created_at"]
            })

        return {
            "survey_id": survey_id,
            "total_detections": len(detections),
            "detections": detections
        }


@router.get("/detections/{detection_id}/crop")
def get_detection_crop(detection_id: str):
    """Serves the cropped target image for a specific detection."""
    os.makedirs(CROPS_DIR, exist_ok=True)
    crop_path = os.path.join(CROPS_DIR, f"{detection_id}.png")
    
    if not os.path.exists(crop_path):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT d.*, i.filepath FROM detections d JOIN images i ON d.image_id = i.id WHERE d.id = ?", (detection_id,))
            det = cursor.fetchone()
            if det and os.path.exists(det["filepath"]):
                import cv2
                from backend.detection.yolo_service import SonarDetector
                detector = SonarDetector.get_instance()
                bbox = [det["bbox_x1"], det["bbox_y1"], det["bbox_x2"], det["bbox_y2"]]
                crop = detector.extract_crop(det["filepath"], bbox)
                if crop is not None and crop.size > 0:
                    cv2.imwrite(crop_path, crop)

    if not os.path.exists(crop_path):
        raise HTTPException(status_code=404, detail="Detection crop not found on disk")
    return FileResponse(crop_path, media_type="image/png")
