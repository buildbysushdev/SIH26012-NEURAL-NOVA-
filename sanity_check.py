from satellite_detector import predict_from_tif
import os

tiles = sorted(os.listdir("dataset 1/images"))[:5]
print("=== 5-Tile SegFormer Sanity Check ===")
for t in tiles:
    path = "dataset 1/images/" + t
    r = predict_from_tif(path)
    print("")
    print("Tile: " + t)
    print("  building_pct:      " + str(r["building_pct"]) + "%")
    print("  road_pct:          " + str(r["road_pct"]) + "%")
    print("  water_pct:         " + str(r["water_pct"]) + "%")
    print("  woodland_pct:      " + str(r["woodland_pct"]) + "%")
    print("  background_pct:    " + str(r["background_pct"]) + "%")
    print("  structure_detected:" + str(r["structure_detected"]))
    print("  dominant_class:    " + str(r["dominant_class"]))
    print("  model_source:      " + str(r["model_source"]))
print("")
print("=== Done ===")
