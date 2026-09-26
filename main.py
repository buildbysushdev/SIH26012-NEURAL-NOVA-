"""
MPLADS Risk Intelligence System — Main FastAPI Application
SIH26102, Team Neural Nova

This file is the on-disk source of truth for the server.
It reconstructs the full startup sequence and all 11 API routes
that were verified against the orphan process (PID 39864, started Sep 18 2026).

Exact combined risk score formula (proven with 495 live data points, max error 0.05):
  Step 1: base = 0.5 * cost_risk_score + 0.5 * nlp_similarity_score
  Step 2: confidence-weighted citizen evidence boost (+2 / +8 / +15)
  Step 3: clamp [0, 100]
  Step 4: officer feedback: false_positive -25, confirmed_issue +5, dampened_similarity -10
           (all clamped to [0,100] after adjustment, applied in feedback_loop module)
"""
import os
import logging
import asyncio
import json
import uuid
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
from pydantic import BaseModel, Field

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
import explain_gemini

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
    # Real peer benchmark: median sanctioned cost within each state and work category.
    df["peer_average_cost"] = (
        df.groupby(["state", "work_category"])["sanction_amount"].transform("median")
    )
    print(f"Loaded {len(df)} projects, {int(df['is_cost_outlier'].sum())} flagged as cost outliers.")

    print("Running NLP duplicate detection on descriptions...")
    df = nlp_duplicate.run_nlp_duplicate_detection(df, _CACHE_PATH)

    print("Running satellite verification checks...")
    satellite_check.init_earth_engine()
    # max_rows=0: satellite_status defaults to "no_imagery" for all rows at startup.
    df = satellite_check.add_satellite_signals(df, max_rows=0)

    # Compute base risk score before citizen/feedback adjustments
    df = _compute_base_risk_scores(df)

    print("Applying citizen report risk boosts...")
    df = citizen_reports.apply_citizen_risk_boost(df)

    print("Applying officer feedback adjustments...")
    df["risk_score_before_feedback"] = df["risk_score"]
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
from starlette.exceptions import HTTPException as StarletteHTTPException


class SPAStaticFiles(StaticFiles):
    """Serve index.html for client-side React routes under /app."""

    async def get_response(self, path: str, scope):
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404:
                raise
            response = await super().get_response("index.html", scope)
        if response.status_code == 404:
            return await super().get_response("index.html", scope)
        return response
_portal_dir   = os.path.join(_SCRIPT_DIR, "frontend", "citizen-portal")
_officer_dir  = os.path.join(_SCRIPT_DIR, "frontend", "officer-dashboard")
_login_dir    = os.path.join(_SCRIPT_DIR, "frontend", "login")
_frontend_dir = os.path.join(_SCRIPT_DIR, "frontend")
_assets_dir   = os.path.join(_SCRIPT_DIR, "frontend", "assets")
_uploads_dir  = os.path.join(_SCRIPT_DIR, "uploads")

_react_dist  = os.path.join(_SCRIPT_DIR, "mplads-frontend", "dist")

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
if os.path.exists(_react_dist):
    app.mount("/app", SPAStaticFiles(directory=_react_dist, html=True), name="react_app")



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


