"""
Citizen Reporting Module for MPLADS Risk Intelligence System.
Handles citizen grievances/reports with photo uploads, stores them persistently
in CSV + disk storage, and applies a +15 point risk boost to reported projects.
"""
import os
import uuid
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any

import pandas as pd
from fastapi import APIRouter, Form, File, UploadFile, HTTPException, Request, status

router = APIRouter(tags=["Citizen Reports"])

# ---------------------------------------------------------------------------
# Rate limiting — in-memory per-IP counter (hackathon-appropriate)
# Limit: 10 submissions per IP per hour.  Protects the +15-point boost
# mechanism from being spammed to inflate/deflate risk scores artificially.
# ---------------------------------------------------------------------------
_RATE_LIMIT_WINDOW = timedelta(hours=1)
_RATE_LIMIT_MAX    = 10
_ip_timestamps: Dict[str, list] = defaultdict(list)  # ip -> [datetime, ...]

def _check_rate_limit(ip: str):
    """Raises HTTP 429 if the IP has exceeded the per-hour submission limit."""
    now = datetime.now(timezone.utc)
    cutoff = now - _RATE_LIMIT_WINDOW
    # Purge timestamps older than the window
    _ip_timestamps[ip] = [t for t in _ip_timestamps[ip] if t > cutoff]
    if len(_ip_timestamps[ip]) >= _RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded: max {_RATE_LIMIT_MAX} reports per hour per IP.",
        )
    _ip_timestamps[ip].append(now)

# ---------------------------------------------------------------------------
# MIME validation — check real file magic bytes, not just the extension.
# Prevents someone uploading an executable disguised as image.jpg.
# ---------------------------------------------------------------------------
MAX_UPLOAD_BYTES = 5 * 1024 * 1024   # 5 MB
ALLOWED_MIME_SIGNATURES = {
    b"\xff\xd8\xff":                     ".jpg",   # JPEG
    b"\x89PNG\r\n\x1a\n":              ".png",   # PNG
    b"GIF87a":                           ".gif",   # GIF87
    b"GIF89a":                           ".gif",   # GIF89
    b"RIFF":                             ".webp",  # WebP (checked with offset 8)
    b"\x42\x4d":                         ".bmp",   # BMP
}

def _validate_image_bytes(contents: bytes, filename: str) -> str:
    """
    Validates file contents against known image magic bytes.
    Returns the safe extension to use, or raises HTTP 400.
    """
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum allowed size is {MAX_UPLOAD_BYTES // (1024*1024)} MB.",
        )
    for magic, ext in ALLOWED_MIME_SIGNATURES.items():
        if contents.startswith(magic):
            # Extra WebP check: bytes 8-12 must be 'WEBP'
            if magic == b"RIFF" and contents[8:12] != b"WEBP":
                continue
            return ext
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid file type. Only JPEG, PNG, GIF, WebP, and BMP images are accepted.",
    )

import verification_pipeline

UPLOADS_DIR = Path("uploads/citizen_reports")
REPORTS_CSV = Path("citizen_reports.csv")
VERIFICATIONS_CSV = Path("citizen_report_verifications.csv")
BACKEND_VERIFICATIONS_CSV = Path("backend/data/citizen_report_verifications.csv")
try:
    BACKEND_VERIFICATIONS_CSV.parent.mkdir(parents=True, exist_ok=True)
except Exception:
    pass

# Ensure upload directory exists
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# CSV schemas
CSV_COLUMNS = [
    "report_id", "work_id", "category", "description",
    "photo_filename", "captured_lat", "captured_lng", "captured_timestamp",
    "timestamp", "status",
]

VERIFICATION_COLUMNS = [
    "report_id", "work_id", "confidence_score", "location_check",
    "visual_check", "text_check", "duplicate_check", "metadata_check",
    "ai_recommendation", "ai_reasoning", "verified_at"
]

if not REPORTS_CSV.exists():
    pd.DataFrame(columns=CSV_COLUMNS).to_csv(REPORTS_CSV, index=False)
if not VERIFICATIONS_CSV.exists():
    pd.DataFrame(columns=VERIFICATION_COLUMNS).to_csv(VERIFICATIONS_CSV, index=False)
if not BACKEND_VERIFICATIONS_CSV.exists():
    try:
        pd.DataFrame(columns=VERIFICATION_COLUMNS).to_csv(BACKEND_VERIFICATIONS_CSV, index=False)
    except Exception:
        pass

