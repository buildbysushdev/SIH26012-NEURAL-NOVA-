"""
Fund Utilization & Payment Tracking Service
MPLADS Risk Intelligence System (SIH26102, Team Neural Nova)

Computes statutory MPLADS fund metrics, expenditure tracking, remaining balance,
utilization percentages, and flags potential cost overruns for MoSPI auditors.

Formulas enforced:
  Remaining Balance = Funds Released - Total Expenditure
  Fund Utilization % = (Total Expenditure / Funds Released) * 100
"""

import math
import re
from typing import Dict, Any, List, Optional
import pandas as pd
from fastapi import APIRouter, Query, Depends, HTTPException

router = APIRouter(prefix="/api/fund-tracking", tags=["Fund & Payment Tracking"])

# In-memory reference to main scored dataframe
_df: Optional[pd.DataFrame] = None


def set_fund_dataframe(df: pd.DataFrame):
    """Sets the shared dataframe reference from main.py startup."""
    global _df
    _df = df


def _extract_fy(work_id: Any, sanction_date: Any) -> str:
    """Extracts Financial Year e.g. '2024-2025' from work_id or sanction_date."""
    w_str = str(work_id or "")
    m = re.search(r"(\d{4}-\d{4})", w_str)
    if m:
        return m.group(1)
    
    d_str = str(sanction_date or "")
    if len(d_str) >= 4 and d_str[:4].isdigit():
        y = int(d_str[:4])
        # Indian FY runs April to March. If month >= 4, FY is Y-(Y+1), else (Y-1)-Y
        try:
            m_num = int(d_str[5:7]) if len(d_str) >= 7 else 4
            if m_num >= 4:
                return f"{y}-{y+1}"
            else:
                return f"{y-1}-{y}"
        except Exception:
            return f"{y}-{y+1}"
    return "2024-2025"


def _sanitize_float(val: Any, default: float = 0.0) -> float:
    """Safely converts value to float, guarding against NaN and Infinity."""
    if val is None or pd.isna(val):
        return default
    try:
        f = float(val)
        return default if (math.isnan(f) or math.isinf(f)) else f
    except (ValueError, TypeError):
        return default


def filter_fund_dataframe(
    df: pd.DataFrame,
    state: Optional[str] = None,
    district: Optional[str] = None,
    constituency: Optional[str] = None,
    financial_year: Optional[str] = None,
    payment_status: Optional[str] = None,
) -> pd.DataFrame:
    """Applies multi-dimensional filters on the MPLADS dataset."""
    filtered = df

    if state and state.strip() and state.strip().lower() != "all":
        st_clean = state.strip().lower()
        filtered = filtered[filtered["state"].astype(str).str.lower() == st_clean]

    if district and district.strip() and district.strip().lower() != "all":
        dist_clean = district.strip().lower()
        dist_mask = (
            filtered["constituency"].astype(str).str.lower().str.contains(dist_clean, na=False)
            | filtered["ida"].astype(str).str.lower().str.contains(dist_clean, na=False)
        )
        filtered = filtered[dist_mask]

    if constituency and constituency.strip() and constituency.strip().lower() != "all":
        c_clean = constituency.strip().lower()
        filtered = filtered[filtered["constituency"].astype(str).str.lower() == c_clean]

    if payment_status and payment_status.strip() and payment_status.strip().lower() != "all":
        ps_clean = payment_status.strip().lower()
        if ps_clean in ["success", "payment success"]:
            filtered = filtered[filtered["latest_payment_status"].astype(str).str.lower() == "payment success"]
        elif ps_clean in ["in_progress", "payment in-progress"]:
            filtered = filtered[filtered["latest_payment_status"].astype(str).str.lower() == "payment in-progress"]
        elif ps_clean in ["pending", "unrecorded"]:
            filtered = filtered[
                filtered["latest_payment_status"].isna()
                | (filtered["latest_payment_status"].astype(str).str.lower().isin(["nan", "none", "pending"]))
            ]

    if financial_year and financial_year.strip() and financial_year.strip().lower() != "all":
        fy_clean = financial_year.strip()
        filtered = filtered[filtered["work_id"].astype(str).str.contains(fy_clean, na=False)]

    return filtered


