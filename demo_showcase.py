"""
demo_showcase.py — Demo-Ready Geospatial Showcase for MPLADS Risk Intelligence System
SIH26102, Team Neural Nova

Provides a curated, ultra-fast entry point for live judging demonstrations.
Returns real MPLADS records where trusted locality coordinates are available.
Each record can load current Esri World Imagery as geographic reference imagery.
Risk flags remain dataset-derived; imagery is explicitly reserved for manual review.

CRITICAL GUARDRAIL:
- Unsupervised risk scores and raw dataset values are strictly preserved.
- The UI labels Esri tiles as reference imagery, never as automated proof.
- No synthetic before/after comparisons or satellite detection results are generated.
"""

import os
import math
import hashlib
import logging
from typing import Optional, List, Dict, Any

import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="", tags=["Demo Showcase"])
logger = logging.getLogger(__name__)

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_DISTRICT_CACHE_CSV = os.path.join(_SCRIPT_DIR, "geocode_district_cache.csv")
_LOCALITY_CACHE_CSV = os.path.join(_SCRIPT_DIR, "geocode_locality_cache.csv")
_RAW_CSV_PATH = os.path.join(_SCRIPT_DIR, "MPLADS_real_raw_data_77312_works.csv")

# Global reference to main server dataframe
_main_df: Optional[pd.DataFrame] = None


def set_main_dataframe_reference(df: pd.DataFrame):
    """Stores a reference to the active main.py in-memory dataframe."""
    global _main_df
    _main_df = df


def _sanitize(record: dict) -> dict:
    """Sanitize numpy scalars, NaNs, and infinities for strict JSON compliance."""
    out = {}
    for k, v in record.items():
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            out[k] = None
        elif hasattr(v, "item"):
            try:
                fv = float(v)
                out[k] = None if (math.isnan(fv) or math.isinf(fv)) else fv
            except Exception:
                out[k] = None
        else:
            out[k] = v
    return out


def build_curated_locality_cache() -> int:
    """Return the count of genuinely geocoded locality rows.

    Kept for API compatibility. Synthetic offsets are never generated. Only
    Nominatim-, GPS-, or manually verified cache records qualify.
    """
    if not os.path.exists(_LOCALITY_CACHE_CSV):
        return 0
    try:
        existing = pd.read_csv(_LOCALITY_CACHE_CSV)
        trusted = existing[existing["status"].isin(["nominatim", "verified", "gps"])]
        return int(len(trusted))
    except Exception:
        return 0


def initialize_showcase_signals(df: pd.DataFrame) -> pd.DataFrame:
    """Mark records with trusted coordinates as demo-ready reference imagery.

    Esri World Imagery is fetched on demand by ``/project-satellite-image``.
    It is contextual evidence for an officer, not an automated finding, so no
    satellite risk score or acquisition date is invented here.
    """
    df = df.copy()
    if "imagery_status" not in df.columns:
        df["imagery_status"] = "unavailable"
    if "satellite_pass_date" not in df.columns:
        df["satellite_pass_date"] = None
    if "imagery_source" not in df.columns:
        df["imagery_source"] = None

    trusted = (
        df["location_precision"].isin(["precise", "locality"])
        & df["resolved_lat"].notnull()
        & df["resolved_lng"].notnull()
    )
    df.loc[trusted, "imagery_status"] = "reference_available"
    df.loc[trusted, "imagery_source"] = "Esri World Imagery"
    df.loc[trusted, "satellite_status"] = "manual_review_required"
    df.loc[trusted, "satellite_risk_score"] = np.nan
    df.loc[trusted, "satellite_pass_date"] = None
    print(f"Demo showcase ready: {int(trusted.sum())} projects have trusted locality coordinates.")
    return df


