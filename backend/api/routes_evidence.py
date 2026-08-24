"""
API Routes for SONAR-SHIELD Evidence Layer (Shape, Shadow, Context & Multi-Evidence Fusion).
"""

import os
import cv2
from typing import Optional, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Query, status, Body
from fastapi.responses import FileResponse

from backend.database.db import get_db
from backend.detection.yolo_service import CROPS_DIR
from backend.evidence.shape import evaluate_detection_shape, EVIDENCE_CROPS_DIR
from backend.evidence.shadow import evaluate_detection_shadow
from backend.evidence.context import evaluate_detection_context
from backend.evidence.fusion import (
    compute_artificiality_score,
    fuse_detection_evidence,
    fuse_survey_evidence,
    DEFAULT_WEIGHTS
)

router = APIRouter(prefix="/api", tags=["Evidence Intelligence"])


class FusionWeightsPayload(BaseModel):
    ai: Optional[float] = 0.40
    shape: Optional[float] = 0.25
    shadow: Optional[float] = 0.20
    context: Optional[float] = 0.15


# ==================== CONFIGURATION ====================

@router.get("/evidence/weights")
def get_default_evidence_weights():
    """Returns the default transparent evidence fusion weights."""
    return {
        "weights": DEFAULT_WEIGHTS,
        "description": "Prototype Multi-Evidence Fusion Weights (40% AI, 25% Shape, 20% Shadow, 15% Context)"
    }


# ==================== MULTI-EVIDENCE FUSION ====================

@router.post("/detections/{detection_id}/fuse-evidence")
def fuse_single_detection_endpoint(
    detection_id: str,
    payload: Optional[FusionWeightsPayload] = Body(None)
):
    """
    Executes full multi-evidence fusion across AI, Shape, Shadow, and Context channels
    and computes the final Prototype Artificiality Score for a candidate detection.
    """
    weights = payload.dict() if payload else None
    try:
        result = fuse_detection_evidence(detection_id, weights=weights)
        return {
            "status": "success",
            "data": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Evidence fusion failed for detection {detection_id}: {str(e)}"
        )


@router.post("/surveys/{survey_id}/fuse-evidence")
def fuse_survey_evidence_endpoint(
    survey_id: str,
    payload: Optional[FusionWeightsPayload] = Body(None)
):
    """
    Batch executes multi-evidence fusion across all candidate detections in a survey.
    """
    weights = payload.dict() if payload else None
    try:
        result = fuse_survey_evidence(survey_id, weights=weights)
        return {
            "status": "success",
            "message": f"Successfully computed evidence fusion and Artificiality Scores for {result['total_fused']} detections.",
            "data": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Survey evidence fusion failed: {str(e)}"
        )


@router.get("/detections/{detection_id}/evidence-dossier")
def get_detection_evidence_dossier(detection_id: str):
    """
    Retrieves the complete evidence dossier for a detection.
    If evidence is missing, automatically computes and caches it.
    """
    try:
        result = fuse_detection_evidence(detection_id)
        return {
            "status": "success",
            "dossier": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate evidence dossier: {str(e)}"
        )


# ==================== SHAPE EVIDENCE ====================

