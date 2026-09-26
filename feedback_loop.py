"""
Officer Feedback Loop Module for MPLADS Risk Intelligence System.
Allows government auditors to mark flagged projects as 'confirmed_issue' or 'false_positive'.
Stores determinations persistently in CSV, and dynamically dampens risk scores
for false positives and projects sharing NLP duplicate patterns with confirmed false positives.
"""
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any, Literal

import math
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

import supabase_sync
import auth_jwt

router = APIRouter(tags=["Officer Feedback"])

FEEDBACK_CSV = Path("officer_feedback.csv")
CSV_COLUMNS = ["feedback_id", "work_id", "verdict", "officer_notes", "officer_id", "timestamp"]

if not FEEDBACK_CSV.exists():
    pd.DataFrame(columns=CSV_COLUMNS).to_csv(FEEDBACK_CSV, index=False)

# Global in-memory reference to main dataframe (set at server startup)
_MAIN_DF_REF: Optional[pd.DataFrame] = None


def set_main_dataframe_reference(df: pd.DataFrame):
    """Stores reference to in-memory project dataframe for dynamic live re-scoring."""
    global _MAIN_DF_REF
    _MAIN_DF_REF = df


class FeedbackRequest(BaseModel):
    work_id: str = Field(..., description="MPLADS project work_id (e.g. WS/MP317/2024-2025/145098)")
    verdict: Literal["confirmed_issue", "false_positive"] = Field(
        ...,
        description="Auditor determination: 'confirmed_issue' or 'false_positive'"
    )
    officer_notes: Optional[str] = Field(
        default="",
        description="Justification, field verification findings, or audit committee rationale"
    )
    officer_id: Optional[str] = Field(
        default="AUDITOR-DEFAULT",
        description="Badge / ID of the auditing officer"
    )


def get_all_feedback() -> pd.DataFrame:
    """Reads officer_feedback.csv and returns clean DataFrame."""
    if not FEEDBACK_CSV.exists() or os.path.getsize(FEEDBACK_CSV) == 0:
        return pd.DataFrame(columns=CSV_COLUMNS)
    try:
        rdf = pd.read_csv(FEEDBACK_CSV)
        return rdf if not rdf.empty else pd.DataFrame(columns=CSV_COLUMNS)
    except Exception:
        return pd.DataFrame(columns=CSV_COLUMNS)


def apply_feedback_adjustments(
    df: pd.DataFrame,
    fp_direct_reduction: float = 25.0,
    fp_similar_dampening: float = 10.0,
    ci_affirmation_boost: float = 5.0
) -> pd.DataFrame:
    """
    Applies officer feedback adjustments across the full dataset:
    1. Confirmed False Positives: Target project risk score reduced by fp_direct_reduction (-25 pts).
    2. Similar Projects: Any project whose description matched a confirmed false positive
       has its risk score dampened by fp_similar_dampening (-10 pts), reflecting that the pattern
       was reviewed and identified as routine government language.
    3. Confirmed Issues: Target project affirmed with +5 pts and marked for dispatch.
    """
    df = df.copy()

    if "feedback_status" not in df.columns:
        df["feedback_status"] = None

    fb_df = get_all_feedback()
    if fb_df.empty or "work_id" not in fb_df.columns:
        return df

    # Latest verdict per work_id
    latest_fb = fb_df.drop_duplicates(subset=["work_id"], keep="last")
    false_positives = set(latest_fb[latest_fb["verdict"] == "false_positive"]["work_id"])
    confirmed_issues = set(latest_fb[latest_fb["verdict"] == "confirmed_issue"]["work_id"])

    # 1. Update target projects
    if false_positives:
        fp_mask = df["work_id"].isin(false_positives)
        df.loc[fp_mask, "feedback_status"] = "false_positive"
        if "risk_score" in df.columns:
            df.loc[fp_mask, "risk_score"] = (df.loc[fp_mask, "risk_score"] - fp_direct_reduction).clip(lower=0.0).round(1)

    if confirmed_issues:
        ci_mask = df["work_id"].isin(confirmed_issues)
        df.loc[ci_mask, "feedback_status"] = "confirmed_issue"
        if "risk_score" in df.columns:
            df.loc[ci_mask, "risk_score"] = (df.loc[ci_mask, "risk_score"] + ci_affirmation_boost).clip(upper=100.0).round(1)

    # 2. Similarity dampening for projects similar to confirmed false positives
    if false_positives and "similar_project" in df.columns:
        similar_to_fp_mask = df["similar_project"].isin(false_positives) & (~df["work_id"].isin(false_positives))
        # Only tag if not already directly reviewed
        not_reviewed = df["feedback_status"].isna() | (df["feedback_status"] == "")
        apply_mask = similar_to_fp_mask & not_reviewed
        df.loc[apply_mask, "feedback_status"] = "dampened_similarity"
        if "risk_score" in df.columns:
            df.loc[apply_mask, "risk_score"] = (df.loc[apply_mask, "risk_score"] - fp_similar_dampening).clip(lower=0.0).round(1)

    return df


