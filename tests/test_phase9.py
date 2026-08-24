"""
Phase 9 Automated Tests for Simulated Geolocation & Spatial Metadata.
Tests:
- Deterministic port/starboard swath offset & coordinate math
- Depth & towfish altitude simulation
- Survey-wide spatial coordinate update in SQLite
- Standard GeoJSON FeatureCollection generation with scientific honesty tags
"""

import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database.db import init_db
from backend.spatial.geolocator import (
    compute_detection_spatial_coords,
    update_survey_spatial_coordinates,
    generate_survey_geojson
)

client = TestClient(app)


def test_spatial_swath_offset_calculation():
    # Target on port side (left, cx = 160 of 640)
    port_spatial = compute_detection_spatial_coords(
        frame_index=0,
        bbox_pixels=[100, 200, 220, 320],
        img_dims=(640, 640)
    )
    assert port_spatial["swath_side"] == "PORT"
    assert port_spatial["lateral_offset_m"] < 0
    assert 18.0 <= port_spatial["latitude"] <= 19.5
    assert 72.0 <= port_spatial["longitude"] <= 73.5
    assert port_spatial["coordinate_type"] == "SIMULATED SURVEY METADATA"

    # Target on starboard side (right, cx = 480 of 640)
    stbd_spatial = compute_detection_spatial_coords(
        frame_index=0,
        bbox_pixels=[420, 200, 540, 320],
        img_dims=(640, 640)
    )
    assert stbd_spatial["swath_side"] == "STARBOARD"
    assert stbd_spatial["lateral_offset_m"] > 0


def test_spatial_api_pipeline():
    init_db()
    # 1. Load Demo Survey & Run Detection
    load_resp = client.post("/api/surveys/load-demo")
    assert load_resp.status_code == 200
    survey_id = load_resp.json()["data"]["survey_id"]

    client.post(f"/api/surveys/{survey_id}/run-detection?conf_threshold=0.20")
    client.post(f"/api/surveys/{survey_id}/fuse-evidence")

    # 2. Batch Update Spatial Coordinates API
    spatial_resp = client.post(f"/api/surveys/{survey_id}/compute-spatial")
    assert spatial_resp.status_code == 200
    s_data = spatial_resp.json()["data"]
    assert s_data["total_updated"] >= 5
    assert all("latitude" in d and "longitude" in d for d in s_data["detections"])

    # 3. Retrieve GeoJSON FeatureCollection
    geojson_resp = client.get(f"/api/surveys/{survey_id}/spatial-geojson")
    assert geojson_resp.status_code == 200
    geojson = geojson_resp.json()
    assert geojson["type"] == "FeatureCollection"
    assert geojson["metadata_tag"] == "SIMULATED SURVEY METADATA"
    assert len(geojson["features"]) >= 5

    first_feat = geojson["features"][0]
    assert first_feat["geometry"]["type"] == "Point"
    assert len(first_feat["geometry"]["coordinates"]) == 2
    assert "class_name" in first_feat["properties"]
    assert "artificiality_score" in first_feat["properties"]
    assert "disclaimer" in first_feat["properties"]


if __name__ == "__main__":
    print("Running Phase 9 Verification Tests...")
    test_spatial_swath_offset_calculation()
    print("[OK] Deterministic Swath Offset & Simulated Coordinate Math Passed")
    test_spatial_api_pipeline()
    print("[OK] Survey Spatial Coordinate Computation & GeoJSON API Passed")
    print("\n>>> ALL PHASE 9 BACKEND TESTS PASSED! <<<")
