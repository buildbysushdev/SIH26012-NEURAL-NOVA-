/**
 * ============================================================================
 * MPLADS Risk Intelligence System — Officer Authentication & Scoping
 * Team Neural Nova (SIH26102)
 *
 * Manages officer profile, genuine server-side JWT authentication,
 * jurisdiction scoping, and local audit logging.
 *
 * LOGIN FLOW:
 *   1. User visits frontend/login/index.html
 *   2. Enters Officer ID + Password → backend /auth/login validates credentials
 *   3. JWT + officer profile stored in localStorage by login page
 *   4. User redirected to officer-dashboard/index.html
 *   5. This module reads the token + profile from localStorage
 *   6. If token missing or expired → redirects back to login page
 * ============================================================================
 */

const AUTH_API_URL = (typeof window !== 'undefined' && window.API_BASE_URL)
  || (typeof window !== 'undefined' && localStorage.getItem('MPLADS_API_URL'))
  || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:8000'
      : (typeof window !== 'undefined' && document.querySelector('meta[name="backend-url"]')?.content)
        || 'https://mplads-risk-backend.onrender.com');

// ── Login page path (relative from officer-dashboard/) ──────────────────────
const LOGIN_PAGE = '../login/index.html';

export const OfficerAuth = {
  CURRENT_OFFICER: {
    id: 'AUDITOR-VIGILANCE-01',
    name: 'Inspector S. Verma',
    designation: 'District Vigilance Officer',
    department: 'MoSPI / DISHA Inspection Wing',
    jurisdiction: 'ALL',
    role: 'national_admin',
    sessionStarted: new Date().toISOString()
  },

  jwtToken: null,

  getOfficerProfile() {
    return this.CURRENT_OFFICER;
  },

  getToken() {
    if (!this.jwtToken) {
      // Try the token stored by the login page first
      this.jwtToken = localStorage.getItem('mplads_token')
        || sessionStorage.getItem('mplads_officer_jwt_token')
        || localStorage.getItem('mplads_officer_jwt_token');
    }
    return this.jwtToken;
  },

  /**
   * Checks if an existing JWT is still valid (not expired).
   * Returns true if valid, false if missing or expired.
   */
  isTokenValid(token) {
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      return payload.exp && payload.exp > now;
    } catch (_) {
      return false;
    }
  },

  /**
   * Reads officer profile stored by the login page.
   * Merges into CURRENT_OFFICER.
   */
  loadStoredProfile() {
    try {
      const stored = localStorage.getItem('mplads_officer');
      if (stored) {
        const p = JSON.parse(stored);
        if (p.officer_id) this.CURRENT_OFFICER.id = p.officer_id;
        if (p.district)   this.CURRENT_OFFICER.jurisdiction = p.district;
        if (p.role)       this.CURRENT_OFFICER.role = p.role;
      }
    } catch (_) {}
  },

  /**
   * Redirects to the login page, clearing any stale session.
   */
  redirectToLogin(reason = '') {
    if (reason) console.warn('[Auth] Redirecting to login:', reason);
    localStorage.removeItem('mplads_token');
    localStorage.removeItem('mplads_officer');
    localStorage.removeItem('mplads_officer_jwt_token');
    sessionStorage.removeItem('mplads_officer_jwt_token');
    window.location.href = LOGIN_PAGE;
  },

  /**
   * Logout — clears session and redirects to login.
   */
  logout() {
    this.redirectToLogin('User logged out');
  },

  async login(officerId = 'AUDITOR-VIGILANCE-01', district = 'ALL', role = 'national_admin') {
    try {
      const res = await fetch(`${AUTH_API_URL}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officer_id: officerId,
          district: district || 'ALL',
          role: role || 'district_officer'
        })
      });

      if (!res.ok) {
        throw new Error(`Authentication failed (${res.status})`);
      }

      const data = await res.json();
      this.jwtToken = data.access_token;
      sessionStorage.setItem('mplads_officer_jwt_token', this.jwtToken);
      localStorage.setItem('mplads_officer_jwt_token', this.jwtToken);

      this.CURRENT_OFFICER.id = data.officer.officer_id;
      this.CURRENT_OFFICER.jurisdiction = data.officer.district;
      this.CURRENT_OFFICER.role = data.officer.role;

      return this.jwtToken;
    } catch (err) {
      console.warn('Backend authentication error:', err);
      return null;
    }
  },

  async ensureAuthenticated() {
    // 1. Load officer profile set by login page
    this.loadStoredProfile();

    const token = this.getToken();

    // 2. If no token at all → redirect to login
    if (!token) {
      this.redirectToLogin('No session token found');
      return null;
    }

    // 3. Check if token is expired client-side
    if (!this.isTokenValid(token)) {
      this.redirectToLogin('Session expired — please log in again');
      return null;
    }

    // 4. Validate with /auth/me server-side
    try {
      const res = await fetch(`${AUTH_API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const profile = await res.json();
        this.CURRENT_OFFICER.id = profile.officer_id;
        this.CURRENT_OFFICER.jurisdiction = profile.district;
        this.CURRENT_OFFICER.role = profile.role;
        return token;
      } else if (res.status === 401) {
        // Token was rejected server-side
        this.redirectToLogin('Session token rejected by server');
        return null;
      }
      // Non-auth server error — allow access with existing token (offline resilience)
      return token;
    } catch (e) {
      // Network error — allow access with the existing valid token (offline resilience)
      console.warn('[Auth] Could not reach /auth/me, using cached token:', e);
      return token;
    }
  },

  async setJurisdiction(districtName) {
    const d = districtName || 'ALL';
    this.CURRENT_OFFICER.jurisdiction = d;
    this.CURRENT_OFFICER.role = d === 'ALL' ? 'national_admin' : 'district_officer';
    localStorage.setItem('mplads_officer_jurisdiction', d);

    // Acquire a new cryptographically signed JWT token with the new district scope
    return await this.login(this.CURRENT_OFFICER.id, d, this.CURRENT_OFFICER.role);
  },

  getJurisdiction() {
    return localStorage.getItem('mplads_officer_jurisdiction') || this.CURRENT_OFFICER.jurisdiction;
  },

  /**
   * Logs an auditor decision locally for accountability.
   * @param {string} action
   * @param {string} workId
   * @param {Object} [meta]
   */
  logAuditAction(action, workId, meta = {}) {
    const logEntry = {
      officerId: this.CURRENT_OFFICER.id,
      action,
      workId,
      timestamp: new Date().toISOString(),
      meta
    };
    try {
      const logs = JSON.parse(localStorage.getItem('mplads_officer_audit_logs') || '[]');
      logs.unshift(logEntry);
      if (logs.length > 100) logs.pop();
      localStorage.setItem('mplads_officer_audit_logs', JSON.stringify(logs));
    } catch (e) {
      console.warn('Could not persist local audit log:', e);
    }
  }
};
