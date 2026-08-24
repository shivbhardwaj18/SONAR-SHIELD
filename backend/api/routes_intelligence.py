"""
API Routes for Ecological Intelligence, Bio-Threat Modeling & Actionable Cleanup Prioritization.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status

from backend.intelligence.bio_threat import (
    compute_detection_bio_threat,
    compute_hotspot_bio_threat,
    evaluate_survey_bio_threat
)
from backend.intelligence.cleanup import (
    compute_hotspot_cleanup_priority,
    evaluate_survey_cleanup_priorities
)
from backend.database.db import get_db

router = APIRouter(prefix="/api", tags=["Ecological Intelligence & Cleanup Priority"])


# ==================== BIO-THREAT INTELLIGENCE ====================

@router.post("/surveys/{survey_id}/evaluate-bio-threat")
def evaluate_survey_bio_threat_endpoint(survey_id: str):
    """
    Computes and updates Prototype Bio-Threat Indices for all hotspots in a survey.
    """
    try:
        result = evaluate_survey_bio_threat(survey_id)
        return {
            "status": "success",
            "message": f"Evaluated Bio-Threat Index for {result['total_hotspots_evaluated']} hotspots.",
            "data": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to evaluate Bio-Threat metrics: {str(e)}"
        )


@router.get("/surveys/{survey_id}/bio-threat-summary")
def get_survey_bio_threat_summary(survey_id: str):
    """
    Retrieves survey-wide ecological threat summary report with habitat protection data.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM hotspots WHERE survey_id = ? ORDER BY bio_threat_score DESC", (survey_id,))
        rows = cursor.fetchall()

        hotspot_threats = []
        for r in rows:
            hotspot_threats.append({
                "hotspot_id": r["id"],
                "dominant_class": r["dominant_class"],
                "detection_count": r["detection_count"],
                "estimated_area_m2": r["estimated_area_m2"],
                "avg_artificiality": r["avg_artificiality"],
                "bio_threat_score": r["bio_threat_score"],
                "bio_threat_level": r["bio_threat_level"],
                "is_protected": (r["dominant_class"].lower() == "artificial reef")
            })

        critical_count = sum(1 for h in hotspot_threats if h["bio_threat_level"] in ["CRITICAL", "HIGH"])
        protected_count = sum(1 for h in hotspot_threats if h["is_protected"])

        return {
            "status": "success",
            "survey_id": survey_id,
            "metrics": {
                "total_debris_fields": len(hotspot_threats),
                "critical_or_high_threats": critical_count,
                "protected_artificial_habitats": protected_count
            },
            "hotspots": hotspot_threats,
            "disclaimer": "PROTOTYPE BIO-THREAT ESTIMATE - Heuristic proxy based on material taxonomy and cluster density (SIH 2026)"
        }


@router.get("/detections/{detection_id}/bio-threat")
def get_detection_bio_threat_endpoint(detection_id: str):
    """
    Returns single detection ecological threat evaluation and material hazard profile.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT class_name, artificiality_score FROM detections WHERE id = ?", (detection_id,))
        det = cursor.fetchone()
        if not det:
            raise HTTPException(status_code=404, detail="Detection not found")

        result = compute_detection_bio_threat(det["class_name"], det["artificiality_score"])
        return {
            "detection_id": detection_id,
            "bio_threat": result
        }


# ==================== CLEANUP PRIORITIZATION ====================

@router.post("/surveys/{survey_id}/compute-cleanup-priority")
def compute_survey_cleanup_priority_endpoint(survey_id: str):
    """
    Evaluates multi-factor Cleanup Priority rankings for all hotspots in a survey.
    """
    try:
        result = evaluate_survey_cleanup_priorities(survey_id)
        return {
            "status": "success",
            "message": f"Successfully ranked {result['total_ranked']} remediation targets.",
            "data": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute cleanup priorities: {str(e)}"
        )


@router.get("/surveys/{survey_id}/cleanup-rankings")
def get_survey_cleanup_rankings_endpoint(survey_id: str):
    """
    Returns sorted remediation dispatch task list for a survey.
    """
    try:
        rankings = evaluate_survey_cleanup_priorities(survey_id)
        return {
            "status": "success",
            "data": rankings
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve cleanup rankings: {str(e)}"
        )


@router.get("/hotspots/{hotspot_id}/remediation-plan")
def get_hotspot_remediation_plan_endpoint(hotspot_id: str):
    """
    Returns operational action protocol and recommended equipment for a specific hotspot.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM hotspots WHERE id = ?", (hotspot_id,))
        h = cursor.fetchone()
        if not h:
            raise HTTPException(status_code=404, detail="Hotspot not found")

        plan = compute_hotspot_cleanup_priority(
            dominant_class=h["dominant_class"],
            bio_threat_score=h["bio_threat_score"] or 0.50,
            avg_artificiality=h["avg_artificiality"] or 0.50,
            detection_count=h["detection_count"]
        )

        return {
            "hotspot_id": hotspot_id,
            "remediation_plan": plan
        }
