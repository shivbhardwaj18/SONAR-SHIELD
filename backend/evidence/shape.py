"""
Shape Evidence Extraction Module for SONAR-SHIELD.
Extracts geometric contour metrics (circularity, aspect ratio, solidity, extent)
and computes transparent, class-aware heuristic shape scores.
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


def extract_shape_metrics(crop_bgr: np.ndarray) -> Dict[str, Any]:
    """
    Extracts geometric contour metrics from a cropped candidate sonar image.
    """
    if crop_bgr is None or crop_bgr.size == 0:
        return {
            "valid_contour": False,
            "circularity": 0.0,
            "aspect_ratio": 1.0,
            "solidity": 0.0,
            "extent": 0.0,
            "area": 0,
            "perimeter": 0.0,
            "primary_contour": None
        }

    h, w = crop_bgr.shape[:2]
    gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY) if len(crop_bgr.shape) == 3 else crop_bgr
    
    # Bilateral smoothing to remove noise while keeping edges
    blurred = cv2.bilateralFilter(gray, d=5, sigmaColor=50, sigmaSpace=50)

    # Otsu adaptive thresholding
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Morphological closing to fill small internal acoustic holes
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    # Find external contours
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return {
            "valid_contour": False,
            "circularity": 0.0,
            "aspect_ratio": 1.0,
            "solidity": 0.0,
            "extent": 0.0,
            "area": 0,
            "perimeter": 0.0,
            "primary_contour": None
        }

    # Find the most prominent contour (largest area near center)
    center_x, center_y = w / 2.0, h / 2.0
    best_contour = None
    max_score = -1

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 15:  # Ignore tiny speckle noise
            continue
        M = cv2.moments(cnt)
        if M["m00"] > 0:
            cx = M["m10"] / M["m00"]
            cy = M["m01"] / M["m00"]
            dist_to_center = np.sqrt((cx - center_x)**2 + (cy - center_y)**2)
            # Area weighted by center proximity
            score = area / (1.0 + (dist_to_center / (min(w, h) + 1e-5)))
            if score > max_score:
                max_score = score
                best_contour = cnt

    if best_contour is None:
        best_contour = max(contours, key=cv2.contourArea)

    area = float(cv2.contourArea(best_contour))
    perimeter = float(cv2.arcLength(best_contour, True))

    # Circularity: 4 * pi * Area / Perimeter^2 (1.0 for perfect circle)
    if perimeter > 0:
        circularity = (4.0 * np.pi * area) / (perimeter ** 2)
        circularity = min(1.0, max(0.0, round(circularity, 4)))
    else:
        circularity = 0.0

    # Bounding Rectangle & Aspect Ratio
    rx, ry, rw, rh = cv2.boundingRect(best_contour)
    aspect_ratio = round(max(rw, rh) / (min(rw, rh) + 1e-5), 4)

    # Extent: Area / Bounding Rect Area
    rect_area = float(rw * rh)
    extent = round(min(1.0, max(0.0, area / (rect_area + 1e-5))), 4)

    # Convex Hull & Solidity
    hull = cv2.convexHull(best_contour)
    hull_area = float(cv2.contourArea(hull))
    solidity = round(min(1.0, max(0.0, area / (hull_area + 1e-5))), 4)

    return {
        "valid_contour": True,
        "circularity": circularity,
        "aspect_ratio": aspect_ratio,
        "solidity": solidity,
        "extent": extent,
        "area": int(area),
        "perimeter": round(perimeter, 2),
        "primary_contour": best_contour,
        "hull": hull,
        "bounding_box": [rx, ry, rw, rh]
    }


def compute_class_shape_score(class_name: str, metrics: Dict[str, Any]) -> float:
    """
    Computes a transparent, class-aware heuristic shape conformity score [0.0, 1.0].
    """
    if not metrics.get("valid_contour", False):
        return 0.35  # Baseline fallback when contour is ambiguous

    cname = class_name.lower().strip()
    circ = metrics["circularity"]
    ar = metrics["aspect_ratio"]
    solidity = metrics["solidity"]
    extent = metrics["extent"]

    if cname == "tyre":
        # Tyres should exhibit high circularity, balanced aspect ratio (1.0 - 1.6), and high solidity
        circ_component = circ * 0.55
        ar_penalty = max(0.0, 1.0 - (abs(ar - 1.0) / 1.5)) * 0.25
        solidity_component = solidity * 0.20
        raw_score = circ_component + ar_penalty + solidity_component

    elif cname == "shipwreck":
        # Shipwrecks exhibit elongated hull profiles (AR >= 1.4), structural solidity, and extent
        ar_component = min(1.0, (ar / 1.8)) * 0.40
        solidity_component = min(1.0, max(0.40, solidity * 1.2)) * 0.35
        extent_component = min(1.0, max(0.40, extent * 1.3)) * 0.25
        raw_score = ar_component + solidity_component + extent_component

    elif cname == "artificial reef":
        # Artificial reefs exhibit structured rectangular/grid profiles and moderate extent
        extent_component = extent * 0.40
        solidity_component = solidity * 0.35
        non_circular_component = (1.0 - min(1.0, circ * 0.8)) * 0.25
        raw_score = extent_component + solidity_component + non_circular_component

    elif cname == "rock":
        # Natural rocks: irregular jagged perimeter, moderate circularity, varying solidity
        irregularity = (1.0 - circ) * 0.50 + (1.0 - solidity) * 0.50
        raw_score = irregularity

    elif cname == "sand ripple":
        # Sand ripples: linear, high aspect ratio, low compactness
        linear_component = min(1.0, ar / 3.0) * 0.60 + (1.0 - circ) * 0.40
        raw_score = linear_component

    else:
        # Generic heuristic
        raw_score = (solidity * 0.4) + (extent * 0.3) + (circ * 0.3)

    return round(min(1.0, max(0.05, float(raw_score))), 4)


def generate_shape_diagnostic_image(
    crop_bgr: np.ndarray,
    metrics: Dict[str, Any],
    detection_id: str,
    class_name: str,
    shape_score: float
) -> str:
    """
    Renders an annotated diagnostic image with contour overlays and metric badges for operator visual inspection.
    """
    ensure_evidence_dir()
    out_filename = f"shape_{detection_id}.png"
    out_filepath = os.path.join(EVIDENCE_CROPS_DIR, out_filename)

    h, w = crop_bgr.shape[:2]
    # Create canvas with extra margin for telemetry text
    canvas_w = max(320, w * 2 + 40)
    canvas_h = max(240, h + 80)
    canvas = np.zeros((canvas_h, canvas_w, 3), dtype=np.uint8)
    canvas[:] = (10, 16, 28)  # Deep marine background

    # 1. Place original crop on left
    canvas[20:20+h, 20:20+w] = crop_bgr

    # 2. Place contour overlay on right
    overlay = crop_bgr.copy()
    if metrics.get("valid_contour", False) and metrics.get("primary_contour") is not None:
        cv2.drawContours(overlay, [metrics["primary_contour"]], -1, (0, 255, 200), 2)  # Cyan contour
        if metrics.get("hull") is not None:
            cv2.drawContours(overlay, [metrics["hull"]], -1, (255, 180, 0), 1)  # Amber convex hull

    canvas[20:20+h, w+40:w+40+w] = overlay

    # 3. Add Diagnostic Text
    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(canvas, f"ORIGINAL CROP", (20, 15), font, 0.35, (148, 163, 184), 1, cv2.LINE_AA)
    cv2.putText(canvas, f"CONTOUR & HULL", (w+40, 15), font, 0.35, (0, 255, 200), 1, cv2.LINE_AA)

    # Telemetry Strip
    y_text = 20 + h + 25
    stats_text1 = f"CLASS: {class_name.upper()} | SHAPE SCORE: {int(shape_score*100)}%"
    stats_text2 = f"Circularity: {metrics.get('circularity',0):.2f} | Aspect Ratio: {metrics.get('aspect_ratio',0):.2f} | Solidity: {metrics.get('solidity',0):.2f}"
    
    cv2.putText(canvas, stats_text1, (20, y_text), font, 0.42, (0, 255, 200), 1, cv2.LINE_AA)
    cv2.putText(canvas, stats_text2, (20, y_text + 20), font, 0.35, (148, 163, 184), 1, cv2.LINE_AA)

    cv2.imwrite(out_filepath, canvas)
    return out_filepath


def evaluate_detection_shape(detection_id: str, crop_bgr: np.ndarray, class_name: str) -> Dict[str, Any]:
    """
    Evaluates shape metrics and generates diagnostic visuals for a single detection.
    """
    metrics = extract_shape_metrics(crop_bgr)
    shape_score = compute_class_shape_score(class_name, metrics)
    
    diag_path = generate_shape_diagnostic_image(
        crop_bgr=crop_bgr,
        metrics=metrics,
        detection_id=detection_id,
        class_name=class_name,
        shape_score=shape_score
    )

    return {
        "detection_id": detection_id,
        "class_name": class_name,
        "shape_score": shape_score,
        "metrics": {
            "circularity": metrics["circularity"],
            "aspect_ratio": metrics["aspect_ratio"],
            "solidity": metrics["solidity"],
            "extent": metrics["extent"],
            "area_pixels": metrics["area"],
            "perimeter_pixels": metrics["perimeter"]
        },
        "diagnostic_image_path": diag_path
    }
