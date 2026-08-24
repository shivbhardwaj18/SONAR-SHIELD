"""
False-Positive Filtering, Taxonomic Triage, and Human-in-the-Loop Review Engine for SONAR-SHIELD.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
from backend.database.db import get_db

DEFAULT_HIGH_ARTIFICIALITY_THRESHOLD = 0.80
DEFAULT_REVIEW_THRESHOLD = 0.60


def categorize_detection(
    class_name: str,
    artificiality_score: Optional[float],
    high_thresh: float = DEFAULT_HIGH_ARTIFICIALITY_THRESHOLD,
    review_thresh: float = DEFAULT_REVIEW_THRESHOLD
) -> str:
    """
    Applies transparent taxonomic and threshold rules to categorize an acoustic detection candidate.
    """
    cname = class_name.lower().strip()

    # Rule 1: Natural Features
    if cname in ["rock", "sand ripple"]:
        return "NATURAL"

    # Rule 2: Artificial Reef (Protected Structure - Not Marine Debris)
    if cname == "artificial reef":
        return "ARTIFICIAL_STRUCTURE"

    # Rule 3: Artificial Debris Candidates (Shipwreck, Tyre, etc.)
    score = artificiality_score if artificiality_score is not None else 0.50

    if score >= high_thresh:
        return "VALIDATED"
    elif score >= review_thresh:
        return "NEEDS REVIEW"
    else:
        return "LOW ARTIFICIALITY"


def apply_survey_triage(
    survey_id: str,
    high_thresh: float = DEFAULT_HIGH_ARTIFICIALITY_THRESHOLD,
    review_thresh: float = DEFAULT_REVIEW_THRESHOLD
) -> Dict[str, Any]:
    """
    Applies triage rules across all detections in a survey and updates SQLite.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, class_name, artificiality_score, review_status FROM detections WHERE survey_id = ?", (survey_id,))
        rows = cursor.fetchall()
        if not rows:
            raise ValueError(f"No detections found for survey {survey_id}")

        counts = {
            "VALIDATED": 0,
            "NEEDS REVIEW": 0,
            "LOW ARTIFICIALITY": 0,
            "ARTIFICIAL_STRUCTURE": 0,
            "NATURAL": 0,
            "OPERATOR_OVERRIDDEN": 0
        }

        updated_detections = []
        for r in rows:
            det_id = r["id"]
            cname = r["class_name"]
            score = r["artificiality_score"]
            rev_status = r["review_status"]

            # If human operator already explicitly approved/rejected, preserve human verdict
            if rev_status == "OPERATOR_APPROVED":
                status_tag = "VALIDATED"
                counts["OPERATOR_OVERRIDDEN"] += 1
            elif rev_status == "OPERATOR_REJECTED":
                status_tag = "REJECTED"
                counts["OPERATOR_OVERRIDDEN"] += 1
            else:
                status_tag = categorize_detection(cname, score, high_thresh, review_thresh)

            cursor.execute("UPDATE detections SET status = ? WHERE id = ?", (status_tag, det_id))
            if status_tag in counts:
                counts[status_tag] += 1

            updated_detections.append({
                "detection_id": det_id,
                "class_name": cname,
                "artificiality_score": score,
                "status": status_tag,
                "review_status": rev_status
            })

        return {
            "survey_id": survey_id,
            "total_detections": len(rows),
            "thresholds_applied": {
                "high_artificiality": high_thresh,
                "needs_review": review_thresh
            },
            "summary_counts": counts,
            "detections": updated_detections
        }


def record_operator_review(
    detection_id: str,
    action: str,  # APPROVE_DEBRIS, REJECT_FALSE_POSITIVE, FLAGGED_FOR_INSPECTION, RECLASSIFY
    notes: Optional[str] = None,
    new_class: Optional[str] = None
) -> Dict[str, Any]:
    """
    Persists a human sonar analyst's review decision and audit notes into SQLite.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM detections WHERE id = ?", (detection_id,))
        det = cursor.fetchone()
        if not det:
            raise ValueError(f"Detection {detection_id} not found.")

        act = action.upper().strip()
        timestamp = datetime.utcnow().isoformat()
        current_notes = det["operator_notes"] or ""
        note_entry = f"[{timestamp}] {act}: {notes.strip() if notes else 'Operator action recorded.'}"
        updated_notes = f"{current_notes}\n{note_entry}".strip()

        if act in ["APPROVE_DEBRIS", "APPROVE"]:
            new_status = "VALIDATED"
            new_rev_status = "OPERATOR_APPROVED"
        elif act in ["REJECT_FALSE_POSITIVE", "REJECT"]:
            new_status = "REJECTED"
            new_rev_status = "OPERATOR_REJECTED"
        elif act in ["FLAG_FOR_INSPECTION", "FLAG"]:
            new_status = "NEEDS REVIEW"
            new_rev_status = "FLAGGED_FOR_INSPECTION"
        elif act == "RECLASSIFY" and new_class:
            new_status = categorize_detection(new_class, det["artificiality_score"])
            new_rev_status = f"RECLASSIFIED_AS_{new_class.upper().replace(' ', '_')}"
            cursor.execute("UPDATE detections SET class_name = ? WHERE id = ?", (new_class.lower(), detection_id))
        else:
            raise ValueError(f"Invalid review action '{action}'")

        cursor.execute("""
        UPDATE detections 
        SET status = ?, review_status = ?, operator_notes = ?
        WHERE id = ?
        """, (new_status, new_rev_status, updated_notes, detection_id))

        return {
            "detection_id": detection_id,
            "status": new_status,
            "review_status": new_rev_status,
            "operator_notes": updated_notes,
            "timestamp": timestamp
        }


def get_survey_review_summary(survey_id: str) -> Dict[str, Any]:
    """
    Aggregates operator review and operational triage metrics for an active survey.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT status, review_status, class_name FROM detections WHERE survey_id = ?", (survey_id,))
        rows = cursor.fetchall()

        summary = {
            "total_detections": len(rows),
            "validated_candidates": 0,
            "needs_review": 0,
            "low_artificiality": 0,
            "rejected_false_positives": 0,
            "artificial_structures": 0,
            "natural_seabed": 0,
            "operator_approved": 0,
            "operator_rejected": 0,
            "pending_review": 0
        }

        for r in rows:
            st = r["status"]
            rev = r["review_status"]
            cname = r["class_name"]

            if st == "VALIDATED":
                summary["validated_candidates"] += 1
            elif st == "NEEDS REVIEW":
                summary["needs_review"] += 1
            elif st == "LOW ARTIFICIALITY":
                summary["low_artificiality"] += 1
            elif st == "REJECTED":
                summary["rejected_false_positives"] += 1
            elif st == "ARTIFICIAL_STRUCTURE":
                summary["artificial_structures"] += 1
            elif st == "NATURAL":
                summary["natural_seabed"] += 1

            if rev == "OPERATOR_APPROVED":
                summary["operator_approved"] += 1
            elif rev == "OPERATOR_REJECTED":
                summary["operator_rejected"] += 1
            else:
                if st == "NEEDS REVIEW":
                    summary["pending_review"] += 1

        return {
            "survey_id": survey_id,
            "metrics": summary
        }
