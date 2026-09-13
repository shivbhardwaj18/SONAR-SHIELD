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

# Default Base Reference Coordinates (Mumbai Harbor Deepwater Open Sea Channel, Arabian Sea)
DEFAULT_BASE_LAT = 18.9150
DEFAULT_BASE_LON = 72.8700

import csv


def parse_metadata_csv(csv_path: str) -> Dict[str, Dict[str, Any]]:
    """
    Parses a metadata CSV mapping image filenames to exact geographic coordinates, depth, and notes.
    Supported headers: filename, lat/latitude, lon/longitude, depth/depth_m, heading/heading_deg, notes.
    """
    if not os.path.exists(csv_path):
        return {}
    meta_by_file = {}
    try:
        with open(csv_path, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Handle possible BOM or alternate column names
                fname = ""
                for k, v in row.items():
                    if k and k.strip().lower() in ["filename", "file", "image", "image_name", "img"]:
                        fname = (v or "").strip()
                        break
                if not fname:
                    fname = (row.get("filename") or row.get("file") or "").strip()
                if not fname:
                    continue
                try:
                    lat_str = row.get("latitude") or row.get("lat") or row.get("Lat")
                    lon_str = row.get("longitude") or row.get("lon") or row.get("Lon") or row.get("lng")
                    if lat_str is None or lon_str is None:
                        continue
                    lat = float(lat_str)
                    lon = float(lon_str)
                    depth_m = float(row.get("depth_m") or row.get("depth") or 21.0)
                    heading = float(row.get("heading_deg") or row.get("heading") or 135.0)
                    swath_w = float(row.get("swath_width_m") or row.get("swath_width") or 100.0)
                    target_type = row.get("target_type") or row.get("class") or ""
                    notes = row.get("notes") or row.get("description") or ""

                    meta_by_file[fname] = {
                        "lat": lat,
                        "lon": lon,
                        "depth_m": depth_m,
                        "heading_deg": heading,
                        "swath_width_m": swath_w,
                        "target_type": target_type,
                        "notes": notes
                    }
                except (ValueError, TypeError):
                    continue
    except Exception as e:
        print(f"Notice: Failed to parse metadata CSV {csv_path}: {e}")
    return meta_by_file


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
    label_path: Optional[str] = None,
    custom_lat: Optional[float] = None,
    custom_lon: Optional[float] = None,
    base_lat: float = DEFAULT_BASE_LAT,
    base_lon: float = DEFAULT_BASE_LON
) -> str:
    """Registers an ingested image and assigns survey coordinates."""
    image_id = f"IMG_{uuid.uuid4().hex[:8].upper()}"
    frame_id = f"FRAME_{frame_index:04d}"
    
    if custom_lat is not None and custom_lon is not None:
        lat, lon = custom_lat, custom_lon
        is_simulated = 0 if not is_demo else 1
    else:
        lat, lon = generate_simulated_coordinates(frame_index, base_lat=base_lat, base_lon=base_lon)
        is_simulated = 1
        
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            image_id, survey_id, filename, filepath, meta["width"], meta["height"],
            meta.get("channels", 3), meta["file_size_kb"], frame_id, lat, lon,
            is_simulated, 1 if is_demo else 0, has_labels, label_path, created_at
        ))

        # Update total_images count on survey
        cursor.execute("""
        UPDATE surveys SET total_images = total_images + 1 WHERE id = ?
        """, (survey_id,))
    
    return image_id


def load_demo_survey() -> Dict[str, Any]:
    """
    Ingests and registers the pre-packaged demo survey images from data/demo_survey/
    with real-world Mumbai Harbor coordinates.
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

    # Parse survey_info.json if present
    survey_info_file = os.path.join(demo_dir, "survey_info.json")
    survey_name = "MUMBAI-OFFSHORE-CORRIDOR-2026 (Arabian Sea)"
    survey_desc = "High-resolution side-scan sonar survey in Mumbai Harbor South Channel featuring a 3-point ghost net & wreck scatter cluster and 2 isolated shipping hazards."
    survey_meta = {
        "survey_type": "Dual-Frequency Side-Scan Sonar (455/900 kHz)",
        "location": "Mumbai Harbor South Deepwater Channel, Arabian Sea, India",
        "base_latitude": 18.9150,
        "base_longitude": 72.8700,
        "swath_width_m": 100,
        "coordinate_mode": "REAL-WORLD OPENSTREETMAP COORDINATES (EPSG:4326)"
    }

    if os.path.exists(survey_info_file):
        try:
            with open(survey_info_file, "r", encoding="utf-8") as f:
                loaded_info = json.load(f)
                survey_name = loaded_info.get("survey_name", survey_name)
                survey_desc = loaded_info.get("description", survey_desc)
                survey_meta.update(loaded_info)
        except Exception:
            pass

    survey_id = register_survey_in_db(
        name=survey_name,
        description=survey_desc,
        is_demo=True,
        metadata=survey_meta
    )

    # Parse metadata.csv if present
    csv_file = os.path.join(demo_dir, "metadata.csv")
    csv_metadata = parse_metadata_csv(csv_file) if os.path.exists(csv_file) else {}

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

        # Check if coordinates exist in CSV
        img_meta = csv_metadata.get(filename, {})
        custom_lat = img_meta.get("lat")
        custom_lon = img_meta.get("lon")

        img_id = register_image_in_db(
            survey_id=survey_id,
            filename=filename,
            filepath=img_path,
            meta=meta,
            frame_index=idx,
            is_demo=True,
            label_path=label_path,
            custom_lat=custom_lat,
            custom_lon=custom_lon
        )
        registered_images.append({
            "id": img_id,
            "filename": filename,
            "frame_id": f"FRAME_{idx:04d}",
            "dimensions": f"{meta['width']}x{meta['height']}",
            "latitude": custom_lat,
            "longitude": custom_lon,
            "depth_m": img_meta.get("depth_m", 21.0),
            "notes": img_meta.get("notes", ""),
            "has_ground_truth": bool(label_path)
        })

    return {
        "survey_id": survey_id,
        "name": survey_name,
        "total_images": len(registered_images),
        "is_demo": True,
        "coordinate_mode": "REAL-WORLD OPENSTREETMAP COORDINATES (EPSG:4326)",
        "location": survey_meta.get("location", "Mumbai Port & Elephanta South Channel"),
        "images": registered_images
    }

