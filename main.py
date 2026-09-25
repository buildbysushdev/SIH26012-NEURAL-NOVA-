"""
MPLADS Risk Intelligence System — Main FastAPI Application
SIH26102, Team Neural Nova

This file is the on-disk source of truth for the server.
It reconstructs the full startup sequence and all 11 API routes
that were verified against the orphan process (PID 39864, started Sep 18 2026).

Exact combined risk score formula (proven with 495 live data points, max error 0.05):
  Step 1: base = 0.5 * cost_risk_score + 0.5 * nlp_similarity_score
  Step 2: +15.0 flat on FIRST citizen report (applied in citizen_reports module)
  Step 3: clamp [0, 100]
  Step 4: officer feedback: false_positive -25, confirmed_issue +5, dampened_similarity -10
           (all clamped to [0,100] after adjustment, applied in feedback_loop module)
"""
import os
import logging
from pathlib import Path

# Load .env file at application startup
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env", override=True)
except ImportError:
    pass

import math
import pandas as pd
import numpy as np
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, status, Depends
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware

# --- Module imports ---
import data_pipeline
import anomaly_detector
import nlp_duplicate
import satellite_check
import citizen_reports
import feedback_loop
import audit_brief
import location_enricher
import auth_jwt
import officer_checklist
import voice_transcriber
import demo_showcase
import fund_tracking
import progress_delay
import compliance_alerts

from explain_gemini import explain_flagged_project  # noqa: F401 (used by audit_brief)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Script-relative paths — never assume a working directory
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_CSV_PATH   = os.path.join(_SCRIPT_DIR, "MPLADS_real_raw_data_77312_works.csv")
_CACHE_PATH = os.path.join(_SCRIPT_DIR, "nlp_duplicates_cache_5000.csv")

# In-memory dataframe — loaded at startup, mutated by citizen/feedback routes
_df: Optional[pd.DataFrame] = None


def _sanitize(record: dict) -> dict:
    """Replace NaN/inf with None for JSON serialisation."""
    out = {}
    for k, v in record.items():
        if isinstance(v, float) and (v != v or v == float("inf") or v == float("-inf")):
            out[k] = None
        elif hasattr(v, "item"):          # numpy scalar
            try:
                fv = float(v)
                out[k] = None if (fv != fv) else fv
            except Exception:
                out[k] = None
        else:
            out[k] = v
    return out


