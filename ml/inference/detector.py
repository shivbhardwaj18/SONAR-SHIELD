"""
YOLO Inference Detector Wrapper for SONAR-SHIELD.
Loads trained weights (best.pt) and extracts detections, bounding boxes, and object crops.
"""

import os
from typing import List, Dict, Any, Optional, Tuple
import cv2
import numpy as np
from PIL import Image

try:
    from ultralytics import YOLO
except ImportError:
    YOLO = None

DEFAULT_WEIGHTS_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "weights", "best.pt")
)

CLASS_MAP = {
    0: "shipwreck",
    1: "tyre",
    2: "artificial reef",
    3: "rock",
    4: "sand ripple"
}

# Categorize artificial debris candidates vs natural anomalies
ARTIFICIAL_CLASSES = {"shipwreck", "tyre", "artificial reef"}
NATURAL_CLASSES = {"rock", "sand ripple"}


class SonarDetector:
    _instance = None

    def __init__(self, weights_path: str = DEFAULT_WEIGHTS_PATH):
        self.weights_path = weights_path
        self.model = None
        self._load_model()

    def _load_model(self):
        if not os.path.exists(self.weights_path):
            raise FileNotFoundError(f"YOLO model weights not found at {self.weights_path}")
        if YOLO is None:
            raise ImportError("Ultralytics package is not installed.")
        
        print(f"Loading YOLO model from {self.weights_path}...")
        self.model = YOLO(self.weights_path)
        print(f"YOLO model loaded successfully. Classes: {self.model.names}")

    @classmethod
    def get_instance(cls, weights_path: str = DEFAULT_WEIGHTS_PATH):
        if cls._instance is None:
            cls._instance = cls(weights_path)
        return cls._instance

    def predict(
        self,
        image_path: str,
        conf_threshold: float = 0.20,
        iou_threshold: float = 0.45
    ) -> List[Dict[str, Any]]:
        """
        Runs YOLO inference on a sonar image file.
        Returns a list of structured detection dictionaries.
        """
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found at {image_path}")

        # Read image to obtain dimensions
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Failed to decode image from {image_path}")
        
        img_h, img_w = img.shape[:2]

        results = self.model(
            image_path,
            conf=conf_threshold,
            iou=iou_threshold,
            verbose=False
        )

        detections = []
        for result in results:
            boxes = result.boxes
            if boxes is None or len(boxes) == 0:
                continue

            for box in boxes:
                # Class & Confidence
                cls_id = int(box.cls[0].item())
                cls_name = self.model.names.get(cls_id, CLASS_MAP.get(cls_id, f"class_{cls_id}"))
                confidence = round(float(box.conf[0].item()), 4)

                # Pixel coordinates [x1, y1, x2, y2]
                xyxy = box.xyxy[0].tolist()
                x1 = max(0, int(xyxy[0]))
                y1 = max(0, int(xyxy[1]))
                x2 = min(img_w, int(xyxy[2]))
                y2 = min(img_h, int(xyxy[3]))

                # Ensure valid box dimensions
                box_w = max(1, x2 - x1)
                box_h = max(1, y2 - y1)

                # Normalized coordinates [x_center, y_center, width, height]
                x_center = round((x1 + x2) / 2.0 / img_w, 6)
                y_center = round((y1 + y2) / 2.0 / img_h, 6)
                norm_w = round(box_w / img_w, 6)
                norm_h = round(box_h / img_h, 6)

                # Class classification type
                is_artificial = cls_name in ARTIFICIAL_CLASSES
                is_reef = cls_name == "artificial reef"
                initial_status = "CANDIDATE" if is_artificial else "NATURAL"
                if is_reef:
                    initial_status = "ARTIFICIAL_STRUCTURE"

                detections.append({
                    "class_id": cls_id,
                    "class_name": cls_name,
                    "confidence": confidence,
                    "bbox_pixels": [x1, y1, x2, y2],
                    "bbox_normalized": [x_center, y_center, norm_w, norm_h],
                    "box_width": box_w,
                    "box_height": box_h,
                    "is_artificial": is_artificial,
                    "initial_status": initial_status,
                    "image_dimensions": {"width": img_w, "height": img_h}
                })

        return detections

    def extract_crop(
        self,
        image_path: str,
        bbox_pixels: List[int],
        padding_pct: float = 0.10
    ) -> Optional[np.ndarray]:
        """
        Extracts a cropped sub-image around the detected bounding box with optional context padding.
        """
        img = cv2.imread(image_path)
        if img is None:
            return None
        
        img_h, img_w = img.shape[:2]
        x1, y1, x2, y2 = bbox_pixels

        # Add context padding
        pad_x = int((x2 - x1) * padding_pct)
        pad_y = int((y2 - y1) * padding_pct)

        crop_x1 = max(0, x1 - pad_x)
        crop_y1 = max(0, y1 - pad_y)
        crop_x2 = min(img_w, x2 + pad_x)
        crop_y2 = min(img_h, y2 + pad_y)

        crop = img[crop_y1:crop_y2, crop_x1:crop_x2]
        return crop
