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

UPLOADS_DIR = Path("uploads/citizen_reports")
REPORTS_CSV = Path("citizen_reports.csv")

# Ensure upload directory exists
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# CSV schema
CSV_COLUMNS = ["report_id", "work_id", "description", "photo_filename", "timestamp", "status"]

if not REPORTS_CSV.exists():
    pd.DataFrame(columns=CSV_COLUMNS).to_csv(REPORTS_CSV, index=False)

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
    Applies a fixed score boost (e.g. +15 points, capped at 100) to any project
    that has one or more citizen reports.
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
):
    """
    Accepts a citizen report with optional photo upload.
    Security: rate-limited per IP (10/hr) and upload validated by real MIME magic bytes.
    Stores metadata in citizen_reports.csv, saves photo to disk,
    and dynamically boosts the project's risk score by +15 points.
    """
    # --- Rate limiting (guards the +15 boost mechanism from spam) ---
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
    if _MAIN_DF_REF is not None and not (_MAIN_DF_REF["work_id"] == work_id).any():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with work_id '{work_id}' not found in MPLADS database."
        )

    # Save photo if uploaded — validate real MIME type from magic bytes
    photo_filename = None
    if photo and photo.filename:
        contents = await photo.read()
        if len(contents) > 0:
            safe_ext = _validate_image_bytes(contents, photo.filename)  # raises 400 if invalid
            unique_name = f"{uuid.uuid4().hex[:10]}_{int(datetime.now(timezone.utc).timestamp())}{safe_ext}"
            target_path = UPLOADS_DIR / unique_name
            with open(target_path, "wb") as f:
                f.write(contents)
            photo_filename = unique_name

    # Create report entry
    report_id = f"CR-{uuid.uuid4().hex[:8].upper()}"
    timestamp = datetime.now(timezone.utc).isoformat()
    new_record = {
        "report_id": report_id,
        "work_id": work_id,
        "description": clean_desc,
        "photo_filename": photo_filename or "",
        "timestamp": timestamp,
        "status": "submitted"
    }

    # Append to CSV
    rep_df = pd.DataFrame([new_record])
    rep_df.to_csv(REPORTS_CSV, mode="a", header=not REPORTS_CSV.exists(), index=False)

    # Dynamically boost in-memory dataframe if project exists
    updated_risk_score = None
    if _MAIN_DF_REF is not None:
        mask = _MAIN_DF_REF["work_id"] == work_id
        if mask.any():
            # Update citizen report count
            curr_count = _MAIN_DF_REF.loc[mask, "citizen_report_count"].values[0] if "citizen_report_count" in _MAIN_DF_REF.columns else 0
            _MAIN_DF_REF.loc[mask, "citizen_report_count"] = curr_count + 1

            # Apply +15 boost once
            if curr_count == 0 and "risk_score" in _MAIN_DF_REF.columns:
                old_score = _MAIN_DF_REF.loc[mask, "risk_score"].values[0]
                new_score = min(100.0, round(float(old_score) + 15.0, 1))
                _MAIN_DF_REF.loc[mask, "risk_score"] = new_score
                updated_risk_score = new_score
            else:
                updated_risk_score = float(_MAIN_DF_REF.loc[mask, "risk_score"].values[0])

    return {
        "status": "success",
        "message": "Citizen report submitted successfully. Risk priority updated.",
        "report_id": report_id,
        "work_id": work_id,
        "photo_saved": bool(photo_filename),
        "photo_path": str(UPLOADS_DIR / photo_filename) if photo_filename else None,
        "new_risk_score": updated_risk_score
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

