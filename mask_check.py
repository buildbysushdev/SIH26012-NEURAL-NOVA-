import os
import numpy as np

try:
    import rasterio
    has_rasterio = True
except ImportError:
    has_rasterio = False
    from PIL import Image

CLASS_NAMES = {0:"background", 1:"building", 2:"woodland", 3:"water", 4:"road"}

tiles = sorted(os.listdir("dataset 1/images"))
print("=== Ground Truth Mask Analysis (first 10 tiles) ===")

# Find tiles that have buildings
tiles_with_buildings = []
for t in tiles[:20]:
    mask_path = "dataset 1/masks/" + t
    if not os.path.exists(mask_path):
        print("MISSING MASK: " + t)
        continue
    if has_rasterio:
        import rasterio
        with rasterio.open(mask_path) as src:
            mask = src.read(1)
    else:
        mask = np.array(Image.open(mask_path))
    
    unique, counts = np.unique(mask, return_counts=True)
    total = mask.size
    class_dist = {CLASS_NAMES.get(int(u), str(u)): round(c/total*100, 1) for u, c in zip(unique, counts)}
    has_building = "building" in class_dist and class_dist["building"] > 0
    has_road     = "road" in class_dist and class_dist["road"] > 0
    marker = " <-- HAS BUILDING!" if has_building else (" <-- HAS ROAD" if has_road else "")
    print(t + ": " + str(class_dist) + marker)
    if has_building:
        tiles_with_buildings.append(t)

print("\nTiles with buildings: " + str(len(tiles_with_buildings)))
if tiles_with_buildings:
    print("First building tile: " + tiles_with_buildings[0])
