"""
Phase 10 Automated Tests for Hotspot Mapping (DBSCAN Debris Fields).
Tests:
- Cartesian metric conversion & DBSCAN clustering logic
- Hotspot centroid, dominant class, and bounding area calculation
- Survey-wide hotspot clustering API & SQLite persistence
- Hotspot retrieval endpoints
"""

import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database.db import init_db
from backend.spatial.clustering import (
    latlon_to_meters,
    meters_to_latlon,
    simple_dbscan_clustering,
    compute_convex_hull_area_and_polygon,
    run_survey_hotspot_clustering
)

client = TestClient(app)


def test_dbscan_metric_clustering():
    # 3 points close together (within 20m) + 1 outlier (150m away)
    pts = [
        (0.0, 0.0),
        (10.0, 5.0),
        (5.0, 12.0),
        (150.0, 150.0)  # Outlier
    ]
    labels = simple_dbscan_clustering(pts, eps_meters=50.0, min_samples=2)
    assert labels[0] == 0
    assert labels[1] == 0
    assert labels[2] == 0
    assert labels[3] == -1  # Outlier


def test_convex_hull_polygon_calculation():
    pts_latlon = [
        (18.9220, 72.8340),
        (18.9225, 72.8345),
        (18.9230, 72.8340)
    ]
    area, polygon = compute_convex_hull_area_and_polygon(pts_latlon)
    assert area >= 80.0
    assert len(polygon) == 4  # 3 vertices + closed loop point
    assert polygon[0] == polygon[-1]


def test_hotspot_api_pipeline():
    init_db()
    # 1. Load Demo Survey, Run Detection, Fusion, Spatial
    load_resp = client.post("/api/surveys/load-demo")
    assert load_resp.status_code == 200
    survey_id = load_resp.json()["data"]["survey_id"]

    client.post(f"/api/surveys/{survey_id}/run-detection?conf_threshold=0.20")
    client.post(f"/api/surveys/{survey_id}/fuse-evidence")
    client.post(f"/api/surveys/{survey_id}/compute-spatial")

    # 2. Compute Debris Hotspots API
    hotspot_resp = client.post(f"/api/surveys/{survey_id}/compute-hotspots?eps_meters=60.0&min_samples=2")
    assert hotspot_resp.status_code == 200
    h_data = hotspot_resp.json()["data"]
    assert h_data["total_hotspots"] >= 1
    assert all("hotspot_id" in h and "center_lat" in h for h in h_data["hotspots"])

    # 3. Retrieve Survey Hotspots List API
    list_resp = client.get(f"/api/surveys/{survey_id}/hotspots")
    assert list_resp.status_code == 200
    hotspots = list_resp.json()["hotspots"]
    assert len(hotspots) == h_data["total_hotspots"]

    first_hs = hotspots[0]
    assert first_hs["dominant_class"] is not None
    assert first_hs["detection_count"] >= 1
    assert first_hs["estimated_area_m2"] > 0


if __name__ == "__main__":
    print("Running Phase 10 Verification Tests...")
    test_dbscan_metric_clustering()
    print("[OK] DBSCAN Metric Distance Clustering Logic Passed")
    test_convex_hull_polygon_calculation()
    print("[OK] Convex Hull Polygon & Area Calculation Passed")
    test_hotspot_api_pipeline()
    print("[OK] Survey Hotspot Computation & Retrieval API Passed")
    print("\n>>> ALL PHASE 10 BACKEND TESTS PASSED! <<<")
