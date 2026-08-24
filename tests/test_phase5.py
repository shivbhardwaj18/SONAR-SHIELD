"""
Phase 5 Automated Tests for Acoustic Shadow Evidence Extraction.
Tests:
- Adjacent shadow region search
- Contrast drop calculation and dark pixel void ratio
- Physical shadow plausibility rules
- Survey-wide batch shadow evaluation API and SQLite updates
- Shadow diagnostic overlay generation
"""

import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import cv2
import numpy as np
from fastapi.testclient import TestClient

from backend.main import app
from backend.database.db import init_db
from backend.evidence.shadow import (
    extract_target_and_shadow_zones,
    compute_shadow_metrics,
    evaluate_detection_shadow
)

client = TestClient(app)


def test_shadow_metrics_synthetic():
    # 1. Synthetic Bright Target + Dark Adjacent Acoustic Shadow
    img = np.full((120, 200, 3), 110, dtype=np.uint8)  # Ambient seabed (110)
    # Bright target echo at [40:80, 50:90]
    img[40:80, 50:90] = 230
    # Dark acoustic shadow void on right at [40:80, 90:140]
    img[40:80, 90:140] = 15

    bbox = [50, 40, 90, 80]
    zones = extract_target_and_shadow_zones(img, bbox)
    assert zones["valid"] is True
    assert zones["shadow_dir"] == "RIGHT"

    metrics = compute_shadow_metrics(zones)
    assert metrics["has_shadow"] is True
    assert metrics["contrast_drop"] >= 0.70
    assert metrics["dark_pixel_ratio"] >= 0.80
    assert metrics["shadow_score"] >= 0.80

    # 2. Synthetic Flat Image (No Shadow)
    flat_img = np.full((120, 200, 3), 120, dtype=np.uint8)
    flat_zones = extract_target_and_shadow_zones(flat_img, bbox)
    flat_metrics = compute_shadow_metrics(flat_zones)
    assert flat_metrics["has_shadow"] is False
    assert flat_metrics["shadow_score"] <= 0.20


def test_shadow_evidence_api_pipeline():
    init_db()
    # 1. Load Demo Survey & Run Detection
    load_resp = client.post("/api/surveys/load-demo")
    assert load_resp.status_code == 200
    survey_id = load_resp.json()["data"]["survey_id"]

    detect_resp = client.post(f"/api/surveys/{survey_id}/run-detection?conf_threshold=0.20")
    assert detect_resp.status_code == 200

    # 2. Batch Evaluate Shadow Evidence across Survey
    shadow_resp = client.post(f"/api/surveys/{survey_id}/evaluate-shadow")
    assert shadow_resp.status_code == 200
    shadow_data = shadow_resp.json()
    assert shadow_data["total_evaluated"] >= 5
    assert all("shadow_score" in d for d in shadow_data["detections"])

    # 3. Retrieve Shadow Evidence Details for First Detection
    first_det_id = shadow_data["detections"][0]["detection_id"]
    det_shadow_resp = client.get(f"/api/detections/{first_det_id}/shadow-evidence")
    assert det_shadow_resp.status_code == 200
    det_data = det_shadow_resp.json()
    assert det_data["shadow_score"] is not None
    assert "contrast_drop" in det_data["metrics"]
    assert "dark_pixel_ratio" in det_data["metrics"]

    # 4. Stream Shadow Diagnostic Overlay
    overlay_resp = client.get(f"/api/detections/{first_det_id}/shadow-overlay")
    assert overlay_resp.status_code == 200
    assert overlay_resp.headers["content-type"] == "image/png"
    assert len(overlay_resp.content) > 0


if __name__ == "__main__":
    print("Running Phase 5 Verification Tests...")
    test_shadow_metrics_synthetic()
    print("[OK] Synthetic Acoustic Shadow Extraction & Plausibility Passed")
    test_shadow_evidence_api_pipeline()
    print("[OK] Survey Shadow Evidence Evaluation & Diagnostic Overlay Passed")
    print("\n>>> ALL PHASE 5 BACKEND TESTS PASSED! <<<")
