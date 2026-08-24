"""
Phase 6 Automated Tests for Seabed Context Evidence Extraction.
Tests:
- Annulus ring extraction and inner target masking
- Local contrast and seabed texture variance metrics
- High saliency vs high clutter background scoring
- Survey-wide batch context evaluation API and SQLite updates
- Context diagnostic overlay generation
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
from backend.evidence.context import (
    extract_seabed_context_annulus,
    compute_context_metrics,
    evaluate_detection_context
)

client = TestClient(app)


def test_context_metrics_synthetic():
    # 1. High-Contrast Target on Smooth Natural Sediment Seabed
    img = np.full((120, 200, 3), 90, dtype=np.uint8)  # Uniform seabed (90)
    # Bright target echo at [40:80, 70:110]
    img[40:80, 70:110] = 235

    bbox = [70, 40, 110, 80]
    annulus_data = extract_seabed_context_annulus(img, bbox)
    assert annulus_data["valid"] is True
    assert annulus_data["context_pixels"].size > 0

    metrics = compute_context_metrics(annulus_data)
    assert metrics["local_contrast"] >= 0.80
    assert metrics["context_variance"] <= 5.0  # Smooth background
    assert metrics["context_score"] >= 0.75

    # 2. Low-Contrast Target Blending into Cluttered Seabed
    noise_img = np.random.randint(40, 200, (120, 200, 3), dtype=np.uint8)
    noise_img[40:80, 70:110] = 120  # Low contrast against noisy mean
    clutter_annulus = extract_seabed_context_annulus(noise_img, bbox)
    clutter_metrics = compute_context_metrics(clutter_annulus)
    assert clutter_metrics["context_variance"] > 15.0
    assert clutter_metrics["context_score"] < metrics["context_score"]


def test_context_evidence_api_pipeline():
    init_db()
    # 1. Load Demo Survey & Run Detection
    load_resp = client.post("/api/surveys/load-demo")
    assert load_resp.status_code == 200
    survey_id = load_resp.json()["data"]["survey_id"]

    detect_resp = client.post(f"/api/surveys/{survey_id}/run-detection?conf_threshold=0.20")
    assert detect_resp.status_code == 200

    # 2. Batch Evaluate Context Evidence across Survey
    context_resp = client.post(f"/api/surveys/{survey_id}/evaluate-context")
    assert context_resp.status_code == 200
    context_data = context_resp.json()
    assert context_data["total_evaluated"] >= 5
    assert all("context_score" in d for d in context_data["detections"])

    # 3. Retrieve Context Evidence Details for First Detection
    first_det_id = context_data["detections"][0]["detection_id"]
    det_ctx_resp = client.get(f"/api/detections/{first_det_id}/context-evidence")
    assert det_ctx_resp.status_code == 200
    det_data = det_ctx_resp.json()
    assert det_data["context_score"] is not None
    assert "local_contrast" in det_data["metrics"]
    assert "context_variance" in det_data["metrics"]

    # 4. Stream Context Diagnostic Overlay
    overlay_resp = client.get(f"/api/detections/{first_det_id}/context-overlay")
    assert overlay_resp.status_code == 200
    assert overlay_resp.headers["content-type"] == "image/png"
    assert len(overlay_resp.content) > 0


if __name__ == "__main__":
    print("Running Phase 6 Verification Tests...")
    test_context_metrics_synthetic()
    print("[OK] Seabed Annulus Extraction & Context Saliency Passed")
    test_context_evidence_api_pipeline()
    print("[OK] Survey Context Evidence Evaluation & Diagnostic Overlay Passed")
    print("\n>>> ALL PHASE 6 BACKEND TESTS PASSED! <<<")
