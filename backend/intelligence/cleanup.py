"""
Actionable Cleanup Prioritization & Remediation Intelligence Engine for SONAR-SHIELD.
Ranks debris hotspots into operational cleanup tiers, recommends specialized recovery equipment,
and enforces habitat preservation exemptions for artificial reefs.
"""

from typing import Dict, Any, List, Optional
from backend.database.db import get_db

EQUIPMENT_RECOMMENDATIONS = {
    "tyre": {
        "equipment": "Diver Recovery Net Basket, Hydraulic Winch & Benthic Microplastic Silt Curtain",
        "action_protocol": "Deploy recovery divers with basket rig. Hoist tyre clusters to vessel deck; vacuum residual sediment for microplastic containment.",
        "estimated_duration_hours": 3.5
    },
    "shipwreck": {
        "equipment": "Heavy Salvage ROV, Subsea Inflatable Lift Bags & Hydrocarbon Containment Boom",
        "action_protocol": "Deploy ROV for hull integrity inspection. Rig inflatable lift bladders; position oil sheen containment boom before structural hoist.",
        "estimated_duration_hours": 12.0
    },
    "artificial reef": {
        "equipment": "Marine Sanctuary Buoy Marker & Passive Acoustic Monitoring Transponder",
        "action_protocol": "DO NOT REMOVE. Log GPS boundary as an ecological fish sanctuary; deploy monitoring marker.",
        "estimated_duration_hours": 1.0
    },
    "rock": {
        "equipment": "None",
        "action_protocol": "Natural benthic structure. No intervention required.",
        "estimated_duration_hours": 0.0
    },
    "sand ripple": {
        "equipment": "None",
        "action_protocol": "Natural hydro-dynamic sand bed. No intervention required.",
        "estimated_duration_hours": 0.0
    }
}


def compute_hotspot_cleanup_priority(
    dominant_class: str,
    bio_threat_score: float,
    avg_artificiality: float,
    detection_count: int,
    avg_depth_m: float = 24.0
) -> Dict[str, Any]:
    """
    Computes multi-factor Cleanup Priority Score, operational tier, and recovery equipment protocol.
    """
    cname = dominant_class.lower().strip()

    # Case 1: Artificial Reefs -> Protected Sanctuary Habitat (Excluded from cleanup)
    if cname == "artificial reef":
        rec = EQUIPMENT_RECOMMENDATIONS["artificial reef"]
        return {
            "cleanup_priority_score": 0.00,
            "cleanup_priority_level": "PROTECTED_HABITAT",
            "tier_display": "PROTECTED / DO NOT REMOVE",
            "action_protocol": rec["action_protocol"],
            "recommended_equipment": rec["equipment"],
            "estimated_duration_hours": rec["estimated_duration_hours"],
            "is_actionable_debris": False
        }

    # Case 2: Natural Features -> Discard
    if cname in ["rock", "sand ripple"]:
        rec = EQUIPMENT_RECOMMENDATIONS.get(cname, EQUIPMENT_RECOMMENDATIONS["rock"])
        return {
            "cleanup_priority_score": 0.00,
            "cleanup_priority_level": "NATURAL_FEATURE",
            "tier_display": "NATURAL / NO ACTION",
            "action_protocol": rec["action_protocol"],
            "recommended_equipment": rec["equipment"],
            "estimated_duration_hours": 0.0,
            "is_actionable_debris": False
        }

    # Case 3: Actionable Marine Debris (Tyre, Shipwreck, Candidate Debris)
    # Density factor (normalized 1 to 5+ items)
    density_factor = min(1.0, float(detection_count) / 5.0)

    # Accessibility factor based on depth (shallower = easier diver/ROV access)
    accessibility_factor = max(0.20, min(1.0, 1.0 - ((avg_depth_m - 15.0) / 40.0)))

    # Multi-Factor Weighted Linear Model
    raw_score = (
        (bio_threat_score * 0.35) +
        (avg_artificiality * 0.25) +
        (density_factor * 0.20) +
        (accessibility_factor * 0.20)
    )
    score = round(min(1.0, max(0.05, float(raw_score))), 4)

    if score >= 0.75:
        level = "PRIORITY 1"
        tier_display = "PRIORITY 1: IMMEDIATE CLEANUP"
    elif score >= 0.45:
        level = "PRIORITY 2"
        tier_display = "PRIORITY 2: SCHEDULED REMEDIATION"
    else:
        level = "PRIORITY 3"
        tier_display = "PRIORITY 3: MONITOR & RE-SURVEY"

    rec = EQUIPMENT_RECOMMENDATIONS.get(cname, EQUIPMENT_RECOMMENDATIONS["tyre"])

    return {
        "cleanup_priority_score": score,
        "cleanup_priority_level": level,
        "tier_display": tier_display,
        "action_protocol": rec["action_protocol"],
        "recommended_equipment": rec["equipment"],
        "estimated_duration_hours": rec["estimated_duration_hours"],
        "is_actionable_debris": True,
        "factors": {
            "bio_threat_weight": 0.35,
            "artificiality_weight": 0.25,
            "density_factor": round(density_factor, 2),
            "accessibility_factor": round(accessibility_factor, 2)
        }
    }


