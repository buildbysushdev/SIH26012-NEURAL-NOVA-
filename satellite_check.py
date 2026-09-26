"""Satellite reference-imagery support for MPLADS Risk Intelligence System.

Uses verified project coordinates, Earth Engine acquisition metadata when available,
and honestly labelled Esri World Imagery reference tiles. It never claims automated
structure detection when a validated detector was not run.
"""
import os
import io
import re
import math
from typing import Dict, Any, Tuple, Optional
import pandas as pd
import numpy as np

# Try importing Google Earth Engine
try:
    import ee
    _HAS_EE = True
except ImportError:
    _HAS_EE = False

# Try importing geopy
try:
    from geopy.geocoders import Nominatim
    _geolocator = Nominatim(user_agent="mplads_risk_intelligence_sih26102")
except Exception:
    _geolocator = None

_EE_INITIALIZED = False

def init_earth_engine() -> bool:
    """
    Initializes Google Earth Engine if credentials or project are present.
    Returns True if initialized, False otherwise.
    """
    global _EE_INITIALIZED
    if not _HAS_EE:
        return False
    if _EE_INITIALIZED:
        return True

    project_id = os.environ.get("EARTHENGINE_PROJECT") or "mplads-satellite-int-sih"
    try:
        if project_id:
            ee.Initialize(project=project_id)
        else:
            ee.Initialize()
        _EE_INITIALIZED = True
        print("Google Earth Engine initialized successfully.")
        return True
    except Exception as e:
        print(f"Earth Engine not initialized ({e}). Satellite verification running in fallback mode.")
        return False


# In-memory district centroid cache (seeded with major Indian districts for fast lookup)
_DISTRICT_CACHE: Dict[str, Tuple[float, float]] = {
    "vaishali": (25.9898, 85.3262),
    "muzaffarpur": (26.1209, 85.3647),
    "dharwad": (15.4589, 75.0078),
    "belagavi": (15.8497, 74.4977),
    "patna": (25.5941, 85.1376),
    "kolkata": (22.5726, 88.3639),
    "gaya": (24.7914, 85.0002),
    "ranchi": (23.3441, 85.3096),
    "giridih": (24.1869, 86.3052),
    "bhopal": (23.2599, 77.4126),
    "indore": (22.7196, 75.8577),
    "lucknow": (26.8467, 80.9462),
    "kanpur": (26.4499, 80.3319),
    "jaipur": (26.9124, 75.7873),
    "hyderabad": (17.3850, 78.4867),
    "bengaluru": (12.9716, 77.5946),
    "ahmedabad": (23.0225, 72.5714),
    "pune": (18.5204, 73.8567),
    "chennai": (13.0827, 80.2707),
    "mumbai": (19.0760, 72.8777),
    "amritsar": (31.6340, 74.8723),
    "ludhiana": (30.9010, 75.8573),
    "chandigarh": (30.7333, 76.7794),
}

_STATE_CENTROIDS: Dict[str, Tuple[float, float]] = {
    "andhra pradesh": (15.9129, 79.7400),
    "arunachal pradesh": (28.2180, 94.7278),
    "assam": (26.2006, 92.9376),
    "bihar": (25.0961, 85.3131),
    "chhattisgarh": (21.2787, 81.8661),
    "goa": (15.2993, 74.1240),
    "gujarat": (22.2587, 71.1924),
    "haryana": (29.0588, 76.0856),
    "himachal pradesh": (31.1048, 77.1734),
    "jharkhand": (23.6102, 85.2799),
    "karnataka": (15.3173, 75.7139),
    "kerala": (10.8505, 76.2711),
    "madhya pradesh": (22.9734, 78.6569),
    "maharashtra": (19.7515, 75.7139),
    "manipur": (24.6637, 93.9063),
    "meghalaya": (25.4670, 91.3662),
    "mizoram": (23.1645, 92.9376),
    "nagaland": (26.1584, 94.5624),
    "odisha": (20.9517, 85.0985),
    "punjab": (31.1471, 75.3412),
    "rajasthan": (27.0238, 74.2179),
    "sikkim": (27.5330, 88.5122),
    "tamil nadu": (11.1271, 78.6569),
    "telangana": (18.1124, 79.0193),
    "tripura": (23.9408, 91.9882),
    "uttar pradesh": (26.8467, 80.9462),
    "uttarakhand": (30.0668, 79.0193),
    "west bengal": (22.9868, 87.8550),
    "delhi": (28.7041, 77.1025),
    "jammu and kashmir": (33.7782, 76.5762),
    "ladakh": (34.1526, 77.5771),
}


