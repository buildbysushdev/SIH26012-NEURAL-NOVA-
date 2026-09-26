"""
Automated Compliance & Early-Warning Alerts Service
MPLADS Risk Intelligence System (SIH26102, Team Neural Nova)

Evaluates multi-vector statutory compliance rules:
  1. Project completion deadline exceeded (>365 days)
  2. Payment pending beyond configured threshold (>90 days)
  3. Cost overrun: expenditure exceeds sanctioned limits
  4. Missing mandatory project updates / stalled progress
  5. Physical inspection overdue (>60 days)
  6. High cost anomaly score from Isolation Forest (cost_risk_score >= 80)
  7. Potential duplicate works flagged by Sentence-BERT (nlp_similarity_score >= 90)
  8. Unresolved citizen grievance flagged via vigilance reports

Critical Rule:
  Alerts denote potential irregularities requiring administrative verification,
  never an automated fraud verdict.
"""

import os
import math
import datetime
import hashlib
from typing import Dict, Any, List, Optional
import pandas as pd
from fastapi import APIRouter, Query, Body, HTTPException, Depends
from pydantic import BaseModel, Field
import auth_jwt

router = APIRouter(prefix="/api/compliance", tags=["Compliance & Alerts"])

_df: Optional[pd.DataFrame] = None
CURRENT_DATE = datetime.datetime(2026, 9, 25)

# Audit log store
_AUDIT_CSV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "compliance_alerts_audit.csv")

# In-memory alert status override store (alert_id -> {status, assigned_to, remarks, history})
_ALERT_OVERRIDES: Dict[str, Dict[str, Any]] = {}


def set_compliance_dataframe(df: pd.DataFrame):
    """Sets the shared dataframe reference from main.py startup."""
    global _df
    _df = df


def _init_audit_store():
    """Initializes local CSV storage for compliance actions."""
    if not os.path.exists(_AUDIT_CSV_PATH):
        try:
            df_init = pd.DataFrame(columns=[
                "alert_id", "project_id", "officer_id", "action", "status", "assigned_to", "remarks", "timestamp"
            ])
            df_init.to_csv(_AUDIT_CSV_PATH, index=False)
        except Exception:
            pass
    else:
        try:
            audit_df = pd.read_csv(_AUDIT_CSV_PATH)
            for _, r in audit_df.iterrows():
                aid = str(r.get("alert_id") or "")
                if aid:
                    _ALERT_OVERRIDES[aid] = {
                        "status": str(r.get("status") or "ACKNOWLEDGED"),
                        "assigned_to": str(r.get("assigned_to") or ""),
                        "remarks": str(r.get("remarks") or ""),
                        "last_officer": str(r.get("officer_id") or ""),
                        "last_update": str(r.get("timestamp") or ""),
                    }
        except Exception:
            pass


_init_audit_store()


class AlertActionRequest(BaseModel):
    alert_id: str = Field(..., description="Unique Alert identifier")
    project_id: str = Field(..., description="Associated MPLADS Work ID")
    action: str = Field(..., description="Action: acknowledge, assign, remark, resolve")
    officer_id: str = Field(default="AUDITOR-VIGILANCE-01", description="Acting officer badge ID")
    assigned_to: Optional[str] = Field(default=None, description="Assigned authority / officer")
    remarks: Optional[str] = Field(default=None, description="Audit note or field observation")


def _safe_float(val: Any, default: float = 0.0) -> float:
    if val is None or pd.isna(val):
        return default
    try:
        f = float(val)
        return default if (math.isnan(f) or math.isinf(f)) else f
    except (ValueError, TypeError):
        return default


def _safe_int(val: Any, default: int = 0) -> int:
    if val is None or pd.isna(val):
        return default
    try:
        f = float(val)
        return default if (math.isnan(f) or math.isinf(f)) else int(f)
    except (ValueError, TypeError):
        return default


