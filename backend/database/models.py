"""
Pydantic Models and Data Structures for SONAR-SHIELD.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class SurveyCreate(BaseModel):
    name: str = Field(..., description="Human-readable survey name")
    description: Optional[str] = None
    is_demo: bool = False


class SurveyResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    total_images: int = 0
    status: str = "ready"  # ready, processing, completed
    is_demo: bool = False
    created_at: str
    metadata: Optional[Dict[str, Any]] = None


class ImageMetadata(BaseModel):
    id: str
    survey_id: str
    filename: str
    filepath: str
    width: int
    height: int
    channels: int
    file_size_kb: float
    frame_id: str
    simulated_lat: float
    simulated_lon: float
    is_simulated_coords: bool = True
    is_demo: bool = False
    has_labels: bool = False
    label_path: Optional[str] = None
    created_at: str


class DetectionRecord(BaseModel):
    id: str
    image_id: str
    survey_id: str
    class_id: int
    class_name: str
    confidence: float
    bbox: List[float]  # [x1, y1, x2, y2] in pixels
    shape_score: Optional[float] = None
    shadow_score: Optional[float] = None
    context_score: Optional[float] = None
    artificiality_score: Optional[float] = None
    status: str = "CANDIDATE"  # VALIDATED, NEEDS REVIEW, REJECTED, NATURAL
    review_status: str = "PENDING"  # PENDING, OPERATOR_APPROVED, OPERATOR_REJECTED
    operator_notes: Optional[str] = None
    simulated_lat: float
    simulated_lon: float
    created_at: str


class HotspotRecord(BaseModel):
    id: str
    survey_id: str
    center_lat: float
    center_lon: float
    detection_count: int
    dominant_class: str
    estimated_area_m2: float
    avg_artificiality: float
    bio_threat_score: float
    bio_threat_level: str  # LOW, MEDIUM, HIGH, CRITICAL
    cleanup_priority_score: float
    cleanup_priority_level: str  # LOW, MEDIUM, HIGH, CRITICAL
    created_at: str


class SystemHealthResponse(BaseModel):
    status: str
    version: str
    model_loaded: bool
    model_path: str
    detected_classes: List[str]
    total_surveys: int
    total_images: int
    database: str
