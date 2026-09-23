"""
Supabase Cloud Data & Storage Synchronization Module
MPLADS Risk Intelligence System (SIH26102, Team Neural Nova)

Persists citizen grievances, 5-check AI verifications, officer determinations,
DISHA inspection checklists, photo hashes, and cloud evidence storage to Supabase.
Operates with graceful fail-safe fallback: cloud synchronization never blocks
local disk & CSV persistence if internet connectivity degrades in the field.
"""

import os
import json
import logging
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# Load .env manually if python-dotenv is not installed
def _load_env_file():
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k, v = k.strip(), v.strip()
                    if k not in os.environ:
                        os.environ[k] = v

_load_env_file()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://jriawilozamluyieoett.supabase.co").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
STORAGE_BUCKET = "citizen-evidence"


def is_supabase_configured() -> bool:
    """Checks whether valid Supabase credentials are configured."""
    return bool(SUPABASE_URL and SUPABASE_KEY and SUPABASE_KEY.startswith("eyJ"))


def _get_headers(content_type: str = "application/json", prefer: Optional[str] = None) -> Dict[str, str]:
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    if content_type:
        headers["Content-Type"] = content_type
    if prefer:
        headers["Prefer"] = prefer
    return headers


def upload_photo_evidence(filename: str, photo_bytes: bytes, mime_type: str = "image/jpeg") -> Optional[str]:
    """
    Uploads photo evidence to Supabase Storage bucket 'citizen-evidence'.
    Returns public cloud URL or None if upload failed.
    """
    if not is_supabase_configured() or not photo_bytes:
        return None

    clean_name = Path(filename).name
    url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{clean_name}"
    headers = _get_headers(content_type=mime_type, prefer="upsert=true")

    req = urllib.request.Request(url, data=photo_bytes, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as res:
            if res.status in (200, 201):
                public_url = f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{clean_name}"
                logger.info(f"Supabase Storage: uploaded {clean_name} -> {public_url}")
                return public_url
    except Exception as e:
        logger.warning(f"Supabase Storage upload failed for {clean_name}: {e}")
        return None


def sync_citizen_report(report_data: Dict[str, Any], photo_url: Optional[str] = None) -> bool:
    """Syncs a citizen report to Supabase 'citizen_reports' table."""
    if not is_supabase_configured():
        return False

    url = f"{SUPABASE_URL}/rest/v1/citizen_reports"
    headers = _get_headers(prefer="return=minimal")

    cap_ts = report_data.get("captured_timestamp")
    payload = {
        "report_id": report_data.get("report_id"),
        "work_id": report_data.get("work_id"),
        "category": report_data.get("category"),
        "description": report_data.get("description"),
        "photo_filename": report_data.get("photo_filename"),
        "photo_url": photo_url,
        "captured_lat": float(report_data["captured_lat"]) if report_data.get("captured_lat") else None,
        "captured_lng": float(report_data["captured_lng"]) if report_data.get("captured_lng") else None,
        "captured_timestamp": cap_ts.strip() if (cap_ts and isinstance(cap_ts, str) and cap_ts.strip()) else None,
        "status": report_data.get("status", "submitted"),
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req) as res:
            return res.status in (200, 201)
    except Exception as e:
        logger.warning(f"Supabase sync_citizen_report failed for {report_data.get('report_id')}: {e}")
        return False


def sync_verification(verif_data: Dict[str, Any]) -> bool:
    """Syncs AI cross-verification result to Supabase 'citizen_report_verifications' table."""
    if not is_supabase_configured():
        return False

    url = f"{SUPABASE_URL}/rest/v1/citizen_report_verifications"
    headers = _get_headers(prefer="return=minimal")

    conf = verif_data.get("confidence_score")
    try:
        conf_int = int(float(conf)) if conf is not None else None
    except Exception:
        conf_int = None

    v_at = verif_data.get("verified_at")
    payload = {
        "report_id": verif_data.get("report_id"),
        "work_id": verif_data.get("work_id"),
        "confidence_score": conf_int,
        "location_check": verif_data.get("location_check"),
        "visual_check": verif_data.get("visual_check"),
        "text_check": verif_data.get("text_check"),
        "duplicate_check": verif_data.get("duplicate_check"),
        "metadata_check": verif_data.get("metadata_check"),
        "ai_recommendation": verif_data.get("ai_recommendation"),
        "ai_reasoning": verif_data.get("ai_reasoning"),
        "verified_at": v_at.strip() if (v_at and isinstance(v_at, str) and v_at.strip()) else None,
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req) as res:
            return res.status in (200, 201)
    except Exception as e:
        logger.warning(f"Supabase sync_verification failed for {verif_data.get('report_id')}: {e}")
        return False


def sync_officer_feedback(feedback_data: Dict[str, Any]) -> bool:
    """Syncs auditor determination to Supabase 'officer_feedback' table."""
    if not is_supabase_configured():
        return False

    url = f"{SUPABASE_URL}/rest/v1/officer_feedback"
    headers = _get_headers(prefer="return=minimal")

    score = feedback_data.get("new_risk_score")
    try:
        score_val = float(score) if score is not None else None
    except Exception:
        score_val = None

    fb_ts = feedback_data.get("timestamp")
    payload = {
        "feedback_id": feedback_data.get("feedback_id"),
        "work_id": feedback_data.get("work_id"),
        "verdict": feedback_data.get("verdict"),
        "officer_notes": feedback_data.get("officer_notes"),
        "officer_id": feedback_data.get("officer_id"),
        "new_risk_score": score_val,
        "timestamp": fb_ts.strip() if (fb_ts and isinstance(fb_ts, str) and fb_ts.strip()) else None,
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req) as res:
            return res.status in (200, 201)
    except Exception as e:
        logger.warning(f"Supabase sync_officer_feedback failed for {feedback_data.get('feedback_id')}: {e}")
        return False


def sync_officer_checklist(work_id: str, checklist_data: Dict[str, Any]) -> bool:
    """Upserts DISHA physical inspection checklist to Supabase 'officer_checklists' table."""
    if not is_supabase_configured():
        return False

    url = f"{SUPABASE_URL}/rest/v1/officer_checklists"
    # Upsert with resolution=merge-duplicates on primary key (work_id)
    headers = _get_headers(prefer="resolution=merge-duplicates,return=minimal")

    payload = {
        "work_id": work_id.strip(),
        "chk_exists": bool(checklist_data.get("chk_exists")),
        "chk_specs": bool(checklist_data.get("chk_specs")),
        "chk_duplicate": bool(checklist_data.get("chk_duplicate")),
        "chk_citizen": bool(checklist_data.get("chk_citizen")),
        "chk_plaque": bool(checklist_data.get("chk_plaque")),
        "chk_photo": bool(checklist_data.get("chk_photo")),
        "officer_notes": checklist_data.get("officer_notes", ""),
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req) as res:
            return res.status in (200, 201)
    except Exception as e:
        logger.warning(f"Supabase sync_officer_checklist failed for {work_id}: {e}")
        return False


def get_officer_checklist(work_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves saved DISHA checklist for a project from Supabase."""
    if not is_supabase_configured():
        return None

    import urllib.parse
    encoded_id = urllib.parse.quote(work_id.strip())
    url = f"{SUPABASE_URL}/rest/v1/officer_checklists?work_id=eq.{encoded_id}&select=*"
    headers = _get_headers()

    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req) as res:
            records = json.loads(res.read().decode())
            return records[0] if records else None
    except Exception as e:
        logger.warning(f"Supabase get_officer_checklist failed for {work_id}: {e}")
        return None


def sync_photo_hash(photo_id: str, work_id: str, sha256_hash: str, source: str = "citizen") -> bool:
    """Syncs cryptographic photo hash seal to Supabase 'photo_hashes' table."""
    if not is_supabase_configured():
        return False

    url = f"{SUPABASE_URL}/rest/v1/photo_hashes"
    headers = _get_headers(prefer="return=minimal")

    payload = {
        "photo_id": photo_id,
        "work_id": work_id,
        "sha256_hash": sha256_hash,
        "source": source,
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req) as res:
            return res.status in (200, 201)
    except Exception as e:
        logger.warning(f"Supabase sync_photo_hash failed: {e}")
        return False


def sync_audit_log(officer_id: str, action: str, work_id: Optional[str] = None, meta: Optional[Dict] = None) -> bool:
    """Records an immutable auditor action trail into Supabase 'audit_action_logs' table."""
    if not is_supabase_configured():
        return False

    url = f"{SUPABASE_URL}/rest/v1/audit_action_logs"
    headers = _get_headers(prefer="return=minimal")

    payload = {
        "officer_id": officer_id,
        "action": action,
        "work_id": work_id,
        "meta": meta or {},
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req) as res:
            return res.status in (200, 201)
    except Exception as e:
        logger.warning(f"Supabase sync_audit_log failed: {e}")
        return False