@router.post("/feedback", status_code=status.HTTP_201_CREATED)
def submit_officer_feedback(req: FeedbackRequest, officer: Dict[str, Any] = Depends(auth_jwt.get_current_officer)):
    """
    Submits auditor feedback ('confirmed_issue' or 'false_positive') for a project.
    Stores record persistently in CSV, and dynamically applies score adjustments
    to both the target project and matching similar projects in memory.
    """
    global _MAIN_DF_REF
    work_id = req.work_id.strip() if req.work_id else ""
    if not work_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="work_id cannot be empty."
        )

    # Validate that project exists in the MPLADS scheme
    if _MAIN_DF_REF is not None and not (_MAIN_DF_REF["work_id"] == work_id).any():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with work_id '{work_id}' not found in MPLADS database."
        )

    feedback_id = f"FB-{uuid.uuid4().hex[:8].upper()}"
    timestamp = datetime.now(timezone.utc).isoformat()

    record = {
        "feedback_id": feedback_id,
        "work_id": work_id,
        "verdict": req.verdict,
        "officer_notes": req.officer_notes.strip() if req.officer_notes else "",
        "officer_id": str(officer.get("sub") or "AUDITOR-UNKNOWN"),
        "timestamp": timestamp,
    }

    # Append to CSV
    fb_df = pd.DataFrame([record])
    fb_df.to_csv(FEEDBACK_CSV, mode="a", header=not FEEDBACK_CSV.exists(), index=False)

    # Rebuild feedback effects from the persisted latest-verdict history so a
    # repeated submission or verdict change produces the same score as restart.
    updated_score = None
    affected_similar_count = 0
    if _MAIN_DF_REF is not None:
        replay = _MAIN_DF_REF.copy()
        if "risk_score_before_feedback" in replay.columns:
            replay["risk_score"] = replay["risk_score_before_feedback"]
        replay["feedback_status"] = None
        adjusted = apply_feedback_adjustments(replay)
        _MAIN_DF_REF["risk_score"] = adjusted["risk_score"].values
        _MAIN_DF_REF["feedback_status"] = adjusted["feedback_status"].values
        mask = _MAIN_DF_REF["work_id"] == work_id
        if mask.any():
            updated_score = float(_MAIN_DF_REF.loc[mask, "risk_score"].iloc[0])
        if req.verdict == "false_positive" and "similar_project" in _MAIN_DF_REF.columns:
            affected_similar_count = int(((_MAIN_DF_REF["similar_project"] == work_id) & (_MAIN_DF_REF["work_id"] != work_id)).sum())

    # Sync officer feedback & audit log to Supabase
    record["new_risk_score"] = updated_score
    supabase_sync.sync_officer_feedback(record)
    supabase_sync.sync_audit_log(
        officer_id=record["officer_id"],
        action=f"FEEDBACK_{req.verdict.upper()}",
        work_id=work_id,
        meta={"notes": req.officer_notes, "new_risk_score": updated_score}
    )

    return {
        "status": "success",
        "message": f"Officer feedback '{req.verdict}' recorded successfully.",
        "feedback_id": feedback_id,
        "work_id": work_id,
        "verdict": req.verdict,
        "new_risk_score": updated_score,
        "affected_similar_projects_count": affected_similar_count,
    }


@router.get("/feedback")
def get_feedback_logs(work_id: Optional[str] = None, officer: Dict[str, Any] = Depends(auth_jwt.get_current_officer)):
    """
    Returns historical officer feedback logs, optionally filtered by project work_id.
    """
    fb_df = get_all_feedback()
    if fb_df.empty:
        return []
    if work_id:
        fb_df = fb_df[fb_df["work_id"] == work_id.strip()]
    records = fb_df.to_dict(orient="records")
    clean_records = []
    for r in records:
        clean = {}
        for k, v in r.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                clean[k] = None
            elif pd.isna(v):
                clean[k] = None
            else:
                clean[k] = v
        clean_records.append(clean)
    return clean_records
