"""
API Routes for False-Positive Filtering, Operational Triage, and Human Review System.
"""

from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Query, status, Body

from backend.filtering.triage import (
    apply_survey_triage,
    record_operator_review,
    get_survey_review_summary
)

router = APIRouter(prefix="/api", tags=["False-Positive Filtering & Review"])


class OperatorReviewPayload(BaseModel):
    action: str = Field(..., description="Action: APPROVE_DEBRIS, REJECT_FALSE_POSITIVE, FLAG_FOR_INSPECTION, RECLASSIFY")
    notes: Optional[str] = Field(None, description="Operator rationale or field inspection note")
    new_class: Optional[str] = Field(None, description="New class if reclassifying")


@router.post("/surveys/{survey_id}/triage")
def trigger_survey_triage(
    survey_id: str,
    high_threshold: float = Query(0.80, ge=0.50, le=0.99, description="High Artificiality threshold"),
    review_threshold: float = Query(0.60, ge=0.30, le=0.85, description="Needs Review threshold")
):
    """
    Applies automated false-positive triage rules across all candidates in a survey.
    """
    try:
        result = apply_survey_triage(
            survey_id=survey_id,
            high_thresh=high_threshold,
            review_thresh=review_threshold
        )
        return {
            "status": "success",
            "message": f"Triage complete for {result['total_detections']} detections.",
            "data": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Survey triage failed: {str(e)}"
        )


@router.post("/detections/{detection_id}/operator-review")
def submit_operator_review(
    detection_id: str,
    payload: OperatorReviewPayload = Body(...)
):
    """
    Submits a human sonar operator's decision (Approve Debris, Reject False Positive, Flag for Inspection, Reclassify).
    """
    try:
        result = record_operator_review(
            detection_id=detection_id,
            action=payload.action,
            notes=payload.notes,
            new_class=payload.new_class
        )
        return {
            "status": "success",
            "message": f"Recorded operator decision: {payload.action}",
            "data": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record operator review: {str(e)}"
        )


@router.get("/surveys/{survey_id}/review-summary")
def get_survey_review_summary_endpoint(survey_id: str):
    """
    Returns aggregated triage and operator review metrics for the survey.
    """
    try:
        summary = get_survey_review_summary(survey_id)
        return {
            "status": "success",
            "data": summary
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch review summary: {str(e)}"
        )
