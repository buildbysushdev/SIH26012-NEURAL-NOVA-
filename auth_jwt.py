"""
Server-Side JWT Authentication & Role-Based Scoping Module
MPLADS Risk Intelligence System (SIH26102, Team Neural Nova)

Enforces statutory role-based data access control on audit endpoints.
Generates cryptographically signed HMAC-SHA256 JWT tokens containing
the auditing officer's ID, assigned district jurisdiction, and security role.
"""

import os
import json
import logging
import hmac
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

import jwt
import pandas as pd
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Officer Authentication"])

def _get_secret_key() -> str:
    key = os.getenv("JWT_SECRET_KEY")
    if key and not key.startswith("your-"):
        return key
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("JWT_SECRET_KEY=") and not line.startswith("#"):
                        val = line.split("=", 1)[1].strip()
                        if val and not val.startswith("your-"):
                            return val
        except Exception:
            pass
    return "mplads-neural-nova-vigilance-hmac-sha256-secret-key-2026-audit"


JWT_SECRET_KEY = _get_secret_key()
ALGORITHM = "HS256"
DEFAULT_EXPIRY_HOURS = 12


# ---------------------------------------------------------------------------
# Officer Credentials Store
# ---------------------------------------------------------------------------
# Credentials are SHA-256 hashed passwords stored here.
# In production, replace with a proper database. For SIH hackathon, this is
# a hardcoded store that can be overridden by environment variables.
#
# Format: officer_id -> {"password_hash": sha256(password), "district": str, "role": str}
#
# Default demo credentials:
#   ADMIN-NEURAL-NOVA   / admin@SIH2026    -> national_admin,  ALL districts
#   OFFICER-DELHI-01    / officer@SIH2026  -> district_officer, DELHI
#   OFFICER-MH-01       / officer@SIH2026  -> district_officer, PUNE
# ---------------------------------------------------------------------------

