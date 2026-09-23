/**
 * ============================================================================
 * MPLADS Risk Intelligence System — Officer Authentication & Scoping
 * Team Neural Nova (SIH26102)
 *
 * Manages officer profile, genuine server-side JWT authentication,
 * jurisdiction scoping, and local audit logging.
 * ============================================================================
 */

const AUTH_API_URL = (typeof window !== 'undefined' && window.API_BASE_URL)
  || (typeof window !== 'undefined' && localStorage.getItem('MPLADS_API_URL'))
  || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:8000'
      : (typeof window !== 'undefined' && document.querySelector('meta[name="backend-url"]')?.content)
        || 'https://mplads-risk-backend.onrender.com');

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
      this.jwtToken = sessionStorage.getItem('mplads_officer_jwt_token') || localStorage.getItem('mplads_officer_jwt_token');
    }
    return this.jwtToken;
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
    const existing = this.getToken();
    if (existing) {
      // Validate with /auth/me
      try {
        const res = await fetch(`${AUTH_API_URL}/auth/me`, {
          headers: { 'Authorization': `Bearer ${existing}` }
        });
        if (res.ok) {
          const profile = await res.json();
          this.CURRENT_OFFICER.id = profile.officer_id;
          this.CURRENT_OFFICER.jurisdiction = profile.district;
          this.CURRENT_OFFICER.role = profile.role;
          return existing;
        }
      } catch (e) {
        // Fallback to fresh login
      }
    }

    return await this.login(
      this.CURRENT_OFFICER.id,
      this.CURRENT_OFFICER.jurisdiction,
      this.CURRENT_OFFICER.role
    );
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