def geocode_district(district_name: str, state_name: str, allow_network: bool = False) -> Optional[Tuple[float, float]]:
    """
    Geocodes district + state into (latitude, longitude) centroid.
    Fast local cache lookup with state-centroid fallback (runs in microseconds).
    """
    clean_state = str(state_name).strip().lower() if state_name else ""
    clean_dist = ""
    if district_name and not pd.isna(district_name):
        clean_dist = re.sub(r"\(.*?\)", "", str(district_name)).strip().lower()
        clean_dist = clean_dist.replace("_ida", "").replace("ida", "").strip()

    cache_key = f"{clean_dist}_{clean_state}"
    if clean_dist and clean_dist in _DISTRICT_CACHE:
        return _DISTRICT_CACHE[clean_dist]
    if cache_key in _DISTRICT_CACHE:
        return _DISTRICT_CACHE[cache_key]

    # Instant state centroid fallback
    if clean_state in _STATE_CENTROIDS:
        return _STATE_CENTROIDS[clean_state]

    # Optional network lookup only if explicitly requested
    if allow_network and _geolocator and clean_dist:
        try:
            query = f"{clean_dist}, {state_name}, India"
            loc = _geolocator.geocode(query, timeout=2)
            if loc:
                coords = (loc.latitude, loc.longitude)
                _DISTRICT_CACHE[clean_dist] = coords
                return coords
        except Exception:
            pass

    return (22.0, 77.0)  # Default central India centroid if unknown


def select_sentinel2_pass(
    lat: float,
    lng: float,
    cloud_threshold: float = 20.0,
    primary_window_days: int = 90,
    expanded_window_days: int = 180,
    ref_date_str: str = "2024-03-15",
) -> Tuple[Optional[str], Optional[float], bool]:
    """
    Sentinel-2 pass date selection with 90-day primary window, <20% cloud threshold,
    and 180-day single window expansion fallback.
    Returns: (pass_date_str, cloud_cover_pct, was_expanded)
    """
    import datetime
    import hashlib
    ref_dt = datetime.datetime.strptime(ref_date_str, "%Y-%m-%d")

    # 1. If Earth Engine is initialized, run real server-side query
    if _EE_INITIALIZED and _HAS_EE:
        try:
            point = ee.Geometry.Point([lng, lat])
            col = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED").filterBounds(point)

            # Window 1: 90 days
            start_90 = (ref_dt - datetime.timedelta(days=primary_window_days)).strftime("%Y-%m-%d")
            filtered_90 = col.filterDate(start_90, ref_date_str).filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", cloud_threshold)).sort("system:time_start", False)
            first_90 = filtered_90.first()
            info_90 = first_90.getInfo() if first_90 else None
            if info_90 and "properties" in info_90:
                t_ms = info_90["properties"].get("system:time_start", 0)
                dt = datetime.datetime.fromtimestamp(t_ms / 1000.0, tz=datetime.timezone.utc)
                cloud = float(info_90["properties"].get("CLOUDY_PIXEL_PERCENTAGE", 0.0))
                return dt.strftime("%Y-%m-%d"), cloud, False

            # Window 2: Expanded 180 days
            start_180 = (ref_dt - datetime.timedelta(days=expanded_window_days)).strftime("%Y-%m-%d")
            filtered_180 = col.filterDate(start_180, ref_date_str).filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", cloud_threshold)).sort("system:time_start", False)
            first_180 = filtered_180.first()
            info_180 = first_180.getInfo() if first_180 else None
            if info_180 and "properties" in info_180:
                t_ms = info_180["properties"].get("system:time_start", 0)
                dt = datetime.datetime.fromtimestamp(t_ms / 1000.0, tz=datetime.timezone.utc)
                cloud = float(info_180["properties"].get("CLOUDY_PIXEL_PERCENTAGE", 0.0))
                return dt.strftime("%Y-%m-%d"), cloud, True

            return None, None, False
        except Exception as e:
            print(f"Earth Engine query error: {e}")

    # Never fabricate an acquisition date or cloud percentage. Without a live
    # Earth Engine response the optical verification is simply unavailable.
    return None, None, False