def evaluate_survey_cleanup_priorities(survey_id: str) -> Dict[str, Any]:
    """
    Evaluates and updates Cleanup Priority rankings across all hotspots in a survey.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM hotspots WHERE survey_id = ?", (survey_id,))
        hotspots = cursor.fetchall()

        updated_hotspots = []
        for h in hotspots:
            h_id = h["id"]
            dom_class = h["dominant_class"]
            bio_threat = h["bio_threat_score"] or 0.50
            avg_art = h["avg_artificiality"] or 0.50
            cnt = h["detection_count"]

            priority_info = compute_hotspot_cleanup_priority(
                dominant_class=dom_class,
                bio_threat_score=bio_threat,
                avg_artificiality=avg_art,
                detection_count=cnt
            )

            cursor.execute("""
            UPDATE hotspots 
            SET cleanup_priority_score = ?, cleanup_priority_level = ?
            WHERE id = ?
            """, (priority_info["cleanup_priority_score"], priority_info["cleanup_priority_level"], h_id))

            updated_hotspots.append({
                "hotspot_id": h_id,
                "dominant_class": dom_class,
                "detection_count": cnt,
                "center_lat": h["center_lat"],
                "center_lon": h["center_lon"],
                "estimated_area_m2": h["estimated_area_m2"],
                "avg_artificiality": avg_art,
                "bio_threat_score": bio_threat,
                "cleanup_priority_score": priority_info["cleanup_priority_score"],
                "cleanup_priority_level": priority_info["cleanup_priority_level"],
                "tier_display": priority_info["tier_display"],
                "recommended_equipment": priority_info["recommended_equipment"],
                "action_protocol": priority_info["action_protocol"],
                "is_actionable_debris": priority_info["is_actionable_debris"]
            })

        # Sort rankings: Actionable debris descending by priority score, followed by protected habitats
        actionable = sorted(
            [h for h in updated_hotspots if h["is_actionable_debris"]],
            key=lambda x: x["cleanup_priority_score"],
            reverse=True
        )
        non_actionable = [h for h in updated_hotspots if not h["is_actionable_debris"]]
        ranked_list = actionable + non_actionable

        return {
            "survey_id": survey_id,
            "total_ranked": len(ranked_list),
            "priority_1_count": sum(1 for h in ranked_list if h["cleanup_priority_level"] == "PRIORITY 1"),
            "priority_2_count": sum(1 for h in ranked_list if h["cleanup_priority_level"] == "PRIORITY 2"),
            "protected_habitats_count": sum(1 for h in ranked_list if h["cleanup_priority_level"] == "PROTECTED_HABITAT"),
            "rankings": ranked_list
        }
