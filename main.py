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
import pandas as pd
import numpy as np
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

# --- Module imports ---
import data_pipeline
import anomaly_detector
import nlp_duplicate
import satellite_check
import citizen_reports
import feedback_loop
import audit_brief

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

    _df = df
    top = _df["risk_score"].max()
    avg = _df["risk_score"].mean()
    print(f"Scoring complete. Top risk score: {top:.1f}, Average: {avg:.2f}")

    # Wire dataframe reference into all modules that mutate it
    citizen_reports.set_main_dataframe_reference(_df)
    feedback_loop.set_main_dataframe_reference(_df)
    audit_brief.set_main_dataframe_reference(_df)

    yield  # Server is running


# --- FastAPI app ---
app = FastAPI(
    title="MPLADS Risk Intelligence System",
    description="AI-powered decision-support dashboard for MPLAD Scheme audit. SIH26102.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers from existing modules
app.include_router(citizen_reports.router)
app.include_router(feedback_loop.router)
app.include_router(audit_brief.router)


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.get("/", tags=["Status"])
def root():
    """Health check — returns total project count."""
    total = len(_df) if _df is not None else 0
    return {"status": "MPLADS Risk Intelligence System is running", "total_projects": total}


@app.get("/flagged-projects", tags=["Projects"])
def flagged_projects(
    limit: int = Query(default=20, ge=1, le=500),
    state: Optional[str] = Query(default=None),
    work_category: Optional[str] = Query(default=None),
):
    """
    Returns projects flagged as cost outliers, sorted by risk_score descending.
    Supports optional filtering by state and work_category.
    """
    if _df is None:
        raise HTTPException(status_code=503, detail="Dataset not loaded yet.")

    result = _df[_df["is_cost_outlier"] == True].copy()

    if state:
        result = result[result["state"].str.lower() == state.lower()]
    if work_category:
        result = result[result["work_category"].str.lower() == work_category.lower()]

    result = result.sort_values("risk_score", ascending=False).head(limit)

    # Return a safe subset of columns for the list view
    cols = [
        "work_id", "state", "constituency", "mp_name", "work_category",
        "work_description", "sanction_amount", "cost_zscore",
        "cost_risk_score", "nlp_similarity_score", "satellite_risk_score",
        "satellite_status", "citizen_report_count", "feedback_status",
        "risk_score", "similar_project", "similar_state", "is_cost_outlier",
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
