"""
Server-Side JWT Authentication & Role-Based Scoping Module
MPLADS Risk Intelligence System (SIH26102, Team Neural Nova)

Enforces statutory role-based data access control on audit endpoints.
Generates cryptographically signed HMAC-SHA256 JWT tokens containing
the auditing officer's ID, assigned district jurisdiction, and security role.
"""

import os
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


class TokenRequest(BaseModel):
    officer_id: str = Field(
        default="AUDITOR-VIGILANCE-01",
        description="Auditing officer badge ID"
    )
    district: Optional[str] = Field(
        default="ALL",
        description="Assigned district jurisdiction (e.g. 'VAISHALI', 'PARBHANI', or 'ALL')"
    )
    role: Optional[str] = Field(
        default="district_officer",
        description="Auditor role: 'district_officer' | 'national_admin'"
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
    Sets officer identity and statutory jurisdiction boundaries.
    """
    district_clean = (req.district or "ALL").strip().upper()
    role_clean = (req.role or "district_officer").strip().lower()
    officer_id_clean = (req.officer_id or "AUDITOR-DEFAULT").strip()

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