def check_satellite_status(project: Dict[str, Any], allow_network: bool = False) -> Dict[str, Any]:
    """
    Checks physical presence for a project using Sentinel-2 imagery.
    Enforces the 3 strict user-mandated statuses:
      1. "Verified" — cloud-free image in window found (<20% cloud in 90d/180d) and structure detection ran.
      2. "Imagery unavailable" — no sufficiently cloud-free pass found in window.
      3. "Location precision insufficient" — location_precision is district/unavailable.
    """
    prec = str(project.get("location_precision") or project.get("coord_precision") or "district").lower().strip()

    # Rule: Never run optical verification against imprecise district centroids
    if prec not in ["precise", "locality"]:
        return {
            "satellite_status": "location_precision_insufficient",
            "status_label": "Location precision insufficient",
            "satellite_risk_score": None,
            "coordinates": None,
            "satellite_pass_date": None,
            "details": "Location precision is district-level or unavailable. Satellite optical verification requires resolved locality or precise GPS coordinates (tolerance <=2km)."
        }

    # Resolved coordinates
    lat = project.get("resolved_lat") or project.get("latitude")
    lng = project.get("resolved_lng") or project.get("longitude")
    if lat is None or lng is None:
        return {
            "satellite_status": "location_precision_insufficient",
            "status_label": "Location precision insufficient",
            "satellite_risk_score": None,
            "coordinates": None,
            "satellite_pass_date": None,
            "details": "Missing coordinates for target project."
        }

    try:
        lat = float(lat)
        lng = float(lng)
    except (ValueError, TypeError):
        return {
            "satellite_status": "location_precision_insufficient",
            "status_label": "Location precision insufficient",
            "satellite_risk_score": None,
            "coordinates": None,
            "satellite_pass_date": None,
            "details": "Invalid numerical coordinates."
        }

    # Date selection logic: 90 days < 20% cloud cover, widen to 180 days if needed
    pass_date, cloud_pct, was_expanded = select_sentinel2_pass(lat, lng, cloud_threshold=20.0, primary_window_days=90, expanded_window_days=180)

    if not pass_date:
        return {
            "satellite_status": "imagery_unavailable",
            "status_label": "Imagery unavailable",
            "satellite_risk_score": None,
            "coordinates": (lat, lng),
            "satellite_pass_date": None,
            "details": "No cloud-free Sentinel-2 optical pass (<20% cloud cover) found in the 90-day or expanded 180-day lookback window."
        }

    # A confirmed acquisition date is useful provenance, but this service does
    # not currently fetch the matching Sentinel-2 pixels or run a validated
    # detector against them. Return an explicit manual-review state rather than
    # inferring visual evidence from financial or NLP signals.
    return {
        "satellite_status": "manual_review_required",
        "status_label": "Reference imagery available — manual review required",
        "satellite_risk_score": None,
        "coordinates": (lat, lng),
        "satellite_pass_date": pass_date,
        "cloud_cover_pct": cloud_pct,
        "window_expanded": was_expanded,
        "details": "Sentinel-2 acquisition metadata confirmed. Automated structure detection was not run."
    }


def add_satellite_signals(df: pd.DataFrame, max_rows: int = 5000) -> pd.DataFrame:
    """
    Attaches satellite verification columns to the dataframe:
    - satellite_status: 'visible' | 'not_visible' | 'no_imagery'
    - satellite_risk_score: float (100.0, 0.0, or NaN)
    Adds only verified metadata-derived statuses; no financial/NLP heuristic is used as image evidence.
    """
    df = df.copy()
    init_earth_engine()

    print("[satellite_check] Satellite scores remain neutral unless verified acquisition metadata is available.")

    records = df.head(max_rows).to_dict(orient="records")
    statuses = ["no_imagery"] * len(df)
    scores = [np.nan] * len(df)

    for i, row in enumerate(records):
        res = check_satellite_status(row, allow_network=False)
        statuses[i] = res["satellite_status"]
        if res["satellite_risk_score"] is not None:
            scores[i] = res["satellite_risk_score"]

    df["satellite_status"] = statuses
    df["satellite_risk_score"] = scores
    return df


def _deg2num(lat_deg: float, lon_deg: float, zoom: int) -> Tuple[int, int]:
    """Converts latitude and longitude to standard Web Mercator tile numbers."""
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return (xtile, ytile)


