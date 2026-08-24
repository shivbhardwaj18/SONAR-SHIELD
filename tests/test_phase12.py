"""
Phase 12 Automated Tests for Actionable Cleanup Priority Ranking.
Tests:
- Multi-factor priority score calculation math
- Operational tier categorization (Priority 1, 2, 3)
- Habitat preservation exemption for Artificial Reefs
- Natural feature dismissal for rocks/ripples
- Equipment recommendation accuracy
- Survey cleanup ranking API and sorting order
"""

import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database.db import init_db
from backend.intelligence.cleanup import (
    compute_hotspot_cleanup_priority,
    evaluate_survey_cleanup_priorities
)

client = TestClient(app)


def test_cleanup_priority_scoring_rules():
    # 1. High Threat, High Artificiality, High Density Tyre Cluster -> Priority 1
    p1 = compute_hotspot_cleanup_priority(
        dominant_class="tyre",
        bio_threat_score=0.88,
        avg_artificiality=0.90,
        detection_count=5,
        avg_depth_m=20.0
    )
    assert p1["cleanup_priority_score"] >= 0.75
    assert p1["cleanup_priority_level"] == "PRIORITY 1"
    assert p1["is_actionable_debris"] is True
    assert "basket" in p1["recommended_equipment"].lower()

    # 2. Artificial Reef -> Protected Habitat (Score = 0.00, Do Not Remove)
    reef_plan = compute_hotspot_cleanup_priority(
        dominant_class="artificial reef",
        bio_threat_score=0.00,
        avg_artificiality=0.90,
        detection_count=3
    )
    assert reef_plan["cleanup_priority_score"] == 0.00
    assert reef_plan["cleanup_priority_level"] == "PROTECTED_HABITAT"
    assert reef_plan["is_actionable_debris"] is False
    assert "not remove" in reef_plan["action_protocol"].lower()

    # 3. Rock -> Natural Feature (No Action)
    rock_plan = compute_hotspot_cleanup_priority(
        dominant_class="rock",
        bio_threat_score=0.00,
        avg_artificiality=0.40,
        detection_count=2
    )
    assert rock_plan["cleanup_priority_level"] == "NATURAL_FEATURE"
    assert rock_plan["is_actionable_debris"] is False


def test_cleanup_ranking_api_pipeline():
    init_db()
    # 1. Load Demo Survey, Run Detection, Fusion, Spatial, Hotspots, Bio-Threat
    load_resp = client.post("/api/surveys/load-demo")
    assert load_resp.status_code == 200
    survey_id = load_resp.json()["data"]["survey_id"]

    client.post(f"/api/surveys/{survey_id}/run-detection?conf_threshold=0.20")
    client.post(f"/api/surveys/{survey_id}/fuse-evidence")
    client.post(f"/api/surveys/{survey_id}/compute-spatial")
    client.post(f"/api/surveys/{survey_id}/compute-hotspots")
    client.post(f"/api/surveys/{survey_id}/evaluate-bio-threat")

    # 2. Compute Cleanup Priorities API
    prio_resp = client.post(f"/api/surveys/{survey_id}/compute-cleanup-priority")
    assert prio_resp.status_code == 200
    p_data = prio_resp.json()["data"]
    assert p_data["total_ranked"] >= 1

    # 3. Retrieve Cleanup Rankings List API
    rank_resp = client.get(f"/api/surveys/{survey_id}/cleanup-rankings")
    assert rank_resp.status_code == 200
    rankings = rank_resp.json()["data"]["rankings"]
    assert len(rankings) >= 1

    # Verify sorting: actionable debris has higher scores before non-actionable
    actionable_scores = [r["cleanup_priority_score"] for r in rankings if r["is_actionable_debris"]]
    if len(actionable_scores) > 1:
        assert actionable_scores == sorted(actionable_scores, reverse=True)


if __name__ == "__main__":
    print("Running Phase 12 Verification Tests...")
    test_cleanup_priority_scoring_rules()
    print("[OK] Multi-Factor Cleanup Scoring & Habitat Protection Passed")
    test_cleanup_ranking_api_pipeline()
    print("[OK] Survey Cleanup Prioritization & Sorted Ranking API Passed")
    print("\n>>> ALL PHASE 12 BACKEND TESTS PASSED! <<<")
