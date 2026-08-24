"""
Phase 8 Automated Tests for False-Positive Filtering, Taxonomic Triage, & Human Review.
Tests:
- Categorization rules for Natural classes (rock, sand ripple)
- Categorization rule for Artificial Reef (protected structure)
- Artificiality score threshold classification (>=80% Validated, 60-79% Needs Review, <60% Low Artificiality)
- Operator review submission (Approve, Reject, Flag, Notes)
- Survey review summary aggregation API
"""

import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database.db import init_db
from backend.filtering.triage import (
    categorize_detection,
    apply_survey_triage,
    record_operator_review,
    get_survey_review_summary
)

client = TestClient(app)


def test_triage_rules_direct():
    # 1. Natural classes
    assert categorize_detection("rock", 0.95) == "NATURAL"
    assert categorize_detection("sand ripple", 0.88) == "NATURAL"

    # 2. Artificial Reef
    assert categorize_detection("artificial reef", 0.90) == "ARTIFICIAL_STRUCTURE"

    # 3. Shipwreck & Tyre threshold tests
    assert categorize_detection("shipwreck", 0.85) == "VALIDATED"
    assert categorize_detection("tyre", 0.70) == "NEEDS REVIEW"
    assert categorize_detection("tyre", 0.45) == "LOW ARTIFICIALITY"


def test_filtering_and_operator_review_api_pipeline():
    init_db()
    # 1. Load Demo Survey, Run Detection & Fusion
    load_resp = client.post("/api/surveys/load-demo")
    assert load_resp.status_code == 200
    survey_id = load_resp.json()["data"]["survey_id"]

    client.post(f"/api/surveys/{survey_id}/run-detection?conf_threshold=0.20")
    client.post(f"/api/surveys/{survey_id}/fuse-evidence")

    # 2. Run Survey Triage API
    triage_resp = client.post(f"/api/surveys/{survey_id}/triage?high_threshold=0.80&review_threshold=0.60")
    assert triage_resp.status_code == 200
    t_data = triage_resp.json()["data"]
    assert t_data["total_detections"] >= 5
    assert "summary_counts" in t_data

    # 3. Submit Operator Approval on First Detection
    first_det_id = t_data["detections"][0]["detection_id"]
    review_resp = client.post(
        f"/api/detections/{first_det_id}/operator-review",
        json={
            "action": "APPROVE_DEBRIS",
            "notes": "Verified high-circularity tyre with distinct acoustic shadow void in frame."
        }
    )
    assert review_resp.status_code == 200
    r_data = review_resp.json()["data"]
    assert r_data["status"] == "VALIDATED"
    assert r_data["review_status"] == "OPERATOR_APPROVED"
    assert "Verified high-circularity tyre" in r_data["operator_notes"]

    # 4. Submit Operator Rejection on Second Detection
    second_det_id = t_data["detections"][1]["detection_id"]
    reject_resp = client.post(
        f"/api/detections/{second_det_id}/operator-review",
        json={
            "action": "REJECT_FALSE_POSITIVE",
            "notes": "Natural rock formation mimicking man-made structure."
        }
    )
    assert reject_resp.status_code == 200
    assert reject_resp.json()["data"]["status"] == "REJECTED"
    assert reject_resp.json()["data"]["review_status"] == "OPERATOR_REJECTED"

    # 5. Retrieve Survey Review Summary API
    summary_resp = client.get(f"/api/surveys/{survey_id}/review-summary")
    assert summary_resp.status_code == 200
    metrics = summary_resp.json()["data"]["metrics"]
    assert metrics["operator_approved"] >= 1
    assert metrics["operator_rejected"] >= 1


if __name__ == "__main__":
    print("Running Phase 8 Verification Tests...")
    test_triage_rules_direct()
    print("[OK] Taxonomic Triage & Threshold Rules Passed")
    test_filtering_and_operator_review_api_pipeline()
    print("[OK] Survey Triage, Operator Review Audit Trail & Summary API Passed")
    print("\n>>> ALL PHASE 8 BACKEND TESTS PASSED! <<<")
