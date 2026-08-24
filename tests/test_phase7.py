"""
Phase 7 Automated Tests for Multi-Evidence Fusion & Artificiality Scoring.
Tests:
- Weighted Artificiality Score computation math
- Default & custom weight combinations
- Single detection evidence fusion and dossier retrieval
- Survey-wide batch fusion API and SQLite updates
"""

import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database.db import init_db
from backend.evidence.fusion import (
    compute_artificiality_score,
    fuse_detection_evidence,
    fuse_survey_evidence,
    DEFAULT_WEIGHTS
)

client = TestClient(app)


def test_fusion_calculation_math():
    # Example: AI=0.91, Shape=0.88, Shadow=0.92, Context=0.80
    # Weights: 0.40, 0.25, 0.20, 0.15
    # Result: (0.91*0.40) + (0.88*0.25) + (0.92*0.20) + (0.80*0.15)
    # = 0.364 + 0.220 + 0.184 + 0.120 = 0.888
    score = compute_artificiality_score(
        conf=0.91,
        shape_score=0.88,
        shadow_score=0.92,
        context_score=0.80,
        weights=DEFAULT_WEIGHTS
    )
    assert 0.88 <= score <= 0.90

    # Custom weights test
    custom_weights = {"ai": 0.50, "shape": 0.50, "shadow": 0.0, "context": 0.0}
    custom_score = compute_artificiality_score(
        conf=0.90,
        shape_score=0.80,
        shadow_score=0.0,
        context_score=0.0,
        weights=custom_weights
    )
    assert custom_score == 0.85


def test_evidence_fusion_api_pipeline():
    init_db()
    # 1. Load Demo Survey & Run Detection
    load_resp = client.post("/api/surveys/load-demo")
    assert load_resp.status_code == 200
    survey_id = load_resp.json()["data"]["survey_id"]

    detect_resp = client.post(f"/api/surveys/{survey_id}/run-detection?conf_threshold=0.20")
    assert detect_resp.status_code == 200

    # 2. Batch Fuse Evidence across Entire Survey
    fuse_resp = client.post(f"/api/surveys/{survey_id}/fuse-evidence")
    assert fuse_resp.status_code == 200
    fuse_data = fuse_resp.json()["data"]
    assert fuse_data["total_fused"] >= 5
    assert all(d["artificiality_score"] > 0 for d in fuse_data["detections"])

    # 3. Retrieve Full Evidence Dossier for First Detection
    first_det_id = fuse_data["detections"][0]["detection_id"]
    dossier_resp = client.get(f"/api/detections/{first_det_id}/evidence-dossier")
    assert dossier_resp.status_code == 200
    dossier = dossier_resp.json()["dossier"]
    assert dossier["artificiality_score"] is not None
    assert dossier["shape_score"] is not None
    assert dossier["shadow_score"] is not None
    assert dossier["context_score"] is not None
    assert "crop" in dossier["diagnostic_urls"]
    assert "shape_overlay" in dossier["diagnostic_urls"]
    assert "shadow_overlay" in dossier["diagnostic_urls"]
    assert "context_overlay" in dossier["diagnostic_urls"]


if __name__ == "__main__":
    print("Running Phase 7 Verification Tests...")
    test_fusion_calculation_math()
    print("[OK] Weighted Artificiality Score Calculation Passed")
    test_evidence_fusion_api_pipeline()
    print("[OK] Survey Multi-Evidence Fusion & Evidence Dossier API Passed")
    print("\n>>> ALL PHASE 7 BACKEND TESTS PASSED! <<<")
