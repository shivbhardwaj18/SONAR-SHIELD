"""
DBSCAN Spatial Clustering Engine for Debris Hotspots and Marine Scatter Fields.
Aggregates proximal underwater detections into defined spatial hotspots with centroid,
dominant class, estimated bounding area, and GeoJSON boundary polygons.
"""

import math
import uuid
from datetime import datetime
from collections import Counter
from typing import Dict, Any, List, Tuple, Optional
import numpy as np

from backend.database.db import get_db
from backend.spatial.geolocator import (
    BASE_LAT, 
    BASE_LON, 
    METERS_PER_DEG_LAT, 
    METERS_PER_DEG_LON,
    update_survey_spatial_coordinates
)


def latlon_to_meters(lat: float, lon: float, origin_lat: float = BASE_LAT, origin_lon: float = BASE_LON) -> Tuple[float, float]:
    """Converts (lat, lon) to Cartesian metric coordinates (x, y) relative to origin."""
    m_lat = METERS_PER_DEG_LAT
    m_lon = METERS_PER_DEG_LAT * math.cos(math.radians(origin_lat))
    x = (lon - origin_lon) * m_lon
    y = (lat - origin_lat) * m_lat
    return x, y


def meters_to_latlon(x: float, y: float, origin_lat: float = BASE_LAT, origin_lon: float = BASE_LON) -> Tuple[float, float]:
    """Converts Cartesian metric coordinates (x, y) back to (lat, lon)."""
    m_lat = METERS_PER_DEG_LAT
    m_lon = METERS_PER_DEG_LAT * math.cos(math.radians(origin_lat))
    lat = origin_lat + (y / m_lat)
    lon = origin_lon + (x / m_lon)
    return lat, lon


def simple_dbscan_clustering(
    points_xy: List[Tuple[float, float]],
    eps_meters: float = 55.0,
    min_samples: int = 2
) -> List[int]:
    """
    Pure Python/NumPy DBSCAN implementation to avoid heavy external C-extensions.
    Returns cluster labels for each point (-1 for noise/outlier, 0, 1, 2... for clusters).
    """
    n = len(points_xy)
    labels = [-1] * n
    visited = [False] * n
    cluster_id = 0

    def region_query(p_idx: int) -> List[int]:
        neighbors = []
        px, py = points_xy[p_idx]
        for i, (qx, qy) in enumerate(points_xy):
            dist = math.hypot(px - qx, py - qy)
            if dist <= eps_meters:
                neighbors.append(i)
        return neighbors

    for i in range(n):
        if visited[i]:
            continue
        visited[i] = True
        neighbors = region_query(i)

        if len(neighbors) < min_samples:
            labels[i] = -1  # Mark as noise initially
        else:
            labels[i] = cluster_id
            queue = list(neighbors)
            while queue:
                q_idx = queue.pop(0)
                if not visited[q_idx]:
                    visited[q_idx] = True
                    q_neighbors = region_query(q_idx)
                    if len(q_neighbors) >= min_samples:
                        queue.extend([idx for idx in q_neighbors if idx not in queue])
                if labels[q_idx] == -1:
                    labels[q_idx] = cluster_id
            cluster_id += 1

    return labels


