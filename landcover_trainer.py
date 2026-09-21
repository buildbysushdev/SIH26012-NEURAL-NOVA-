"""
LandCover.ai Fine-Tuning Script (GPU + in-memory cache) -- MPLADS SIH26102
Team Neural Nova

Key optimization: ALL 246 patches are loaded from disk ONCE at startup into
RAM (~47 MB). Each epoch then runs entirely from memory — GPU stays busy,
no per-epoch disk I/O. Epoch time: ~20-30 sec on RTX 3050.
"""

import os, sys, time, random
import numpy as np
from pathlib import Path

SCRIPT_DIR     = Path(os.path.dirname(os.path.abspath(__file__)))
DATASET_DIR    = SCRIPT_DIR / "dataset 1"
IMAGES_DIR     = DATASET_DIR / "images"
MASKS_DIR      = DATASET_DIR / "masks"
MODEL_SAVE_DIR = SCRIPT_DIR / "landcover_segformer"

NUM_CLASSES       = 5
PATCH_SIZE        = 256
PATCHES_PER_IMAGE = 12
EPOCHS            = 25
LR                = 5e-5
BATCH_SIZE        = 16

# Held-out tiles — NEVER trained on, used only for honest sanity check.
# Chosen as the 5 tiles with highest building coverage in their masks.
HOLDOUT_TILES = {
    "M-34-65-D-d-4-1.tif",   # 2.8% building
    "M-34-6-A-d-2-2.tif",    # 1.8% building
    "M-34-51-C-d-4-1.tif",   # 1.4% building
    "M-34-56-A-b-1-4.tif",   # 1.4% building
    "M-34-51-C-b-2-1.tif",   # 1.0% building
}

print("[Trainer] Loading libraries...")
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, TensorDataset
from transformers import SegformerForSemanticSegmentation, SegformerConfig
from PIL import Image

try:
    import rasterio
    _HAS_RASTERIO = True
except ImportError:
    _HAS_RASTERIO = False

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[Trainer] Device: {DEVICE}" + (f" ({torch.cuda.get_device_name(0)})" if DEVICE.type == "cuda" else ""))


def read_tif(path):
    if _HAS_RASTERIO:
        with rasterio.open(path) as src:
            arr = src.read()
            arr = np.moveaxis(arr, 0, -1)
    else:
        arr = np.array(Image.open(path))
    return arr


def crop_patch(arr, seed_offset, patch_size):
    h, w = arr.shape[:2]
    ps = patch_size
    if h <= ps or w <= ps:
        if arr.ndim == 3:
            pad = np.zeros((ps, ps, arr.shape[2]), dtype=arr.dtype)
            pad[:min(h,ps), :min(w,ps)] = arr[:min(h,ps), :min(w,ps)]
        else:
            pad = np.zeros((ps, ps), dtype=arr.dtype)
            pad[:min(h,ps), :min(w,ps)] = arr[:min(h,ps), :min(w,ps)]
        return pad
    random.seed(seed_offset)
    y = random.randint(0, h - ps - 1)
    x = random.randint(0, w - ps - 1)
    return arr[y:y+ps, x:x+ps]


def load_all_patches_to_memory(image_dir, mask_dir, patch_size, patches_per_image, seed=42):
    """
    Load training patches from disk once into RAM.
    Skips HOLDOUT_TILES — those are reserved for the honest test-set check.
    Result: two tensors held in RAM, GPU never starves for data.
    """
    all_image_paths = sorted(Path(image_dir).glob("*.tif"))
    image_paths = [p for p in all_image_paths if p.name not in HOLDOUT_TILES]
    held_out    = [p for p in all_image_paths if p.name in HOLDOUT_TILES]
    mask_dir = Path(mask_dir)

    all_imgs  = []
    all_masks = []
    n_loaded  = 0

    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std  = np.array([0.229, 0.224, 0.225], dtype=np.float32)

    print(f"[Dataset] Train tiles: {len(image_paths)}  |  Held-out (unseen): {len(held_out)}")
    print(f"[Dataset] Held-out tiles: {[p.name for p in held_out]}")
    print(f"[Dataset] Loading {len(image_paths)} training tiles into RAM (one-time)...")
    t0 = time.time()

    for img_path in image_paths:
        mask_path = mask_dir / img_path.name
        if not mask_path.exists():
            continue

        img_arr  = read_tif(img_path)
        mask_arr = read_tif(mask_path)

        # Ensure 3-band RGB
        if img_arr.ndim == 3 and img_arr.shape[2] > 3:
            img_arr = img_arr[:, :, :3]
        elif img_arr.ndim == 2:
            img_arr = np.stack([img_arr]*3, axis=-1)

        if mask_arr.ndim == 3:
            mask_arr = mask_arr[:, :, 0]

        for i in range(patches_per_image):
            seed_val = n_loaded * 1000 + i
            img_patch  = crop_patch(img_arr,  seed_val, patch_size)
            mask_patch = crop_patch(mask_arr, seed_val, patch_size)

            # Normalise image
            img_f = img_patch.astype(np.float32)
            img_f = img_f / 65535.0 if img_f.max() > 255 else img_f / 255.0
            img_f = (img_f - mean) / std

            mask_patch = np.clip(mask_patch.astype(np.int64), 0, NUM_CLASSES - 1)

            all_imgs.append(img_f.transpose(2, 0, 1))   # (3, H, W)
            all_masks.append(mask_patch)
        n_loaded += 1

    elapsed = time.time() - t0
    print(f"[Dataset] Loaded {len(all_imgs)} patches in {elapsed:.1f}s — now in RAM, disk I/O done.")

    imgs_t  = torch.from_numpy(np.stack(all_imgs,  axis=0)).float()   # (N,3,H,W)
    masks_t = torch.from_numpy(np.stack(all_masks, axis=0)).long()    # (N,H,W)

    # Shuffle
    idx = torch.randperm(len(imgs_t))
    return imgs_t[idx], masks_t[idx]


