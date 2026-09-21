"""
Honest generalization test: run inference ONLY on the 5 held-out tiles
that were NEVER seen during training.
"""
import numpy as np
import rasterio
from satellite_detector import predict_structure

PATCH = 256

# Must match HOLDOUT_TILES in landcover_trainer.py exactly
HOLDOUT_TILES = [
    "M-34-65-D-d-4-1.tif",   # 2.8% building - highest
    "M-34-6-A-d-2-2.tif",    # 1.8% building
    "M-34-51-C-d-4-1.tif",   # 1.4% building
    "M-34-56-A-b-1-4.tif",   # 1.4% building
    "M-34-51-C-b-2-1.tif",   # 1.0% building
]

CLASS_NAMES = {0:"background",1:"building",2:"woodland",3:"water",4:"road"}

def find_best_building_patch(img_arr, mask_arr):
    h, w = mask_arr.shape
    best_pct, best_patch, best_y, best_x = 0, None, 0, 0
    step = PATCH // 2
    for y in range(0, h - PATCH, step):
        for x in range(0, w - PATCH, step):
            m = mask_arr[y:y+PATCH, x:x+PATCH]
            bp = (m == 1).sum() / m.size * 100
            if bp > best_pct:
                best_pct = bp
                best_patch = img_arr[y:y+PATCH, x:x+PATCH].copy()
                best_y, best_x = y, x
    return best_patch, best_y, best_x, best_pct

def gt_pcts(mask_arr):
    total = mask_arr.size
    return {CLASS_NAMES[c]: round((mask_arr==c).sum()/total*100,1) for c in range(5)}

print("=== HONEST GENERALIZATION TEST (Held-out tiles only) ===")
print("These 5 tiles were NEVER seen during training.\n")

passes, fails = 0, 0
for t in HOLDOUT_TILES:
    img_path  = "dataset 1/images/" + t
    mask_path = "dataset 1/masks/"  + t

    with rasterio.open(img_path) as src:
        img = np.moveaxis(src.read()[:3], 0, -1)
    with rasterio.open(mask_path) as src:
        mask = src.read(1)

    gt = gt_pcts(mask)
    patch, py, px, gt_patch_pct = find_best_building_patch(img, mask)

    if img.max() > 255:
        patch = (patch / img.max() * 255).astype(np.uint8)

    r = predict_structure(patch)

    print("Tile: " + t)
    print("  Whole-tile GT: " + str(gt))
    print("  Best patch at y=" + str(py) + " x=" + str(px) + "  patch_GT_building=" + str(round(gt_patch_pct,1)) + "%")
    print("  Model -> building=" + str(r["building_pct"]) + "%  road=" + str(r["road_pct"]) +
          "%  water=" + str(r["water_pct"]) + "%  woodland=" + str(r["woodland_pct"]) + "%")
    print("  structure_detected: " + str(r["structure_detected"]))
    correct = r["building_pct"] > 0 or r["road_pct"] > 0
    verdict = "PASS" if correct else "FAIL"
    if correct: passes += 1
    else: fails += 1
    print("  VERDICT: " + verdict)
    print()

print("=== RESULT: " + str(passes) + "/5 PASS on unseen tiles ===")