@router.get("/demo-showcase", tags=["Demo Showcase"])
def get_demo_showcase(
    state: Optional[str] = Query(default=None, description="Filter by state (e.g. Maharashtra, Kerala)"),
    limit: int = Query(default=50, ge=1, le=200, description="Max projects to return"),
    offset: int = Query(default=0, ge=0, description="Offset for pagination"),
    search: Optional[str] = Query(default=None, description="Optional keyword search"),
):
    """
    Returns verified MPLADS showcase projects with:
    1. Real resolved locality/precise coordinates.
    2. On-demand Esri World Imagery labelled as reference imagery.
    3. Grouped state-by-state with real-time verified counts.
    """
    if _main_df is None:
        raise HTTPException(status_code=503, detail="Dataset not initialized yet.")

    # Strictly filter for precise/locality + available imagery
    mask = (
        _main_df["location_precision"].isin(["precise", "locality"])
        & (_main_df["imagery_status"].isin(["reference_available", "available"]))
        & (_main_df["is_cost_outlier"] == True)
    )

    if not mask.any():
        # Fallback: if imagery_status not yet populated, use locality + valid coords
        mask = (
            _main_df["location_precision"].isin(["precise", "locality"])
            & _main_df["resolved_lat"].notnull()
            & _main_df["resolved_lng"].notnull()
            & (_main_df["is_cost_outlier"] == True)
        )

    base_filtered = _main_df[mask]

    # Compute comprehensive state-by-state verified counts
    state_counts_series = base_filtered["state"].dropna().value_counts()
    state_counts = {str(k): int(v) for k, v in state_counts_series.items()}

    # Apply state filter if provided
    result_df = base_filtered.copy()
    if isinstance(state, str) and state.strip() and state.strip().lower() != "all":
        st_clean = state.strip().lower()
        result_df = result_df[result_df["state"].astype(str).str.lower() == st_clean]

    # Optional keyword search
    if isinstance(search, str) and search.strip():
        q = search.strip().lower()
        q_mask = (
            result_df["work_description"].astype(str).str.lower().str.contains(q, na=False)
            | result_df["constituency"].astype(str).str.lower().str.contains(q, na=False)
            | result_df["locality_name"].astype(str).str.lower().str.contains(q, na=False)
        )
        result_df = result_df[q_mask]

    eff_limit = limit if isinstance(limit, int) else 50
    eff_offset = offset if isinstance(offset, int) else 0

    total_matches = len(result_df)

    # Sort by risk_score descending to provide high-value audit demo material first
    if "risk_score" in result_df.columns:
        result_df = result_df.sort_values("risk_score", ascending=False)
    elif "sanction_amount" in result_df.columns:
        result_df = result_df.sort_values("sanction_amount", ascending=False)
    paged = result_df.iloc[eff_offset : eff_offset + eff_limit]

    cols = [
        "work_id", "state", "constituency", "district", "mp_name",
        "work_category", "work_description", "sanction_amount",
        "risk_score", "cost_risk_score", "nlp_similarity_score",
        "satellite_risk_score", "satellite_status", "imagery_status", "imagery_source",
        "satellite_pass_date", "citizen_report_count", "feedback_status",
        "latitude", "longitude", "resolved_lat", "resolved_lng",
        "locality_name", "location_precision", "coord_precision", "is_cost_outlier",
    ]
    cols = [c for c in cols if c in paged.columns]
    records = paged[cols].where(pd.notnull(paged[cols]), None).to_dict(orient="records")

    selected_st = state if isinstance(state, str) else "ALL"
    sanitized_items = [_sanitize(r) for r in records]

    return {
        "status": "success",
        "mode": "reference_imagery_showcase",
        "total": total_matches,
        "total_in_selection": total_matches,
        "total_verified_all_states": len(base_filtered),
        "state": selected_st,
        "selected_state": selected_st,
        "limit": limit,
        "offset": offset,
        "state_counts": state_counts,
        "items": sanitized_items,
        "projects": sanitized_items,
    }


@router.get("/demo-showcase/states", tags=["Demo Showcase"])
def get_showcase_states():
    """
    Returns a state-by-state list of demo-ready projects with trusted locality coordinates.
    Used to populate the 'Browse verified examples by state' top panel.
    """
    if _main_df is None:
        raise HTTPException(status_code=503, detail="Dataset not initialized yet.")

    mask = (
        _main_df["location_precision"].isin(["precise", "locality"])
        & (_main_df["imagery_status"].isin(["reference_available", "available"]))
        & (_main_df["is_cost_outlier"] == True)
    )
    if not mask.any():
        mask = (
            _main_df["location_precision"].isin(["precise", "locality"])
            & _main_df["resolved_lat"].notnull()
            & (_main_df["is_cost_outlier"] == True)
        )

    base_filtered = _main_df[mask]
    counts = base_filtered["state"].dropna().value_counts()

    states_list = [
        {
            "state": str(state),
            "count": int(count),
            "verified_count": int(count)
        }
        for state, count in counts.items()
    ]

    return {
        "total_verified": len(base_filtered),
        "states": states_list,
    }


@router.get("/demo-showcase/sample", tags=["Demo Showcase"])
def get_showcase_sample(
    state: Optional[str] = Query(default=None, description="State name for instant sample project")
):
    """
    Returns one reference-imagery example when honest locality evidence is available.
    """
    if _main_df is None:
        raise HTTPException(status_code=503, detail="Dataset not initialized yet.")

    mask = (
        _main_df["location_precision"].isin(["precise", "locality"])
        & (_main_df["imagery_status"].isin(["reference_available", "available"]))
        & (_main_df["is_cost_outlier"] == True)
    )
    if not mask.any():
        mask = _main_df["location_precision"].isin(["precise", "locality"]) & (_main_df["is_cost_outlier"] == True)

    subset = _main_df[mask]
    if isinstance(state, str) and state.strip() and state.strip().lower() != "all":
        st_clean = state.strip().lower()
        state_subset = subset[subset["state"].astype(str).str.lower() == st_clean]
        if not state_subset.empty:
            subset = state_subset

    if subset.empty:
        return {
            "status": "unavailable",
            "project": None,
            "message": "No project currently has trusted locality coordinates for reference imagery.",
        }

    # Pick top risk project for dramatic demonstration
    sort_c = "risk_score" if "risk_score" in subset.columns else "sanction_amount" if "sanction_amount" in subset.columns else None
    if sort_c:
        row = subset.sort_values(sort_c, ascending=False).iloc[0]
    else:
        row = subset.iloc[0]

    return {
        "status": "success",
        "project": _sanitize(row.where(pd.notnull(row), None).to_dict())
    }