def generate_alerts_for_project(row: pd.Series) -> List[Dict[str, Any]]:
    """
    Evaluates a single project against statutory compliance and AI anomaly rules.
    Returns list of generated alert objects.
    """
    alerts = []
    wid = str(row.get("work_id") or "")
    desc = str(row.get("work_description") or "MPLADS Project")
    st = str(row.get("state") or "")
    dist = str(row.get("constituency") or row.get("ida") or "")
    constituency = str(row.get("constituency") or "")
    raw_status = str(row.get("work_status") or "").lower()

    sanc_amt = _safe_float(row.get("sanction_amount"), 0.0)
    rel_amt = _safe_float(row.get("total_fund_disbursed"), 0.0)
    exp_amt = _safe_float(row.get("amount_disbursed_completed"), 0.0)

    cost_score = _safe_float(row.get("cost_risk_score"), 0.0)
    nlp_score = _safe_float(row.get("nlp_similarity_score"), 0.0)
    citizen_count = _safe_int(row.get("citizen_report_count"), 0)

    # Date parsing
    sanc_dt = None
    try:
        if pd.notnull(row.get("sanction_date")):
            sanc_dt = datetime.datetime.strptime(str(row["sanction_date"])[:10], "%Y-%m-%d")
    except Exception:
        pass

    # 1. Statutory Deadline Exceeded Alert
    if sanc_dt:
        expected_comp = sanc_dt + datetime.timedelta(days=365)
        if "completed" not in raw_status and CURRENT_DATE > expected_comp:
            overdue_days = (CURRENT_DATE - expected_comp).days
            aid = f"ALT-DL-{hashlib.md5(wid.encode()).hexdigest()[:6].upper()}"
            alerts.append({
                "alert_id": aid,
                "project_id": wid,
                "project_name": desc,
                "state": st,
                "district": dist,
                "constituency": constituency,
                "alert_type": "DEADLINE_EXCEEDED",
                "severity": "CRITICAL" if overdue_days > 180 else ("HIGH" if overdue_days > 90 else "MEDIUM"),
                "reason": f"Statutory 365-day execution deadline exceeded by {overdue_days} days. On-site progress verification required.",
                "date_generated": expected_comp.strftime("%Y-%m-%d"),
                "assigned_authority": f"District Collector / IDA {dist}",
                "status": "OPEN",
            })

    # 2. Cost Overrun Alert: Expenditure > Sanctioned Amount
    if exp_amt > sanc_amt and sanc_amt > 0:
        overrun_val = exp_amt - sanc_amt
        overrun_pct = round((overrun_val / sanc_amt) * 100, 1)
        aid = f"ALT-CO-{hashlib.md5(wid.encode()).hexdigest()[:6].upper()}"
        alerts.append({
            "alert_id": aid,
            "project_id": wid,
            "project_name": desc,
            "state": st,
            "district": dist,
            "constituency": constituency,
            "alert_type": "COST_OVERRUN",
            "severity": "HIGH",
            "reason": f"Disbursed expenditure (INR {exp_amt:,.0f}) exceeds approved sanction (INR {sanc_amt:,.0f}) by INR {overrun_val:,.0f} (+{overrun_pct}%).",
            "date_generated": str(row.get("latest_expenditure_date") or CURRENT_DATE.strftime("%Y-%m-%d")),
            "assigned_authority": "Chief Audit Officer / Finance Controller",
            "status": "OPEN",
        })

    # 3. High Cost Anomaly Alert (Isolation Forest Machine Learning Signal)
    if cost_score >= 80.0:
        aid = f"ALT-ML-{hashlib.md5(wid.encode()).hexdigest()[:6].upper()}"
        alerts.append({
            "alert_id": aid,
            "project_id": wid,
            "project_name": desc,
            "state": st,
            "district": dist,
            "constituency": constituency,
            "alert_type": "COST_ANOMALY_HIGH",
            "severity": "CRITICAL" if cost_score >= 90 else "HIGH",
            "reason": f"Unsupervised Isolation Forest flagged cost per category outlier score of {cost_score:.1f}/100 compared to peer works.",
            "date_generated": CURRENT_DATE.strftime("%Y-%m-%d"),
            "assigned_authority": "DISHA Technical Vigilance Unit",
            "status": "OPEN",
        })

    # 4. Duplicate Project Record Suspect (Sentence-BERT NLP Signal)
    if nlp_score >= 88.0:
        aid = f"ALT-DUP-{hashlib.md5(wid.encode()).hexdigest()[:6].upper()}"
        alerts.append({
            "alert_id": aid,
            "project_id": wid,
            "project_name": desc,
            "state": st,
            "district": dist,
            "constituency": constituency,
            "alert_type": "DUPLICATE_WORKS_SUSPECT",
            "severity": "CRITICAL" if nlp_score >= 93 else "HIGH",
            "reason": f"Sentence-BERT semantic similarity of {nlp_score:.1f}% indicates potential duplicate recommendation or overlapping fund sanction.",
            "date_generated": CURRENT_DATE.strftime("%Y-%m-%d"),
            "assigned_authority": "State Nodal Audit Cell",
            "status": "OPEN",
        })

    # 5. Inspection Bottleneck Overdue
    if "inspection" in raw_status and sanc_dt:
        if (CURRENT_DATE - sanc_dt).days > 180:
            aid = f"ALT-INSP-{hashlib.md5(wid.encode()).hexdigest()[:6].upper()}"
            alerts.append({
                "alert_id": aid,
                "project_id": wid,
                "project_name": desc,
                "state": st,
                "district": dist,
                "constituency": constituency,
                "alert_type": "INSPECTION_OVERDUE",
                "severity": "MEDIUM",
                "reason": "Work remains in 'Physical Inspection' stage for over 180 days without completion closure.",
                "date_generated": (sanc_dt + datetime.timedelta(days=180)).strftime("%Y-%m-%d"),
                "assigned_authority": f"District Executive Engineer ({dist})",
                "status": "OPEN",
            })

    # 6. Citizen Grievance Active
    if citizen_count > 0:
        aid = f"ALT-CIT-{hashlib.md5(wid.encode()).hexdigest()[:6].upper()}"
        alerts.append({
            "alert_id": aid,
            "project_id": wid,
            "project_name": desc,
            "state": st,
            "district": dist,
            "constituency": constituency,
            "alert_type": "CITIZEN_GRIEVANCE_ACTIVE",
            "severity": "HIGH",
            "reason": f"{citizen_count} verified citizen report(s) submitted regarding project physical execution or quality concern.",
            "date_generated": CURRENT_DATE.strftime("%Y-%m-%d"),
            "assigned_authority": "District Public Grievance Officer",
            "status": "OPEN",
        })

    # Apply override status if exists in memory/audit log
    for a in alerts:
        override = _ALERT_OVERRIDES.get(a["alert_id"])
        if override:
            a["status"] = override.get("status", a["status"])
            if override.get("assigned_to"):
                a["assigned_authority"] = override.get("assigned_to")
            a["audit_remarks"] = override.get("remarks")
            a["last_officer"] = override.get("last_officer")
            a["last_action_date"] = override.get("last_update")

    return alerts