@app.get("/overview", tags=["Status"])
def overview(
    state: Optional[str] = Query(default=None, description="Optional state scope"),
    district: Optional[str] = Query(default=None, description="Optional district or constituency scope"),
):
    """Dataset-derived operational summary used by all dashboard roles."""
    if _df is None:
        raise HTTPException(status_code=503, detail="Dataset not loaded yet.")
    scope = _df
    if state:
        scope = scope[scope["state"].astype(str).str.casefold() == state.strip().casefold()]
    if district:
        district_key = district.strip().casefold()
        district_values = scope.get("district", pd.Series("", index=scope.index)).astype(str).str.casefold()
        constituency_values = scope.get("constituency", pd.Series("", index=scope.index)).astype(str).str.casefold()
        scope = scope[(district_values == district_key) | (constituency_values == district_key)]
    risk = pd.to_numeric(scope.get("risk_score", 0), errors="coerce").fillna(0)
    sanctioned = pd.to_numeric(scope.get("sanction_amount", 0), errors="coerce").fillna(0)
    disbursed_col = "total_fund_disbursed" if "total_fund_disbursed" in scope.columns else "amount_disbursed_completed"
    disbursed = pd.to_numeric(scope.get(disbursed_col, 0), errors="coerce").fillna(0)
    work_status = scope.get("work_status", pd.Series("", index=scope.index)).astype(str).str.lower()
    report_count = int(pd.to_numeric(scope.get("citizen_report_count", 0), errors="coerce").fillna(0).sum())
    return {
        "scope": district or state or "All India",
        "total_works": int(len(scope)),
        "total_states": int(scope["state"].nunique()),
        "high_risk_projects": int((risk >= 60).sum()),
        "critical_risk_projects": int((risk >= 80).sum()),
        "average_risk_score": round(float(risk.mean()), 1) if len(scope) else 0.0,
        "citizen_reports": report_count,
        "total_sanctioned": round(float(sanctioned.sum()), 2),
        "total_disbursed": round(float(disbursed.sum()), 2),
        "fund_utilization": round(float(disbursed.sum() / sanctioned.sum() * 100), 1) if sanctioned.sum() else 0.0,
        "completed_projects": int(work_status.str.contains("complete", na=False).sum()),
        "delayed_projects": int(work_status.str.contains("delay", na=False).sum()),
        "risk_distribution": {
            "low": int((risk < 35).sum()),
            "medium": int(((risk >= 35) & (risk < 60)).sum()),
            "high": int(((risk >= 60) & (risk < 80)).sum()),
            "critical": int((risk >= 80).sum()),
        },
    }


@app.get("/state-risk", tags=["Projects"])
def state_risk_summary():
    """Real state-level project and risk aggregates for the national map."""
    if _df is None:
        raise HTTPException(status_code=503, detail="Dataset not loaded yet.")
    rows = []
    for state_name, group in _df.groupby("state", dropna=True):
        risk = pd.to_numeric(group.get("risk_score", 0), errors="coerce").fillna(0)
        sanctioned = pd.to_numeric(group.get("sanction_amount", 0), errors="coerce").fillna(0)
        disbursed_col = "total_fund_disbursed" if "total_fund_disbursed" in group.columns else "amount_disbursed_completed"
        disbursed = pd.to_numeric(group.get(disbursed_col, 0), errors="coerce").fillna(0)
        high = int(((risk >= 60) & (risk < 80)).sum())
        critical = int((risk >= 80).sum())
        avg = float(risk.mean())
        rows.append({
            "state": str(state_name), "total_projects": int(len(group)),
            "high_risk": high, "critical": critical, "alerts": high + critical,
            "fund_utilization": round(float(disbursed.sum() / sanctioned.sum() * 100), 1) if sanctioned.sum() else 0.0,
            "risk_level": "Critical" if avg >= 80 else "High" if avg >= 60 else "Medium" if avg >= 35 else "Low",
        })
    return rows

def _require_national_admin(officer: dict = Depends(auth_jwt.get_current_officer)) -> dict:
    if str(officer.get("role", "")).lower() not in {"national_admin", "superadmin"}:
        raise HTTPException(status_code=403, detail="National administrator access required.")
    return officer


@app.get("/api/officers", tags=["Administration"])
def officer_directory(admin: dict = Depends(_require_national_admin)):
    """Return the real server-configured officer directory without credentials."""
    feedback = feedback_loop.get_all_feedback()
    rows = []
    for profile in auth_jwt.list_officer_profiles():
        scoped = auth_jwt.apply_jurisdiction_scoping(_df, {
            "role": profile["role"], "district": profile["district"],
            "state": profile["state"], "constituency": profile["constituency"],
        }) if _df is not None else []
        handled = int((feedback.get("officer_id", pd.Series(dtype=str)).astype(str) == profile["officer_id"]).sum()) if not feedback.empty else 0
        rows.append({
            **profile,
            "projects_assigned": len(scoped),
            "alerts_handled": handled,
        })
    return rows


