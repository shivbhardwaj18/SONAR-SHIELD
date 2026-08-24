"""
Phase 2 Automated Tests for YOLO Detection & Inference.
Tests:
- Single image inference and crop generation
- Batch survey inference
- Bounding box retrieval
- Crop file streaming endpoint
"""

import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database.db import init_db, get_db

client = TestClient(app)


def test_yolo_detector_direct():
    from ml.inference.detector import SonarDetector
    detector = SonarDetector.get_instance()
    
    test_img = os.path.abspath("data/demo_survey/Barge_No_1_14_1169x2048.png")
    results = detector.predict(test_img, conf_threshold=0.20)
    assert len(results) >= 1
    assert results[0]["class_name"] == "shipwreck"
    assert len(results[0]["bbox_pixels"]) == 4

    # Verify crop extraction
    crop = detector.extract_crop(test_img, results[0]["bbox_pixels"])
    assert crop is not None
    assert crop.shape[0] > 0 and crop.shape[1] > 0


def test_detection_api_pipeline():
    init_db()
    # 1. Load Demo Survey
    load_resp = client.post("/api/surveys/load-demo")
    assert load_resp.status_code == 200
    survey_id = load_resp.json()["data"]["survey_id"]

    # 2. Run Batch Detection across survey
    detect_resp = client.post(f"/api/surveys/{survey_id}/run-detection?conf_threshold=0.20")
    assert detect_resp.status_code == 200
    detect_data = detect_resp.json()["data"]
    assert detect_data["total_frames_processed"] >= 10
    assert detect_data["total_detections"] >= 5
    assert len(detect_data["class_breakdown"]) > 0

    # 3. Retrieve Survey Detections
    survey_dets_resp = client.get(f"/api/surveys/{survey_id}/detections")
    assert survey_dets_resp.status_code == 200
    detections = survey_dets_resp.json()["detections"]
    assert len(detections) >= 5

    # 4. Verify Single Image Detections
    first_det = detections[0]
    img_id = first_det["image_id"]
    img_dets_resp = client.get(f"/api/images/{img_id}/detections")
    assert img_dets_resp.status_code == 200
    assert img_dets_resp.json()["total_detections"] >= 1

    # 5. Verify Detection Crop Streaming Endpoint
    crop_resp = client.get(f"/api/detections/{first_det['id']}/crop")
    assert crop_resp.status_code == 200
    assert crop_resp.headers["content-type"] == "image/png"
    assert len(crop_resp.content) > 0


if __name__ == "__main__":
    print("Running Phase 2 Verification Tests...")
    test_yolo_detector_direct()
    print("[OK] Direct YOLO Model Inference & Crop Extraction Passed")
    test_detection_api_pipeline()
    print("[OK] Batch Survey Detection API & Crop Streaming Passed")
    print("\n>>> ALL PHASE 2 BACKEND TESTS PASSED! <<<")
