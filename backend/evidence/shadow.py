"""
Acoustic Shadow Evidence Extraction Module for SONAR-SHIELD.
Analyzes physical acoustic shadows cast by protruding underwater structures,
calculating relative contrast drop, dark pixel void density, and shadow continuity.
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


def extract_target_and_shadow_zones(
    full_img_bgr: np.ndarray,
    bbox_pixels: list
) -> Dict[str, Any]:
    """
    Extracts the target echo bounding box and searches adjacent candidate sectors
    for physical acoustic shadow voids.
    """
    if full_img_bgr is None or full_img_bgr.size == 0:
        return {"valid": False}

    img_h, img_w = full_img_bgr.shape[:2]
    x1, y1, x2, y2 = int(bbox_pixels[0]), int(bbox_pixels[1]), int(bbox_pixels[2]), int(bbox_pixels[3])
    x1 = max(0, min(img_w - 1, x1))
    y1 = max(0, min(img_h - 1, y1))
    x2 = max(x1 + 1, min(img_w, x2))
    y2 = max(y1 + 1, min(img_h, y2))
    bw = max(1, x2 - x1)
    bh = max(1, y2 - y1)

    target_crop = full_img_bgr[y1:y2, x1:x2]
    if target_crop.size == 0:
        return {"valid": False}

    # Grayscale target
    target_gray = cv2.cvtColor(target_crop, cv2.COLOR_BGR2GRAY) if len(target_crop.shape) == 3 else target_crop
    target_mean = float(np.mean(target_gray))

    # Evaluate candidate shadow zones (Right, Left, Bottom) adjacent to the object
    # In side-scan sonar, the shadow extends laterally away from the nadir
    candidate_zones = []

    # 1. Right adjacent zone
    rx1, rx2 = x2, min(img_w, x2 + int(bw * 1.2))
    if rx2 > rx1 + 4:
        right_zone = full_img_bgr[y1:y2, rx1:rx2]
        candidate_zones.append(("RIGHT", right_zone, [rx1, y1, rx2, y2]))

    # 2. Left adjacent zone
    lx1, lx2 = max(0, x1 - int(bw * 1.2)), x1
    if lx2 > lx1 + 4:
        left_zone = full_img_bgr[y1:y2, lx1:lx2]
        candidate_zones.append(("LEFT", left_zone, [lx1, y1, lx2, y2]))

    # 3. Bottom adjacent zone
    by1, by2 = y2, min(img_h, y2 + int(bh * 1.2))
    if by2 > by1 + 4:
        bottom_zone = full_img_bgr[by1:by2, x1:x2]
        candidate_zones.append(("BOTTOM", bottom_zone, [x1, by1, x2, by2]))

    if not candidate_zones:
        return {
            "valid": True,
            "target_crop": target_crop,
            "target_mean": target_mean,
            "best_shadow_zone": None,
            "shadow_dir": "NONE",
            "shadow_bbox": [0, 0, 0, 0]
        }

    # Pick the candidate zone with lowest mean intensity (deepest potential shadow)
    best_candidate = None
    min_mean = 999.0

    for direction, zone, s_bbox in candidate_zones:
        if zone.size == 0:
            continue
        z_gray = cv2.cvtColor(zone, cv2.COLOR_BGR2GRAY) if len(zone.shape) == 3 else zone
        z_mean = float(np.mean(z_gray))
        if z_mean < min_mean:
            min_mean = z_mean
            best_candidate = (direction, zone, z_gray, s_bbox, z_mean)

    if best_candidate is None:
        return {"valid": False}

    dir_name, s_zone_bgr, s_zone_gray, s_bbox, shadow_mean = best_candidate

    return {
        "valid": True,
        "target_crop": target_crop,
        "target_gray": target_gray,
        "target_mean": target_mean,
        "shadow_zone": s_zone_bgr,
        "shadow_gray": s_zone_gray,
        "shadow_mean": shadow_mean,
        "shadow_dir": dir_name,
        "shadow_bbox": s_bbox,
        "target_bbox": [x1, y1, x2, y2]
    }


def compute_shadow_metrics(zones: Dict[str, Any]) -> Dict[str, Any]:
    """
    Computes contrast drop, dark pixel density, and shadow plausibility.
    """
    if not zones.get("valid", False) or zones.get("shadow_gray") is None:
        return {
            "has_shadow": False,
            "contrast_drop": 0.0,
            "dark_pixel_ratio": 0.0,
            "target_mean_intensity": 0.0,
            "shadow_mean_intensity": 0.0,
            "shadow_direction": "NONE",
            "shadow_score": 0.40
        }

    t_mean = zones["target_mean"]
    s_mean = zones["shadow_mean"]
    s_gray = zones["shadow_gray"]

    # Contrast drop: (Target Brightness - Shadow Darkness) / Target Brightness
    contrast_drop = max(0.0, (t_mean - s_mean) / (t_mean + 1e-5))
    contrast_drop = min(1.0, round(contrast_drop, 4))

    # Dark Pixel Ratio: Fraction of shadow pixels < 45 intensity (acoustic void)
    dark_pixels = np.sum(s_gray < 45)
    dark_pixel_ratio = round(float(dark_pixels) / float(s_gray.size + 1e-5), 4)

    # Shadow uniformity (true acoustic shadows have low standard deviation)
    shadow_std = float(np.std(s_gray))
    uniformity_score = max(0.0, 1.0 - (shadow_std / 45.0))

    # Physical plausibility check
    if t_mean <= s_mean + 2:
        shadow_score = 0.65
        has_shadow = False
    else:
        has_shadow = True
        # Transparent Heuristic Combination
        drop_comp = min(1.0, max(0.65, contrast_drop * 3.0)) * 0.50
        dark_comp = min(1.0, max(0.60, dark_pixel_ratio * 3.0)) * 0.30
        unif_comp = min(1.0, max(0.60, uniformity_score)) * 0.20
        raw_score = drop_comp + dark_comp + unif_comp
        shadow_score = round(min(0.95, max(0.70, float(raw_score))), 4)

    return {
        "has_shadow": has_shadow,
        "contrast_drop": contrast_drop,
        "dark_pixel_ratio": dark_pixel_ratio,
        "target_mean_intensity": round(t_mean, 2),
        "shadow_mean_intensity": round(s_mean, 2),
        "shadow_direction": zones["shadow_dir"],
        "shadow_score": shadow_score,
        "shadow_bbox": zones["shadow_bbox"]
    }


def generate_shadow_diagnostic_image(
    full_img_bgr: np.ndarray,
    zones: Dict[str, Any],
    metrics: Dict[str, Any],
    detection_id: str,
    class_name: str
) -> str:
    """
    Renders an annotated diagnostic view showing the Target Highlight (Green Box)
    and Detected Acoustic Shadow Zone (Purple Box) with telemetry overlay.
    """
    ensure_evidence_dir()
    out_filename = f"shadow_{detection_id}.png"
    out_filepath = os.path.join(EVIDENCE_CROPS_DIR, out_filename)

    img_h, img_w = full_img_bgr.shape[:2]
    tx1, ty1, tx2, ty2 = int(zones["target_bbox"][0]), int(zones["target_bbox"][1]), int(zones["target_bbox"][2]), int(zones["target_bbox"][3])
    sx1, sy1, sx2, sy2 = int(zones["shadow_bbox"][0]), int(zones["shadow_bbox"][1]), int(zones["shadow_bbox"][2]), int(zones["shadow_bbox"][3])

    # Crop an expanded context window encompassing both target and shadow
    cx1 = max(0, min(tx1, sx1) - 30)
    cy1 = max(0, min(ty1, sy1) - 30)
    cx2 = min(img_w, max(tx2, sx2) + 30)
    cy2 = min(img_h, max(ty2, sy2) + 30)

    context_crop = full_img_bgr[cy1:cy2, cx1:cx2].copy()
    ch, cw = context_crop.shape[:2]

    # Draw boxes relative to context crop
    # 1. Target Highlight Box (Emerald/Green)
    cv2.rectangle(
        context_crop,
        (tx1 - cx1, ty1 - cy1),
        (tx2 - cx1, ty2 - cy1),
        (0, 255, 150),
        2
    )

    # 2. Acoustic Shadow Zone (Indigo/Purple)
    if metrics["has_shadow"] and sx2 > sx1:
        cv2.rectangle(
            context_crop,
            (sx1 - cx1, sy1 - cy1),
            (sx2 - cx1, sy2 - cy1),
            (220, 100, 200),
            2
        )

    # Create composite canvas with telemetry strip
    canvas_w = max(360, cw + 40)
    canvas_h = max(260, ch + 90)
    canvas = np.zeros((canvas_h, canvas_w, 3), dtype=np.uint8)
    canvas[:] = (10, 16, 28)

    # Place annotated crop
    canvas[25:25+ch, 20:20+cw] = context_crop

    # Overlay Telemetry Text
    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(canvas, f"TARGET (GREEN) & SHADOW ZONE (PURPLE)", (20, 16), font, 0.35, (148, 163, 184), 1, cv2.LINE_AA)

    y_text = 25 + ch + 25
    stats_text1 = f"SHADOW SCORE: {int(metrics['shadow_score']*100)}% | DIRECTION: {metrics['shadow_direction']}"
    stats_text2 = f"Contrast Drop: {metrics['contrast_drop']:.2f} | Dark Void Ratio: {int(metrics['dark_pixel_ratio']*100)}%"
    stats_text3 = f"Target Intensity: {metrics['target_mean_intensity']} | Shadow Intensity: {metrics['shadow_mean_intensity']}"

    cv2.putText(canvas, stats_text1, (20, y_text), font, 0.42, (220, 100, 200), 1, cv2.LINE_AA)
    cv2.putText(canvas, stats_text2, (20, y_text + 20), font, 0.35, (148, 163, 184), 1, cv2.LINE_AA)
    cv2.putText(canvas, stats_text3, (20, y_text + 38), font, 0.32, (100, 116, 139), 1, cv2.LINE_AA)

    cv2.imwrite(out_filepath, canvas)
    return out_filepath


def is_ghost_net(class_name: Optional[str]) -> bool:
    """Checks whether the target is a ghost fishing net / porous mesh."""
    if not class_name:
        return False
    c = class_name.lower().replace("_", " ").strip()
    return c in ["ghost net", "ghostnet", "net", "fishing net"]


def generate_ghostnet_shadow_bypass_image(
    full_img_bgr: np.ndarray,
    bbox_pixels: list,
    detection_id: str,
    class_name: str
) -> str:
    """
    Renders a specialized diagnostic canvas explaining why acoustic shadow
    is bypassed for porous fishing mesh.
    """
    ensure_evidence_dir()
    out_filename = f"shadow_{detection_id}.png"
    out_filepath = os.path.join(EVIDENCE_CROPS_DIR, out_filename)

    img_h, img_w = full_img_bgr.shape[:2]
    x1, y1, x2, y2 = int(bbox_pixels[0]), int(bbox_pixels[1]), int(bbox_pixels[2]), int(bbox_pixels[3])
    x1, y1 = max(0, min(img_w - 1, x1)), max(0, min(img_h - 1, y1))
    x2, y2 = max(x1 + 1, min(img_w, x2)), max(y1 + 1, min(img_h, y2))

    cx1 = max(0, x1 - 30)
    cy1 = max(0, y1 - 30)
    cx2 = min(img_w, x2 + 30)
    cy2 = min(img_h, y2 + 30)

    context_crop = full_img_bgr[cy1:cy2, cx1:cx2].copy()
    ch, cw = context_crop.shape[:2]

    # Draw cyan box around ghost net target
    cv2.rectangle(
        context_crop,
        (x1 - cx1, y1 - cy1),
        (x2 - cx1, y2 - cy1),
        (255, 200, 0),  # Cyan / Blue in BGR
        2
    )

    canvas_w = max(420, cw + 40)
    canvas_h = max(260, ch + 90)
    canvas = np.zeros((canvas_h, canvas_w, 3), dtype=np.uint8)
    canvas[:] = (10, 16, 28)

    # Place annotated crop
    canvas[25:25+ch, 20:20+cw] = context_crop

    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(canvas, "GHOST NET TARGET (CYAN) - ACOUSTIC SHADOW EXEMPT", (20, 16), font, 0.35, (56, 189, 248), 1, cv2.LINE_AA)

    y_text = 25 + ch + 22
    stats_text1 = "PHYSICS RULE: SHADOW CALCULATION BYPASSED (WEIGHT: 0%)"
    stats_text2 = "Reason: Porous synthetic mesh allows acoustic transmission without solid void."
    stats_text3 = "Formula: 0.50(AI) + 0.30(Mesh Geometry) + 0.20(Context)"

    cv2.putText(canvas, stats_text1, (20, y_text), font, 0.38, (56, 189, 248), 1, cv2.LINE_AA)
    cv2.putText(canvas, stats_text2, (20, y_text + 18), font, 0.32, (148, 163, 184), 1, cv2.LINE_AA)
    cv2.putText(canvas, stats_text3, (20, y_text + 34), font, 0.32, (52, 211, 153), 1, cv2.LINE_AA)

    cv2.imwrite(out_filepath, canvas)
    return out_filepath


def evaluate_detection_shadow(
    detection_id: str,
    full_img_bgr: np.ndarray,
    bbox_pixels: list,
    class_name: str
) -> Dict[str, Any]:
    """
    Executes shadow evidence extraction and diagnostic generation for a detection.
    For ghost nets / porous mesh, shadow calculation is completely bypassed.
    """
    if is_ghost_net(class_name):
        diag_path = generate_ghostnet_shadow_bypass_image(
            full_img_bgr=full_img_bgr,
            bbox_pixels=bbox_pixels,
            detection_id=detection_id,
            class_name=class_name
        )
        return {
            "detection_id": detection_id,
            "class_name": class_name,
            "shadow_score": None,
            "is_exempt": True,
            "metrics": {
                "has_shadow": False,
                "is_exempt": True,
                "contrast_drop": 0.0,
                "dark_pixel_ratio": 0.0,
                "target_mean_intensity": 0.0,
                "shadow_mean_intensity": 0.0,
                "shadow_direction": "EXEMPT (POROUS NETTING)",
                "rationale": "Porous synthetic fishing mesh allows acoustic sound wave penetration; acoustic shadow calculation bypassed."
            },
            "diagnostic_image_path": diag_path
        }

    zones = extract_target_and_shadow_zones(full_img_bgr, bbox_pixels)
    metrics = compute_shadow_metrics(zones)

    diag_path = generate_shadow_diagnostic_image(
        full_img_bgr=full_img_bgr,
        zones=zones,
        metrics=metrics,
        detection_id=detection_id,
        class_name=class_name
    )

    return {
        "detection_id": detection_id,
        "class_name": class_name,
        "shadow_score": metrics["shadow_score"],
        "is_exempt": False,
        "metrics": {
            "has_shadow": metrics["has_shadow"],
            "is_exempt": False,
            "contrast_drop": metrics["contrast_drop"],
            "dark_pixel_ratio": metrics["dark_pixel_ratio"],
            "target_mean_intensity": metrics["target_mean_intensity"],
            "shadow_mean_intensity": metrics["shadow_mean_intensity"],
            "shadow_direction": metrics["shadow_direction"]
        },
        "diagnostic_image_path": diag_path
    }

