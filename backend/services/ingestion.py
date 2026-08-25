"""
Data Ingestion Service for SONAR-SHIELD.
Handles validation, metadata extraction, simulated coordinate assignment, and demo survey loading.
"""

import os
import glob
import uuid
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import cv2
from PIL import Image

from backend.database.db import get_db
from backend.database.models import ImageMetadata, SurveyResponse

# Supported image formats for acoustic / sonar data
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff"}

# Default Demo Survey Reference Coordinates (Arabian Sea Coastal Survey Grid)
DEFAULT_BASE_LAT = 15.4980
DEFAULT_BASE_LON = 73.8150


def generate_simulated_coordinates(index: int, base_lat: float = DEFAULT_BASE_LAT, base_lon: float = DEFAULT_BASE_LON) -> Tuple[float, float]:
    """
    Generates deterministic simulated survey track coordinates in a lawnmower acoustic sweep pattern.
    Each track point is roughly 30-50 meters apart.
    """
    row = index // 4
    col = index % 4
    # If odd row, traverse reverse to mimic sonar survey lawnmower pattern
    if row % 2 == 1:
        col = 3 - col
    
    # 0.00035 degrees ~ approx 38 meters
    lat = round(base_lat + (row * 0.00038), 6)
    lon = round(base_lon + (col * 0.00042), 6)
    return lat, lon


def validate_image_file(file_path: str) -> Tuple[bool, Optional[str], Dict[str, Any]]:
    """
    Validates that a file is an accessible, uncorrupted image.
    Returns: (is_valid, error_message, metadata_dict)
    """
    ext = os.path.splitext(file_path)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"Unsupported file format '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}", {}
    
    try:
        file_size_kb = round(os.path.getsize(file_path) / 1024.0, 2)
        with Image.open(file_path) as img:
            width, height = img.size
            mode = img.mode
            channels = len(img.getbands())
        
        # Verify OpenCV can read it as well
        cv_img = cv2.imread(file_path)
        if cv_img is None:
            return False, "Image file is corrupted or cannot be decoded by OpenCV.", {}

        return True, None, {
            "width": width,
            "height": height,
            "channels": channels,
            "file_size_kb": file_size_kb,
            "mode": mode
        }
    except Exception as e:
        return False, f"Failed to validate image: {str(e)}", {}


def register_survey_in_db(name: str, description: Optional[str] = None, is_demo: bool = False, metadata: Optional[Dict[str, Any]] = None) -> str:
    """Creates a new survey record in SQLite."""
    survey_id = f"SRV_{uuid.uuid4().hex[:8].upper()}"
    created_at = datetime.utcnow().isoformat()
    meta_json = json.dumps(metadata or {})

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO surveys (id, name, description, total_images, status, is_demo, created_at, metadata)
        VALUES (?, ?, ?, 0, 'ready', ?, ?, ?)
        """, (survey_id, name, description, 1 if is_demo else 0, created_at, meta_json))
    
    return survey_id


def register_image_in_db(
    survey_id: str,
    filename: str,
    filepath: str,
    meta: Dict[str, Any],
    frame_index: int,
    is_demo: bool = False,
    label_path: Optional[str] = None
) -> str:
    """Registers an ingested image and assigns simulated survey metadata."""
    image_id = f"IMG_{uuid.uuid4().hex[:8].upper()}"
    frame_id = f"FRAME_{frame_index:04d}"
    lat, lon = generate_simulated_coordinates(frame_index)
    created_at = datetime.utcnow().isoformat()
    has_labels = 1 if (label_path and os.path.exists(label_path)) else 0

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO images (
            id, survey_id, filename, filepath, width, height, channels,
            file_size_kb, frame_id, simulated_lat, simulated_lon,
            is_simulated_coords, is_demo, has_labels, label_path, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
        """, (
            image_id, survey_id, filename, filepath, meta["width"], meta["height"],
            meta.get("channels", 3), meta["file_size_kb"], frame_id, lat, lon,
            1 if is_demo else 0, has_labels, label_path, created_at
        ))

        # Update total_images count on survey
        cursor.execute("""
        UPDATE surveys SET total_images = total_images + 1 WHERE id = ?
        """, (survey_id,))
    
    return image_id


def load_demo_survey() -> Dict[str, Any]:
    """
    Ingests and registers the pre-packaged demo survey images from data/demo_survey/.
    """
    demo_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "demo_survey"))
    if not os.path.exists(demo_dir):
        raise FileNotFoundError(f"Demo survey directory not found at {demo_dir}")

    # Check for existing demo survey and refresh cleanly to avoid duplicate dropdown flooding
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM surveys WHERE is_demo = 1")
        old_demos = [row[0] for row in cursor.fetchall()]
        for old_id in old_demos:
            cursor.execute("DELETE FROM detections WHERE survey_id = ?", (old_id,))
            cursor.execute("DELETE FROM images WHERE survey_id = ?", (old_id,))
            cursor.execute("DELETE FROM hotspots WHERE survey_id = ?", (old_id,))
            cursor.execute("DELETE FROM surveys WHERE id = ?", (old_id,))

    survey_name = "DEMO-SURVEY-ALPHA (Simulated Coastal Grid)"
    survey_desc = "Pre-packaged multi-class side-scan sonar demo dataset for instant evaluation."
    
    survey_id = register_survey_in_db(
        name=survey_name,
        description=survey_desc,
        is_demo=True,
        metadata={
            "survey_type": "Side-Scan Sonar Simulated Run",
            "frequency_khz": 450,
            "swath_width_m": 100,
            "coordinate_mode": "DEMO / SIMULATED COORDINATES"
        }
    )

    image_patterns = [os.path.join(demo_dir, f"*{ext}") for ext in ALLOWED_EXTENSIONS]
    image_paths = []
    for pattern in image_patterns:
        image_paths.extend(glob.glob(pattern))
    
    image_paths.sort()
    registered_images = []

    for idx, img_path in enumerate(image_paths, start=1):
        filename = os.path.basename(img_path)
        is_valid, err, meta = validate_image_file(img_path)
        if not is_valid:
            continue
        
        # Check corresponding .txt label
        base_name = os.path.splitext(filename)[0]
        label_file = os.path.join(demo_dir, f"{base_name}.txt")
        label_path = label_file if os.path.exists(label_file) else None

        img_id = register_image_in_db(
            survey_id=survey_id,
            filename=filename,
            filepath=img_path,
            meta=meta,
            frame_index=idx,
            is_demo=True,
            label_path=label_path
        )
        registered_images.append({
            "id": img_id,
            "filename": filename,
            "frame_id": f"FRAME_{idx:04d}",
            "dimensions": f"{meta['width']}x{meta['height']}",
            "has_ground_truth": bool(label_path)
        })

    return {
        "survey_id": survey_id,
        "name": survey_name,
        "total_images": len(registered_images),
        "is_demo": True,
        "coordinate_note": "SIMULATED SURVEY METADATA",
        "images": registered_images
    }
