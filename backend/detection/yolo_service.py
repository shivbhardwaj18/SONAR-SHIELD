"""
Detection Service for SONAR-SHIELD.
Orchestrates YOLO inference runs, persists detections in SQLite, and generates target crops.
"""

import os
import uuid
import cv2
from datetime import datetime
from typing import List, Dict, Any, Optional

from backend.database.db import get_db
from ml.inference.detector import SonarDetector

CROPS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "uploads", "crops")
)


def get_detector() -> SonarDetector:
    return SonarDetector.get_instance()


def run_detection_on_image(
    image_id: str,
    conf_threshold: float = 0.20,
    iou_threshold: float = 0.45,
    re_detect: bool = True
) -> Dict[str, Any]:
    """
    Executes YOLO detector on a single image record from SQLite.
    Stores and returns all detected objects.
    """
    os.makedirs(CROPS_DIR, exist_ok=True)
    detector = get_detector()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM images WHERE id = ?", (image_id,))
        img_row = cursor.fetchone()
        if not img_row:
            raise ValueError(f"Image {image_id} not found in database.")

        # If re_detect is True, clear previous detections for this image
        if re_detect:
            cursor.execute("DELETE FROM detections WHERE image_id = ?", (image_id,))

        filepath = img_row["filepath"]
        survey_id = img_row["survey_id"]
        base_lat = img_row["simulated_lat"]
        base_lon = img_row["simulated_lon"]

        raw_detections = detector.predict(
            image_path=filepath,
            conf_threshold=conf_threshold,
            iou_threshold=iou_threshold
        )

        saved_detections = []
        created_at = datetime.utcnow().isoformat()

        for idx, det in enumerate(raw_detections, start=1):
            detection_id = f"DET_{uuid.uuid4().hex[:8].upper()}"
            x1, y1, x2, y2 = det["bbox_pixels"]

            # Slight simulated offset based on bounding box center in frame
            x_norm, y_norm = det["bbox_normalized"][0], det["bbox_normalized"][1]
            det_lat = round(base_lat + ((y_norm - 0.5) * 0.0001), 6)
            det_lon = round(base_lon + ((x_norm - 0.5) * 0.0001), 6)

            # Extract and save cropped target image
            crop_img = detector.extract_crop(filepath, det["bbox_pixels"])
            crop_filename = f"{detection_id}.png"
            crop_filepath = os.path.join(CROPS_DIR, crop_filename)
            if crop_img is not None and crop_img.size > 0:
                cv2.imwrite(crop_filepath, crop_img)

            cursor.execute("""
            INSERT INTO detections (
                id, image_id, survey_id, class_id, class_name, confidence,
                bbox_x1, bbox_y1, bbox_x2, bbox_y2,
                status, review_status, simulated_lat, simulated_lon, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)
            """, (
                detection_id, image_id, survey_id, det["class_id"], det["class_name"],
                det["confidence"], x1, y1, x2, y2, det["initial_status"],
                det_lat, det_lon, created_at
            ))

            saved_detections.append({
                "id": detection_id,
                "image_id": image_id,
                "survey_id": survey_id,
                "class_id": det["class_id"],
                "class_name": det["class_name"],
                "confidence": det["confidence"],
                "bbox": [x1, y1, x2, y2],
                "bbox_normalized": det["bbox_normalized"],
                "status": det["initial_status"],
                "simulated_lat": det_lat,
                "simulated_lon": det_lon,
                "has_crop": os.path.exists(crop_filepath)
            })

    return {
        "image_id": image_id,
        "filename": img_row["filename"],
        "frame_id": img_row["frame_id"],
        "total_detections": len(saved_detections),
        "detections": saved_detections
    }


def run_detection_on_survey(
    survey_id: str,
    conf_threshold: float = 0.20,
    iou_threshold: float = 0.45
) -> Dict[str, Any]:
    """
    Executes YOLO detector across all images in a survey.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM images WHERE survey_id = ? ORDER BY frame_id ASC", (survey_id,))
        images = cursor.fetchall()
        if not images:
            raise ValueError(f"No images found for survey {survey_id}")

        # Update survey status
        cursor.execute("UPDATE surveys SET status = 'processing' WHERE id = ?", (survey_id,))

    processed_frames = []
    total_detections = 0
    class_counts = {}

    for img in images:
        result = run_detection_on_image(
            image_id=img["id"],
            conf_threshold=conf_threshold,
            iou_threshold=iou_threshold,
            re_detect=True
        )
        processed_frames.append(result)
        total_detections += result["total_detections"]
        for det in result["detections"]:
            cname = det["class_name"]
            class_counts[cname] = class_counts.get(cname, 0) + 1

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE surveys SET status = 'detected' WHERE id = ?", (survey_id,))

    return {
        "survey_id": survey_id,
        "total_frames_processed": len(processed_frames),
        "total_detections": total_detections,
        "class_breakdown": class_counts,
        "frames": processed_frames
    }