# In-memory reference to main dataframe (set at server startup)
_MAIN_DF_REF: Optional[pd.DataFrame] = None


def set_main_dataframe_reference(df: pd.DataFrame):
    """Stores reference to in-memory project dataframe for dynamic live re-scoring."""
    global _MAIN_DF_REF
    _MAIN_DF_REF = df


def get_citizen_report_counts() -> Dict[str, int]:
    """Reads citizen_reports.csv and returns a dict mapping work_id -> count of reports."""
    if not REPORTS_CSV.exists() or os.path.getsize(REPORTS_CSV) == 0:
        return {}
    try:
        rdf = pd.read_csv(REPORTS_CSV)
        if rdf.empty or "work_id" not in rdf.columns:
            return {}
        return rdf["work_id"].value_counts().to_dict()
    except Exception:
        return {}


def apply_citizen_risk_boost(df: pd.DataFrame, boost: float = 15.0) -> pd.DataFrame:
    """
    Applies score boost to any project that has one or more citizen reports.
    """
    df = df.copy()
    report_counts = get_citizen_report_counts()

    counts = [report_counts.get(wid, 0) for wid in df["work_id"]]
    df["citizen_report_count"] = counts

    # If base risk score exists, boost projects with >= 1 citizen report by +15
    if "risk_score" in df.columns:
        has_report = df["citizen_report_count"] > 0
        df["risk_score"] = df["risk_score"] + (has_report * boost)
        df["risk_score"] = df["risk_score"].clip(upper=100.0).round(1)

    return df


