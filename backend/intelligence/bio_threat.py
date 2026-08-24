"""
Prototype Bio-Threat & Ecological Impact Modeling Engine for SONAR-SHIELD.
Evaluates environmental hazard severity for marine debris targets and hotspot clusters,
distinguishing toxic pollutants from protected artificial reef habitats.
"""

from typing import Dict, Any, List, Optional
from backend.database.db import get_db

# Material Toxicity & Ecological Impact Profiles
MATERIAL_PROFILES = {
    "tyre": {
        "toxicity_factor": 0.85,
        "hazard_category": "TOXIC POLYMER & MICROPLASTIC HAZARD",
        "rationale": "High long-term toxicity: Leaches vulcanization chemicals, zinc, and sheds harmful microplastic fibers into benthic food webs.",
        "remediation_urgency": "HIGH"
    },
    "shipwreck": {
        "toxicity_factor": 0.75,
        "hazard_category": "STRUCTURAL COLLAPSE & CHEMICAL RESIDUE",
        "rationale": "Moderate/High toxicity: Potential bunker fuel seepage, heavy metal corrosion, and snag hazard for marine fauna.",
        "remediation_urgency": "HIGH"
    },
    "artificial reef": {
        "toxicity_factor": 0.00,
        "hazard_category": "BENEFICIAL MARINE HABITAT / FISH SANCTUARY",
        "rationale": "Zero ecological threat: Man-made structure intentionally placed to restore coral ecosystems and provide fish shelter. Excluded from debris removal.",
        "remediation_urgency": "PRESERVE & PROTECT"
    },
    "rock": {
        "toxicity_factor": 0.00,
        "hazard_category": "NATURAL BENTHIC GEOLOGY",
        "rationale": "Natural seabed feature. Zero contamination risk.",
        "remediation_urgency": "NONE"
    },
    "sand ripple": {
        "toxicity_factor": 0.00,
        "hazard_category": "NATURAL SEABED SEDIMENT",
        "rationale": "Natural hydro-dynamic sediment formation. Zero contamination risk.",
        "remediation_urgency": "NONE"
    }
}


def compute_detection_bio_threat(
    class_name: str,
    artificiality_score: Optional[float]
) -> Dict[str, Any]:
    """
    Computes prototype ecological threat score and hazard profile for a single detection.
    """
    cname = class_name.lower().strip()
    profile = MATERIAL_PROFILES.get(cname, {
        "toxicity_factor": 0.50,
        "hazard_category": "UNCLASSIFIED DEBRIS",
        "rationale": "Generic submerged artificial object.",
        "remediation_urgency": "MODERATE"
    })

    t_mat = profile["toxicity_factor"]
    art_score = artificiality_score if artificiality_score is not None else 0.50

    if cname in ["artificial reef"]:
        score = 0.00
        level = "BENEFICIAL_HABITAT"
    elif cname in ["rock", "sand ripple"]:
        score = 0.00
        level = "NATURAL"
    else:
        score = round(min(1.0, max(0.0, float(t_mat * art_score))), 4)
        if score >= 0.75:
            level = "CRITICAL"
        elif score >= 0.55:
            level = "HIGH"
        elif score >= 0.35:
            level = "MODERATE"
        else:
            level = "LOW"

    return {
        "class_name": class_name,
        "bio_threat_score": score,
        "bio_threat_level": level,
        "hazard_category": profile["hazard_category"],
        "rationale": profile["rationale"],
        "remediation_urgency": profile["remediation_urgency"],
        "is_protected_structure": (cname == "artificial reef"),
        "disclaimer": "PROTOTYPE BIO-THREAT ESTIMATE - Heuristic proxy based on material taxonomy and cluster density (SIH 2026)"
    }


