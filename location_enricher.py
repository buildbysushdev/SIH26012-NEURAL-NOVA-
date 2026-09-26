"""
Location Enrichment Module — MPLADS Risk Intelligence System
SIH26102, Team Neural Nova

Extracts finer location information from project descriptions and geocodes them
to improve GPS verification accuracy beyond constituency-level centroids.

PRECISION TIERS (used by verification_pipeline.check_location):
  'precise'     - per-project GPS in dataset (future)         tolerance: 200-500 m
  'locality'    - village/panchayat geocoded from description  tolerance: 2 km / 10 km
  'district'    - constituency centroid (CONSTITUENCY_COORDS)  tolerance: 25 km / 100 km
  'unavailable' - no coords at all                            -> UNVERIFIED

SIGNAL WEIGHTS in verify_citizen_report when location_precision='district':
  GPS (Signal A) weight drops 0.30 -> 0.20; freed 0.10 -> text quality + duplicate signals

GEOCODING:
  - District tier: seeded from CONSTITUENCY_COORDS dict (instant, offline).
    Nominatim called ONLY for constituencies NOT in the dict.
  - Locality tier: Nominatim once per unique (locality, constituency, state) triple.
  - The live server NEVER calls Nominatim. All lookups are dict/CSV reads.

CLI:
  python location_enricher.py --build-district-cache
  python location_enricher.py --build-locality-cache
  python location_enricher.py --enrich-sample
"""

import os
import re
import time
import logging
from typing import Optional, Tuple, Dict

import pandas as pd

logger = logging.getLogger(__name__)

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DISTRICT_CACHE_CSV = os.path.join(_SCRIPT_DIR, "geocode_district_cache.csv")
LOCALITY_CACHE_CSV = os.path.join(_SCRIPT_DIR, "geocode_locality_cache.csv")
DATA_CSV           = os.path.join(_SCRIPT_DIR, "MPLADS_real_raw_data_77312_works.csv")

# ---------------------------------------------------------------------------
# Locality extraction — pure regex, zero network calls
# ---------------------------------------------------------------------------

_STOP_TOKENS = {
    "construction", "work", "road", "near", "and", "the", "of", "at", "in",
    "for", "to", "from", "with", "by", "is", "are", "this", "that", "a",
    "an", "on", "ward", "no", "phase", "phage", "under", "block", "tq",
    "taluk", "district", "new", "old", "main", "cross", "lane", "street",
    "shri", "sri", "sh", "late", "above", "below", "continued", "continue",
    "pcc", "rcc", "cc", "km", "meter", "metre", "community", "bhavan",
    # Neighbourhood / community designations (not place names)
    "mohalla", "sc", "st", "obc", "bc", "colony", "sector", "area",
    # Articles, prepositions and conjunctions that are never place names
    "every", "some", "each", "all", "both", "and", "or", "but",
    "in", "at", "of", "from", "by", "to", "up", "ke",
}

_LOCALITY_PATTERNS = [
    # P1: "at <NAME> village/gram panchayat/panchayat/tq/taluk/pada/faliya"
    # Non-greedy: captures 1-3 words before the anchor keyword
    re.compile(
        r'\bat\s+((?:[A-Za-z]+\s){0,2}[A-Za-z]+)\s+'
        r'(?:village|gram\s+panchayat|panchayat|tq|taluk|pada|faliya|nagar\s+panchayat)\b',
        re.IGNORECASE,
    ),
    # P2: "<NAME> gram panchayat" — name PRECEDES keyword, max 2 words, word-boundary anchored
    # (checked before P3 so 'Belavatagi gram panchayat ...' captures 'Belavatagi', not what follows)
    re.compile(
        r'\b([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+gram\s+panchayat\b',
        re.IGNORECASE,
    ),
    # P3: "gram panchayat <NAME>" — name FOLLOWS keyword (single word only — proper names are one token)
    re.compile(
        r'\bgram\s+panchayat\s+([A-Za-z]+)\b',
        re.IGNORECASE,
    ),
    # P4: "<NAME> panchayat" standalone (not followed by office/bhavan/building/hall)
    re.compile(
        r'\b([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+panchayat\b(?!\s+(?:office|bhavan|building|hall))',
        re.IGNORECASE,
    ),
    # P5: "near <NAME> mandir/temple/school/hospital/math/masjid/dargah"
    re.compile(
        r'\bnear\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,2})\s+'
        r'(?:mandir|temple|school|hospital|math|masjid|dargah|ashram)\b',
        re.IGNORECASE,
    ),
    # P6: "<NAME> village" (not preceded by "gram", not followed by road/panchayat)
    re.compile(
        r'(?<!gram\s)\b([A-Za-z]+)\s+village\b(?!\s+(?:road|panchayat))',
        re.IGNORECASE,
    ),
    # P7: "village of <NAME>"
    re.compile(r'\bvillage\s+of\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,2})\b', re.IGNORECASE),
    # P8: "ward no. X" — returns "ward:<N>" tag
    re.compile(r'\bward\s+(?:no\.?\s*)?(\d+)\b', re.IGNORECASE),
    # P9: "at <NAME> colony/nagar/mohalla/pada/faliya"
    re.compile(
        r'\bat\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,2})\s+(?:colony|nagar|mohalla|pada|faliya)\b',
        re.IGNORECASE,
    ),
]