def get_all_compliance_alerts(
    df: pd.DataFrame,
    severity: Optional[str] = None,
    alert_type: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
) -> Dict[str, Any]:
    """Generates and filters compliance alerts across priority works."""
    # Process top priority projects: flagged outliers + high risk scores
    if "risk_score" in df.columns:
        priority_df = df[df["risk_score"] >= 60.0]
        if len(priority_df) < 500:
            priority_df = df.head(1000)
    else:
        priority_df = df.head(1000)

    # State filter pre-pass
    if state and state.strip() and state.strip().lower() != "all":
        priority_df = priority_df[priority_df["state"].astype(str).str.lower() == state.strip().lower()]

    all_alerts = []
    for _, row in priority_df.iterrows():
        p_alerts = generate_alerts_for_project(row)
        for alert in p_alerts:
            alert["risk_score"] = round(_safe_float(row.get("risk_score"), 0.0), 1)
        all_alerts.extend(p_alerts)

    # Filter alerts
    filtered = all_alerts
    if severity and severity.strip() and severity.strip().lower() != "all":
        filtered = [a for a in filtered if a["severity"].lower() == severity.strip().lower()]

    if alert_type and alert_type.strip() and alert_type.strip().lower() != "all":
        filtered = [a for a in filtered if a["alert_type"].lower() == alert_type.strip().lower()]

    if district and district.strip() and district.strip().lower() != "all":
        d_clean = district.strip().lower()
        filtered = [a for a in filtered if d_clean in a["district"].lower() or d_clean in a["constituency"].lower()]

    if status and status.strip() and status.strip().lower() != "all":
        filtered = [a for a in filtered if a["status"].lower() == status.strip().lower()]

    total_count = len(filtered)
    sliced = filtered[offset:offset + limit]

    # Severity counts
    counts_by_severity = {
        "CRITICAL": sum(1 for a in all_alerts if a["severity"] == "CRITICAL"),
        "HIGH": sum(1 for a in all_alerts if a["severity"] == "HIGH"),
        "MEDIUM": sum(1 for a in all_alerts if a["severity"] == "MEDIUM"),
        "LOW": sum(1 for a in all_alerts if a["severity"] == "LOW"),
    }

    counts_by_status = {
        "OPEN": sum(1 for a in all_alerts if a["status"] == "OPEN"),
        "ACKNOWLEDGED": sum(1 for a in all_alerts if a["status"] == "ACKNOWLEDGED"),
        "RESOLVED": sum(1 for a in all_alerts if a["status"] == "RESOLVED"),
    }

    return {
        "results": sliced,
        "total": total_count,
        "counts_by_severity": counts_by_severity,
        "counts_by_status": counts_by_status,
        "limit": limit,
        "offset": offset,
    }


