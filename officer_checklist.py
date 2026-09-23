"""
DISHA Physical Inspection Checklist Module
MPLADS Risk Intelligence System (SIH26102, Team Neural Nova)

Persists statutory on-site verification checklist items and officer findings.
Provides cloud persistence to Supabase 'officer_checklists' table with local CSV fail-safe.
"""

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any

import pandas as pd
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

import supabase_sync

router = APIRouter(tags=["DISHA Inspection Checklist"])

CHECKLIST_CSV = Path("officer_checklists.csv")
COLUMNS = [
    "work_id", "chk_exists", "chk_specs", "chk_duplicate",
    "chk_citizen", "chk_plaque", "chk_photo", "officer_notes", "updated_at"
]

if not CHECKLIST_CSV.exists():
    pd.DataFrame(columns=COLUMNS).to_csv(CHECKLIST_CSV, index=False)


class ChecklistSubmission(BaseModel):
    work_id: str = Field(..., description="MPLADS project work_id")
    chk_exists: bool = Field(default=False, description="Physical existence verified at site")
    chk_specs: bool = Field(default=False, description="Technical BOQ specifications verified")
    chk_duplicate: bool = Field(default=False, description="Non-duplication across schemes verified")
    chk_citizen: bool = Field(default=False, description="Citizen inquiry / beneficiary interview completed")
    chk_plaque: bool = Field(default=False, description="Official MPLADS plaque verified on-site")
    chk_photo: bool = Field(default=False, description="Geotagged photographic proof captured")
    officer_notes: Optional[str] = Field(default="", description="Auditor field remarks and notes")


@router.post("/checklist", status_code=status.HTTP_200_OK)
def save_checklist(req: ChecklistSubmission):
    """
    Saves or updates DISHA physical inspection checklist.
    Persists to Supabase cloud table and updates local CSV.
    """
    work_id = req.work_id.strip() if req.work_id else ""
    if not work_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="work_id cannot be empty."
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    record = {
        "work_id": work_id,
        "chk_exists": req.chk_exists,
        "chk_specs": req.chk_specs,
        "chk_duplicate": req.chk_duplicate,
        "chk_citizen": req.chk_citizen,
        "chk_plaque": req.chk_plaque,
        "chk_photo": req.chk_photo,
        "officer_notes": req.officer_notes.strip() if req.officer_notes else "",
        "updated_at": now_iso,
    }

    # 1. Update local CSV
    try:
        if CHECKLIST_CSV.exists() and os.path.getsize(CHECKLIST_CSV) > 0:
            df = pd.read_csv(CHECKLIST_CSV)
            # Remove previous record for this work_id if present
            df = df[df["work_id"] != work_id]
            df = pd.concat([df, pd.DataFrame([record])], ignore_index=True)
            df.to_csv(CHECKLIST_CSV, index=False)
        else:
            pd.DataFrame([record]).to_csv(CHECKLIST_CSV, index=False)
    except Exception as e:
        pass

    # 2. Sync to Supabase cloud
    cloud_synced = supabase_sync.sync_officer_checklist(work_id, record)

    return {
        "status": "success",
        "message": "DISHA checklist saved successfully.",
        "work_id": work_id,
        "cloud_synced": cloud_synced,
        "checklist": record,
    }


@router.get("/checklist")
def get_checklist(work_id: str = Query(..., description="MPLADS project work_id")):
    """
    Retrieves saved DISHA checklist for a project.
    Queries Supabase cloud first; falls back to local CSV cache.
    """
    work_id = work_id.strip() if work_id else ""
    if not work_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="work_id cannot be empty."
        )

    # 1. Try Supabase cloud
    cloud_data = supabase_sync.get_officer_checklist(work_id)
    if cloud_data:
        return {"status": "success", "source": "cloud", "checklist": cloud_data}

    # 2. Fall back to local CSV
    if CHECKLIST_CSV.exists() and os.path.getsize(CHECKLIST_CSV) > 0:
        try:
            df = pd.read_csv(CHECKLIST_CSV)
            match = df[df["work_id"] == work_id]
            if not match.empty:
                rec = match.iloc[-1].to_dict()
                return {"status": "success", "source": "local_csv", "checklist": rec}
        except Exception:
            pass

    # Return empty default template if not found
    empty_template = {
        "work_id": work_id,
        "chk_exists": False,
        "chk_specs": False,
        "chk_duplicate": False,
        "chk_citizen": False,
        "chk_plaque": False,
        "chk_photo": False,
        "officer_notes": "",
        "updated_at": None,
    }
    return {"status": "not_found", "source": "default", "checklist": empty_template}