def train():
    print(f"\n{'='*55}")
    print(f"  LandCover.ai SegFormer GPU+Cache -- SIH26102  [{DEVICE}]")
    print(f"{'='*55}")

    imgs_t, masks_t = load_all_patches_to_memory(
        IMAGES_DIR, MASKS_DIR, PATCH_SIZE, PATCHES_PER_IMAGE)

    dataset = TensorDataset(imgs_t, masks_t)
    loader  = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True,
                         num_workers=0, pin_memory=(DEVICE.type=="cuda"))

    id2label = {0:"background",1:"building",2:"woodland",3:"water",4:"road"}
    label2id = {v:k for k,v in id2label.items()}

    # --- Class-weighted loss (critical for rare classes like buildings/roads) ---
    # Buildings cover ~1% of pixels, background ~60%. Without weighting the model
    # collapses to predicting only dominant classes and ignores buildings entirely.
    # Weight = inverse pixel frequency, capped at 20x to avoid instability.
    flat_masks = masks_t.view(-1).numpy()
    class_weights = np.zeros(NUM_CLASSES, dtype=np.float32)
    total_pixels  = len(flat_masks)
    for c in range(NUM_CLASSES):
        freq = (flat_masks == c).sum() / total_pixels
        class_weights[c] = 1.0 / (freq + 1e-6)   # inverse freq
    class_weights = class_weights / class_weights.min()   # normalise to min=1
    class_weights = np.clip(class_weights, 1.0, 20.0)     # cap at 20x
    class_weights_t = torch.tensor(class_weights, dtype=torch.float32).to(DEVICE)
    print("[Trainer] Class weights computed from pixel frequencies:")
    for c, name in id2label.items():
        freq_pct = round((flat_masks == c).sum() / total_pixels * 100, 2)
        print(f"  class {c} ({name:12s}): {freq_pct:5.2f}% pixels  -> weight {class_weights[c]:.2f}")

    try:
        model = SegformerForSemanticSegmentation.from_pretrained(
            "nvidia/mit-b0", num_labels=NUM_CLASSES,
            id2label=id2label, label2id=label2id, ignore_mismatched_sizes=True)
        print("[Trainer] Loaded pretrained nvidia/mit-b0 (ADE20K) OK")
    except Exception as e:
        print(f"[Trainer] Pretrained load failed ({e}), using random init.")
        config = SegformerConfig(num_labels=NUM_CLASSES, id2label=id2label, label2id=label2id)
        model  = SegformerForSemanticSegmentation(config)

    model = model.to(DEVICE)
    optimizer = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=EPOCHS * len(loader))
    criterion = nn.CrossEntropyLoss(weight=class_weights_t, ignore_index=255)

    best_loss  = float("inf")
    train_start = time.time()

    for epoch in range(1, EPOCHS + 1):
        model.train()
        t0 = time.time()
        total_loss, batches = 0.0, 0

        for imgs, masks in loader:
            imgs  = imgs.to(DEVICE)
            masks = masks.to(DEVICE)
            optimizer.zero_grad()
            logits = model(pixel_values=imgs).logits
            logits_up = nn.functional.interpolate(
                logits, size=masks.shape[-2:], mode="bilinear", align_corners=False)
            loss = criterion(logits_up, masks)
            loss.backward()
            optimizer.step()
            scheduler.step()
            total_loss += loss.item()
            batches += 1

        avg_loss = total_loss / max(batches, 1)
        marker   = " <- best" if avg_loss < best_loss else ""
        if avg_loss < best_loss:
            best_loss = avg_loss
        print(f"  Epoch {epoch:02d}/{EPOCHS}  loss={avg_loss:.4f}  t={time.time()-t0:.1f}s  total={time.time()-train_start:.0f}s{marker}", flush=True)

    MODEL_SAVE_DIR.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(str(MODEL_SAVE_DIR))
    print(f"\n[Trainer] Model saved -> {MODEL_SAVE_DIR}")
    print("[Trainer] TRAINING COMPLETE OK")

if __name__ == "__main__":
    train()