def extract_locality(description: str) -> Optional[str]:
    """
    Extract a village/panchayat/landmark name from a project work_description.

    Returns the extracted locality string (1-4 words), or None if no match found.
    Ward numbers are returned as 'ward:<N>' strings (distinct from village names).

    What this does:
      Tries each regex pattern in priority order. The first match wins.
      Rejects tokens that are pure stop-words, numbers, or too short (<3 chars).
    """
    if not description or not isinstance(description, str):
        return None

    for pat in _LOCALITY_PATTERNS:
        m = pat.search(description)
        if not m:
            continue
        token = m.group(1).strip()

        # Ward number: return tagged string
        if token.isdigit():
            return f"ward:{token}"

        token_lower = token.lower().strip()
        words = token_lower.split()

        if not words or len(token_lower) < 3:
            continue
        if all(w in _STOP_TOKENS for w in words):
            continue
        # Reject purely numeric / punctuation tokens
        if re.fullmatch(r'[\d\s/\\.\-]+', token):
            continue

        # Reject tokens whose FIRST word is a preposition/article/conjunction
        # (catches "in Turio", "every village", "and X")
        _LEADING_PREPOSITIONS = {
            "in", "at", "of", "from", "by", "to", "up", "ke",
            "every", "some", "each", "all", "both", "and", "or", "the",
        }
        if words[0] in _LEADING_PREPOSITIONS or words[0] in _STOP_TOKENS:
            continue

        # Reject tokens whose LAST word is a stop/generic word
        # (catches "village and", "block of", "colony near")
        if words[-1] in _STOP_TOKENS:
            continue

        return token.strip()

    return None


# ---------------------------------------------------------------------------
# Nominatim helper
# ---------------------------------------------------------------------------

def _get_nominatim():
    """Lazy-load Nominatim geocoder. Returns None if geopy unavailable."""
    try:
        from geopy.geocoders import Nominatim
        return Nominatim(user_agent="mplads_risk_sih26102_neural_nova")
    except ImportError:
        logger.warning("geopy not installed — Nominatim geocoding unavailable.")
        return None


def _nominatim_geocode(geocoder, query: str, retries: int = 3) -> Optional[Tuple[float, float]]:
    """
    Geocode one query string via Nominatim with retry/backoff.
    Rate-limited to >=1.1s between requests (Nominatim ToS: max 1 req/sec).
    Returns (lat, lng) or None on failure.
    """
    for attempt in range(retries):
        try:
            time.sleep(1.1)
            loc = geocoder.geocode(query, timeout=8, language="en")
            if loc:
                return round(loc.latitude, 6), round(loc.longitude, 6)
            return None
        except Exception as e:
            wait = 2 ** attempt
            logger.warning(f"Nominatim error (attempt {attempt+1}) for {query!r}: {e}. Waiting {wait}s.")
            time.sleep(wait)
    logger.error(f"Nominatim failed after {retries} retries: {query!r}")
    return None


# ---------------------------------------------------------------------------
# Cache loaders — fast dict reads, no network
# ---------------------------------------------------------------------------