def compute_convex_hull_area_and_polygon(
    points_latlon: List[Tuple[float, float]]
) -> Tuple[float, List[List[float]]]:
    """
    Calculates estimated spatial area in m^2 and boundary polygon coordinates [[lon, lat], ...].
    """
    if len(points_latlon) == 1:
        lat, lon = points_latlon[0]
        # Buffer square approx 50m^2 (r ≈ 4m)
        d_lat = 4.0 / METERS_PER_DEG_LAT
        d_lon = 4.0 / (METERS_PER_DEG_LAT * math.cos(math.radians(lat)))
        polygon = [
            [round(lon - d_lon, 7), round(lat - d_lat, 7)],
            [round(lon + d_lon, 7), round(lat - d_lat, 7)],
            [round(lon + d_lon, 7), round(lat + d_lat, 7)],
            [round(lon - d_lon, 7), round(lat + d_lat, 7)],
            [round(lon - d_lon, 7), round(lat - d_lat, 7)]
        ]
        return 50.0, polygon

    if len(points_latlon) == 2:
        (lat1, lon1), (lat2, lon2) = points_latlon
        x1, y1 = latlon_to_meters(lat1, lon1)
        x2, y2 = latlon_to_meters(lat2, lon2)
        dist_m = max(10.0, math.hypot(x2 - x1, y2 - y1))
        est_area = round(dist_m * 20.0, 1)  # 20m swath buffer along line

        # 4-point corridor polygon
        d_lat = 10.0 / METERS_PER_DEG_LAT
        d_lon = 10.0 / (METERS_PER_DEG_LAT * math.cos(math.radians(lat1)))
        polygon = [
            [round(lon1 - d_lon, 7), round(lat1 - d_lat, 7)],
            [round(lon2 + d_lon, 7), round(lat2 - d_lat, 7)],
            [round(lon2 + d_lon, 7), round(lat2 + d_lat, 7)],
            [round(lon1 - d_lon, 7), round(lat1 + d_lat, 7)],
            [round(lon1 - d_lon, 7), round(lat1 - d_lat, 7)]
        ]
        return est_area, polygon

    # 3 or more points: Shoelace formula in metric Cartesian coordinates
    xy_pts = [latlon_to_meters(lat, lon) for lat, lon in points_latlon]
    xs = [p[0] for p in xy_pts]
    ys = [p[1] for p in xy_pts]

    # Shoelace formula for area
    area_m2 = 0.5 * abs(sum(xs[i] * ys[(i + 1) % len(xs)] - xs[(i + 1) % len(xs)] * ys[i] for i in range(len(xs))))
    area_m2 = max(80.0, round(area_m2, 1))

    # Polygon loop in [lon, lat]
    polygon = [[round(lon, 7), round(lat, 7)] for lat, lon in points_latlon]
    polygon.append(polygon[0])  # Close loop
    return area_m2, polygon