def _sha256(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


_DEFAULT_CREDENTIALS: Dict[str, Dict] = {
    # 1. MoSPI / National Admin (Nationwide All-Jurisdiction Scope)
    "ADMIN-NEURAL-NOVA": {
        "password_hash": _sha256(os.getenv("ADMIN_PASSWORD", "admin@SIH2026")),
        "district": "ALL",
        "state": "ALL",
        "constituency": "ALL",
        "role": "national_admin",
    },
    "AUDITOR-VIGILANCE-01": {
        "password_hash": _sha256(os.getenv("OFFICER_PASSWORD", "officer@SIH2026")),
        "district": "ALL",
        "state": "ALL",
        "constituency": "ALL",
        "role": "national_admin",
    },

    # 2. State Nodal Authority (State-Scoped Access)
    "STATE-MH-NODAL": {
        "password_hash": _sha256(os.getenv("STATE_PASSWORD", "state@SIH2026")),
        "district": "ALL",
        "state": "MAHARASHTRA",
        "constituency": "ALL",
        "role": "state_nodal",
    },
    "STATE-KA-NODAL": {
        "password_hash": _sha256(os.getenv("STATE_PASSWORD", "state@SIH2026")),
        "district": "ALL",
        "state": "KARNATAKA",
        "constituency": "ALL",
        "role": "state_nodal",
    },
    "STATE-JH-NODAL": {
        "password_hash": _sha256(os.getenv("STATE_PASSWORD", "state@SIH2026")),
        "district": "ALL",
        "state": "JHARKHAND",
        "constituency": "ALL",
        "role": "state_nodal",
    },

    # 3. District Authority / District Officer (District-Scoped Access)
    "OFFICER-DELHI-01": {
        "password_hash": _sha256(os.getenv("OFFICER_PASSWORD", "officer@SIH2026")),
        "district": "DELHI",
        "state": "DELHI",
        "constituency": "DELHI",
        "role": "district_officer",
    },
    "OFFICER-MH-01": {
        "password_hash": _sha256(os.getenv("OFFICER_PASSWORD", "officer@SIH2026")),
        "district": "PUNE",
        "state": "MAHARASHTRA",
        "constituency": "PUNE",
        "role": "district_officer",
    },
    "OFFICER-JH-01": {
        "password_hash": _sha256(os.getenv("OFFICER_PASSWORD", "officer@SIH2026")),
        "district": "GIRIDIH",
        "state": "JHARKHAND",
        "constituency": "GIRIDIH",
        "role": "district_officer",
    },

    # 4. MP / Constituency Dashboard (Constituency-Scoped Access)
    "MP-DHARWAD-01": {
        "password_hash": _sha256(os.getenv("MP_PASSWORD", "mp@SIH2026")),
        "district": "DHARWAD",
        "state": "KARNATAKA",
        "constituency": "DHARWAD",
        "role": "mp_dashboard",
    },
    "MP-GIRIDIH-01": {
        "password_hash": _sha256(os.getenv("MP_PASSWORD", "mp@SIH2026")),
        "district": "GIRIDIH",
        "state": "JHARKHAND",
        "constituency": "GIRIDIH",
        "role": "mp_dashboard",
    },
}


_DISABLED_FILE = os.path.join(os.path.dirname(__file__), "disabled_officers.txt")
_CUSTOM_OFFICERS_FILE = os.path.join(os.path.dirname(__file__), "custom_officers.json")


def _load_custom_officers() -> Dict[str, Dict]:
    if not os.path.exists(_CUSTOM_OFFICERS_FILE):
        return {}
    try:
        with open(_CUSTOM_OFFICERS_FILE, "r", encoding="utf-8") as handle:
            data = json.load(handle)
            return data if isinstance(data, dict) else {}
    except Exception as exc:
        logger.warning(f"Could not load custom officers: {exc}")
        return {}


def _save_custom_officers(officers: Dict[str, Dict]) -> None:
    try:
        with open(_CUSTOM_OFFICERS_FILE, "w", encoding="utf-8") as handle:
            json.dump(officers, handle, indent=2)
    except Exception as exc:
        logger.error(f"Failed to persist custom officers: {exc}")


def get_all_officers() -> Dict[str, Dict]:
    all_officers = dict(_DEFAULT_CREDENTIALS)
    all_officers.update(_load_custom_officers())
    return all_officers


def register_officer(
    officer_id: str,
    name: str,
    email: str,
    password: str,
    state: str,
    district: str = "ALL",
    constituency: str = "ALL",
    role: str = "district_officer"
) -> Dict[str, Any]:
    officer_id_clean = officer_id.strip().upper()
    state_clean = state.strip().upper() if state else "ALL"
    district_clean = district.strip().upper() if district else "ALL"
    constituency_clean = constituency.strip().upper() if constituency else "ALL"
    role_clean = role.strip().lower()

    if not officer_id_clean:
        raise ValueError("Officer ID is required.")
    if not state_clean or state_clean == "ALL":
        raise ValueError("Selecting an assigned State is mandatory.")

    custom = _load_custom_officers()
    record = {
        "name": name.strip(),
        "email": email.strip() or f"{officer_id_clean.lower()}@mplads.gov.in",
        "password_hash": _sha256(password or "officer@SIH2026"),
        "district": district_clean,
        "state": state_clean,
        "constituency": constituency_clean,
        "role": role_clean,
    }
    custom[officer_id_clean] = record
    _save_custom_officers(custom)
    return {
        "officer_id": officer_id_clean,
        "name": record["name"],
        "email": record["email"],
        "district": district_clean,
        "state": state_clean,
        "constituency": constituency_clean,
        "role": role_clean,
        "status": "Active",
    }


def get_disabled_officers() -> set[str]:
    try:
        with open(_DISABLED_FILE, "r", encoding="utf-8") as handle:
            return {line.strip() for line in handle if line.strip()}
    except FileNotFoundError:
        return set()


def set_officer_active(officer_id: str, active: bool) -> None:
    disabled = get_disabled_officers()
    if active:
        disabled.discard(officer_id)
    else:
        disabled.add(officer_id)
    with open(_DISABLED_FILE, "w", encoding="utf-8") as handle:
        handle.write("\n".join(sorted(disabled)))


def list_officer_profiles() -> list[Dict[str, Any]]:
    disabled = get_disabled_officers()
    all_officers = get_all_officers()
    return [
        {
            "officer_id": officer_id,
            "name": value.get("name") or officer_id,
            "email": value.get("email") or f"{officer_id.lower()}@mplads.gov.in",
            "district": value.get("district"),
            "state": value.get("state"),
            "constituency": value.get("constituency"),
            "role": value.get("role"),
            "status": "Inactive" if officer_id in disabled else "Active"
        }
        for officer_id, value in all_officers.items()
    ]


def _validate_credentials(officer_id: str, password: str) -> Optional[Dict]:
    """
    Validates officer_id + password against the credentials store.
    Returns the credential record (district, state, constituency, role) if valid, None if invalid.
    Constant-time comparison to prevent timing attacks.
    """
    clean_id = officer_id.strip().upper()
    if clean_id in get_disabled_officers():
        return None
    all_officers = get_all_officers()
    cred = all_officers.get(clean_id)
    if cred is None:
        for k, v in all_officers.items():
            if k.upper() == clean_id:
                cred = v
                break
    if cred is None:
        hmac.compare_digest(_sha256("dummy"), _sha256("notmatch"))
        return None
    given_hash = _sha256(password)
    if not hmac.compare_digest(given_hash, cred["password_hash"]):
        return None
    return cred


class TokenRequest(BaseModel):
    officer_id: str = Field(
        default="AUDITOR-VIGILANCE-01",
        description="Auditing officer badge ID"
    )
    password: str = Field(
        default="",
        description="Officer password (validated server-side via SHA-256 comparison)"
    )
    district: Optional[str] = Field(default=None, description="Ignored — set server-side")
    role: Optional[str] = Field(default=None, description="Ignored — set server-side")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_hours: int
    officer: Dict[str, Any]


def create_access_token(
    officer_id: str,
    district: str = "ALL",
    state: str = "ALL",
    constituency: str = "ALL",
    role: str = "district_officer",
    expires_delta: Optional[timedelta] = None
) -> str:
    """Creates a cryptographically signed HMAC-SHA256 JWT token with role & jurisdiction scope."""
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=DEFAULT_EXPIRY_HOURS))
    payload = {
        "sub": officer_id.strip(),
        "district": (district or "ALL").strip().upper(),
        "state": (state or "ALL").strip().upper(),
        "constituency": (constituency or "ALL").strip().upper(),
        "role": (role or "district_officer").strip().lower(),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=ALGORITHM)


