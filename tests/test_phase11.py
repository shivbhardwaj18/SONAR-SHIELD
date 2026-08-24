"""
Phase 11 Automated Tests for Prototype Bio-Threat Index & Habitat Protection.
Tests:
- Material toxicity scoring (Tyres, Shipwrecks, Reefs, Natural)
- Ecological habitat protection rule for Artificial Reefs (score = 0.00)
- Density & area footprint multiplier logic
- Survey-wide Bio-Threat evaluation API and SQLite updates
- Hotspot Bio-Threat summary API
"""

import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database.db import init_db
from backend.intelligence.bio_threat import (
    compute_detection_bio_threat,
    compute_hotspot_bio_threat,
    evaluate_survey_bio_threat
)

client = TestClient(app)


def test_material_bio_threat_profiles():
    # 1. Tyre: High toxicity
    tyre_threat = compute_detection_bio_threat("tyre", 0.90)
    assert tyre_threat["bio_threat_score"] >= 0.70
    assert tyre_threat["bio_threat_level"] in ["CRITICAL", "HIGH"]
    assert "microplastic" in tyre_threat["rationale"].lower()
    assert tyre_threat["is_protected_structure"] is False

    # 2. Artificial Reef: Beneficial Protected Habitat (Score 0.00)
    reef_threat = compute_detection_bio_threat("artificial reef", 0.95)
    assert reef_threat["bio_threat_score"] == 0.00
    assert reef_threat["bio_threat_level"] == "BENEFICIAL_HABITAT"
    assert reef_threat["is_protected_structure"] is True
    assert "shelter" in reef_threat["rationale"].lower()

    # 3. Rock: Natural (Score 0.00)
    rock_threat = compute_detection_bio_threat("rock", 0.80)
    assert rock_threat["bio_threat_score"] == 0.00
    assert rock_threat["bio_threat_level"] == "NATURAL"


def test_hotspot_bio_threat_density_scaling():
    # 5 tyres over 200m^2 vs 1 tyre over 50m^2
    multi_tyre = compute_hotspot_bio_threat("tyre", 0.85, detection_count=5, estimated_area_m2=200.0)
    single_tyre = compute_hotspot_bio_threat("tyre", 0.85, detection_count=1, estimated_area_m2=50.0)
    assert multi_tyre["bio_threat_score"] > single_tyre["bio_threat_score"]
    assert multi_tyre["density_multiplier"] > 1.0


def test_bio_threat_api_pipeline():
    init_db()
    # 1. Load Demo Survey, Run Detection, Fusion, Spatial, Hotspots
    load_resp = client.post("/api/surveys/load-demo")
    assert load_resp.status_code == 200
    survey_id = load_resp.json()["data"]["survey_id"]

    client.post(f"/api/surveys/{survey_id}/run-detection?conf_threshold=0.20")
    client.post(f"/api/surveys/{survey_id}/fuse-evidence")
    client.post(f"/api/surveys/{survey_id}/compute-spatial")
    client.post(f"/api/surveys/{survey_id}/compute-hotspots")

    # 2. Run Survey Bio-Threat Evaluation API
    eval_resp = client.post(f"/api/surveys/{survey_id}/evaluate-bio-threat")
    assert eval_resp.status_code == 200
    e_data = eval_resp.json()["data"]
    assert e_data["total_hotspots_evaluated"] >= 1

    # 3. Retrieve Survey Bio-Threat Summary API
    sum_resp = client.get(f"/api/surveys/{survey_id}/bio-threat-summary")
    assert sum_resp.status_code == 200
    sum_data = sum_resp.json()
    assert "metrics" in sum_data
    assert "disclaimer" in sum_data
    assert len(sum_data["hotspots"]) >= 1


if __name__ == "__main__":
    print("Running Phase 11 Verification Tests...")
    test_material_bio_threat_profiles()
    print("[OK] Material Hazard Profiles & Habitat Protection Passed")
    test_hotspot_bio_threat_density_scaling()
    print("[OK] Hotspot Density & Area Scaling Passed")
    test_bio_threat_api_pipeline()
    print("[OK] Survey Bio-Threat Evaluation & Summary API Passed")
    print("\n>>> ALL PHASE 11 BACKEND TESTS PASSED! <<<")
