"""
Multi-Evidence Fusion and Artificiality Scoring Service for SONAR-SHIELD.
Combines AI Confidence, Shape Geometry, Acoustic Shadow, and Seabed Context into
a transparent, configurable Prototype Artificiality Score.
"""

import os
import cv2
from typing import Dict, Any, Optional

from backend.database.db import get_db
from backend.detection.yolo_service import CROPS_DIR
from backend.evidence.shape import evaluate_detection_shape
from backend.evidence.shadow import evaluate_detection_shadow
from backend.evidence.context import evaluate_detection_context

# Master Prototype Evidence Weights (Configurable)
DEFAULT_WEIGHTS = {
    "ai": 0.40,
    "shape": 0.25,
    "shadow": 0.20,
    "context": 0.15
}


def compute_artificiality_score(
    conf: float,
    shape_score: float,
    shadow_score: float,
    context_score: float,
    weights: Optional[Dict[str, float]] = None
) -> float:
    """
    Computes the weighted linear Prototype Artificiality Score normalized to [0.0, 1.0].
    """
    w = weights or DEFAULT_WEIGHTS
    w_ai = w.get("ai", DEFAULT_WEIGHTS["ai"])
    w_shape = w.get("shape", DEFAULT_WEIGHTS["shape"])
    w_shadow = w.get("shadow", DEFAULT_WEIGHTS["shadow"])
    w_context = w.get("context", DEFAULT_WEIGHTS["context"])

    total_weight = w_ai + w_shape + w_shadow + w_context
    if total_weight <= 0:
        total_weight = 1.0

    # Normalized weights
    nw_ai = w_ai / total_weight
    nw_shape = w_shape / total_weight
    nw_shadow = w_shadow / total_weight
    nw_context = w_context / total_weight

    score = (
        (conf * nw_ai) +
        (shape_score * nw_shape) +
        (shadow_score * nw_shadow) +
        (context_score * nw_context)
    )

    return round(min(1.0, max(0.0, float(score))), 4)


def fuse_detection_evidence(
    detection_id: str,
    weights: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Orchestrates all 3 evidence modules (Shape, Shadow, Context) for a detection
    and updates SQLite with the computed scores and final Artificiality Score.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT d.*, i.filepath 
        FROM detections d 
        JOIN images i ON d.image_id = i.id 
        WHERE d.id = ?
        """, (detection_id,))
        det = cursor.fetchone()
        if not det:
            raise ValueError(f"Detection {detection_id} not found in database.")

        full_img_path = det["filepath"]
        full_img = cv2.imread(full_img_path)
        if full_img is None:
            raise ValueError(f"Failed to read sonar image from {full_img_path}")

        bbox = [det["bbox_x1"], det["bbox_y1"], det["bbox_x2"], det["bbox_y2"]]
        class_name = det["class_name"]
        conf = float(det["confidence"])

        # 1. Evaluate Shape Evidence (if not cached or requested)
        shape_score = det["shape_score"]
        shape_metrics = {}
        crop_path = os.path.join(CROPS_DIR, f"{detection_id}.png")
        if os.path.exists(crop_path):
            crop_bgr = cv2.imread(crop_path)
            if crop_bgr is not None:
                shape_res = evaluate_detection_shape(detection_id, crop_bgr, class_name)
                shape_score = shape_res["shape_score"]
                shape_metrics = shape_res["metrics"]

        if shape_score is None:
            shape_score = 0.50

        # 2. Evaluate Shadow Evidence
        shadow_res = evaluate_detection_shadow(detection_id, full_img, bbox, class_name)
        shadow_score = shadow_res["shadow_score"]
        shadow_metrics = shadow_res["metrics"]

        # 3. Evaluate Context Evidence
        context_res = evaluate_detection_context(detection_id, full_img, bbox, class_name)
        context_score = context_res["context_score"]
        context_metrics = context_res["metrics"]

        # 4. Compute Final Fused Artificiality Score
        artificiality_score = compute_artificiality_score(
            conf=conf,
            shape_score=shape_score,
            shadow_score=shadow_score,
            context_score=context_score,
            weights=weights
        )

        # 5. Determine Candidate Operational Status based on Master Thresholds (Phase 8 preview)
        if class_name in ["rock", "sand ripple"]:
            status_tag = "NATURAL"
        elif class_name == "artificial reef":
            status_tag = "ARTIFICIAL_STRUCTURE"
        elif artificiality_score >= 0.80:
            status_tag = "VALIDATED"
        elif artificiality_score >= 0.60:
            status_tag = "NEEDS REVIEW"
        else:
            status_tag = "LOW ARTIFICIALITY"

        # 6. Update SQLite
        cursor.execute("""
        UPDATE detections 
        SET shape_score = ?, shadow_score = ?, context_score = ?, artificiality_score = ?, status = ?
        WHERE id = ?
        """, (shape_score, shadow_score, context_score, artificiality_score, status_tag, detection_id))

        return {
            "detection_id": detection_id,
            "image_id": det["image_id"],
            "survey_id": det["survey_id"],
            "class_name": class_name,
            "confidence": conf,
            "shape_score": shape_score,
            "shadow_score": shadow_score,
            "context_score": context_score,
            "artificiality_score": artificiality_score,
            "status": status_tag,
            "weights_used": weights or DEFAULT_WEIGHTS,
            "metrics": {
                "shape": shape_metrics,
                "shadow": shadow_metrics,
                "context": context_metrics
            },
            "diagnostic_urls": {
                "crop": f"/api/detections/{detection_id}/crop",
                "shape_overlay": f"/api/detections/{detection_id}/shape-overlay",
                "shadow_overlay": f"/api/detections/{detection_id}/shadow-overlay",
                "context_overlay": f"/api/detections/{detection_id}/context-overlay"
            }
        }


def fuse_survey_evidence(
    survey_id: str,
    weights: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Batch executes full evidence fusion across all detections in a survey.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM detections WHERE survey_id = ?", (survey_id,))
        rows = cursor.fetchall()
        if not rows:
            raise ValueError(f"No detections found for survey {survey_id}")

    fused_list = []
    for r in rows:
        fused = fuse_detection_evidence(r["id"], weights=weights)
        fused_list.append(fused)

    return {
        "survey_id": survey_id,
        "total_fused": len(fused_list),
        "weights_applied": weights or DEFAULT_WEIGHTS,
        "detections": fused_list
    }