def compute_hotspot_bio_threat(
    dominant_class: str,
    avg_artificiality: float,
    detection_count: int,
    estimated_area_m2: float
) -> Dict[str, Any]:
    """
    Computes composite Bio-Threat Index for a spatial hotspot cluster.
    """
    cname = dominant_class.lower().strip()
    profile = MATERIAL_PROFILES.get(cname, {
        "toxicity_factor": 0.50,
        "hazard_category": "UNCLASSIFIED DEBRIS CLUSTER",
        "rationale": "Submerged debris cluster of unverified composition.",
        "remediation_urgency": "MODERATE"
    })

    t_mat = profile["toxicity_factor"]

    # If the cluster is primarily artificial reef or natural, preserve as non-threat
    if cname == "artificial reef":
        return {
            "bio_threat_score": 0.00,
            "bio_threat_level": "BENEFICIAL_HABITAT",
            "hazard_category": profile["hazard_category"],
            "rationale": profile["rationale"],
            "remediation_urgency": "PRESERVE & PROTECT",
            "is_protected_structure": True
        }
    elif cname in ["rock", "sand ripple"]:
        return {
            "bio_threat_score": 0.00,
            "bio_threat_level": "NATURAL",
            "hazard_category": profile["hazard_category"],
            "rationale": profile["rationale"],
            "remediation_urgency": "NONE",
            "is_protected_structure": False
        }

    # Density & Area Multipliers for True Debris
    density_mult = min(1.40, 1.0 + (max(0, detection_count - 1) * 0.10))
    area_scale = min(1.25, 1.0 + ((estimated_area_m2 / 500.0) * 0.20))

    raw_threat = t_mat * avg_artificiality * density_mult * area_scale
    threat_score = round(min(1.0, max(0.05, float(raw_threat))), 4)

    if threat_score >= 0.75:
        threat_level = "CRITICAL"
    elif threat_score >= 0.55:
        threat_level = "HIGH"
    elif threat_score >= 0.35:
        threat_level = "MODERATE"
    else:
        threat_level = "LOW"

    return {
        "bio_threat_score": threat_score,
        "bio_threat_level": threat_level,
        "hazard_category": profile["hazard_category"],
        "rationale": profile["rationale"],
        "remediation_urgency": profile["remediation_urgency"],
        "is_protected_structure": False,
        "density_multiplier": round(density_mult, 2),
        "area_scale": round(area_scale, 2)
    }


def evaluate_survey_bio_threat(survey_id: str) -> Dict[str, Any]:
    """
    Evaluates and updates Bio-Threat metrics for all hotspots and detections in a survey.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM hotspots WHERE survey_id = ?", (survey_id,))
        hotspots = cursor.fetchall()

        updated_hotspots = []
        for h in hotspots:
            h_id = h["id"]
            dom_class = h["dominant_class"]
            avg_art = h["avg_artificiality"]
            cnt = h["detection_count"]
            area = h["estimated_area_m2"]

            threat_info = compute_hotspot_bio_threat(dom_class, avg_art, cnt, area)

            cursor.execute("""
            UPDATE hotspots 
            SET bio_threat_score = ?, bio_threat_level = ?
            WHERE id = ?
            """, (threat_info["bio_threat_score"], threat_info["bio_threat_level"], h_id))

            updated_hotspots.append({
                "hotspot_id": h_id,
                "dominant_class": dom_class,
                "detection_count": cnt,
                "bio_threat_score": threat_info["bio_threat_score"],
                "bio_threat_level": threat_info["bio_threat_level"],
                "hazard_category": threat_info["hazard_category"],
                "rationale": threat_info["rationale"],
                "is_protected_structure": threat_info["is_protected_structure"]
            })

        # Summary statistics
        high_threat_count = sum(1 for h in updated_hotspots if h["bio_threat_level"] in ["CRITICAL", "HIGH"])
        protected_count = sum(1 for h in updated_hotspots if h["is_protected_structure"])

        return {
            "survey_id": survey_id,
            "total_hotspots_evaluated": len(updated_hotspots),
            "high_threat_hotspots": high_threat_count,
            "protected_habitats": protected_count,
            "hotspots": updated_hotspots
        }
