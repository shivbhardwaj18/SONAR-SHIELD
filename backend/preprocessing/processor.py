"""
Acoustic Preprocessing Service for SONAR-SHIELD.
Implements CLAHE contrast enhancement, edge-preserving bilateral denoising,
dynamic range normalization, and acoustic image statistics calculation.
"""

import os
import cv2
import numpy as np
from typing import Dict, Any, Tuple, Optional

CACHE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "uploads", "preprocessed")
)


def ensure_cache_dir():
    os.makedirs(CACHE_DIR, exist_ok=True)


def apply_clahe(
    img_bgr: np.ndarray,
    clip_limit: float = 2.5,
    tile_grid_size: Tuple[int, int] = (8, 8)
) -> np.ndarray:
    """
    Applies Contrast Limited Adaptive Histogram Equalization (CLAHE).
    Enhances faint acoustic shadows and subtle seabed textures in dark/low-contrast sonar imagery.
    """
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
    if len(img_bgr.shape) == 2:  # Grayscale
        return clahe.apply(img_bgr)
    
    # If BGR/Color, convert to LAB color space and equalize the L (luminance) channel
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    l_enhanced = clahe.apply(l_channel)
    lab_enhanced = cv2.merge((l_enhanced, a_channel, b_channel))
    return cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)


def apply_denoise(
    img_bgr: np.ndarray,
    diameter: int = 9,
    sigma_color: float = 75.0,
    sigma_space: float = 75.0
) -> np.ndarray:
    """
    Applies an edge-preserving bilateral filter.
    Smooths high-frequency acoustic speckle noise while preserving sharp boundaries of debris objects.
    """
    return cv2.bilateralFilter(img_bgr, d=diameter, sigmaColor=sigma_color, sigmaSpace=sigma_space)


def normalize_intensity(img_bgr: np.ndarray) -> np.ndarray:
    """
    Normalizes pixel intensities across the full 0-255 dynamic range using min-max stretching.
    """
    if len(img_bgr.shape) == 2:
        norm = cv2.normalize(img_bgr, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)
        return norm
    
    # Normalize per channel or on luminance
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    l_norm = cv2.normalize(l, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)
    lab_norm = cv2.merge((l_norm, a, b))
    return cv2.cvtColor(lab_norm, cv2.COLOR_LAB2BGR)


def compute_acoustic_stats(image_path: str) -> Dict[str, Any]:
    """
    Computes key acoustic histogram and statistical metrics from a sonar image.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found at {image_path}")

    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError(f"Failed to read image at {image_path}")

    mean_val = float(np.mean(img))
    std_val = float(np.std(img))
    min_val = int(np.min(img))
    max_val = int(np.max(img))
    dynamic_range = max_val - min_val

    # Contrast ratio (standard deviation / mean)
    contrast_ratio = round((std_val / (mean_val + 1e-5)), 4)
    
    # Shadow pixel percentage (pixels with intensity < 35 out of 255)
    shadow_pixels = np.sum(img < 35)
    shadow_ratio = round(float(shadow_pixels) / float(img.size), 4)

    # Highlight pixel percentage (pixels with intensity > 200 out of 255)
    highlight_pixels = np.sum(img > 200)
    highlight_ratio = round(float(highlight_pixels) / float(img.size), 4)

    return {
        "mean_intensity": round(mean_val, 2),
        "std_intensity": round(std_val, 2),
        "min_intensity": min_val,
        "max_intensity": max_val,
        "dynamic_range": dynamic_range,
        "contrast_ratio": contrast_ratio,
        "shadow_pixel_pct": round(shadow_ratio * 100, 2),
        "highlight_pixel_pct": round(highlight_ratio * 100, 2),
        "image_size_pixels": int(img.size)
    }


def get_preprocessed_file(image_id: str, original_path: str, mode: str = "raw") -> str:
    """
    Returns path to preprocessed image. If not already cached, computes and saves it.
    Supported modes: 'raw', 'clahe', 'denoised', 'enhanced' (clahe + denoise).
    """
    mode = mode.lower().strip()
    if mode == "raw":
        return original_path

    ensure_cache_dir()
    cache_filename = f"{image_id}_{mode}.png"
    cached_path = os.path.join(CACHE_DIR, cache_filename)

    if os.path.exists(cached_path):
        return cached_path

    img = cv2.imread(original_path)
    if img is None:
        return original_path

    if mode == "clahe":
        processed = apply_clahe(img, clip_limit=2.8)
    elif mode == "denoised":
        processed = apply_denoise(img, diameter=7)
    elif mode == "enhanced":
        denoised = apply_denoise(img, diameter=5)
        processed = apply_clahe(denoised, clip_limit=2.5)
    elif mode == "normalized":
        processed = normalize_intensity(img)
    else:
        processed = img

    cv2.imwrite(cached_path, processed)
    return cached_path