def run_survey_hotspot_clustering(
    survey_id: str,
    eps_meters: float = 55.0,
    min_samples: int = 2
) -> Dict[str, Any]:
    """
    Groups survey detections into Debris Hotspots, computes statistics, and persists to SQLite.
    """
    # 1. Ensure spatial coordinates are up to date
    update_survey_spatial_coordinates(survey_id)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT d.*, i.filename, i.frame_id 
        FROM detections d
        JOIN images i ON d.image_id = i.id
        WHERE d.survey_id = ?
        """, (survey_id,))
        detections = cursor.fetchall()
        if not detections:
            raise ValueError(f"No detections found for survey {survey_id}")

        # 2. Filter candidate detections (ignore rejected or low artificiality if natural)
        clusterable_dets = []
        for d in detections:
            if d["status"] in ["VALIDATED", "NEEDS REVIEW", "ARTIFICIAL_STRUCTURE", "CANDIDATE"]:
                clusterable_dets.append(d)

        if not clusterable_dets:
            clusterable_dets = list(detections)

        # 3. Convert to Metric Cartesian coordinates
        points_xy = [
            latlon_to_meters(d["simulated_lat"], d["simulated_lon"])
            for d in clusterable_dets
        ]

        # 4. Run DBSCAN Clustering with adaptive search radius
        adaptive_eps = max(eps_meters, 85.0) if len(clusterable_dets) <= 10 else eps_meters
        labels = simple_dbscan_clustering(points_xy, eps_meters=adaptive_eps, min_samples=min_samples)

        # 5. Group detections by cluster ID
        cluster_groups: Dict[int, List[Dict[str, Any]]] = {}
        outliers: List[Dict[str, Any]] = []

        for idx, lbl in enumerate(labels):
            det = clusterable_dets[idx]
            if lbl >= 0:
                cluster_groups.setdefault(lbl, []).append(det)
            else:
                outliers.append(det)

        # Ensure every outlier / isolated debris point forms its own localized hotspot zone
        next_cluster_id = max(cluster_groups.keys()) + 1 if cluster_groups else 0
        for out_det in outliers:
            cluster_groups[next_cluster_id] = [out_det]
            next_cluster_id += 1

        # 6. Build Hotspot Records and Insert into SQLite
        # Clear existing hotspots for this survey
        cursor.execute("DELETE FROM hotspots WHERE survey_id = ?", (survey_id,))

        created_hotspots = []
        for c_idx, (lbl, group) in enumerate(cluster_groups.items(), 1):
            hotspot_id = f"HS_{survey_id[:8]}_{c_idx:02d}"
            det_count = len(group)
            
            # Centroid
            mean_lat = round(float(np.mean([d["simulated_lat"] for d in group])), 7)
            mean_lon = round(float(np.mean([d["simulated_lon"] for d in group])), 7)

            # Dominant Class
            classes = [d["class_name"] for d in group]
            dominant_class = Counter(classes).most_common(1)[0][0]

            # Average Artificiality
            art_scores = [d["artificiality_score"] or 0.80 for d in group]
            avg_art = round(float(np.mean(art_scores)), 4)

            # Estimated Area & Polygon
            pts_latlon = [(d["simulated_lat"], d["simulated_lon"]) for d in group]
            area_m2, polygon = compute_convex_hull_area_and_polygon(pts_latlon)

            # Default Baseline Bio-Threat & Priority Scores
            bio_threat = round(min(1.0, (avg_art * 0.7) + (min(det_count, 5) * 0.06)), 4)
            bio_level = "HIGH" if bio_threat >= 0.70 else "MODERATE" if bio_threat >= 0.40 else "LOW"

            cleanup_score = round(min(1.0, (avg_art * 0.5) + (det_count * 0.10)), 4)
            cleanup_level = "PRIORITY 1" if cleanup_score >= 0.75 else "PRIORITY 2" if cleanup_score >= 0.45 else "PRIORITY 3"

            now_str = datetime.utcnow().isoformat()

            cursor.execute("""
            INSERT INTO hotspots (
                id, survey_id, center_lat, center_lon, detection_count, 
                dominant_class, estimated_area_m2, avg_artificiality, 
                bio_threat_score, bio_threat_level, cleanup_priority_score, 
                cleanup_priority_level, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                hotspot_id, survey_id, mean_lat, mean_lon, det_count,
                dominant_class, area_m2, avg_art,
                bio_threat, bio_level, cleanup_score,
                cleanup_level, now_str
            ))

            created_hotspots.append({
                "hotspot_id": hotspot_id,
                "survey_id": survey_id,
                "center_lat": mean_lat,
                "center_lon": mean_lon,
                "detection_count": det_count,
                "dominant_class": dominant_class,
                "estimated_area_m2": area_m2,
                "avg_artificiality": avg_art,
                "bio_threat_score": bio_threat,
                "bio_threat_level": bio_level,
                "cleanup_priority_score": cleanup_score,
                "cleanup_priority_level": cleanup_level,
                "polygon_geojson": polygon,
                "detection_ids": [d["id"] for d in group]
            })

    # Automatically compute downstream bio-threat metrics and recovery protocols
    try:
        from backend.intelligence.bio_threat import evaluate_survey_bio_threat
        from backend.intelligence.cleanup import evaluate_survey_cleanup_priorities
        evaluate_survey_bio_threat(survey_id)
        evaluate_survey_cleanup_priorities(survey_id)
    except Exception:
        pass

    return {
        "survey_id": survey_id,
        "total_hotspots": len(created_hotspots),
        "clustering_parameters": {
            "eps_meters": eps_meters,
            "min_samples": min_samples
        },
        "hotspots": created_hotspots
    }

