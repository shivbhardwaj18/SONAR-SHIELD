"""
API Routes for Spatial Intelligence, Simulated Geolocation, DBSCAN Hotspot Clustering & GeoJSON.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status

from backend.spatial.geolocator import (
    update_survey_spatial_coordinates,
    generate_survey_geojson,
    compute_detection_spatial_coords
)
from backend.spatial.clustering import run_survey_hotspot_clustering
from backend.database.db import get_db

router = APIRouter(prefix="/api", tags=["Spatial Intelligence & Hotspots"])


# ==================== SPATIAL GEOLOCATION ====================

@router.post("/surveys/{survey_id}/compute-spatial")
def compute_survey_spatial_endpoint(survey_id: str):
    """
    Computes and updates deterministic simulated geographic coordinates and swath telemetry
    for all detections in a survey.
    """
    try:
        result = update_survey_spatial_coordinates(survey_id)
        return {
            "status": "success",
            "message": f"Updated spatial coordinates for {result['total_updated']} detections.",
            "data": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute spatial coordinates: {str(e)}"
        )


@router.get("/surveys/{survey_id}/spatial-geojson")
def get_survey_geojson_endpoint(survey_id: str):
    """
    Returns survey detections as a standard RFC 7946 GeoJSON FeatureCollection.
    Explicitly includes SIMULATED SURVEY METADATA tag and scientific honesty disclaimer.
    """
    try:
        geojson = generate_survey_geojson(survey_id)
        return geojson
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate GeoJSON: {str(e)}"
        )


@router.get("/detections/{detection_id}/spatial-telemetry")
def get_detection_spatial_telemetry(detection_id: str):
    """
    Returns simulated spatial coordinates, depth, altitude, and swath offset for a single detection.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT d.*, i.simulated_lat AS img_lat, i.simulated_lon AS img_lon 
        FROM detections d 
        JOIN images i ON d.image_id = i.id 
        WHERE d.id = ?
        """, (detection_id,))
        det = cursor.fetchone()
        if not det:
            raise HTTPException(status_code=404, detail="Detection not found")

        bbox = [det["bbox_x1"], det["bbox_y1"], det["bbox_x2"], det["bbox_y2"]]
        telemetry = compute_detection_spatial_coords(
            frame_index=0,
            bbox_pixels=bbox,
            image_lat=det["img_lat"],
            image_lon=det["img_lon"]
        )

        return {
            "detection_id": detection_id,
            "class_name": det["class_name"],
            "telemetry": telemetry
        }


# ==================== DBSCAN HOTSPOT CLUSTERING ====================

@router.post("/surveys/{survey_id}/compute-hotspots")
def compute_survey_hotspots_endpoint(
    survey_id: str,
    eps_meters: float = Query(55.0, ge=10.0, le=200.0, description="DBSCAN search radius in meters"),
    min_samples: int = Query(2, ge=1, le=10, description="Minimum samples to form dense cluster")
):
    """
    Runs DBSCAN spatial clustering to aggregate proximal detections into Debris Hotspots.
    """
    try:
        result = run_survey_hotspot_clustering(
            survey_id=survey_id,
            eps_meters=eps_meters,
            min_samples=min_samples
        )
        return {
            "status": "success",
            "message": f"Formed {result['total_hotspots']} Debris Hotspots across survey.",
            "data": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Hotspot clustering failed: {str(e)}"
        )


@router.get("/surveys/{survey_id}/hotspots")
def get_survey_hotspots_endpoint(survey_id: str):
    """
    Retrieves all computed Debris Hotspots for a survey from SQLite.
    If hotspots have not been clustered yet, runs clustering on-the-fly.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM hotspots WHERE survey_id = ? ORDER BY detection_count DESC, cleanup_priority_score DESC", (survey_id,))
        rows = cursor.fetchall()

        if not rows:
            # Check if survey has detections
            cursor.execute("SELECT COUNT(*) FROM detections WHERE survey_id = ?", (survey_id,))
            det_count = cursor.fetchone()[0]
            if det_count > 0:
                try:
                    run_survey_hotspot_clustering(survey_id=survey_id)
                    cursor.execute("SELECT * FROM hotspots WHERE survey_id = ? ORDER BY detection_count DESC, cleanup_priority_score DESC", (survey_id,))
                    rows = cursor.fetchall()
                except Exception:
                    pass

        hotspots = []
        for r in rows:
            hotspots.append({
                "id": r["id"],
                "hotspot_id": r["id"],
                "survey_id": r["survey_id"],
                "center_lat": r["center_lat"],
                "center_lon": r["center_lon"],
                "centroid_lat": r["center_lat"],
                "centroid_lon": r["center_lon"],
                "detection_count": r["detection_count"],
                "dominant_class": r["dominant_class"],
                "estimated_area_m2": r["estimated_area_m2"],
                "avg_artificiality": r["avg_artificiality"],
                "bio_threat_score": r["bio_threat_score"],
                "bio_threat_level": r["bio_threat_level"],
                "cleanup_priority_score": r["cleanup_priority_score"],
                "cleanup_priority_level": r["cleanup_priority_level"],
                "created_at": r["created_at"]
            })

        return {
            "status": "success",
            "survey_id": survey_id,
            "total_hotspots": len(hotspots),
            "hotspots": hotspots
        }


@router.get("/hotspots/{hotspot_id}")
def get_single_hotspot_details(hotspot_id: str):
    """
    Retrieves full details for a single hotspot.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM hotspots WHERE id = ?", (hotspot_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Hotspot not found")

        return {
            "status": "success",
            "hotspot": dict(row)
        }
