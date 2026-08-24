"""
Phase 1 Automated Tests for SONAR-SHIELD Backend.
"""

import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import io
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.main import app
from backend.database.db import init_db

client = TestClient(app)


def test_init_and_health():
    init_db()
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ONLINE"
    assert data["model_loaded"] is True
    assert "shipwreck" in data["detected_classes"]
    assert "tyre" in data["detected_classes"]


def test_load_demo_survey():
    response = client.post("/api/surveys/load-demo")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["data"]["total_images"] >= 10
    survey_id = data["data"]["survey_id"]

    # Verify survey is retrievable
    survey_resp = client.get(f"/api/surveys/{survey_id}")
    assert survey_resp.status_code == 200
    survey_data = survey_resp.json()
    assert survey_data["survey"]["is_demo"] is True
    assert len(survey_data["images"]) >= 10

    # Verify simulated coordinate assignment
    first_image = survey_data["images"][0]
    assert "simulated_lat" in first_image
    assert "simulated_lon" in first_image
    assert first_image["is_simulated_coords"] is True
    assert first_image["frame_id"].startswith("FRAME_")

    # Verify image binary download
    img_file_resp = client.get(f"/api/images/{first_image['id']}/file")
    assert img_file_resp.status_code == 200
    assert len(img_file_resp.content) > 0


def test_custom_upload():
    # Create a small synthetic test image in memory
    img = Image.new("RGB", (200, 200), color=(30, 60, 90))
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    img_byte_arr.seek(0)

    response = client.post(
        "/api/surveys/upload",
        data={"survey_name": "Unit Test Sonar Run"},
        files=[("files", ("test_sonar_frame.png", img_byte_arr, "image/png"))]
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["total_uploaded"] == 1
    assert data["images"][0]["filename"] == "test_sonar_frame.png"


if __name__ == "__main__":
    print("Running Phase 1 Verification Tests...")
    test_init_and_health()
    print("[OK] Health Check Passed")
    test_load_demo_survey()
    print("[OK] Demo Survey Loading & Serving Passed")
    test_custom_upload()
    print("[OK] Custom Upload Pipeline Passed")
    print("\n>>> ALL PHASE 1 BACKEND TESTS PASSED! <<<")