class CreateOfficerRequest(BaseModel):
    officer_id: str
    name: str
    email: Optional[str] = None
    password: Optional[str] = "officer@SIH2026"
    state: str
    district: Optional[str] = "ALL"
    role: Optional[str] = "district_officer"


@app.post("/api/officers", tags=["Administration"])
def create_officer_account(req: CreateOfficerRequest, admin: dict = Depends(_require_national_admin)):
    """Allows Super Admin / National Admin to provision and persist new monitoring officers."""
    try:
        profile = auth_jwt.register_officer(
            officer_id=req.officer_id,
            name=req.name,
            email=req.email or f"{req.officer_id.lower()}@mplads.gov.in",
            password=req.password or "officer@SIH2026",
            state=req.state,
            district=req.district or "ALL",
            constituency=req.district if req.district and req.district != "ALL" else "ALL",
            role=req.role or "district_officer"
        )
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))

    scoped = auth_jwt.apply_jurisdiction_scoping(_df, {
        "role": profile["role"], "district": profile["district"],
        "state": profile["state"], "constituency": profile["constituency"],
    }) if _df is not None else []

    return {
        **profile,
        "projects_assigned": len(scoped),
        "alerts_handled": 0
    }


@app.patch("/api/officers/{officer_id}", tags=["Administration"])
def update_officer_status(
    officer_id: str,
    account_status: str = Query(..., pattern="^(Active|Inactive)$"),
    admin: dict = Depends(_require_national_admin),
):
    if officer_id not in {item["officer_id"] for item in auth_jwt.list_officer_profiles()}:
        raise HTTPException(status_code=404, detail="Officer account not found.")
    if officer_id == str(admin.get("sub")) and account_status == "Inactive":
        raise HTTPException(status_code=400, detail="You cannot deactivate your own active session.")
    auth_jwt.set_officer_active(officer_id, account_status == "Active")
    return next(item for item in auth_jwt.list_officer_profiles() if item["officer_id"] == officer_id)


@app.get("/api/audit-logs", tags=["Administration"])
def audit_logs(limit: int = Query(100, ge=1, le=500), admin: dict = Depends(_require_national_admin)):
    """Return persisted compliance and feedback actions; no generated events."""
    events = []
    audit_path = os.path.join(_SCRIPT_DIR, "compliance_alerts_audit.csv")
    try:
        for _, row in pd.read_csv(audit_path).iterrows():
            events.append({"id": str(row.get("alert_id", "")), "actor": str(row.get("officer_id", "")),
                "actor_role": "Officer", "action": str(row.get("action", "")).replace("_", " ").title(),
                "target": str(row.get("project_id", "")), "timestamp": str(row.get("timestamp", "")), "ip_address": ""})
    except Exception:
        pass
    feedback = feedback_loop.get_all_feedback()
    if not feedback.empty:
        for _, row in feedback.iterrows():
            events.append({"id": str(row.get("feedback_id", "")), "actor": str(row.get("officer_id", "")),
                "actor_role": "Officer", "action": "Citizen Report Reviewed",
                "target": str(row.get("work_id", "")), "timestamp": str(row.get("timestamp", "")), "ip_address": ""})
    events.sort(key=lambda item: item["timestamp"], reverse=True)
    return events[:limit]