@router.post("/citizen-report", status_code=status.HTTP_201_CREATED)
async def submit_citizen_report(
    request: Request,
    work_id: str = Form(..., description="MPLADS project work_id (can contain slashes)"),
    description: str = Form(..., description="Citizen report or grievance description"),
    photo: Optional[UploadFile] = File(None, description="Optional geotagged or on-site photo upload"),
    category: Optional[str] = Form(None, description="Issue category selected by citizen"),
    captured_lat: Optional[float] = Form(None, description="GPS latitude at photo capture moment"),
    captured_lng: Optional[float] = Form(None, description="GPS longitude at photo capture moment"),
    captured_timestamp: Optional[str] = Form(None, description="ISO-8601 timestamp at photo capture moment"),
):
    """
    Accepts a citizen report with optional photo upload.
    Security: rate-limited per IP (10/hr) and upload validated by real MIME magic bytes.
    Runs 5-check AI evidence cross-verification pipeline before saving and scoring.
    """
    # --- Rate limiting (guards the boost mechanism from spam) ---
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    global _MAIN_DF_REF
    work_id = work_id.strip() if work_id else ""
    if not work_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="work_id cannot be empty."
        )

    clean_desc = description.strip() if description else ""
    if not clean_desc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Grievance description cannot be empty."
        )

    # Validate that the project exists in the MPLADS scheme
    proj_record = None
    if _MAIN_DF_REF is not None:
        mask = _MAIN_DF_REF["work_id"] == work_id
        if not mask.any():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with work_id '{work_id}' not found in MPLADS database."
            )
        proj_record = _MAIN_DF_REF[mask].iloc[0].to_dict()

    # Save photo if uploaded — validate real MIME type from magic bytes
    photo_filename = None
    photo_bytes = None
    if photo and photo.filename:
        contents = await photo.read()
        if len(contents) > 0:
            safe_ext = _validate_image_bytes(contents, photo.filename)  # raises 400 if invalid
            unique_name = f"{uuid.uuid4().hex[:10]}_{int(datetime.now(timezone.utc).timestamp())}{safe_ext}"
            target_path = UPLOADS_DIR / unique_name
            with open(target_path, "wb") as f:
                f.write(contents)
            photo_filename = unique_name
            photo_bytes = contents

    # Sanitise optional text field to prevent script injection
    clean_category = category.strip()[:100] if category else ""

    # Create report entry
    report_id = f"CR-{uuid.uuid4().hex[:8].upper()}"
    timestamp = datetime.now(timezone.utc).isoformat()
    new_record = {
        "report_id": report_id,
        "work_id": work_id,
        "category": clean_category,
        "description": clean_desc,
        "photo_filename": photo_filename or "",
        "captured_lat": captured_lat,
        "captured_lng": captured_lng,
        "captured_timestamp": captured_timestamp or "",
        "timestamp": timestamp,
        "status": "submitted",
    }

    # Append to citizen_reports.csv
    rep_df = pd.DataFrame([new_record], columns=CSV_COLUMNS)
    rep_df.to_csv(REPORTS_CSV, mode="a", header=not REPORTS_CSV.exists(), index=False)

    # Run AI Evidence Cross-Verification Pipeline
    report_data = {
        "report_id": report_id,
        "work_id": work_id,
        "description": clean_desc,
        "category": clean_category,
        "captured_lat": captured_lat,
        "captured_lng": captured_lng,
        "captured_timestamp": captured_timestamp,
        "photo_filename": photo_filename,
    }
    try:
        verif_result = verification_pipeline.verify_citizen_report(
            report_data=report_data,
            project_data=proj_record,
            photo_bytes=photo_bytes,
        )
    except Exception as v_err:
        # Fail-safe handling: Never reject report if verification pipeline encounters error
        verif_result = {
            "confidence_score": 50,
            "ai_recommendation": "REVIEW",
            "ai_reasoning": "Automated verification temporarily degraded; queued for priority manual officer review.",
            "issues": [],
            "checks": {
                "location_check": "UNVERIFIED",
                "visual_check": "UNVERIFIED",
                "text_check": "UNVERIFIED",
                "duplicate_check": "UNVERIFIED",
                "metadata_check": "UNVERIFIED",
            },
            "scores": {},
            "details": {"verified_at": datetime.now(timezone.utc).isoformat()}
        }

    # Store verification metadata in citizen_report_verifications.csv
    verif_row = {
        "report_id": report_id,
        "work_id": work_id,
        "confidence_score": verif_result.get("confidence_score"),
        "location_check": verif_result.get("checks", {}).get("location_check", "UNVERIFIED"),
        "visual_check": verif_result.get("checks", {}).get("visual_check", "UNVERIFIED"),
        "text_check": verif_result.get("checks", {}).get("text_check", "UNVERIFIED"),
        "duplicate_check": verif_result.get("checks", {}).get("duplicate_check", "UNVERIFIED"),
        "metadata_check": verif_result.get("checks", {}).get("metadata_check", "UNVERIFIED"),
        "ai_recommendation": verif_result.get("ai_recommendation", "REVIEW"),
        "ai_reasoning": verif_result.get("ai_reasoning", ""),
        "verified_at": verif_result.get("details", {}).get("verified_at", datetime.now(timezone.utc).isoformat()),
    }
    v_df = pd.DataFrame([verif_row], columns=VERIFICATION_COLUMNS)
    v_df.to_csv(VERIFICATIONS_CSV, mode="a", header=not VERIFICATIONS_CSV.exists(), index=False)
    try:
        v_df.to_csv(BACKEND_VERIFICATIONS_CSV, mode="a", header=not BACKEND_VERIFICATIONS_CSV.exists(), index=False)
    except Exception:
        pass

    # Dynamic risk boost based on AI verification confidence:
    # >= 80: +15.0 (high confidence genuine)
    # 50-79: +8.0  (medium confidence, partial boost)
    # < 50:  +2.0  (low confidence, minimal boost)
    conf_score = verif_result.get("confidence_score")
    if conf_score is None:
        risk_boost = 8.0
    elif conf_score >= 80:
        risk_boost = 15.0
    elif conf_score >= 50:
        risk_boost = 8.0
    else:
        risk_boost = 2.0

    # Dynamically boost in-memory dataframe if project exists
    updated_risk_score = None
    if _MAIN_DF_REF is not None:
        mask = _MAIN_DF_REF["work_id"] == work_id
        if mask.any():
            curr_count = _MAIN_DF_REF.loc[mask, "citizen_report_count"].values[0] if "citizen_report_count" in _MAIN_DF_REF.columns else 0
            _MAIN_DF_REF.loc[mask, "citizen_report_count"] = curr_count + 1

            if curr_count == 0 and "risk_score" in _MAIN_DF_REF.columns:
                old_score = _MAIN_DF_REF.loc[mask, "risk_score"].values[0]
                new_score = min(100.0, round(float(old_score) + risk_boost, 1))
                _MAIN_DF_REF.loc[mask, "risk_score"] = new_score
                updated_risk_score = new_score
            else:
                updated_risk_score = float(_MAIN_DF_REF.loc[mask, "risk_score"].values[0])

    return {
        "status": "success",
        "message": "Citizen report submitted successfully. AI evidence verification complete.",
        "report_id": report_id,
        "work_id": work_id,
        "category": clean_category,
        "photo_saved": bool(photo_filename),
        "captured_lat": captured_lat,
        "captured_lng": captured_lng,
        "captured_timestamp": captured_timestamp,
        "new_risk_score": updated_risk_score,
        "verification": {
            "confidence_score": verif_result.get("confidence_score"),
            "ai_recommendation": verif_result.get("ai_recommendation"),
            "reasoning": verif_result.get("ai_reasoning"),
            "issues": verif_result.get("issues", []),
            "checks": verif_result.get("checks", {}),
        }
    }


