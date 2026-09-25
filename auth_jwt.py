"""
Server-Side JWT Authentication & Role-Based Scoping Module
MPLADS Risk Intelligence System (SIH26102, Team Neural Nova)

Enforces statutory role-based data access control on audit endpoints.
Generates cryptographically signed HMAC-SHA256 JWT tokens containing
the auditing officer's ID, assigned district jurisdiction, and security role.
"""

import os
import hmac
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

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
    "ADMIN-NEURAL-NOVA": {
        "password_hash": _sha256(os.getenv("ADMIN_PASSWORD", "admin@SIH2026")),
        "district": "ALL",
        "role": "national_admin",
    },
    "OFFICER-DELHI-01": {
        "password_hash": _sha256(os.getenv("OFFICER_PASSWORD", "officer@SIH2026")),
        "district": "DELHI",
        "role": "district_officer",
    },
    "OFFICER-MH-01": {
        "password_hash": _sha256(os.getenv("OFFICER_PASSWORD", "officer@SIH2026")),
        "district": "PUNE",
        "role": "district_officer",
    },
    # Demo catch-all officer (any district) for testing:
    "AUDITOR-VIGILANCE-01": {
        "password_hash": _sha256(os.getenv("OFFICER_PASSWORD", "officer@SIH2026")),
        "district": "ALL",
        "role": "national_admin",
    },
}


def _validate_credentials(officer_id: str, password: str) -> Optional[Dict]:
    """
    Validates officer_id + password against the credentials store.
    Returns the credential record (district, role) if valid, None if invalid.
    Constant-time comparison to prevent timing attacks.
    """
    cred = _DEFAULT_CREDENTIALS.get(officer_id.strip())
    if cred is None:
        # Run a dummy comparison to avoid timing-based officer_id enumeration
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
    district: Optional[str] = Field(
        default=None,
        description="Ignored — district is read from the credentials store server-side"
    )
    role: Optional[str] = Field(
        default=None,
        description="Ignored — role is read from the credentials store server-side"
    )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_hours: int
    officer: Dict[str, Any]


def create_access_token(
    officer_id: str,
    district: str = "ALL",
    role: str = "district_officer",
    expires_delta: Optional[timedelta] = None
) -> str:
    """Creates a cryptographically signed HMAC-SHA256 JWT token."""
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=DEFAULT_EXPIRY_HOURS))
    payload = {
        "sub": officer_id.strip(),
        "district": (district or "ALL").strip().upper(),
        "role": (role or "district_officer").strip().lower(),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=ALGORITHM)


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

    # ── Issue token with server-assigned district + role (not client-provided) ─
    district_clean = cred["district"]
    role_clean = cred["role"]

    token = create_access_token(
        officer_id=officer_id_clean,
        district=district_clean,
        role=role_clean
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in_hours": DEFAULT_EXPIRY_HOURS,
        "officer": {
            "officer_id": officer_id_clean,
            "district": district_clean,
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
        "role": officer.get("role"),
        "expires_at": datetime.fromtimestamp(officer.get("exp"), tz=timezone.utc).isoformat() if officer.get("exp") else None,
    }