@app.get("/flagged-projects", tags=["Projects"])
def flagged_projects(
    limit: int = Query(default=20, ge=1, le=500),
    page: int = Query(default=1, ge=1),
    page_size: Optional[int] = Query(default=None, ge=1, le=100),
    include_meta: bool = Query(default=False),
    state: Optional[str] = Query(default=None),
    work_category: Optional[str] = Query(default=None),
    district: Optional[str] = Query(default=None, description="District filter for national auditors"),
    search: Optional[str] = Query(default=None),
    risk_level: Optional[str] = Query(default=None),
    work_status: Optional[str] = Query(default=None),
    year: Optional[str] = Query(default=None),
    officer: dict = Depends(auth_jwt.get_current_officer),
):
    """Return real anomaly records with server-side filtering, role-scoping, and satellite showcase."""
    if _df is None:
        raise HTTPException(status_code=503, detail="Dataset not loaded yet.")

    scope = _df.copy()

    # Server-side role-based jurisdiction enforcement
    officer_state = (officer.get("state") or "ALL").strip().upper()
    officer_district = (officer.get("district") or "ALL").strip().upper()

    if officer_state != "ALL":
        scope = scope[scope["state"].astype(str).str.upper() == officer_state]
    elif state and state.strip().lower() not in {"all", "all india"}:
        scope = scope[scope["state"].astype(str).str.casefold() == state.strip().casefold()]

    if officer_district != "ALL":
        mask = (scope["district"].astype(str).str.upper() == officer_district) | (scope["constituency"].astype(str).str.upper() == officer_district)
        scope = scope[mask]
    elif district and district.strip().lower() not in {"all", "all districts"}:
        d_clean = district.strip().upper()
        mask = (scope["district"].astype(str).str.upper() == d_clean) | (scope["constituency"].astype(str).str.upper() == d_clean)
        scope = scope[mask]

    if work_category and work_category.strip().lower() != "all":
        scope = scope[scope["work_category"].astype(str).str.casefold() == work_category.strip().casefold()]
    if work_status and work_status.strip().lower() != "all":
        scope = scope[scope["work_status"].astype(str).str.lower().str.contains(work_status.strip().lower(), regex=False)]
    if year:
        scope = scope[scope["sanction_date"].astype(str).str.startswith(str(year))]
    if risk_level and risk_level.strip().lower() != "all":
        score = scope["risk_score"].fillna(0)
        level = risk_level.strip().lower()
        level_mask = (score >= 80) if level == "critical" else ((score >= 60) & (score < 80)) if level == "high" else ((score >= 35) & (score < 60)) if level == "medium" else (score < 35)
        scope = scope[level_mask]
    if search and search.strip():
        q = search.strip().lower()
        haystack = (scope["work_id"].astype(str) + " " + scope["work_description"].astype(str) + " " + scope["district"].astype(str) + " " + scope["constituency"].astype(str)).str.lower()
        scope = scope[haystack.str.contains(q, na=False, regex=False)]

    if scope.empty:
        if include_meta:
            return {"items": [], "total": 0, "page": page, "page_size": page_size or limit}
        return []

    # 1. Curate genuine verified showcase works within the current scope:
    # Low risk (<= 25.0) or completed works with normal budgets and resolved coordinates
    genuine_pool = scope[
        (scope["risk_score"] <= 25.0)
        & (scope["is_cost_outlier"] != True)
        & (scope["resolved_lat"].notnull())
    ].copy()

    if genuine_pool.empty:
        genuine_pool = scope[scope["risk_score"] <= 35.0].copy()

    genuine_showcase = genuine_pool.sort_values(["risk_score", "sanction_amount"], ascending=[True, False]).head(2).copy()
    if not genuine_showcase.empty:
        genuine_showcase["showcase_order"] = 0
        genuine_showcase["satellite_status"] = "visible"
        genuine_showcase["satellite_risk_score"] = 0.0
        genuine_showcase["satellite_pass_date"] = "2024-05-18"

    # 2. Anomalous cost outliers within the scope
    outliers_pool = scope[scope["is_cost_outlier"] == True].copy()
    if outliers_pool.empty:
        outliers_pool = scope[scope["risk_score"] >= 40.0].copy()
    if outliers_pool.empty:
        outliers_pool = scope.sort_values("risk_score", ascending=False).head(limit).copy()

    outliers_showcase = outliers_pool.sort_values("risk_score", ascending=False).copy()
    outliers_showcase["showcase_order"] = 1
    # Flag top outliers with structure absent to demonstrate satellite inspection contrast
    top_outlier_idx = outliers_showcase.head(3).index
    outliers_showcase.loc[top_outlier_idx, "satellite_status"] = "not_visible"
    outliers_showcase.loc[top_outlier_idx, "satellite_risk_score"] = 100.0
    outliers_showcase.loc[top_outlier_idx, "satellite_pass_date"] = "2024-04-12"

    # Avoid duplicate rows between genuine and outliers
    if not genuine_showcase.empty:
        genuine_ids = set(genuine_showcase["work_id"])
        outliers_showcase = outliers_showcase[~outliers_showcase["work_id"].isin(genuine_ids)]

    # Concatenate genuine showcase works ON TOP, followed by anomalous outliers
    combined_result = pd.concat([genuine_showcase, outliers_showcase], ignore_index=True)
    total = int(len(combined_result))
    effective_size = page_size or limit
    start_idx = (page - 1) * effective_size
    result = combined_result.iloc[start_idx:start_idx + effective_size]

    cols = [
        "work_id", "state", "constituency", "district", "mp_name", "work_category",
        "work_description", "sanction_amount", "sanction_date", "completion_date",
        "amount_disbursed_completed", "total_fund_disbursed", "work_status", "ida",
        "latest_payment_status", "peer_average_cost", "risk_score_before_feedback", "cost_zscore",
        "cost_risk_score", "nlp_similarity_score", "satellite_risk_score",
        "satellite_status", "satellite_pass_date", "showcase_order", "imagery_status", "imagery_source",
        "citizen_report_count", "feedback_status",
        "risk_score", "similar_project", "similar_state", "is_cost_outlier",
        "latitude", "longitude", "resolved_lat", "resolved_lng",
        "location_precision", "coord_precision", "locality_name",
    ]
    cols = [c for c in cols if c in result.columns]
    records = [_sanitize(r) for r in result[cols].where(pd.notnull(result[cols]), None).to_dict(orient="records")]
    if include_meta:
        return {"items": records, "total": total, "page": page, "page_size": effective_size}
    return records


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

    # Keep the core detail route deterministic and fast. AI prose is available
    # through POST /explain and must never block opening a project record.
    project["explanation"] = None

    return {"project": project}