def _load_district_cache() -> Dict[Tuple[str, str], Tuple[Optional[float], Optional[float], str]]:
    """
    Load geocode_district_cache.csv into memory.
    Returns: {(constituency_lower, state_lower): (lat, lng, status)}
    status values: 'dict' | 'nominatim' | 'failed'
    """
    cache: Dict = {}
    if not os.path.exists(DISTRICT_CACHE_CSV):
        return cache
    try:
        df = pd.read_csv(DISTRICT_CACHE_CSV, dtype=str)
        for _, row in df.iterrows():
            key = (str(row.get("constituency", "")).strip().lower(),
                   str(row.get("state", "")).strip().lower())
            raw_lat = row.get("lat", "")
            raw_lng = row.get("lng", "")
            try:
                lat = float(raw_lat) if raw_lat not in ("", "nan", "None", None) else None
                lng = float(raw_lng) if raw_lng not in ("", "nan", "None", None) else None
            except (ValueError, TypeError):
                lat, lng = None, None
            cache[key] = (lat, lng, str(row.get("status", "unknown")).strip())
    except Exception as e:
        logger.error(f"Failed to load district cache: {e}")
    return cache


def _load_locality_cache() -> Dict[Tuple[str, str, str], Tuple[Optional[float], Optional[float], str]]:
    """
    Load geocode_locality_cache.csv into memory.
    Returns: {(locality_lower, constituency_lower, state_lower): (lat, lng, status)}
    """
    cache: Dict = {}
    if not os.path.exists(LOCALITY_CACHE_CSV):
        return cache
    try:
        df = pd.read_csv(LOCALITY_CACHE_CSV, dtype=str)
        for _, row in df.iterrows():
            key = (
                str(row.get("locality", "")).strip().lower(),
                str(row.get("constituency", "")).strip().lower(),
                str(row.get("state", "")).strip().lower(),
            )
            raw_lat = row.get("lat", "")
            raw_lng = row.get("lng", "")
            try:
                lat = float(raw_lat) if raw_lat not in ("", "nan", "None", None) else None
                lng = float(raw_lng) if raw_lng not in ("", "nan", "None", None) else None
            except (ValueError, TypeError):
                lat, lng = None, None
            cache[key] = (lat, lng, str(row.get("status", "unknown")).strip())
    except Exception as e:
        logger.error(f"Failed to load locality cache: {e}")
    return cache


# ---------------------------------------------------------------------------
# Cache builders — run via CLI before demo, NEVER at server startup
# ---------------------------------------------------------------------------

def build_district_cache():
    """
    One-time CLI task: build geocode_district_cache.csv.

    Strategy (Q1=A):
      1. Seed from CONSTITUENCY_COORDS dict — instant, marks status='dict'
      2. For constituencies NOT in dict, try Nominatim — marks status='nominatim'/'failed'
      3. Already-cached entries are skipped on re-runs

    Run: python location_enricher.py --build-district-cache
    """
    from verification_pipeline import CONSTITUENCY_COORDS, _normalize_constituency

    existing = _load_district_cache()
    df = pd.read_csv(DATA_CSV, dtype=str)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    pairs = df[["constituency", "state"]].dropna().drop_duplicates().itertuples(index=False)
    norm_dict = {_normalize_constituency(k): v for k, v in CONSTITUENCY_COORDS.items()}

    rows_to_add = []
    geocoder = None
    skipped = from_dict = from_nom = failed = 0

    for constituency, state in pairs:
        key = (constituency.strip().lower(), state.strip().lower())
        if key in existing:
            skipped += 1
            continue

        norm = _normalize_constituency(constituency)

        # Tier 1: CONSTITUENCY_COORDS dict
        if norm in norm_dict:
            lat, lng = norm_dict[norm]
            rows_to_add.append(dict(constituency=constituency.strip(), state=state.strip(),
                                    lat=lat, lng=lng, status="dict"))
            from_dict += 1
            continue

        # Tier 2: Nominatim for dict misses
        if geocoder is None:
            geocoder = _get_nominatim()
        if geocoder is None:
            rows_to_add.append(dict(constituency=constituency.strip(), state=state.strip(),
                                    lat="", lng="", status="failed"))
            failed += 1
            continue

        query = f"{constituency.strip()} constituency, {state.strip()}, India"
        coords = _nominatim_geocode(geocoder, query)
        if not coords:
            query2 = f"{constituency.strip()}, {state.strip()}, India"
            coords = _nominatim_geocode(geocoder, query2)

        if coords:
            rows_to_add.append(dict(constituency=constituency.strip(), state=state.strip(),
                                    lat=coords[0], lng=coords[1], status="nominatim"))
            from_nom += 1
        else:
            rows_to_add.append(dict(constituency=constituency.strip(), state=state.strip(),
                                    lat="", lng="", status="failed"))
            failed += 1

    if rows_to_add:
        new_df = pd.DataFrame(rows_to_add)
        write_header = not os.path.exists(DISTRICT_CACHE_CSV)
        new_df.to_csv(DISTRICT_CACHE_CSV, mode="a", header=write_header, index=False)

    print(f"\nDistrict cache build complete:")
    print(f"  Skipped (cached): {skipped}")
    print(f"  From dict:        {from_dict}")
    print(f"  From Nominatim:   {from_nom}")
    print(f"  Failed:           {failed}")
    print(f"  File: {DISTRICT_CACHE_CSV}")


