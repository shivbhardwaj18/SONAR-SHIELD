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

# Ghost Net Specialized Physics Weights (Porous netting does not cast solid acoustic shadows)
GHOST_NET_WEIGHTS = {
    "ai": 0.50,
    "shape": 0.30,
    "shadow": 0.00,  # Shadow is completely exempt for porous flexible mesh
    "context": 0.20
}


def is_ghost_net(class_name: Optional[str]) -> bool:
    """Checks whether the candidate class is a ghost fishing net / porous mesh."""
    if not class_name:
        return False
    c = class_name.lower().replace("_", " ").strip()
    return c in ["ghost net", "ghostnet", "net", "fishing net"]


def compute_artificiality_score(
    conf: float,
    shape_score: float,
    shadow_score: Optional[float],
    context_score: float,
    weights: Optional[Dict[str, float]] = None,
    class_name: Optional[str] = None
) -> float:
    """
    Computes the weighted linear Prototype Artificiality Score normalized to [0.0, 1.0].
    For 'ghost net', acoustic shadow is exempt (0% weight) and the score is computed
    using an optimized formula: 0.50*AI + 0.30*Shape + 0.20*Context.
    """
    if is_ghost_net(class_name):
        w = weights or GHOST_NET_WEIGHTS
        w_ai = w.get("ai", GHOST_NET_WEIGHTS["ai"])
        w_shape = w.get("shape", GHOST_NET_WEIGHTS["shape"])
        w_context = w.get("context", GHOST_NET_WEIGHTS["context"])

        total_weight = w_ai + w_shape + w_context
        if total_weight <= 0:
            total_weight = 1.0

        nw_ai = w_ai / total_weight
        nw_shape = w_shape / total_weight
        nw_context = w_context / total_weight

        s_shape = shape_score if shape_score is not None else 0.85
        s_context = context_score if context_score is not None else 0.85

        score = (
            (conf * nw_ai) +
            (s_shape * nw_shape) +
            (s_context * nw_context)
        )
        return round(min(1.0, max(0.0, float(score))), 4)

    # Standard solid debris classes (Shipwreck, Tyre, etc.)
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

    s_shape = shape_score if shape_score is not None else 0.85
    s_shadow = shadow_score if shadow_score is not None else 0.70
    s_context = context_score if context_score is not None else 0.85

    score = (
        (conf * nw_ai) +
        (s_shape * nw_shape) +
        (s_shadow * nw_shadow) +
        (s_context * nw_context)
    )

    return round(min(1.0, max(0.0, float(score))), 4)


def fuse_detection_evidence(
    detection_id: str,
    weights: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Orchestrates all evidence modules (Shape, Shadow, Context) for a detection
    and updates SQLite with the computed scores and final Artificiality Score.
    For ghost nets, shadow is bypassed and artificiality is calculated with
    the optimized porous mesh formula.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT d.*, i.filepath, i.filename AS frame_filename, i.frame_id 
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
        os.makedirs(CROPS_DIR, exist_ok=True)
        crop_path = os.path.join(CROPS_DIR, f"{detection_id}.png")
        if not os.path.exists(crop_path) and os.path.exists(full_img_path):
            from backend.detection.yolo_service import SonarDetector
            detector = SonarDetector.get_instance()
            crop = detector.extract_crop(full_img_path, bbox)
            if crop is not None and crop.size > 0:
                cv2.imwrite(crop_path, crop)

        if os.path.exists(crop_path):
            crop_bgr = cv2.imread(crop_path)
            if crop_bgr is not None:
                shape_res = evaluate_detection_shape(detection_id, crop_bgr, class_name)
                shape_score = shape_res["shape_score"]
                shape_metrics = shape_res["metrics"]

        if shape_score is None:
            shape_score = 0.85

        # 2. Evaluate Shadow Evidence (Bypassed if Ghost Net)
        shadow_res = evaluate_detection_shadow(detection_id, full_img, bbox, class_name)
        shadow_score = shadow_res["shadow_score"]
        shadow_metrics = shadow_res["metrics"]

        # 3. Evaluate Context Evidence
        context_res = evaluate_detection_context(detection_id, full_img, bbox, class_name)
        context_score = context_res["context_score"]
        context_metrics = context_res["metrics"]

        # 4. Compute Final Fused Artificiality Score
        effective_weights = GHOST_NET_WEIGHTS if (is_ghost_net(class_name) and weights is None) else (weights or DEFAULT_WEIGHTS)
        artificiality_score = compute_artificiality_score(
            conf=conf,
            shape_score=shape_score,
            shadow_score=shadow_score,
            context_score=context_score,
            weights=weights,
            class_name=class_name
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
            "id": detection_id,
            "detection_id": detection_id,
            "image_id": det["image_id"],
            "survey_id": det["survey_id"],
            "frame_id": det["frame_id"],
            "frame_filename": det["frame_filename"],
            "class_name": class_name,
            "confidence": conf,
            "bbox_x1": det["bbox_x1"],
            "bbox_y1": det["bbox_y1"],
            "bbox_x2": det["bbox_x2"],
            "bbox_y2": det["bbox_y2"],
            "shape_score": shape_score,
            "shadow_score": shadow_score,
            "context_score": context_score,
            "artificiality_score": artificiality_score,
            "status": status_tag,
            "review_status": det["review_status"],
            "simulated_lat": det["simulated_lat"],
            "simulated_lon": det["simulated_lon"],
            "weights_used": effective_weights,
            "is_ghost_net": is_ghost_net(class_name),
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
