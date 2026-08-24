"""
Seabed Context Evidence Extraction Module for SONAR-SHIELD.
Analyzes the surrounding seabed context annulus to evaluate local contrast saliency,
background texture variance, and edge density clutter.
"""

import os
import cv2
import numpy as np
from typing import Dict, Any, Tuple, Optional

EVIDENCE_CROPS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "uploads", "evidence")
)


def ensure_evidence_dir():
    os.makedirs(EVIDENCE_CROPS_DIR, exist_ok=True)


def extract_seabed_context_annulus(
    full_img_bgr: np.ndarray,
    bbox_pixels: list,
    pad_ratio: float = 0.80
) -> Dict[str, Any]:
    """
    Extracts the surrounding seabed context annulus (masking out the inner target).
    """
    if full_img_bgr is None or full_img_bgr.size == 0:
        return {"valid": False}

    img_h, img_w = full_img_bgr.shape[:2]
    tx1, ty1, tx2, ty2 = int(bbox_pixels[0]), int(bbox_pixels[1]), int(bbox_pixels[2]), int(bbox_pixels[3])
    tx1 = max(0, min(img_w - 1, tx1))
    ty1 = max(0, min(img_h - 1, ty1))
    tx2 = max(tx1 + 1, min(img_w, tx2))
    ty2 = max(ty1 + 1, min(img_h, ty2))
    
    bw = max(1, tx2 - tx1)
    bh = max(1, ty2 - ty1)

    target_crop = full_img_bgr[ty1:ty2, tx1:tx2]
    if target_crop.size == 0:
        return {"valid": False}

    target_gray = cv2.cvtColor(target_crop, cv2.COLOR_BGR2GRAY) if len(target_crop.shape) == 3 else target_crop

    # Outer expanded context bounding box
    ox1 = max(0, tx1 - int(bw * pad_ratio))
    oy1 = max(0, ty1 - int(bh * pad_ratio))
    ox2 = min(img_w, tx2 + int(bw * pad_ratio))
    oy2 = min(img_h, ty2 + int(bh * pad_ratio))

    context_crop_bgr = full_img_bgr[oy1:oy2, ox1:ox2].copy()
    context_crop_gray = cv2.cvtColor(context_crop_bgr, cv2.COLOR_BGR2GRAY) if len(context_crop_bgr.shape) == 3 else context_crop_bgr

    # Create annular mask (1 for context seabed, 0 for target inner box)
    mask = np.ones(context_crop_gray.shape, dtype=np.uint8)
    inner_x1 = tx1 - ox1
    inner_y1 = ty1 - oy1
    inner_x2 = tx2 - ox1
    inner_y2 = ty2 - oy1
    mask[inner_y1:inner_y2, inner_x1:inner_x2] = 0

    # Extract pixels belonging to context annulus
    context_pixels = context_crop_gray[mask == 1]
    if context_pixels.size == 0:
        context_pixels = context_crop_gray.flatten()

    return {
        "valid": True,
        "target_gray": target_gray,
        "context_pixels": context_pixels,
        "context_crop_bgr": context_crop_bgr,
        "context_crop_gray": context_crop_gray,
        "target_bbox": [tx1, ty1, tx2, ty2],
        "outer_bbox": [ox1, oy1, ox2, oy2],
        "inner_rel_bbox": [inner_x1, inner_y1, inner_x2, inner_y2],
        "mask": mask
    }


