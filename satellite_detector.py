"""
satellite_detector.py -- Real land-cover structure detection for SIH26102
Team Neural Nova

Loads the fine-tuned SegFormer from landcover_segformer/ (next to this script)
and runs per-tile segmentation to detect buildings, roads, and water.

Interface:
  from satellite_detector import predict_structure, is_model_ready

  result = predict_structure(image_array)
  # Returns:
  # {
  #   "building_pct": 12.4,   # % of pixels classified as buildings
  #   "road_pct":      5.1,
  #   "water_pct":     3.2,
  #   "woodland_pct": 60.0,
  #   "background_pct":19.3,
  #   "structure_detected": True,   # True if building+road > THRESHOLD
  #   "dominant_class": "woodland",
  #   "model_source": "finetuned_segformer" | "pretrained_segformer" | "unavailable"
  # }
"""

import os
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional

SCRIPT_DIR     = Path(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR      = SCRIPT_DIR / "landcover_segformer"
PATCH_SIZE     = 256
STRUCT_THRESH  = 5.0   # % of pixels classified as building/road = "detected"

# Class indices matching training
CLASS_NAMES = {0: "background", 1: "building", 2: "woodland", 3: "water", 4: "road"}

_model     = None
_processor = None
_model_loaded = False
_model_source = "unavailable"


def is_model_ready() -> bool:
    """Returns True if the fine-tuned model file exists on disk."""
    return (MODEL_DIR / "config.json").exists()


def _load_model():
    """Lazy-load the SegFormer model on first inference call."""
    global _model, _processor, _model_loaded, _model_source

    if _model_loaded:
        return

    import torch
    from transformers import SegformerForSemanticSegmentation

    if is_model_ready():
        try:
            _model = SegformerForSemanticSegmentation.from_pretrained(str(MODEL_DIR))
            _model.eval()
            _model_source = "finetuned_segformer"
            print(f"[Detector] Loaded fine-tuned SegFormer from {MODEL_DIR}")
            _model_loaded = True
            return
        except Exception as e:
            print(f"[Detector] Fine-tuned model load failed: {e}. Trying pretrained fallback.")

    # Fallback: use vanilla pretrained mit-b0 (ADE20K weights, not LandCover fine-tuned)
    try:
        _model = SegformerForSemanticSegmentation.from_pretrained("nvidia/mit-b0")
        _model.eval()
        _model_source = "pretrained_segformer"
        print("[Detector] Loaded base nvidia/mit-b0 (not fine-tuned) as fallback.")
    except Exception as e:
        print(f"[Detector] Could not load any SegFormer model: {e}")
        _model = None
        _model_source = "unavailable"

    _model_loaded = True


def _prepare_patch(image_array: np.ndarray) -> "torch.Tensor":
    """
    Convert (H, W, 3) uint8 or float RGB array to a normalised
    (1, 3, 256, 256) float32 tensor ready for SegFormer input.
    """
    import torch
    import torch.nn.functional as F

    img = image_array.copy().astype(np.float32)
    if img.max() > 1.0:
        img = img / 255.0

    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img  = (img - mean) / std

    # (H, W, 3) -> (1, 3, H, W)
    tensor = torch.from_numpy(img.transpose(2, 0, 1)).unsqueeze(0)

    # Resize to 256x256 if needed
    if tensor.shape[-2:] != (PATCH_SIZE, PATCH_SIZE):
        tensor = F.interpolate(tensor, size=(PATCH_SIZE, PATCH_SIZE),
                               mode="bilinear", align_corners=False)
    return tensor


def predict_structure(image_array: np.ndarray) -> Dict[str, Any]:
    """
    Run SegFormer segmentation on a satellite image tile.

    Args:
        image_array: np.ndarray of shape (H, W, 3), RGB, uint8 or float [0,1]

    Returns:
        dict with keys:
          building_pct, road_pct, water_pct, woodland_pct, background_pct,
          structure_detected, dominant_class, model_source
    """
    import torch

    _load_model()

    empty_result = {
        "building_pct":    0.0,
        "road_pct":        0.0,
        "water_pct":       0.0,
        "woodland_pct":    0.0,
        "background_pct": 100.0,
        "structure_detected": False,
        "dominant_class":  "background",
        "model_source":    _model_source,
    }

    if _model is None:
        return empty_result

    try:
        with torch.no_grad():
            pixel_values = _prepare_patch(image_array)
            logits = _model(pixel_values=pixel_values).logits  # (1, C, H/4, W/4)

            # Upsample to PATCH_SIZE x PATCH_SIZE
            logits_up = torch.nn.functional.interpolate(
                logits, size=(PATCH_SIZE, PATCH_SIZE),
                mode="bilinear", align_corners=False
            )
            pred = logits_up.argmax(dim=1).squeeze(0).numpy()  # (H, W)

        total_px = pred.size
        counts = {i: int((pred == i).sum()) for i in range(len(CLASS_NAMES))}

        def pct(cls_id):
            return round(counts.get(cls_id, 0) / total_px * 100, 1)

        building_pct  = pct(1)
        woodland_pct  = pct(2)
        water_pct     = pct(3)
        road_pct      = pct(4)
        background_pct = pct(0)

        structure_detected = (building_pct + road_pct) >= STRUCT_THRESH

        dominant_id = max(counts, key=counts.get)
        dominant_class = CLASS_NAMES.get(dominant_id, "background")

        return {
            "building_pct":    building_pct,
            "road_pct":        road_pct,
            "water_pct":       water_pct,
            "woodland_pct":    woodland_pct,
            "background_pct":  background_pct,
            "structure_detected": structure_detected,
            "dominant_class":  dominant_class,
            "model_source":    _model_source,
        }

    except Exception as e:
        print(f"[Detector] Inference error: {e}")
        return {**empty_result, "model_source": _model_source}


def predict_from_tif(tif_path: str) -> Dict[str, Any]:
    """
    Convenience wrapper: load a .tif from disk and run predict_structure.
    Takes a random 256x256 crop from the centre of the image.
    """
    try:
        import rasterio
        with rasterio.open(tif_path) as src:
            arr = src.read()[:3]          # First 3 bands
            arr = np.moveaxis(arr, 0, -1) # (H, W, 3)
    except Exception:
        from PIL import Image
        arr = np.array(Image.open(tif_path))
        if arr.ndim == 2:
            arr = np.stack([arr]*3, axis=-1)
        if arr.ndim == 3 and arr.shape[2] > 3:
            arr = arr[:, :, :3]

    h, w = arr.shape[:2]
    cy, cx = h // 2, w // 2
    ps = PATCH_SIZE // 2
    patch = arr[max(0,cy-ps):cy+ps, max(0,cx-ps):cx+ps]
    if patch.shape[2] == 1:
        patch = np.concatenate([patch]*3, axis=-1)
    return predict_structure(patch)