def _get_real_satellite_patch(lat: float, lon: float, width: int = 500, height: int = 140) -> Any:
    """
    Fetches real spaceborne satellite photography:
    1. Online: Free public ESRI World Imagery global satellite tiles (sub-meter resolution).
    2. Caches tiles locally to ./satellite_tiles_cache/ for instant re-use and offline capability.
    3. Fallback: If offline or network error, crops genuine aerial GeoTIFF from ./dataset 1/images/.
    """
    from PIL import Image
    import urllib.request

    cache_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "satellite_tiles_cache")
    os.makedirs(cache_dir, exist_ok=True)
    zoom = 16
    x, y = _deg2num(lat, lon, zoom)

    def _fetch_or_load(tx: int, ty: int) -> Optional[Image.Image]:
        cp = os.path.join(cache_dir, f"{zoom}_{tx}_{ty}.jpg")
        if os.path.exists(cp) and os.path.getsize(cp) > 500:
            try:
                return Image.open(cp).convert("RGB")
            except Exception:
                pass
        url = f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{zoom}/{ty}/{tx}"
        req = urllib.request.Request(url, headers={"User-Agent": "MPLADS-Intelligence/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=3.5) as resp:
                data = resp.read()
                if len(data) > 500:
                    with open(cp, "wb") as f:
                        f.write(data)
                    return Image.open(io.BytesIO(data)).convert("RGB")
        except Exception:
            pass
        return None

    # Try live satellite tile fetch
    try:
        t1 = _fetch_or_load(x, y)
        t2 = _fetch_or_load(x + 1, y)
        if t1 and t2:
            merged = Image.new("RGB", (512, 256))
            merged.paste(t1, (0, 0))
            merged.paste(t2, (256, 0))
            crop_y = max(0, (256 - height) // 2)
            return merged.crop((6, crop_y, 6 + width, crop_y + height))
        elif t1:
            return t1.resize((width, height), Image.Resampling.LANCZOS)
    except Exception:
        pass

    # Do not substitute imagery from another location when the tile service is unavailable.
    return None


def generate_satellite_thumbnail(
    district: str,
    state: str,
    status: str = "no_imagery",
    coordinates: Optional[Tuple[float, float]] = None,
    width: int = 500,
    height: int = 140,
    pass_date: Optional[str] = None,
    precision: str = "district"
) -> io.BytesIO:
    """
    Generates an honestly labelled reference-imagery tile
    with coordinate reticles, scale reference, and status badge for the PDF dossier.
    """
    from PIL import Image, ImageDraw

    if not coordinates:
        coordinates = geocode_district(district, state, allow_network=False) or (25.0, 85.0)

    lat, lon = coordinates
    clean_stat = (status or "no_imagery").lower()
    prec_clean = str(precision).lower()

    # Format date prominently: e.g. "Imagery captured: 14 Mar 2024"
    formatted_date = ""
    if pass_date:
        try:
            import datetime
            dt = datetime.datetime.strptime(pass_date[:10], "%Y-%m-%d")
            formatted_date = f"Imagery captured: {dt.strftime('%d %b %Y')}"
        except Exception:
            formatted_date = f"Imagery captured: {pass_date}"

    # ── CASE 1: Location Precision Insufficient (Skip optical verification) ──
    if clean_stat == "location_precision_insufficient" or prec_clean in ["district", "unavailable"]:
        img = Image.new("RGB", (width, height), color=(15, 23, 42))  # Slate dark
        draw = ImageDraw.Draw(img)
        # Top banner
        draw.rectangle([(0, 0), (width, 24)], fill=(30, 41, 59))
        draw.text((12, 6), "SATELLITE VERIFICATION AUDIT NOTICE", fill=(203, 213, 225))
        # Center message
        draw.text((width // 2 - 130, height // 2 - 18), "LOCATION PRECISION INSUFFICIENT", fill=(251, 191, 36))
        draw.text((width // 2 - 190, height // 2 + 2), "Optical satellite verification skipped for district centroid / personal constituency.", fill=(148, 163, 184))
        draw.text((width // 2 - 140, height // 2 + 18), "Requires resolved locality GPS coordinates (tolerance <=2km).", fill=(100, 116, 139))
        # Bottom info bar
        draw.rectangle([(0, height - 22), (width, height)], fill=(30, 41, 59))
        draw.text((12, height - 17), f"Jurisdiction: {str(district).title()}, {str(state).title()} | Status: Precision Insufficient", fill=(148, 163, 184))
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        buf.seek(0)
        return buf

    # ── CASE 2: Imagery Unavailable (Excessive cloud cover in 90d and 180d) ──
    if clean_stat in ["imagery_unavailable", "no_imagery", "pending"]:
        img = Image.new("RGB", (width, height), color=(24, 24, 27))  # Charcoal
        draw = ImageDraw.Draw(img)
        # Top banner
        draw.rectangle([(0, 0), (width, 24)], fill=(39, 39, 42))
        draw.text((12, 6), "SATELLITE METADATA | OPTICAL COVERAGE LOG", fill=(212, 212, 216))
        # Center message
        draw.text((width // 2 - 100, height // 2 - 18), "IMAGERY UNAVAILABLE", fill=(245, 158, 11))
        draw.text((width // 2 - 200, height // 2 + 2), "No cloud-free pass (<20% cloud cover) found in 90-day or expanded 180-day window.", fill=(161, 161, 170))
        draw.text((width // 2 - 130, height // 2 + 18), "On-site DISHA physical verification required.", fill=(113, 113, 122))
        # Bottom info bar
        draw.rectangle([(0, height - 22), (width, height)], fill=(39, 39, 42))
        draw.text((12, height - 17), f"Locality: {lat:.4f}°N, {lon:.4f}°E ({str(district).title()}, {str(state).title()}) | Status: Imagery Unavailable", fill=(161, 161, 170))
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        buf.seek(0)
        return buf

    # ── CASE 3: Esri World Imagery reference tile (manual interpretation only) ──
    img = _get_real_satellite_patch(lat, lon, width=width, height=height)
    if img is None:
        img = Image.new("RGB", (width, height), color=(24, 24, 27))
        draw = ImageDraw.Draw(img)
        draw.rectangle([(0, 0), (width, 24)], fill=(39, 39, 42))
        draw.text((12, 6), "ESRI WORLD IMAGERY | SERVICE STATUS", fill=(212, 212, 216))
        draw.text((width // 2 - 125, height // 2 - 12), "REFERENCE IMAGERY UNAVAILABLE", fill=(245, 158, 11))
        draw.text((width // 2 - 155, height // 2 + 8), "Tile service unavailable; no substitute image shown.", fill=(161, 161, 170))
        draw.rectangle([(0, height - 22), (width, height)], fill=(39, 39, 42))
        draw.text((12, height - 17), f"Requested coordinates: {lat:.4f}°N, {lon:.4f}°E | Manual review required", fill=(161, 161, 170))
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        buf.seek(0)
        return buf
    draw = ImageDraw.Draw(img)

    # Reference-location reticle. No automated detection claim is made.
    reticle_color = (251, 191, 36)
    status_text = "REFERENCE IMAGERY — MANUAL REVIEW"
    badge_bg = (120, 53, 15)

    # Target Reticle at Center
    cx = width // 2
    cy = (height // 2) + 2
    draw.ellipse([(cx - 24, cy - 24), (cx + 24, cy + 24)], outline=reticle_color, width=2)
    draw.ellipse([(cx - 10, cy - 10), (cx + 10, cy + 10)], outline=reticle_color, width=1)
    draw.line([(cx - 36, cy), (cx - 14, cy)], fill=reticle_color, width=2)
    draw.line([(cx + 14, cy), (cx + 36, cy)], fill=reticle_color, width=2)
    draw.line([(cx, cy - 36), (cx, cy - 14)], fill=reticle_color, width=2)
    draw.line([(cx, cy + 14), (cx, cy + 36)], fill=reticle_color, width=2)


    # Top Header Bar — PROMINENT CAPTURE DATE DISPLAY
    draw.rectangle([(0, 0), (width, 22)], fill=(15, 23, 42))
    date_label = f" | {formatted_date}" if formatted_date else ""
    header_str = f"ESRI WORLD IMAGERY — REFERENCE ONLY{date_label}"
    draw.text((10, 5), header_str, fill=(241, 245, 249))

    # Scale Bar (top right)
    draw.line([(width - 75, 11), (width - 15, 11)], fill=(255, 255, 255), width=2)
    draw.line([(width - 75, 7), (width - 75, 15)], fill=(255, 255, 255), width=2)
    draw.line([(width - 15, 7), (width - 15, 15)], fill=(255, 255, 255), width=2)
    draw.text((width - 62, 1), "250m", fill=(255, 255, 255))

    # Bottom Coordinate Bar
    draw.rectangle([(0, height - 22), (width, height)], fill=(15, 23, 42))
    prefix = "Precise (100m)" if prec_clean == "precise" else "Locality (2km)"
    coord_str = f"{prefix}: {lat:.4f}°N, {lon:.4f}°E | {str(district).title()}"
    draw.text((10, height - 17), coord_str, fill=(203, 213, 225))

    # Status Pill (bottom right)
    pill_w = 215
    draw.rectangle([(width - pill_w - 6, height - 20), (width - 6, height - 3)], fill=badge_bg)
    draw.text((width - pill_w, height - 16), status_text, fill=(255, 255, 255))

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    buf.seek(0)
    return buf
