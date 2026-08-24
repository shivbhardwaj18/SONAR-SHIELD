"""
Simulated Geolocation & Spatial Metadata Engine for SONAR-SHIELD.
Transforms 2D sonar image detections into deterministic, geographically-consistent
coordinates with swath geometry, depth estimation, and standardized GeoJSON output.
"""

import math
import hashlib
from typing import Dict, Any, List, Optional
from backend.database.db import get_db

# Simulated Survey Base Anchor (Arabian Sea Coastal Grid, Maharashtra, India)
BASE_LAT = 18.9220
BASE_LON = 72.8340
TRANSECT_HEADING_DEG = 135.0  # South-East trackline heading
SWATH_HALF_WIDTH_M = 50.0     # 50m port / 50m starboard swath
FRAME_INTERVAL_M = 35.0       # 35m vessel advance between frames

METERS_PER_DEG_LAT = 111320.0
METERS_PER_DEG_LON = 111320.0 * math.cos(math.radians(BASE_LAT))


def compute_detection_spatial_coords(
    frame_index: int = 0,
    bbox_pixels: list = [0, 0, 100, 100],
    img_dims: tuple = (640, 640),
    image_lat: Optional[float] = None,
    image_lon: Optional[float] = None
) -> Dict[str, Any]:
    """
    Computes deterministic simulated geographic coordinates and swath telemetry for a detection.
    """
    img_w, img_h = img_dims
    x1, y1, x2, y2 = float(bbox_pixels[0]), float(bbox_pixels[1]), float(bbox_pixels[2]), float(bbox_pixels[3])

    # Center of target bounding box
    cx = (x1 + x2) / 2.0
    cy = (y1 + y2) / 2.0

    # 1. Base Vessel Position for this Frame
    if image_lat is not None and image_lon is not None:
        vessel_lat = image_lat
        vessel_lon = image_lon
    else:
        dist_along_track_m = frame_index * FRAME_INTERVAL_M
        heading_rad = math.radians(TRANSECT_HEADING_DEG)
        d_north = dist_along_track_m * math.cos(heading_rad)
        d_east = dist_along_track_m * math.sin(heading_rad)
        vessel_lat = BASE_LAT + (d_north / METERS_PER_DEG_LAT)
        vessel_lon = BASE_LON + (d_east / METERS_PER_DEG_LON)

    # 2. Lateral Swath Offset (Port vs Starboard)
    # Normalized x from -1.0 (far port) to +1.0 (far starboard)
    u = (cx - (img_w / 2.0)) / (img_w / 2.0)
    lateral_offset_m = u * SWATH_HALF_WIDTH_M
    swath_side = "STARBOARD" if u >= 0 else "PORT"

    # Along-track minor offset from frame center
    v = ((img_h / 2.0) - cy) / (img_h / 2.0)
    along_offset_m = v * 15.0

    # Target geographic displacement vector
    # Lateral axis is perpendicular to heading: heading + 90 deg
    lat_heading_rad = math.radians(TRANSECT_HEADING_DEG + 90.0)
    trk_heading_rad = math.radians(TRANSECT_HEADING_DEG)

    target_d_north = (along_offset_m * math.cos(trk_heading_rad)) + (lateral_offset_m * math.cos(lat_heading_rad))
    target_d_east = (along_offset_m * math.sin(trk_heading_rad)) + (lateral_offset_m * math.sin(lat_heading_rad))

    target_lat = round(vessel_lat + (target_d_north / METERS_PER_DEG_LAT), 7)
    target_lon = round(vessel_lon + (target_d_east / METERS_PER_DEG_LON), 7)

    # 3. Simulated Sonar Telemetry (Depth & Towfish Altitude)
    depth_m = round(22.0 + (abs(u) * 4.5) + ((frame_index % 5) * 0.8), 2)
    altitude_m = round(9.0 + ((frame_index % 4) * 0.5), 2)
    slant_range_m = round(math.sqrt((altitude_m ** 2) + (lateral_offset_m ** 2)), 2)

    return {
        "latitude": target_lat,
        "longitude": target_lon,
        "vessel_latitude": round(vessel_lat, 7),
        "vessel_longitude": round(vessel_lon, 7),
        "lateral_offset_m": round(lateral_offset_m, 2),
        "swath_side": swath_side,
        "estimated_depth_m": depth_m,
        "altitude_m": altitude_m,
        "slant_range_est_m": slant_range_m,
        "coordinate_type": "SIMULATED SURVEY METADATA"
    }