def build_locality_cache():
    """
    One-time CLI task: build geocode_locality_cache.csv.

    Extracts unique (locality, constituency, state) triples, skips cached ones,
    geocodes new ones via Nominatim at 1 req/sec.

    Run: python location_enricher.py --build-locality-cache
    Estimated time: 1-2 hours for ~3-8K unique triples.
    """
    df = pd.read_csv(DATA_CSV, dtype=str)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    print("Extracting locality names from work descriptions...")
    df["locality_name"] = df["work_description"].apply(extract_locality)

    triples_df = (
        df[df["locality_name"].notna() & ~df["locality_name"].str.startswith("ward:").fillna(False)]
        [["locality_name", "constituency", "state"]]
        .dropna()
        .drop_duplicates()
    )

    print(f"Unique triples to geocode: {len(triples_df)}")

    existing = _load_locality_cache()
    geocoder = _get_nominatim()
    if geocoder is None:
        print("geopy unavailable — cannot build locality cache.")
        return

    rows_to_add = []
    skipped = succeeded = failed = 0

    for _, row in triples_df.iterrows():
        locality     = str(row["locality_name"]).strip()
        constituency = str(row["constituency"]).strip()
        state        = str(row["state"]).strip()
        key = (locality.lower(), constituency.lower(), state.lower())

        if key in existing:
            skipped += 1
            continue

        coords = _nominatim_geocode(geocoder, f"{locality}, {constituency}, {state}, India")
        if not coords:
            coords = _nominatim_geocode(geocoder, f"{locality}, {state}, India")

        if coords:
            rows_to_add.append(dict(locality=locality, constituency=constituency, state=state,
                                    lat=coords[0], lng=coords[1], status="nominatim"))
            succeeded += 1
        else:
            rows_to_add.append(dict(locality=locality, constituency=constituency, state=state,
                                    lat="", lng="", status="failed"))
            failed += 1

        done = skipped + succeeded + failed
        if done % 100 == 0:
            print(f"  {done}/{len(triples_df)}: {succeeded} OK, {failed} failed, {skipped} skipped")

    if rows_to_add:
        new_df = pd.DataFrame(rows_to_add)
        write_header = not os.path.exists(LOCALITY_CACHE_CSV)
        new_df.to_csv(LOCALITY_CACHE_CSV, mode="a", header=write_header, index=False)

    print(f"\nLocality cache complete: {succeeded} OK, {failed} failed, {skipped} skipped")
    print(f"File: {LOCALITY_CACHE_CSV}")


# ---------------------------------------------------------------------------
# Module-level cache (loaded once at import, never live-queried)
# ---------------------------------------------------------------------------

_district_cache: Optional[Dict] = None
_locality_cache: Optional[Dict] = None


def _ensure_caches_loaded():
    global _district_cache, _locality_cache
    if _district_cache is None:
        _district_cache = _load_district_cache()
        logger.info(f"District geocode cache: {len(_district_cache)} entries")
    if _locality_cache is None:
        _locality_cache = _load_locality_cache()
        logger.info(f"Locality geocode cache: {len(_locality_cache)} entries")