def compute_context_metrics(annulus_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Computes local contrast, background texture variance, and edge clutter density.
    """
    if not annulus_data.get("valid", False):
        return {
            "local_contrast": 0.0,
            "context_variance": 0.0,
            "edge_density": 0.0,
            "target_mean": 0.0,
            "context_mean": 0.0,
            "context_score": 0.35
        }

    t_gray = annulus_data["target_gray"]
    c_pixels = annulus_data["context_pixels"]
    c_crop_gray = annulus_data["context_crop_gray"]
    mask = annulus_data["mask"]

    target_mean = float(np.mean(t_gray))
    context_mean = float(np.mean(c_pixels))
    context_std = float(np.std(c_pixels))

    # Local contrast ratio: |Target - Context| / Context
    local_contrast = abs(target_mean - context_mean) / (max(context_mean, 10.0))
    local_contrast = round(min(1.5, local_contrast), 4)

    # Edge density in context region using Canny
    edges = cv2.Canny(c_crop_gray, 50, 150)
    context_edges = edges[mask == 1]
    edge_density = round(float(np.sum(context_edges > 0)) / float(context_edges.size + 1e-5), 4)

    # Heuristic Context Score Combination:
    # 1. High contrast against seabed -> strong indication of foreign object (+45%)
    # 2. Low background variance (uniform seabed) -> foreign object stands out (+35%)
    # 3. Low background clutter -> (+20%)
    contrast_comp = min(1.0, local_contrast * 1.2) * 0.45
    uniformity_comp = max(0.0, 1.0 - (context_std / 60.0)) * 0.35
    clutter_comp = max(0.0, 1.0 - (edge_density * 2.5)) * 0.20

    raw_score = contrast_comp + uniformity_comp + clutter_comp
    context_score = round(min(1.0, max(0.05, float(raw_score))), 4)

    return {
        "local_contrast": local_contrast,
        "context_variance": round(context_std, 2),
        "edge_density": edge_density,
        "target_mean": round(target_mean, 2),
        "context_mean": round(context_mean, 2),
        "context_score": context_score
    }


def generate_context_diagnostic_image(
    annulus_data: Dict[str, Any],
    metrics: Dict[str, Any],
    detection_id: str,
    class_name: str
) -> str:
    """
    Renders an annotated diagnostic view showing the Target Box (Cyan)
    and surrounding Seabed Context Annulus (Amber) with telemetry overlay.
    """
    ensure_evidence_dir()
    out_filename = f"context_{detection_id}.png"
    out_filepath = os.path.join(EVIDENCE_CROPS_DIR, out_filename)

    context_crop = annulus_data["context_crop_bgr"].copy()
    ch, cw = context_crop.shape[:2]
    ix1, iy1, ix2, iy2 = annulus_data["inner_rel_bbox"]

    # 1. Draw Outer Annulus Box (Amber)
    cv2.rectangle(context_crop, (2, 2), (cw - 3, ch - 3), (0, 180, 255), 2)

    # 2. Draw Target Inner Box (Cyan)
    cv2.rectangle(context_crop, (ix1, iy1), (ix2, iy2), (0, 255, 200), 2)

    # Create composite canvas
    canvas_w = max(360, cw + 40)
    canvas_h = max(260, ch + 90)
    canvas = np.zeros((canvas_h, canvas_w, 3), dtype=np.uint8)
    canvas[:] = (10, 16, 28)

    # Place annotated crop
    canvas[25:25+ch, 20:20+cw] = context_crop

    # Overlay Telemetry Text
    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(canvas, f"TARGET (CYAN) & SEABED CONTEXT ANNULUS (AMBER)", (20, 16), font, 0.35, (148, 163, 184), 1, cv2.LINE_AA)

    y_text = 25 + ch + 25
    stats_text1 = f"CONTEXT SCORE: {int(metrics['context_score']*100)}% | CLASS: {class_name.upper()}"
    stats_text2 = f"Local Contrast: {metrics['local_contrast']:.2f} | Seabed StdDev: {metrics['context_variance']}"
    stats_text3 = f"Target Mean: {metrics['target_mean']} | Seabed Context Mean: {metrics['context_mean']}"

    cv2.putText(canvas, stats_text1, (20, y_text), font, 0.42, (0, 180, 255), 1, cv2.LINE_AA)
    cv2.putText(canvas, stats_text2, (20, y_text + 20), font, 0.35, (148, 163, 184), 1, cv2.LINE_AA)
    cv2.putText(canvas, stats_text3, (20, y_text + 38), font, 0.32, (100, 116, 139), 1, cv2.LINE_AA)

    cv2.imwrite(out_filepath, canvas)
    return out_filepath


def evaluate_detection_context(
    detection_id: str,
    full_img_bgr: np.ndarray,
    bbox_pixels: list,
    class_name: str
) -> Dict[str, Any]:
    """
    Executes full seabed context evidence extraction and diagnostic generation for a detection.
    """
    annulus_data = extract_seabed_context_annulus(full_img_bgr, bbox_pixels)
    metrics = compute_context_metrics(annulus_data)

    diag_path = generate_context_diagnostic_image(
        annulus_data=annulus_data,
        metrics=metrics,
        detection_id=detection_id,
        class_name=class_name
    )

    return {
        "detection_id": detection_id,
        "class_name": class_name,
        "context_score": metrics["context_score"],
        "metrics": {
            "local_contrast": metrics["local_contrast"],
            "context_variance": metrics["context_variance"],
            "edge_density": metrics["edge_density"],
            "target_mean": metrics["target_mean"],
            "context_mean": metrics["context_mean"]
        },
        "diagnostic_image_path": diag_path
    }