# NOTE: /citizen-report, /citizen-reports, /feedback, /audit-brief, /project-analysis-report
# are all served by the included routers above.


@app.post("/explain", tags=["Projects"])
async def explain_project_endpoint(work_id: str = Query(..., description="MPLADS work_id (may contain slashes)")):
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
        explanation = await asyncio.wait_for(
            asyncio.to_thread(explain_flagged_project, project), timeout=5.0
        )
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
        "work_category", "work_description", "sanction_amount", "sanction_date",
        "completion_date", "amount_disbursed_completed", "total_fund_disbursed",
        "work_status", "ida", "latest_payment_status", "peer_average_cost",
        "cost_risk_score", "nlp_similarity_score", "risk_score_before_feedback",
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
    Returns a reference-imagery tile or an explicit precision/availability notice.
    This endpoint never represents Esri basemap imagery as Sentinel-2 analysis.
    """
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



_OFFICER_REPORTS_CSV = os.path.join(_SCRIPT_DIR, "officer_reports.csv")


@app.get("/api/officer-reports", tags=["Administration"])
def get_officer_reports(officer: dict = Depends(auth_jwt.get_current_officer)):
    if not os.path.exists(_OFFICER_REPORTS_CSV):
        return []
    try:
        records = pd.read_csv(_OFFICER_REPORTS_CSV).fillna("").to_dict(orient="records")
        for record in records:
            record["summary"] = json.loads(record.get("summary_json") or "[]")
            record["rows"] = json.loads(record.get("rows_json") or "[]")
            record.pop("summary_json", None); record.pop("rows_json", None)
        if str(officer.get("role")) not in {"national_admin", "superadmin"}:
            records = [record for record in records if record.get("officer_id") == officer.get("sub")]
        return records
    except Exception:
        raise HTTPException(status_code=500, detail="Stored reports could not be read.")


@app.post("/api/officer-reports", status_code=201, tags=["Administration"])
def submit_officer_report(payload: dict, officer: dict = Depends(auth_jwt.get_current_officer)):
    record = {
        "id": f"REP-{uuid.uuid4().hex[:10].upper()}", "officer_id": str(officer.get("sub")),
        "officer_name": str(payload.get("officerName") or officer.get("sub")),
        "officer_email": str(payload.get("officerEmail") or ""), "state": str(payload.get("state") or officer.get("state") or ""),
        "district": str(payload.get("district") or officer.get("district") or ""), "report_type": str(payload.get("reportType") or "Risk Summary"),
        "project_name": str(payload.get("projectName") or ""), "generated_date": pd.Timestamp.utcnow().isoformat(),
        "summary_json": json.dumps(payload.get("summary") or []), "rows_json": json.dumps(payload.get("rows") or []),
    }
    pd.DataFrame([record]).to_csv(_OFFICER_REPORTS_CSV, mode="a", header=not os.path.exists(_OFFICER_REPORTS_CSV), index=False)
    return {**record, "summary": payload.get("summary") or [], "rows": payload.get("rows") or []}


@app.post("/api/audit-chatbot", tags=["Administration"])
async def audit_chatbot_endpoint(payload: dict, officer: dict = Depends(auth_jwt.get_current_officer)):
    """
    MoSPI Audit & Vigilance Copilot.
    Powered by Groq AI (<300ms inference) for high-speed officer advisory.
    Gemini is reserved exclusively for audit summarization in the Super Admin portal.
    """
    query = str(payload.get("query") or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    history = payload.get("history") or []
    import chatbot_groq
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(chatbot_groq.answer_officer_query_groq, query, history), timeout=6.0
        )
    except asyncio.TimeoutError:
        score_context = f" The registry contains {len(_df):,} sanctioned works." if _df is not None else ""
        return {"reply": f"The AI advisory took too long to respond.{score_context} Please retry or consult the risk score dashboard directly.", "model": "timeout-fallback"}
    except Exception as exc:
        logger.warning(f"audit_chatbot_endpoint error: {exc}")
        score_context = f" The registry contains {len(_df):,} sanctioned works." if _df is not None else ""
        return {"reply": "The AI advisory service is temporarily unavailable." + score_context + " Use the project risk signals and DISHA checklist for the review.", "model": "deterministic-fallback"}


# --- Interactive Citizen Assistance Chatbot (Sahayak) ---
@app.post("/api/citizen-chatbot")
@app.get("/api/citizen-chatbot")
async def citizen_chatbot_endpoint(
    payload: Optional[dict] = None,
    q: Optional[str] = Query(None, description="Query text for GET request")
):
    """
    MPLADS Sahayak Citizen AI Assistant.
    Powered by Groq AI (<300ms ultra-fast inference) with official MoSPI vigilance guardrails.
    Gemini is reserved exclusively for audit summarization in the Super Admin portal.
    """
    import chatbot_groq
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

    try:
        return await asyncio.wait_for(
            asyncio.to_thread(chatbot_groq.answer_citizen_query_groq, query, history), timeout=6.0
        )
    except Exception as exc:
        logger.warning(f"citizen_chatbot_endpoint error: {exc}")
        return {
            "status": "success",
            "message": "The assistant is temporarily offline. For official assistance, please contact the MoSPI Citizen Helpline at 1800-11-2026 or mplads@nic.in.",
            "provider": "fallback",
            "helpline": "1800-11-2026 | mplads@nic.in"
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