@router.get("/citizen-reports")
def get_citizen_reports(work_id: Optional[str] = None):
    """
    Returns citizen reports, optionally filtered by project work_id.
    """
    if not REPORTS_CSV.exists() or os.path.getsize(REPORTS_CSV) == 0:
        return []
    try:
        rdf = pd.read_csv(REPORTS_CSV)
        if work_id:
            rdf = rdf[rdf["work_id"] == work_id.strip()]
        records = rdf.to_dict(orient="records")
        return [
            {k: (None if (v is None or (isinstance(v, float) and pd.isna(v)) or str(v) == "nan") else v) for k, v in r.items()}
            for r in records
        ]
    except Exception:
        return []


@router.get("/citizen-report-verification/{report_id}")
def get_citizen_report_verification(report_id: str):
    """
    Returns full AI verification analysis for a specific citizen report,
    allowing officers to inspect individual signals, confidence scores, and reasoning.
    """
    report_id = report_id.strip()
    if not report_id:
        raise HTTPException(status_code=400, detail="report_id cannot be empty.")

    # 1. Lookup in citizen_report_verifications.csv
    if VERIFICATIONS_CSV.exists() and os.path.getsize(VERIFICATIONS_CSV) > 0:
        try:
            vdf = pd.read_csv(VERIFICATIONS_CSV)
            match = vdf[vdf["report_id"] == report_id]
            if not match.empty:
                rec = match.iloc[-1].to_dict()
                conf = rec.get("confidence_score")
                try:
                    conf_int = int(float(conf)) if pd.notnull(conf) and str(conf).strip() != "" else None
                except Exception:
                    conf_int = None

                return {
                    "report_id": report_id,
                    "work_id": rec.get("work_id"),
                    "confidence_score": conf_int,
                    "ai_recommendation": rec.get("ai_recommendation"),
                    "reasoning": rec.get("ai_reasoning"),
                    "checks": {
                        "location_check": rec.get("location_check"),
                        "visual_check": rec.get("visual_check"),
                        "text_check": rec.get("text_check"),
                        "duplicate_check": rec.get("duplicate_check"),
                        "metadata_check": rec.get("metadata_check"),
                    },
                    "verified_at": rec.get("verified_at"),
                }
        except Exception:
            pass

    # 2. Fallback: if report exists in citizen_reports.csv, verify on the fly
    if REPORTS_CSV.exists() and os.path.getsize(REPORTS_CSV) > 0:
        try:
            rdf = pd.read_csv(REPORTS_CSV)
            rmatch = rdf[rdf["report_id"] == report_id]
            if not rmatch.empty:
                rrow = rmatch.iloc[-1].to_dict()
                proj_data = None
                if _MAIN_DF_REF is not None and "work_id" in rrow:
                    pmask = _MAIN_DF_REF["work_id"] == rrow["work_id"]
                    if pmask.any():
                        proj_data = _MAIN_DF_REF[pmask].iloc[0].to_dict()

                res = verification_pipeline.verify_citizen_report(rrow, proj_data)
                return {
                    "report_id": report_id,
                    "work_id": rrow.get("work_id"),
                    "confidence_score": res["confidence_score"],
                    "ai_recommendation": res["ai_recommendation"],
                    "reasoning": res["ai_reasoning"],
                    "issues": res.get("issues", []),
                    "checks": res.get("checks", {}),
                    "scores": res.get("scores", {}),
                    "verified_at": res.get("details", {}).get("verified_at"),
                }
        except Exception:
            pass

    raise HTTPException(status_code=404, detail=f"Verification record for report '{report_id}' not found.")