def calculate_fund_summary(
    df: pd.DataFrame,
    state: Optional[str] = None,
    district: Optional[str] = None,
    constituency: Optional[str] = None,
    financial_year: Optional[str] = None,
    payment_status: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Computes aggregated MPLADS fund utilization metrics:
    - Total Sanctioned Amount
    - Funds Released (total_fund_disbursed)
    - Total Expenditure (amount_disbursed_completed)
    - Remaining Balance = Funds Released - Total Expenditure
    - Fund Utilization % = (Total Expenditure / Funds Released) * 100
    - Pending Payments Count & Amount
    - Cost Overruns
    """
    sub_df = filter_fund_dataframe(df, state, district, constituency, financial_year, payment_status)
    total_projects = len(sub_df)

    if total_projects == 0:
        return {
            "total_projects": 0,
            "total_sanctioned": 0.0,
            "total_released": 0.0,
            "total_expenditure": 0.0,
            "remaining_balance": 0.0,
            "fund_utilization_pct": 0.0,
            "pending_payments_count": 0,
            "pending_payments_amount": 0.0,
            "successful_payments_count": 0,
            "cost_overruns_count": 0,
            "unusual_expenditure_count": 0,
            "top_states": [],
            "category_summary": [],
        }

    sanction_s = sub_df["sanction_amount"].fillna(0.0)
    released_s = sub_df["total_fund_disbursed"].fillna(0.0)
    expenditure_s = sub_df["amount_disbursed_completed"].fillna(0.0)

    total_sanctioned = float(sanction_s.sum())
    total_released = float(released_s.sum())
    total_expenditure = float(expenditure_s.sum())

    # Remaining Balance = Funds Released - Total Expenditure
    remaining_balance = max(0.0, total_released - total_expenditure)

    # Fund Utilization % = (Total Expenditure / Funds Released) * 100
    if total_released > 0:
        fund_utilization_pct = round((total_expenditure / total_released) * 100.0, 2)
    else:
        fund_utilization_pct = 0.0

    # Payment Status breakdown
    pay_status_lower = sub_df["latest_payment_status"].astype(str).str.lower()
    success_mask = pay_status_lower == "payment success"
    in_prog_mask = pay_status_lower == "payment in-progress"
    pending_mask = sub_df["latest_payment_status"].isna() | pay_status_lower.isin(["nan", "none", "pending", "unrecorded"])

    successful_payments_count = int(success_mask.sum())
    pending_payments_count = int((in_prog_mask | pending_mask).sum())
    
    # Estimate pending payment amount (sanctioned minus disbursed completed)
    pending_amount_series = (sanction_s - expenditure_s).clip(lower=0.0)
    pending_payments_amount = float(pending_amount_series[in_prog_mask | pending_mask].sum())

    # Cost Overruns: expenditure > sanction amount
    overrun_mask = (expenditure_s > sanction_s) & (sanction_s > 0)
    cost_overruns_count = int(overrun_mask.sum())

    # Unusual Expenditure Pattern: flagged by Isolation Forest (cost_risk_score > 70 or cost_zscore > 3.0)
    if "cost_risk_score" in sub_df.columns:
        unusual_mask = sub_df["cost_risk_score"].fillna(0.0) >= 70.0
    elif "cost_zscore" in sub_df.columns:
        unusual_mask = sub_df["cost_zscore"].fillna(0.0) >= 3.0
    else:
        unusual_mask = overrun_mask
    unusual_expenditure_count = int(unusual_mask.sum())

    # Top states breakdown
    top_states = []
    if "state" in sub_df.columns:
        state_grp = sub_df.groupby("state").agg({
            "sanction_amount": "sum",
            "total_fund_disbursed": "sum",
            "amount_disbursed_completed": "sum",
            "work_id": "count"
        }).reset_index()
        state_grp.columns = ["state", "sanctioned", "released", "expenditure", "projects"]
        state_grp["utilization_pct"] = (state_grp["expenditure"] / state_grp["released"].replace(0, 1) * 100).round(1)
        state_grp = state_grp.sort_values("sanctioned", ascending=False).head(10)
        top_states = state_grp.to_dict(orient="records")

    # Category breakdown
    category_summary = []
    if "work_category" in sub_df.columns:
        cat_grp = sub_df.groupby("work_category").agg({
            "sanction_amount": "sum",
            "amount_disbursed_completed": "sum",
            "work_id": "count"
        }).reset_index().sort_values("sanction_amount", ascending=False)
        cat_grp.columns = ["category", "sanctioned", "expenditure", "count"]
        category_summary = cat_grp.to_dict(orient="records")

    return {
        "total_projects": total_projects,
        "total_sanctioned": round(total_sanctioned, 2),
        "total_released": round(total_released, 2),
        "total_expenditure": round(total_expenditure, 2),
        "remaining_balance": round(remaining_balance, 2),
        "fund_utilization_pct": fund_utilization_pct,
        "pending_payments_count": pending_payments_count,
        "pending_payments_amount": round(pending_payments_amount, 2),
        "successful_payments_count": successful_payments_count,
        "cost_overruns_count": cost_overruns_count,
        "unusual_expenditure_count": unusual_expenditure_count,
        "top_states": top_states,
        "category_summary": category_summary,
    }


def get_financial_projects_page(
    df: pd.DataFrame,
    state: Optional[str] = None,
    district: Optional[str] = None,
    constituency: Optional[str] = None,
    financial_year: Optional[str] = None,
    payment_status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    sort_by: str = "sanction_amount",
    sort_dir: str = "desc"
) -> Dict[str, Any]:
    """
    Returns paginated, searchable, sortable project financial records with:
    Project ID, Name, Constituency, District, Sanctioned, Released, Expenditure,
    Remaining Balance, Payment Status, Cost Overrun indicator, and AI Risk Score.
    """
    sub_df = filter_fund_dataframe(df, state, district, constituency, financial_year, payment_status)

    if search and search.strip():
        q = search.strip().lower()
        q_mask = (
            sub_df["work_id"].astype(str).str.lower().str.contains(q, na=False)
            | sub_df["work_description"].astype(str).str.lower().str.contains(q, na=False)
            | sub_df["constituency"].astype(str).str.lower().str.contains(q, na=False)
            | sub_df["vendor_name"].astype(str).str.lower().str.contains(q, na=False)
        )
        sub_df = sub_df[q_mask]

    total_count = len(sub_df)
    if total_count == 0:
        return {
            "results": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 0
        }

    # Sorting
    ascending = (sort_dir.lower() == "asc")
    sort_column = sort_by if sort_by in sub_df.columns else "sanction_amount"
    try:
        sub_df = sub_df.sort_values(sort_column, ascending=ascending, na_position="last")
    except Exception:
        pass

    # Pagination slice
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    sliced = sub_df.iloc[start_idx:end_idx].copy()

    records = []
    for _, row in sliced.iterrows():
        sanc = _sanitize_float(row.get("sanction_amount"), 0.0)
        rel = _sanitize_float(row.get("total_fund_disbursed"), 0.0)
        exp = _sanitize_float(row.get("amount_disbursed_completed"), 0.0)
        
        # Statutory calculations
        bal = max(0.0, rel - exp)
        util_pct = round((exp / rel * 100.0), 1) if rel > 0 else 0.0
        is_overrun = (exp > sanc) and (sanc > 0)
        overrun_amt = max(0.0, exp - sanc)

        # Payment status cleanup
        raw_ps = str(row.get("latest_payment_status") or "").strip()
        if not raw_ps or raw_ps.lower() in ["nan", "none"]:
            pay_stat = "Pending Approval"
        else:
            pay_stat = raw_ps

        records.append({
            "work_id": str(row.get("work_id") or ""),
            "work_description": str(row.get("work_description") or "MPLADS Project"),
            "work_category": str(row.get("work_category") or "General"),
            "state": str(row.get("state") or ""),
            "district": str(row.get("constituency") or row.get("ida") or ""),
            "constituency": str(row.get("constituency") or ""),
            "mp_name": str(row.get("mp_name") or ""),
            "sanction_amount": sanc,
            "released_amount": rel,
            "expenditure": exp,
            "remaining_balance": bal,
            "fund_utilization_pct": util_pct,
            "payment_status": pay_stat,
            "latest_expenditure_date": str(row.get("latest_expenditure_date") or row.get("sanction_date") or ""),
            "sanction_date": str(row.get("sanction_date") or ""),
            "vendor_name": str(row.get("vendor_name") or "Authorized Agency"),
            "num_payments": int(_sanitize_float(row.get("num_payments"), 0)),
            "cost_risk_score": _sanitize_float(row.get("cost_risk_score"), 0.0),
            "nlp_similarity_score": _sanitize_float(row.get("nlp_similarity_score"), 0.0),
            "risk_score": _sanitize_float(row.get("risk_score"), 0.0),
            "is_cost_overrun": is_overrun,
            "cost_overrun_amount": overrun_amt,
            "unusual_expenditure": bool(row.get("cost_risk_score", 0) > 70 or row.get("cost_zscore", 0) > 3.0),
        })

    total_pages = math.ceil(total_count / page_size) if page_size > 0 else 1

    return {
        "results": records,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


# ─── API Routes ─────────────────────────────────────────────────────────────

@router.get("/summary")
def get_fund_summary_endpoint(
    state: Optional[str] = Query(None, description="State filter"),
    district: Optional[str] = Query(None, description="District / Constituency filter"),
    constituency: Optional[str] = Query(None, description="Constituency filter"),
    financial_year: Optional[str] = Query(None, description="Financial Year filter e.g. 2024-2025"),
    payment_status: Optional[str] = Query(None, description="Payment status e.g. success, pending"),
):
    """Returns top-level MoSPI fund utilization KPIs, payment states, and remaining balance."""
    if _df is None:
        raise HTTPException(status_code=503, detail="MPLADS dataset not initialized.")
    return calculate_fund_summary(_df, state, district, constituency, financial_year, payment_status)


@router.get("/projects")
def get_fund_projects_endpoint(
    state: Optional[str] = Query(None, description="State filter"),
    district: Optional[str] = Query(None, description="District filter"),
    constituency: Optional[str] = Query(None, description="Constituency filter"),
    financial_year: Optional[str] = Query(None, description="Financial Year filter"),
    payment_status: Optional[str] = Query(None, description="Payment status filter"),
    search: Optional[str] = Query(None, description="Search keyword"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Records per page"),
    sort_by: str = Query("sanction_amount", description="Sort field"),
    sort_dir: str = Query("desc", description="Sort direction ('asc' or 'desc')"),
):
    """Returns paginated, filterable financial tracking table for individual works."""
    if _df is None:
        raise HTTPException(status_code=503, detail="MPLADS dataset not initialized.")
    return get_financial_projects_page(
        _df, state, district, constituency, financial_year, payment_status,
        search, page, page_size, sort_by, sort_dir
    )


@router.get("/filters")
def get_fund_filters_endpoint():
    """Returns available dropdown filter options populated directly from real government data."""
    if _df is None:
        raise HTTPException(status_code=503, detail="MPLADS dataset not initialized.")
    states = sorted([str(s) for s in _df["state"].dropna().unique() if str(s).strip()])
    districts = sorted([str(d) for d in _df["constituency"].dropna().unique() if str(d).strip()])
    return {
        "states": states,
        "districts": districts,
        "payment_statuses": ["All", "Payment Success", "Payment In-Progress", "Pending Approval"],
        "financial_years": ["All", "2024-2025", "2025-2026", "2026-2027"],
    }