def apply_jurisdiction_scoping(df: pd.DataFrame, officer: Dict[str, Any]) -> pd.DataFrame:
    """
    Statutory Server-Side Jurisdiction Access Scoping:
    - national_admin: Complete nationwide access across all works.
    - state_nodal: Scoped exclusively to assigned state.
    - district_officer: Scoped exclusively to assigned district / IDA.
    - mp_dashboard: Scoped exclusively to assigned constituency.
    """
    role = str(officer.get("role") or "").lower()
    if role in ["national_admin", "superadmin"] or officer.get("district") == "ALL" and officer.get("state") == "ALL":
        return df

    if role == "state_nodal":
        st = str(officer.get("state") or "").strip().lower()
        if st and st != "all":
            return df[df["state"].astype(str).str.lower() == st]

    if role == "district_officer":
        dist = str(officer.get("district") or "").strip().lower()
        if dist and dist != "all":
            dist_mask = (
                df["constituency"].astype(str).str.lower().str.contains(dist, na=False)
                | df["ida"].astype(str).str.lower().str.contains(dist, na=False)
            )
            return df[dist_mask]

    if role == "mp_dashboard":
        c = str(officer.get("constituency") or "").strip().lower()
        if c and c != "all":
            return df[df["constituency"].astype(str).str.lower() == c]

    return df


def get_current_officer(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """
    FastAPI security dependency.
    Extracts and validates the Bearer JWT token from the Authorization header.
    Raises HTTP 401 if token is missing, expired, or cryptographically tampered.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Auditor authentication required. Missing 'Authorization: Bearer <token>' header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1]
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Auditor session expired. Please re-authenticate.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cryptographic verification failed. Tampered or invalid token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_optional_current_officer(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    """Return a verified identity when supplied; allow anonymous public reads."""
    if not authorization:
        return None
    return get_current_officer(authorization)


@router.post("/auth/token", response_model=TokenResponse)
@router.post("/auth/login", response_model=TokenResponse)
def login_for_officer_token(req: TokenRequest):
    """
    Issues a cryptographically signed JWT token for an officer session.
    Validates officer credentials (ID + password) before issuing the token.
    District and role are read server-side from the credentials store —
    the client cannot self-assign a district or role.
    """
    officer_id_clean = (req.officer_id or "").strip()
    password = req.password or ""

    if not officer_id_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="officer_id is required."
        )

    # ── Validate credentials ──────────────────────────────────────────────────
    cred = _validate_credentials(officer_id_clean, password)
    if cred is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid officer ID or password. Access denied.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ── Issue token with server-assigned district + state + constituency + role ─
    district_clean = cred.get("district", "ALL")
    state_clean = cred.get("state", "ALL")
    constituency_clean = cred.get("constituency", "ALL")
    role_clean = cred.get("role", "district_officer")

    token = create_access_token(
        officer_id=officer_id_clean,
        district=district_clean,
        state=state_clean,
        constituency=constituency_clean,
        role=role_clean
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in_hours": DEFAULT_EXPIRY_HOURS,
        "officer": {
            "officer_id": officer_id_clean,
            "district": district_clean,
            "state": state_clean,
            "constituency": constituency_clean,
            "role": role_clean,
            "issued_at": datetime.now(timezone.utc).isoformat(),
        }
    }


@router.get("/auth/me")
def get_current_officer_profile(officer: Dict[str, Any] = Depends(get_current_officer)):
    """Validates the active Bearer token and returns authenticated officer identity."""
    return {
        "status": "authenticated",
        "officer_id": officer.get("sub"),
        "district": officer.get("district"),
        "state": officer.get("state"),
        "constituency": officer.get("constituency"),
        "role": officer.get("role"),
        "expires_at": datetime.fromtimestamp(officer.get("exp"), tz=timezone.utc).isoformat() if officer.get("exp") else None,
    }
