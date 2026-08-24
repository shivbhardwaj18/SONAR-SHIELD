"""
Phase 14 Automated Tests for Interactive Map Data & Multi-Format Export Engine.
Tests:
- CSV tabular export structure, headers, and encoding
- JSON survey executive dossier format and metrics
- Standard GeoJSON FeatureCollection export
- Printable HTML executive report generation
"""

import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database.db import init_db
from backend.services.export_service import (
    generate_survey_csv,
    generate_survey_json_dossier,
    generate_executive_report_html
)

client = TestClient(app)


def test_export_pipeline_api():
    init_db()
    # 1. Load Demo Survey, Run Detection, Fusion, Spatial, Hotspots, Bio-Threat, Cleanup
    load_resp = client.post("/api/surveys/load-demo")
    assert load_resp.status_code == 200
    survey_id = load_resp.json()["data"]["survey_id"]

    client.post(f"/api/surveys/{survey_id}/run-detection?conf_threshold=0.20")
    client.post(f"/api/surveys/{survey_id}/fuse-evidence")
    client.post(f"/api/surveys/{survey_id}/compute-spatial")
    client.post(f"/api/surveys/{survey_id}/compute-hotspots")
    client.post(f"/api/surveys/{survey_id}/evaluate-bio-threat")
    client.post(f"/api/surveys/{survey_id}/compute-cleanup-priority")

    # 2. Test CSV Export API
    csv_resp = client.get(f"/api/surveys/{survey_id}/export/csv")
    assert csv_resp.status_code == 200
    assert csv_resp.headers["content-type"] == "text/csv; charset=utf-8"
    csv_text = csv_resp.text
    assert "detection_id,survey_id,frame_id" in csv_text
    assert "artificiality_score" in csv_text
    assert "SIMULATED SURVEY METADATA" in csv_text

    # 3. Test JSON Dossier Export API
    json_resp = client.get(f"/api/surveys/{survey_id}/export/json")
    assert json_resp.status_code == 200
    assert "application/json" in json_resp.headers["content-type"]
    dossier = json_resp.json()
    assert dossier["system"].startswith("SONAR-SHIELD")
    assert "summary_metrics" in dossier
    assert "remediation_rankings" in dossier
    assert "scientific_honesty_disclaimer" in dossier

    # 4. Test GeoJSON Export API
    geojson_resp = client.get(f"/api/surveys/{survey_id}/export/geojson")
    assert geojson_resp.status_code == 200
    geojson = geojson_resp.json()
    assert geojson["type"] == "FeatureCollection"
    assert len(geojson["features"]) >= 1

    # 5. Test Printable HTML Report API
    html_resp = client.get(f"/api/surveys/{survey_id}/export/report-html")
    assert html_resp.status_code == 200
    assert "text/html" in html_resp.headers["content-type"]
    html_text = html_resp.text
    assert "<!DOCTYPE html>" in html_text
    assert "SONAR-SHIELD" in html_text
    assert "Smart India Hackathon" in html_text


if __name__ == "__main__":
    print("Running Phase 14 Verification Tests...")
    test_export_pipeline_api()
    print("[OK] CSV, JSON Dossier, GeoJSON, and HTML Executive Report API Passed")
    print("\n>>> ALL PHASE 14 BACKEND TESTS PASSED! <<<")
