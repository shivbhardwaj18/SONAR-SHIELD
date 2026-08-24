"""
API Routes for Acoustic Image Preprocessing and Statistical Telemetry.
"""

import os
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse

from backend.database.db import get_db
from backend.preprocessing.processor import get_preprocessed_file, compute_acoustic_stats

router = APIRouter(prefix="/api", tags=["Acoustic Preprocessing"])


@router.get("/images/{image_id}/preprocessed")
def serve_preprocessed_image(
    image_id: str,
    mode: str = Query("raw", enum=["raw", "clahe", "denoised", "enhanced", "normalized"], description="Preprocessing filter mode")
):
    """
    Serves the preprocessed image file (raw, CLAHE enhanced, denoised, or combined enhanced).
    Uses disk caching to deliver fast streaming.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT filepath, filename FROM images WHERE id = ?", (image_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Image not found")

        filepath = row["filepath"]
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Original image file missing from disk")

        try:
            output_file = get_preprocessed_file(image_id, filepath, mode=mode)
            return FileResponse(output_file, media_type="image/png")
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Preprocessing failed: {str(e)}"
            )


@router.get("/images/{image_id}/acoustic-stats")
def get_image_acoustic_stats(image_id: str):
    """
    Calculates acoustic contrast ratio, dynamic range, and shadow/highlight distribution.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT filepath, frame_id, filename FROM images WHERE id = ?", (image_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Image not found")

        filepath = row["filepath"]
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Image file missing from disk")

        try:
            stats = compute_acoustic_stats(filepath)
            return {
                "image_id": image_id,
                "frame_id": row["frame_id"],
                "filename": row["filename"],
                "acoustic_stats": stats
            }
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to calculate stats: {str(e)}"
            )
