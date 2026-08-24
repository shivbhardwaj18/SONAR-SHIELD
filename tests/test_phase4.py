"""
Phase 4 Automated Tests for Shape Evidence Extraction.
Tests:
- Contour geometric feature extraction (circularity, aspect ratio, solidity, extent)
- Transparent class-aware shape scoring (tyre, shipwreck, reef, rock, sand ripple)
- Single detection and batch survey shape evaluation API endpoints
- Diagnostic contour overlay generation
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
from backend.database.db import init_db, get_db
from backend.evidence.shape import (
    extract_shape_metrics,
    compute_class_shape_score,
    evaluate_detection_shape
)

client = TestClient(app)


def test_shape_metrics_synthetic():
    # 1. Test Perfect Circle (e.g. Tyre)
    circle_img = np.zeros((100, 100, 3), dtype=np.uint8)
    cv2.circle(circle_img, (50, 50), 30, (255, 255, 255), -1)
    metrics_circle = extract_shape_metrics(circle_img)
    assert metrics_circle["valid_contour"] is True
    assert metrics_circle["circularity"] > 0.80
    assert 0.9 <= metrics_circle["aspect_ratio"] <= 1.15
    tyre_score = compute_class_shape_score("tyre", metrics_circle)
    assert tyre_score >= 0.85

    # 2. Test Elongated Rectangle (e.g. Shipwreck hull)
    rect_img = np.zeros((120, 200, 3), dtype=np.uint8)
    cv2.rectangle(rect_img, (20, 40), (180, 80), (255, 255, 255), -1)
    metrics_rect = extract_shape_metrics(rect_img)
    assert metrics_rect["valid_contour"] is True
    assert metrics_rect["aspect_ratio"] >= 3.0
    ship_score = compute_class_shape_score("shipwreck", metrics_rect)
    assert ship_score >= 0.80


def test_shape_evidence_api_pipeline():
    init_db()
    # 1. Load Demo Survey and Run Detection
    load_resp = client.post("/api/surveys/load-demo")
    assert load_resp.status_code == 200
    survey_id = load_resp.json()["data"]["survey_id"]

    detect_resp = client.post(f"/api/surveys/{survey_id}/run-detection?conf_threshold=0.20")
    assert detect_resp.status_code == 200

    # 2. Batch Evaluate Shape Evidence across Survey
    shape_resp = client.post(f"/api/surveys/{survey_id}/evaluate-shape")
    assert shape_resp.status_code == 200
    shape_data = shape_resp.json()
    assert shape_data["total_evaluated"] >= 5
    assert all("shape_score" in d for d in shape_data["detections"])

    # 3. Retrieve Shape Evidence Details for First Detection
    first_det_id = shape_data["detections"][0]["detection_id"]
    det_shape_resp = client.get(f"/api/detections/{first_det_id}/shape-evidence")
    assert det_shape_resp.status_code == 200
    det_data = det_shape_resp.json()
    assert det_data["shape_score"] is not None
    assert "circularity" in det_data["metrics"]
    assert "aspect_ratio" in det_data["metrics"]

    # 4. Stream Diagnostic Overlay
    overlay_resp = client.get(f"/api/detections/{first_det_id}/shape-overlay")
    assert overlay_resp.status_code == 200
    assert overlay_resp.headers["content-type"] == "image/png"
    assert len(overlay_resp.content) > 0


if __name__ == "__main__":
    print("Running Phase 4 Verification Tests...")
    test_shape_metrics_synthetic()
    print("[OK] Geometric Contour Metrics & Heuristic Scoring Passed")
    test_shape_evidence_api_pipeline()
    print("[OK] Survey Shape Evidence Evaluation & Diagnostic Overlay Passed")
    print("\n>>> ALL PHASE 4 BACKEND TESTS PASSED! <<<")