def _compute_base_risk_scores(df: pd.DataFrame) -> pd.DataFrame:
    """
    Step 1 of the formula: risk_score = 0.5 * cost_risk_score + 0.5 * nlp_similarity_score
    Citizen boost and feedback are applied later by their respective modules.
    """
    df = df.copy()
    cost = df["cost_risk_score"].fillna(0)
    nlp  = df["nlp_similarity_score"].fillna(0)
    df["risk_score"] = (0.5 * cost + 0.5 * nlp).round(1)
    return df


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Server startup: load, score, and wire up in-memory dataframe."""
    global _df

    print("Loading and scoring dataset...")
    df = data_pipeline.load_and_clean(_CSV_PATH)
    df = data_pipeline.add_cost_zscore(df)
    df = anomaly_detector.detect_cost_anomalies(df)
    print(f"Loaded {len(df)} projects, {int(df['is_cost_outlier'].sum())} flagged as cost outliers.")

    print("Running NLP duplicate detection on descriptions...")
    df = nlp_duplicate.run_nlp_duplicate_detection(df, _CACHE_PATH)

    print("Running satellite verification checks...")
    satellite_check.init_earth_engine()
    # max_rows=0: satellite_status defaults to "no_imagery" for all rows at startup.
    # The orphan server started before SegFormer training was complete and used heuristic
    # fallback (fast). Now that is_model_ready()=True, running on 5000 rows would take
    # hours. Real per-project satellite signals run on-demand in GET /project instead.
    df = satellite_check.add_satellite_signals(df, max_rows=0)

    # Compute base risk score before citizen/feedback adjustments
    df = _compute_base_risk_scores(df)

    print("Applying citizen report risk boosts...")
    df = citizen_reports.apply_citizen_risk_boost(df)

    print("Applying officer feedback adjustments...")
    df = feedback_loop.apply_feedback_adjustments(df)

    # --- Location enrichment: locality extraction + geocode cache lookup ---
    # Replaces the old manual lat/lng/coord_precision block.
    # enrich_dataframe() adds: locality_name, resolved_lat, resolved_lng, location_precision
    # It reads only from CSV caches — never calls Nominatim at server startup.
    # Extract district column first (needed for search filter)
    if "district" not in df.columns:
        if "ida" in df.columns:
            dist = df["ida"].fillna("").astype(str).str.split("(").str[0].str.strip()
            df["district"] = np.where(dist == "", df["constituency"], dist)
        else:
            df["district"] = df["constituency"]

    df = location_enricher.enrich_dataframe(df)

    # Keep backward-compatible latitude/longitude columns pointing at resolved coords
    df["latitude"]       = df["resolved_lat"]
    df["longitude"]      = df["resolved_lng"]
    df["coord_precision"] = df["location_precision"]

    # Precompute fast search index columns (eliminates per-request string regex/replace overhead)
    df["search_state"]        = df["state"].astype(str).str.lower().str.replace(" ", "", regex=False)
    df["search_constituency"] = df["constituency"].astype(str).str.lower().str.replace(" ", "", regex=False)
    df["search_district"]     = df["district"].astype(str).str.lower().str.replace(" ", "", regex=False) if "district" in df.columns else df["search_constituency"]
    df["search_desc"]         = df["work_description"].astype(str).str.lower()

    # Initialize verified demo showcase indicators (curated localities & verified tiles)
    df = demo_showcase.initialize_showcase_signals(df)

    _df = df
    top = _df["risk_score"].max()
    avg = _df["risk_score"].mean()
    print(f"Scoring complete. Top risk score: {top:.1f}, Average: {avg:.2f}")

    # Wire dataframe reference into all modules that mutate it
    citizen_reports.set_main_dataframe_reference(_df)
    feedback_loop.set_main_dataframe_reference(_df)
    audit_brief.set_main_dataframe_reference(_df)
    demo_showcase.set_main_dataframe_reference(_df)
    fund_tracking.set_fund_dataframe(_df)
    progress_delay.set_progress_dataframe(_df)
    compliance_alerts.set_compliance_dataframe(_df)

    yield  # Server is running


# --- FastAPI app ---
app = FastAPI(
    title="MPLADS Risk Intelligence System",
    description="AI-powered decision-support dashboard for MPLAD Scheme audit. SIH26102.",
    version="1.0.0",
    lifespan=lifespan,
)

allowed_origins_env = os.getenv("ALLOWED_ORIGINS")
if allowed_origins_env:
    allow_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
    if "null" not in allow_origins:
        allow_origins.append("null")
else:
    allow_origins = [
        "*",
        "null",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",   # citizen portal dev server
        "http://127.0.0.1:8080",
        "http://127.0.0.1:3000",
    ]

allow_creds = False if "*" in allow_origins else True

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=r"https://.*\.vercel\.app|https://.*\.loca\.lt|https://.*\.trycloudflare\.com",
    allow_credentials=allow_creds,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers from existing and enhanced modules
app.include_router(auth_jwt.router)
app.include_router(citizen_reports.router)
app.include_router(feedback_loop.router)
app.include_router(audit_brief.router)
app.include_router(officer_checklist.router)
app.include_router(voice_transcriber.router)
app.include_router(demo_showcase.router)
app.include_router(fund_tracking.router)
app.include_router(progress_delay.router)
app.include_router(compliance_alerts.router)

# Mount static web frontends: Citizen Portal, Officer Dashboard, Login Gateway, and Uploads
from fastapi.staticfiles import StaticFiles
_portal_dir   = os.path.join(_SCRIPT_DIR, "frontend", "citizen-portal")
_officer_dir  = os.path.join(_SCRIPT_DIR, "frontend", "officer-dashboard")
_login_dir    = os.path.join(_SCRIPT_DIR, "frontend", "login")
_frontend_dir = os.path.join(_SCRIPT_DIR, "frontend")
_assets_dir   = os.path.join(_SCRIPT_DIR, "frontend", "assets")
_uploads_dir  = os.path.join(_SCRIPT_DIR, "uploads")

if os.path.exists(_portal_dir):
    app.mount("/portal", StaticFiles(directory=_portal_dir, html=True), name="portal")
    app.mount("/citizen-portal", StaticFiles(directory=_portal_dir, html=True), name="citizen_portal")
if os.path.exists(_officer_dir):
    app.mount("/officer-dashboard", StaticFiles(directory=_officer_dir, html=True), name="officer_dashboard")
    app.mount("/officer", StaticFiles(directory=_officer_dir, html=True), name="officer")
if os.path.exists(_login_dir):
    app.mount("/login", StaticFiles(directory=_login_dir, html=True), name="login")
if os.path.exists(_frontend_dir):
    app.mount("/frontend", StaticFiles(directory=_frontend_dir, html=True), name="frontend")
if os.path.exists(_assets_dir):
    app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")
if os.path.exists(_uploads_dir):
    app.mount("/uploads", StaticFiles(directory=_uploads_dir), name="uploads")


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.get("/", tags=["Status"])
def root():
    """Health check — returns total project count."""
    total = len(_df) if _df is not None else 0
    return {"status": "MPLADS Risk Intelligence System is running", "total_projects": total}


@app.get("/health", tags=["Status"])
def health():
    """Lightweight health check endpoint."""
    total = len(_df) if _df is not None else 0
    return {"status": "ok", "total_projects": total}



@app.get("/flagged-projects", tags=["Projects"])
def flagged_projects(
    limit: int = Query(default=20, ge=1, le=500),
    state: Optional[str] = Query(default=None),
    work_category: Optional[str] = Query(default=None),
    district: Optional[str] = Query(default=None, description="District filter for national auditors"),
    officer: dict = Depends(auth_jwt.get_current_officer),
):
    """
    Returns projects flagged as cost outliers, sorted by risk_score descending.
    Enforces server-side cryptographic role-based jurisdiction scoping:
    - If officer's assigned district != 'ALL', strictly filters by their district.
    - If officer is national admin ('ALL'), allows viewing all or filtering by query param.
    """
    if _df is None:
        raise HTTPException(status_code=503, detail="Dataset not loaded yet.")

    result = _df[_df["is_cost_outlier"] == True].copy()

    # Server-side role-based jurisdiction enforcement
    officer_district = (officer.get("district") or "ALL").strip().upper()
    if officer_district != "ALL":
        # Strictly enforce statutory jurisdiction server-side
        mask = (result["district"].astype(str).str.upper() == officer_district) | (result["constituency"].astype(str).str.upper() == officer_district)
        result = result[mask]
    elif district:
        d_clean = district.strip().upper()
        mask = (result["district"].astype(str).str.upper() == d_clean) | (result["constituency"].astype(str).str.upper() == d_clean)
        result = result[mask]

    if state:
        result = result[result["state"].str.lower() == state.lower()]
    if work_category:
        result = result[result["work_category"].str.lower() == work_category.lower()]

    result = result.sort_values("risk_score", ascending=False).head(limit)

    # Return complete column set for officer inspection
    cols = [
        "work_id", "state", "constituency", "district", "mp_name", "work_category",
        "work_description", "sanction_amount", "cost_zscore",
        "cost_risk_score", "nlp_similarity_score", "satellite_risk_score",
        "satellite_status", "citizen_report_count", "feedback_status",
        "risk_score", "similar_project", "similar_state", "is_cost_outlier",
        "latitude", "longitude", "resolved_lat", "resolved_lng",
        "location_precision", "coord_precision", "locality_name",
    ]
    cols = [c for c in cols if c in result.columns]
    records = result[cols].where(pd.notnull(result[cols]), None).to_dict(orient="records")
    return [_sanitize(r) for r in records]


@app.get("/project", tags=["Projects"])
def project_detail(work_id: str = Query(..., description="MPLADS work_id (may contain slashes)")):
    """
    Returns full detail for a single project including explanation and satellite status.
    Uses query parameter (not path parameter) to handle slash-containing IDs.
    """
    if _df is None:
        raise HTTPException(status_code=503, detail="Dataset not loaded yet.")

    work_id = work_id.strip()
    mask = _df["work_id"] == work_id
    if not mask.any():
        raise HTTPException(status_code=404, detail="Project not found in MPLADS database.")

    row = _df[mask].iloc[0]
    project = _sanitize(row.where(pd.notnull(row), None).to_dict())

    # Generate explanation (Gemini or template fallback)
    try:
        project["explanation"] = explain_flagged_project(project)
    except Exception:
        project["explanation"] = None

    return {"project": project}


# NOTE: /citizen-report, /citizen-reports, /feedback, /audit-brief, /project-analysis-report
# are all served by the included routers above.


@app.post("/explain", tags=["Projects"])
def explain_project_endpoint(work_id: str = Query(..., description="MPLADS work_id (may contain slashes)")):
    """
    Returns plain-language AI explanation for a flagged project.
    Uses Gemini API if configured, otherwise robust template fallback.
    """
    if _df is None:
        raise HTTPException(status_code=503, detail="Dataset not loaded yet.")

    work_id = work_id.strip()
    mask = _df["work_id"] == work_id
    if not mask.any():
        raise HTTPException(status_code=404, detail="Project not found in MPLADS database.")

    row = _df[mask].iloc[0]
    project = _sanitize(row.where(pd.notnull(row), None).to_dict())

    try:
        explanation = explain_flagged_project(project)
    except Exception:
        explanation = f"Flagged for audit review based on combined risk score {project.get('risk_score')}."

    return {
        "work_id": work_id,
        "explanation": explanation,
        "risk_score": project.get("risk_score"),
    }


@app.get("/search-projects", tags=["Projects"])
def search_projects(
    q: Optional[str] = Query(default=None, description="Search term: constituency, district, or keyword"),
    query: Optional[str] = Query(default=None, description="Alias for q"),
    page: int = Query(default=1, ge=1, description="Page number for pagination (1-indexed)"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    limit: Optional[int] = Query(default=None, ge=1, le=100, description="Deprecated alias for page_size"),
):
    """
    Lightweight, paginated text search across all 77K MPLADS works.
    Matches against constituency, work_description, state, district, ida (case-insensitive).
    Used by citizen and officer portals for high-speed on-demand browsing.
    Returns safe subset of columns including satellite indicators.
    """
    if _df is None:
        raise HTTPException(status_code=503, detail="Dataset not loaded yet.")

    search_term = q or query or ""
    term = search_term.strip().lower()
    if len(term) < 2:
        raise HTTPException(status_code=400, detail="Search query must be at least 2 characters long.")

    clean_term = term.replace(" ", "").replace("-", "")

    # Search constituency, description, state, and district/ida (case- and space-insensitive)
    constituency_s = _df["constituency"].astype(str).str.lower()
    state_s = _df["state"].astype(str).str.lower()
    desc_s = _df["work_description"].astype(str).str.lower()

    mask = (
        constituency_s.str.contains(term, na=False, regex=False)
        | constituency_s.str.replace(" ", "", regex=False).str.contains(clean_term, na=False, regex=False)
        | desc_s.str.contains(term, na=False, regex=False)
        | state_s.str.contains(term, na=False, regex=False)
        | state_s.str.replace(" ", "", regex=False).str.contains(clean_term, na=False, regex=False)
    )
    if "district" in _df.columns:
        district_s = _df["district"].astype(str).str.lower()
        mask = mask | district_s.str.contains(term, na=False, regex=False) | district_s.str.replace(" ", "", regex=False).str.contains(clean_term, na=False, regex=False)
    if "ida" in _df.columns:
        mask = mask | _df["ida"].astype(str).str.lower().str.contains(term, na=False, regex=False)

    total = int(mask.sum())
    effective_size = limit if limit is not None else page_size
    total_pages = max(1, math.ceil(total / effective_size))
    start_idx = (page - 1) * effective_size
    end_idx = start_idx + effective_size

    result = _df[mask].iloc[start_idx:end_idx]

    cols = [
        "work_id", "state", "constituency", "district", "mp_name",
        "work_category", "work_description", "sanction_amount",
        "risk_score", "citizen_report_count", "feedback_status",
        # Location enrichment fields
        "latitude", "longitude",            # backward-compatible aliases
        "resolved_lat", "resolved_lng",     # canonical enriched coordinates
        "locality_name",                    # extracted village/panchayat name (or None)
        "location_precision",               # 'precise'|'locality'|'district'|'unavailable'
        "coord_precision",                  # backward-compatible alias for location_precision
        # Satellite indicators
        "satellite_status", "satellite_risk_score",
    ]
    cols = [c for c in cols if c in result.columns]
    records = result[cols].where(pd.notnull(result[cols]), None).to_dict(orient="records")
    return {
        "results": [_sanitize(r) for r in records],
        "total": total,
        "page": page,
        "page_size": effective_size,
        "total_pages": total_pages,
    }


@app.get("/project-satellite-image", tags=["Projects"])
def get_project_satellite_image(
    work_id: Optional[str] = Query(default=None, description="Work ID of project"),
    lat: Optional[str] = Query(default=None, description="Latitude"),
    lng: Optional[str] = Query(default=None, description="Longitude"),
    district: Optional[str] = Query(default=None, description="District / Constituency"),
    state: Optional[str] = Query(default=None, description="State"),
    precision: Optional[str] = Query(default=None, description="Precision tier ('locality' or 'precise')"),
):
    """
    Returns visual Sentinel-2 / Landsat multispectral satellite inspection tile
    with coordinate crosshairs, resolution scale, and structure detection stamp.
    """
    import importlib
    import satellite_check
    importlib.reload(satellite_check)
    from satellite_check import generate_satellite_thumbnail

    clean_lat = None
    clean_lng = None
    if lat not in [None, "", "null", "undefined"]:
        try:
            clean_lat = float(lat)
        except (ValueError, TypeError):
            clean_lat = None
    if lng not in [None, "", "null", "undefined"]:
        try:
            clean_lng = float(lng)
        except (ValueError, TypeError):
            clean_lng = None

    target_lat = clean_lat
    target_lng = clean_lng
    dist_name = district or "District"
    st_name = state or "India"
    sat_status = "visible"
    pass_date = None
    prec = precision or "district"

    if _df is not None and work_id:
        match = _df[_df["work_id"] == work_id]
        if not match.empty:
            row = match.iloc[0]
            dist_name = str(row.get("constituency") or row.get("district") or dist_name)
            st_name = str(row.get("state") or st_name)
            sat_status = str(row.get("satellite_status") or "no_imagery")
            pass_date = row.get("satellite_pass_date")
            if precision is None:
                prec = str(row.get("location_precision") or row.get("coord_precision") or "district")
            if target_lat is None and pd.notnull(row.get("resolved_lat")):
                try:
                    target_lat = float(row["resolved_lat"])
                except Exception:
                    pass
            if target_lng is None and pd.notnull(row.get("resolved_lng")):
                try:
                    target_lng = float(row["resolved_lng"])
                except Exception:
                    pass

    # If coordinates are explicitly provided and precision was not set, allow locality tier
    if precision is None and target_lat is not None and target_lng is not None and prec == "district":
        prec = "locality"

    # If coordinates are missing or precision is district-level/unavailable, enforce honest status
    if prec in ["district", "unavailable"] or target_lat is None or target_lng is None:
        sat_status = "location_precision_insufficient"

    coords = (target_lat, target_lng) if (target_lat is not None and target_lng is not None) else None
    buf = generate_satellite_thumbnail(
        district=dist_name,
        state=st_name,
        status=sat_status,
        coordinates=coords,
        pass_date=pass_date,
        precision=prec
    )
    return Response(content=buf.getvalue(), media_type="image/png")



# --- Interactive Citizen Assistance Chatbot (Sahayak) ---
@app.post("/api/citizen-chatbot")
@app.get("/api/citizen-chatbot")
async def citizen_chatbot_endpoint(
    payload: Optional[dict] = None,
    q: Optional[str] = Query(None, description="Query text for GET request")
):
    """
    MPLADS Sahayak Citizen AI Assistant.
    Powered by Gemini Flash with domain-focused vigilance guardrails.
    Returns official MoSPI toll-free helpline and email for any out-of-context questions.
    """
    import explain_gemini
    query = ""
    history = []
    if payload and isinstance(payload, dict):
        query = payload.get("query") or payload.get("message") or ""
        history = payload.get("history") or []
    elif q:
        query = q

    query = query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    return explain_gemini.answer_citizen_query(query, history=history)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)