def resolve_project_location(
    constituency: str,
    state: str,
    work_description: str = "",
) -> Tuple[Optional[float], Optional[float], Optional[str], str]:
    """
    Resolve the best available coordinates for one project.

    Returns: (lat, lng, locality_name, location_precision)
      location_precision: 'precise' | 'locality' | 'district' | 'unavailable'

    Resolution order:
      1. Locality geocode cache (locality found in description AND cached)  -> 'locality'
      2. District geocode cache (constituency+state in CSV)                 -> 'district'
      3. CONSTITUENCY_COORDS dict fallback (exact or substring match)       -> 'district'
      4. None                                                               -> 'unavailable'
    """
    _ensure_caches_loaded()

    from verification_pipeline import CONSTITUENCY_COORDS, _normalize_constituency

    locality_name = extract_locality(str(work_description or ""))
    c_lower = str(constituency or "").strip().lower()
    s_lower = str(state or "").strip().lower()

    # --- Tier: locality geocode cache ---
    if locality_name and not locality_name.startswith("ward:"):
        loc_key = (locality_name.lower(), c_lower, s_lower)
        if loc_key in _locality_cache:
            lat, lng, status = _locality_cache[loc_key]
            # Only accept coordinates produced by a real geocoder. Older
            # `locality_curated` rows were deterministic offsets from a district
            # centroid and are deliberately treated as unverified.
            if lat is not None and lng is not None and status in {"nominatim", "verified", "gps"}:
                return lat, lng, locality_name, "locality"

    # --- Tier: district geocode cache ---
    d_key = (c_lower, s_lower)
    if d_key in _district_cache:
        lat, lng, status = _district_cache[d_key]
        if lat is not None and lng is not None and status != "failed":
            return lat, lng, locality_name, "district"

    # --- Tier: CONSTITUENCY_COORDS dict ---
    norm_dict = {_normalize_constituency(k): v for k, v in CONSTITUENCY_COORDS.items()}
    norm = _normalize_constituency(constituency or "")

    if norm in norm_dict:
        lat, lng = norm_dict[norm]
        return lat, lng, locality_name, "district"

    for k_norm, coords in norm_dict.items():
        if k_norm and norm and (k_norm in norm or norm in k_norm):
            return coords[0], coords[1], locality_name, "district"

    return None, None, locality_name, "unavailable"


def enrich_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add location enrichment columns to the MPLADS dataframe in-place.

    Columns added:
      locality_name       - extracted village/panchayat/landmark text (or None)
      resolved_lat        - best available latitude (float or NaN)
      resolved_lng        - best available longitude (float or NaN)
      location_precision  - 'precise' | 'locality' | 'district' | 'unavailable'

    What this does:
      Calls resolve_project_location() for every row using pandas apply().
      Uses only in-memory dict/CSV caches — NO network calls.
      Runs once at server startup from main.py lifespan.
    """
    _ensure_caches_loaded()
    print("Enriching project locations (locality extraction + geocode cache lookup)...")

    for col in ["constituency", "state", "work_description"]:
        if col not in df.columns:
            df[col] = ""

    def _enrich_row(row):
        # Preserve per-project GPS if already present and not the India centroid
        lat_val = row.get("project_lat") or row.get("latitude")
        lng_val = row.get("project_lng") or row.get("longitude")
        if lat_val is not None and lng_val is not None:
            try:
                flat, flng = float(lat_val), float(lng_val)
                if not (abs(flat - 20.5937) < 0.001 and abs(flng - 78.9629) < 0.001):
                    return pd.Series(dict(locality_name=None, resolved_lat=flat,
                                         resolved_lng=flng, location_precision="precise"))
            except (ValueError, TypeError):
                pass

        lat, lng, locality, precision = resolve_project_location(
            constituency=str(row.get("constituency") or ""),
            state=str(row.get("state") or ""),
            work_description=str(row.get("work_description") or ""),
        )
        return pd.Series(dict(locality_name=locality, resolved_lat=lat,
                               resolved_lng=lng, location_precision=precision))

    enriched = df.apply(_enrich_row, axis=1)
    df["locality_name"]      = enriched["locality_name"]
    df["resolved_lat"]       = pd.to_numeric(enriched["resolved_lat"], errors="coerce")
    df["resolved_lng"]       = pd.to_numeric(enriched["resolved_lng"], errors="coerce")
    df["location_precision"] = enriched["location_precision"]

    dist  = df["location_precision"].value_counts()
    total = len(df)
    print("Location precision distribution:")
    for prec, count in dist.items():
        print(f"  {prec:15s}: {count:6d}  ({100*count/total:.1f}%)")

    return df


# ---------------------------------------------------------------------------
# CLI entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    if "--build-district-cache" in sys.argv:
        print("Building district geocode cache...")
        build_district_cache()

    elif "--build-locality-cache" in sys.argv:
        print("Building locality geocode cache (Nominatim, may take 1-2 hours)...")
        build_locality_cache()

    elif "--enrich-sample" in sys.argv:
        df = pd.read_csv(DATA_CSV, dtype=str, nrows=500)
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        df = enrich_dataframe(df)
        cols = ["work_id", "constituency", "state", "locality_name",
                "resolved_lat", "resolved_lng", "location_precision"]
        pd.set_option("display.max_colwidth", 35)
        pd.set_option("display.width", 220)
        print("\nSample enriched rows:")
        print(df[cols].head(30).to_string(index=False))

    else:
        print(__doc__)