def update_survey_spatial_coordinates(survey_id: str) -> Dict[str, Any]:
    """
    Computes and persists simulated coordinates for all detections in a survey.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT d.id, d.image_id, d.bbox_x1, d.bbox_y1, d.bbox_x2, d.bbox_y2, 
               i.simulated_lat, i.simulated_lon, i.frame_id
        FROM detections d
        JOIN images i ON d.image_id = i.id
        WHERE d.survey_id = ?
        ORDER BY i.frame_id ASC
        """, (survey_id,))
        rows = cursor.fetchall()
        if not rows:
            raise ValueError(f"No detections found for survey {survey_id}")

        updated = []
        for idx, r in enumerate(rows):
            det_id = r["id"]
            bbox = [r["bbox_x1"], r["bbox_y1"], r["bbox_x2"], r["bbox_y2"]]
            img_lat = r["simulated_lat"]
            img_lon = r["simulated_lon"]

            spatial = compute_detection_spatial_coords(
                frame_index=idx,
                bbox_pixels=bbox,
                image_lat=img_lat,
                image_lon=img_lon
            )

            cursor.execute("""
            UPDATE detections 
            SET simulated_lat = ?, simulated_lon = ?
            WHERE id = ?
            """, (spatial["latitude"], spatial["longitude"], det_id))

            updated.append({
                "detection_id": det_id,
                "latitude": spatial["latitude"],
                "longitude": spatial["longitude"],
                "depth_m": spatial["estimated_depth_m"],
                "lateral_offset_m": spatial["lateral_offset_m"],
                "swath_side": spatial["swath_side"]
            })

        return {
            "survey_id": survey_id,
            "total_updated": len(updated),
            "detections": updated
        }


def generate_survey_geojson(survey_id: str) -> Dict[str, Any]:
    """
    Generates a standard RFC 7946 GeoJSON FeatureCollection for all detections in a survey.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT d.*, i.filename, i.frame_id
        FROM detections d
        JOIN images i ON d.image_id = i.id
        WHERE d.survey_id = ?
        """, (survey_id,))
        rows = cursor.fetchall()

    features = []
    for idx, r in enumerate(rows):
        lat = r["simulated_lat"]
        lon = r["simulated_lon"]

        # Calculate swath details
        bbox = [r["bbox_x1"], r["bbox_y1"], r["bbox_x2"], r["bbox_y2"]]
        spatial = compute_detection_spatial_coords(
            frame_index=idx,
            bbox_pixels=bbox,
            image_lat=lat,
            image_lon=lon
        )

        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat]  # GeoJSON standard: [longitude, latitude]
            },
            "properties": {
                "detection_id": r["id"],
                "survey_id": r["survey_id"],
                "image_id": r["image_id"],
                "frame_filename": r["filename"],
                "frame_id": r["frame_id"],
                "class_name": r["class_name"],
                "confidence": round(float(r["confidence"]), 4),
                "shape_score": r["shape_score"],
                "shadow_score": r["shadow_score"],
                "context_score": r["context_score"],
                "artificiality_score": r["artificiality_score"],
                "status": r["status"],
                "review_status": r["review_status"],
                "depth_m": spatial["estimated_depth_m"],
                "lateral_offset_m": spatial["lateral_offset_m"],
                "swath_side": spatial["swath_side"],
                "coordinate_type": "SIMULATED SURVEY METADATA",
                "disclaimer": "DEMO / SIMULATED COORDINATES - Arabian Sea Coastal Grid (SIH 2026)"
            }
        }
        features.append(feature)

    return {
        "type": "FeatureCollection",
        "survey_id": survey_id,
        "coordinate_reference_system": "EPSG:4326 (WGS 84)",
        "metadata_tag": "SIMULATED SURVEY METADATA",
        "total_features": len(features),
        "features": features
    }