@router.post("/detections/{detection_id}/evaluate-shape")
def evaluate_single_shape_evidence(detection_id: str):
    """Computes Shape Evidence Score for a specific detection."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM detections WHERE id = ?", (detection_id,))
        det = cursor.fetchone()
        if not det:
            raise HTTPException(status_code=404, detail="Detection not found")

        crop_path = os.path.join(CROPS_DIR, f"{detection_id}.png")
        if not os.path.exists(crop_path):
            raise HTTPException(status_code=404, detail="Detection crop image not found on disk")

        crop_bgr = cv2.imread(crop_path)
        if crop_bgr is None:
            raise HTTPException(status_code=500, detail="Failed to decode crop image")

        result = evaluate_detection_shape(
            detection_id=detection_id,
            crop_bgr=crop_bgr,
            class_name=det["class_name"]
        )

        cursor.execute("UPDATE detections SET shape_score = ? WHERE id = ?", (result["shape_score"], detection_id))

        return {
            "status": "success",
            "detection_id": detection_id,
            "shape_score": result["shape_score"],
            "metrics": result["metrics"],
            "diagnostic_url": f"/api/detections/{detection_id}/shape-overlay"
        }


@router.get("/detections/{detection_id}/shape-overlay")
def serve_shape_diagnostic_image(detection_id: str):
    """Streams the contour and convex hull diagnostic image."""
    diag_path = os.path.join(EVIDENCE_CROPS_DIR, f"shape_{detection_id}.png")
    if not os.path.exists(diag_path):
        crop_path = os.path.join(CROPS_DIR, f"{detection_id}.png")
        if os.path.exists(crop_path):
            crop_bgr = cv2.imread(crop_path)
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT class_name FROM detections WHERE id = ?", (detection_id,))
                det = cursor.fetchone()
                if det and crop_bgr is not None:
                    evaluate_detection_shape(detection_id, crop_bgr, det["class_name"])

    if not os.path.exists(diag_path):
        raise HTTPException(status_code=404, detail="Shape diagnostic overlay not available")

    return FileResponse(diag_path, media_type="image/png")


# ==================== SHADOW EVIDENCE ====================

@router.post("/detections/{detection_id}/evaluate-shadow")
def evaluate_single_shadow_evidence(detection_id: str):
    """Computes Acoustic Shadow Evidence Score for a specific detection."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT d.*, i.filepath FROM detections d JOIN images i ON d.image_id = i.id WHERE d.id = ?", (detection_id,))
        det = cursor.fetchone()
        if not det:
            raise HTTPException(status_code=404, detail="Detection or associated image not found")

        full_img = cv2.imread(det["filepath"])
        if full_img is None:
            raise HTTPException(status_code=500, detail="Failed to load full sonar frame")

        bbox = [det["bbox_x1"], det["bbox_y1"], det["bbox_x2"], det["bbox_y2"]]
        res = evaluate_detection_shadow(
            detection_id=detection_id,
            full_img_bgr=full_img,
            bbox_pixels=bbox,
            class_name=det["class_name"]
        )

        cursor.execute("UPDATE detections SET shadow_score = ? WHERE id = ?", (res["shadow_score"], detection_id))

        return {
            "status": "success",
            "detection_id": detection_id,
            "shadow_score": res["shadow_score"],
            "metrics": res["metrics"],
            "diagnostic_url": f"/api/detections/{detection_id}/shadow-overlay"
        }


@router.get("/detections/{detection_id}/shadow-overlay")
def serve_shadow_diagnostic_image(detection_id: str):
    """Streams the target vs shadow diagnostic image."""
    diag_path = os.path.join(EVIDENCE_CROPS_DIR, f"shadow_{detection_id}.png")
    if not os.path.exists(diag_path):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT d.*, i.filepath FROM detections d JOIN images i ON d.image_id = i.id WHERE d.id = ?", (detection_id,))
            det = cursor.fetchone()
            if det:
                full_img = cv2.imread(det["filepath"])
                bbox = [det["bbox_x1"], det["bbox_y1"], det["bbox_x2"], det["bbox_y2"]]
                evaluate_detection_shadow(detection_id, full_img, bbox, det["class_name"])

    if not os.path.exists(diag_path):
        raise HTTPException(status_code=404, detail="Shadow diagnostic overlay not available")

    return FileResponse(diag_path, media_type="image/png")


# ==================== CONTEXT EVIDENCE ====================

@router.post("/detections/{detection_id}/evaluate-context")
def evaluate_single_context_evidence(detection_id: str):
    """Computes Seabed Context Evidence Score for a specific detection."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT d.*, i.filepath FROM detections d JOIN images i ON d.image_id = i.id WHERE d.id = ?", (detection_id,))
        det = cursor.fetchone()
        if not det:
            raise HTTPException(status_code=404, detail="Detection or image not found")

        full_img = cv2.imread(det["filepath"])
        if full_img is None:
            raise HTTPException(status_code=500, detail="Failed to load full sonar frame")

        bbox = [det["bbox_x1"], det["bbox_y1"], det["bbox_x2"], det["bbox_y2"]]
        res = evaluate_detection_context(
            detection_id=detection_id,
            full_img_bgr=full_img,
            bbox_pixels=bbox,
            class_name=det["class_name"]
        )

        cursor.execute("UPDATE detections SET context_score = ? WHERE id = ?", (res["context_score"], detection_id))

        return {
            "status": "success",
            "detection_id": detection_id,
            "context_score": res["context_score"],
            "metrics": res["metrics"],
            "diagnostic_url": f"/api/detections/{detection_id}/context-overlay"
        }


@router.get("/detections/{detection_id}/context-overlay")
def serve_context_diagnostic_image(detection_id: str):
    """Streams the target vs context annulus diagnostic image."""
    diag_path = os.path.join(EVIDENCE_CROPS_DIR, f"context_{detection_id}.png")
    if not os.path.exists(diag_path):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT d.*, i.filepath FROM detections d JOIN images i ON d.image_id = i.id WHERE d.id = ?", (detection_id,))
            det = cursor.fetchone()
            if det:
                full_img = cv2.imread(det["filepath"])
                bbox = [det["bbox_x1"], det["bbox_y1"], det["bbox_x2"], det["bbox_y2"]]
                evaluate_detection_context(detection_id, full_img, bbox, det["class_name"])

    if not os.path.exists(diag_path):
        raise HTTPException(status_code=404, detail="Context diagnostic overlay not available")

    return FileResponse(diag_path, media_type="image/png")
