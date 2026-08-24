"""
Phase 3 Automated Tests for Acoustic Preprocessing Module.
Tests:
- CLAHE contrast enhancement
- Bilateral speckle denoising
- Acoustic stats calculation (mean, dynamic range, contrast ratio)
- Preprocessed image serving endpoint (modes: raw, clahe, denoised, enhanced)
"""

import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import cv2
import numpy as np
from fastapi.testclient import TestClient

from backend.main import app
from backend.database.db import init_db
from backend.preprocessing.processor import (
    apply_clahe,
    apply_denoise,
    normalize_intensity,
    compute_acoustic_stats
)

client = TestClient(app)


def test_preprocessing_functions_direct():
    test_img_path = os.path.abspath("data/demo_survey/Barge_No_1_14_1169x2048.png")
    img = cv2.imread(test_img_path)
    assert img is not None

    # Test CLAHE
    clahe_img = apply_clahe(img, clip_limit=2.5)
    assert clahe_img.shape == img.shape

    # Test Denoise
    denoised_img = apply_denoise(img, diameter=7)
    assert denoised_img.shape == img.shape

    # Test Normalization
    norm_img = normalize_intensity(img)
    assert norm_img.shape == img.shape

    # Test Acoustic Stats
    stats = compute_acoustic_stats(test_img_path)
    assert "mean_intensity" in stats
    assert "contrast_ratio" in stats
    assert "shadow_pixel_pct" in stats
    assert stats["mean_intensity"] > 0
    assert stats["dynamic_range"] > 0


def test_preprocessing_api_endpoints():
    init_db()
    # 1. Load Demo Survey
    load_resp = client.post("/api/surveys/load-demo")
    assert load_resp.status_code == 200
    survey_id = load_resp.json()["data"]["survey_id"]

    # 2. Get first image
    survey_resp = client.get(f"/api/surveys/{survey_id}")
    first_img_id = survey_resp.json()["images"][0]["id"]

    # 3. Test Raw Preprocessed View
    raw_resp = client.get(f"/api/images/{first_img_id}/preprocessed?mode=raw")
    assert raw_resp.status_code == 200
    assert len(raw_resp.content) > 0

    # 4. Test CLAHE Preprocessed View
    clahe_resp = client.get(f"/api/images/{first_img_id}/preprocessed?mode=clahe")
    assert clahe_resp.status_code == 200
    assert len(clahe_resp.content) > 0

    # 5. Test Denoised Preprocessed View
    denoise_resp = client.get(f"/api/images/{first_img_id}/preprocessed?mode=denoised")
    assert denoise_resp.status_code == 200
    assert len(denoise_resp.content) > 0

    # 6. Test Enhanced View
    enh_resp = client.get(f"/api/images/{first_img_id}/preprocessed?mode=enhanced")
    assert enh_resp.status_code == 200
    assert len(enh_resp.content) > 0

    # 7. Test Acoustic Stats API
    stats_resp = client.get(f"/api/images/{first_img_id}/acoustic-stats")
    assert stats_resp.status_code == 200
    stats_data = stats_resp.json()["acoustic_stats"]
    assert stats_data["mean_intensity"] > 0
    assert stats_data["contrast_ratio"] > 0


if __name__ == "__main__":
    print("Running Phase 3 Verification Tests...")
    test_preprocessing_functions_direct()
    print("[OK] Direct CLAHE, Denoising, & Acoustic Stats Passed")
    test_preprocessing_api_endpoints()
    print("[OK] Preprocessing API Endpoints & Filter Streaming Passed")
    print("\n>>> ALL PHASE 3 BACKEND TESTS PASSED! <<<")
