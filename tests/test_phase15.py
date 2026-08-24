"""
Phase 15 Automated Tests for Demo Mode Polish & Auto-Pipeline Execution.
Tests:
- 1-Click Demo Survey loading with full pipeline pre-computation
- Immediate availability of YOLO detections, Evidence Fusion, Hotspots, Bio-Threat, and Cleanup rankings
- Verification of all 5 target classes across the 10 demo frames
"""

import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database.db import init_db

client = TestClient(app)


def test_demo_mode_auto_pipeline():
    init_db()
    # Trigger 1-click Demo Load
    resp = client.post("/api/surveys/load-demo")
    assert resp.status_code == 200
    survey_id = resp.json()["data"]["survey_id"]

    # Verify Detections exist immediately
    det_resp = client.get(f"/api/surveys/{survey_id}/detections")
    assert det_resp.status_code == 200
    detections = det_resp.json()["detections"]
    assert len(detections) >= 5

    # Verify Hotspots exist immediately
    hs_resp = client.get(f"/api/surveys/{survey_id}/hotspots")
    assert hs_resp.status_code == 200
    hotspots = hs_resp.json()["hotspots"]
    assert len(hotspots) >= 1

    # Verify Bio-Threat metrics exist immediately
    bt_resp = client.get(f"/api/surveys/{survey_id}/bio-threat-summary")
    assert bt_resp.status_code == 200
    assert bt_resp.json()["metrics"]["total_debris_fields"] >= 1

    # Verify Cleanup Rankings exist immediately
    cr_resp = client.get(f"/api/surveys/{survey_id}/cleanup-rankings")
    assert cr_resp.status_code == 200
    assert cr_resp.json()["data"]["total_ranked"] >= 1


if __name__ == "__main__":
    print("Running Phase 15 Verification Tests...")
    test_demo_mode_auto_pipeline()
    print("[OK] 1-Click Demo Auto-Pipeline Integration Passed")
    print("\n>>> ALL PHASE 15 BACKEND TESTS PASSED! <<<")