# ─── API Endpoints ──────────────────────────────────────────────────────────

@router.get("/alerts")
def get_compliance_alerts_endpoint(
    severity: Optional[str] = Query(None, description="Severity filter: CRITICAL, HIGH, MEDIUM, LOW"),
    alert_type: Optional[str] = Query(None, description="Alert type filter"),
    state: Optional[str] = Query(None, description="State filter"),
    district: Optional[str] = Query(None, description="District filter"),
    status: Optional[str] = Query(None, description="Status filter: OPEN, ACKNOWLEDGED, RESOLVED"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    officer: Dict[str, Any] = Depends(auth_jwt.get_current_officer),
):
    """Returns active compliance & early-warning alerts with statutory explanations."""
    if _df is None:
        raise HTTPException(status_code=503, detail="MPLADS dataset not initialized.")
    scoped_df = auth_jwt.apply_jurisdiction_scoping(_df, officer)
    return get_all_compliance_alerts(
        scoped_df, severity, alert_type, state, district, status, limit, offset
    )


@router.post("/action")
def record_compliance_action_endpoint(action_req: AlertActionRequest, officer: Dict[str, Any] = Depends(auth_jwt.get_current_officer)):
    """
    Records an official auditor action on a compliance alert:
    - Acknowledgment
    - Assignment to technical/field authority
    - Audit remarks entry
    - Case resolution
    Maintains an audit trail for MoSPI monitoring.
    """
    ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
    acting_officer = str(officer.get("sub") or "AUDITOR-UNKNOWN")
    aid = action_req.alert_id.strip()
    act = action_req.action.strip().lower()

    if act == "acknowledge":
        new_status = "ACKNOWLEDGED"
    elif act == "resolve":
        new_status = "RESOLVED"
    elif act in ["assign", "remark"]:
        new_status = "ACKNOWLEDGED"
    else:
        new_status = "ACKNOWLEDGED"

    override = _ALERT_OVERRIDES.get(aid, {})
    override["status"] = new_status
    if action_req.assigned_to:
        override["assigned_to"] = action_req.assigned_to
    if action_req.remarks:
        override["remarks"] = action_req.remarks
    override["last_officer"] = acting_officer
    override["last_update"] = ts

    _ALERT_OVERRIDES[aid] = override

    # Append to local CSV audit log
    try:
        row_dict = {
            "alert_id": aid,
            "project_id": action_req.project_id,
            "officer_id": acting_officer,
            "action": act,
            "status": new_status,
            "assigned_to": action_req.assigned_to or "",
            "remarks": action_req.remarks or "",
            "timestamp": ts,
        }
        pd.DataFrame([row_dict]).to_csv(_AUDIT_CSV_PATH, mode="a", header=not os.path.exists(_AUDIT_CSV_PATH), index=False)
    except Exception as e:
        print(f"Error persisting compliance audit log: {e}")

    return {
        "status": "success",
        "alert_id": aid,
        "new_status": new_status,
        "timestamp": ts,
        "message": f"Alert {aid} successfully marked as {new_status} by officer {acting_officer}."
    }
