"""
False-negative sweep: for every held-out tile, test MULTIPLE patches
(not just the single best one) and flag any case where:
  GT_building >= 10%  AND  model(building + road + water) < 2%
That is the worst-case miss for an audit tool.
"""
import numpy as np
import rasterio
from satellite_detector import predict_structure

PATCH = 256
STEP  = 128   # 50% overlap -> thorough coverage

HOLDOUT_TILES = [
    "M-34-65-D-d-4-1.tif",
    "M-34-6-A-d-2-2.tif",
    "M-34-51-C-d-4-1.tif",
    "M-34-56-A-b-1-4.tif",
    "M-34-51-C-b-2-1.tif",
]

def load_tile(name):
    img_path  = "dataset 1/images/" + name
    mask_path = "dataset 1/masks/"  + name
    with rasterio.open(img_path) as s:
        img  = np.moveaxis(s.read()[:3], 0, -1)
    with rasterio.open(mask_path) as s:
        mask = s.read(1)
    return img, mask

def to_uint8(img):
    mx = img.max()
    if mx > 255:
        return (img / mx * 255).astype(np.uint8)
    return img.astype(np.uint8)

print("=== FALSE-NEGATIVE SWEEP (held-out tiles, 50%% overlap) ===")
print("Looking for: GT_building>=10% AND model(building+road+water)<2%\n")

total_patches_tested = 0
false_negatives = []
all_results = []

for tile_name in HOLDOUT_TILES:
    img, mask = load_tile(tile_name)
    img8 = to_uint8(img)
    h, w = mask.shape
    
    tile_fn = 0
    tile_tested = 0
    
    for y in range(0, h - PATCH, STEP):
        for x in range(0, w - PATCH, STEP):
            m_patch = mask[y:y+PATCH, x:x+PATCH]
            gt_building = (m_patch == 1).sum() / m_patch.size * 100
            
            if gt_building < 10.0:
                continue  # Only test patches that genuinely have buildings
            
            i_patch = img8[y:y+PATCH, x:x+PATCH]
            r = predict_structure(i_patch)
            
            structure_score = r["building_pct"] + r["road_pct"] + r["water_pct"]
            is_fn = structure_score < 2.0  # Model sees nothing
            
            tile_tested += 1
            total_patches_tested += 1
            
            entry = {
                "tile": tile_name, "y": y, "x": x,
                "gt_building": round(gt_building, 1),
                "pred_building": r["building_pct"],
                "pred_road":     r["road_pct"],
                "pred_water":    r["water_pct"],
                "pred_woodland": r["woodland_pct"],
                "structure_score": round(structure_score, 1),
                "false_negative": is_fn,
            }
            all_results.append(entry)
            if is_fn:
                tile_fn += 1
                false_negatives.append(entry)
    
    detected = tile_tested - tile_fn
    print("Tile: " + tile_name)
    print("  Building patches tested: " + str(tile_tested))
    print("  Detected (structure_score>=2%): " + str(detected))
    print("  FALSE NEGATIVES (structure_score<2%): " + str(tile_fn))
    if tile_tested > 0:
        print("  Detection rate: " + str(round(detected/tile_tested*100,1)) + "%")
    print()

print("=== SUMMARY ===")
print("Total building patches tested: " + str(total_patches_tested))
print("Total false negatives: " + str(len(false_negatives)))

if false_negatives:
    print("\nFALSE NEGATIVE DETAILS (worst cases first):")
    false_negatives.sort(key=lambda x: x["gt_building"], reverse=True)
    for fn in false_negatives[:5]:
        print("  " + fn["tile"] + " y=" + str(fn["y"]) + " x=" + str(fn["x"]))
        print("    GT_building=" + str(fn["gt_building"]) +
              "%  model: building=" + str(fn["pred_building"]) +
              "%  road=" + str(fn["pred_road"]) +
              "%  water=" + str(fn["pred_water"]) +
              "%  (structure_score=" + str(fn["structure_score"]) + "%)")
else:
    print("NO FALSE NEGATIVES found on any building patch >=10% GT coverage.")

fn_rate = round(len(false_negatives)/max(total_patches_tested,1)*100, 1)
print("\nOverall false-negative rate: " + str(fn_rate) + "%")
print("=== Done ===")
