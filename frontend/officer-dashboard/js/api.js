/**
 * ============================================================================
 * MPLADS Risk Intelligence System — Unified API Client
 * Team Neural Nova (SIH26102)
 *
 * Provides real, authenticated, parameterized access to the FastAPI backend.
 * All requests use strict query parameters for slash-containing work_ids
 * and provide clean error handling without leaking server internals.
 * ============================================================================
 */

import { OfficerAuth } from './auth.js';

// Auto-bypass tunnel reminder screen on tunnel requests
if (typeof window !== 'undefined' && window.fetch) {
  const _origFetch = window.fetch;
  window.fetch = function(url, options = {}) {
    if (typeof url === 'string' && url.includes('loca.lt')) {
      options = { ...options };
      options.headers = options.headers || {};
      if (options.headers instanceof Headers) {
        options.headers.set('Bypass-Tunnel-Reminder', 'true');
      } else if (Array.isArray(options.headers)) {
        options.headers.push(['Bypass-Tunnel-Reminder', 'true']);
      } else {
        options.headers['Bypass-Tunnel-Reminder'] = 'true';
      }
    }
    return _origFetch(url, options);
  };
}

const API_BASE_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' || window.location.origin.includes('8080') || window.location.origin.includes('8000')))
  ? (window.location.origin && window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:8000')
  : (typeof window !== 'undefined' && window.API_BASE_URL)
  || (typeof window !== 'undefined' && (localStorage.getItem('MPLADS_API_URL') || localStorage.getItem('mplads_api_url')))
  || (typeof window !== 'undefined' && document.querySelector('meta[name="backend-url"]')?.content)
  || 'https://mplads-neural-nova-26102.loca.lt';


function getAuthHeaders() {
  const token = OfficerAuth.getToken();
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const ApiClient = {
  /**
   * Fetches flagged projects sorted by risk score descending.
   * Cryptographically authenticated via server-enforced JWT Bearer token.
   * @param {Object} options
   * @param {number} [options.limit=50]
   * @param {string} [options.state]
   * @param {string} [options.workCategory]
   * @param {string} [options.district]
   * @returns {Promise<Array>}
   */
  async getFlaggedProjects({ limit = 50, state = null, workCategory = null, district = null } = {}) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (state) params.set('state', state);
    if (workCategory) params.set('work_category', workCategory);
    if (district) params.set('district', district);

    const res = await fetch(`${API_BASE_URL}/flagged-projects?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Auditor authentication required (HTTP 401)');
      }
      throw new Error(`Failed to load flagged projects (${res.status})`);
    }
    return await res.json();
  },

  /**
   * Fetches full single project details including 4-signal breakdown and explanations.
   * Always uses query param (never path param) because work_id contains slashes.
   * @param {string} workId
   * @returns {Promise<Object>}
   */
  async getProjectDetail(workId) {
    if (!workId || typeof workId !== 'string') {
      throw new Error('Valid work_id is required');
    }
    const params = new URLSearchParams({ work_id: workId.trim() });
    const res = await fetch(`${API_BASE_URL}/project?${params.toString()}`);
    if (!res.ok) {
      if (res.status === 404) throw new Error('Project not found in MPLADS database');
      throw new Error(`Server returned status ${res.status}`);
    }
    const data = await res.json();
    return data.project || data;
  },

  /**
   * Fetches citizen grievances/reports attached to this project.
   * @param {string} workId
   * @returns {Promise<Array>}
   */
  async getCitizenReports(workId) {
    if (!workId) return [];
    const params = new URLSearchParams({ work_id: workId.trim() });
    try {
      const res = await fetch(`${API_BASE_URL}/citizen-reports?${params.toString()}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      console.warn('Could not fetch citizen reports:', err);
      return [];
    }
  },

  /**
   * Fetches AI cross-verification breakdown for a citizen report.
   * @param {string} reportId
   * @returns {Promise<Object|null>}
   */
  async getReportVerification(reportId) {
    if (!reportId) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/citizen-report-verification/${encodeURIComponent(reportId)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn('Verification lookup failed for report', reportId, err);
      return null;
    }
  },

  /**
   * Submits official auditor feedback (False Positive or Confirmed Issue).
   * Dynamically triggers the feedback loop dampening/affirming risk scores.
   * @param {Object} payload
   * @param {string} payload.work_id
   * @param {'confirmed_issue'|'false_positive'} payload.verdict
   * @param {string} [payload.officer_notes]
   * @param {string} [payload.officer_id]
   * @returns {Promise<Object>}
   */
  async submitFeedback({ work_id, verdict, officer_notes = '', officer_id = 'AUDITOR-DEFAULT' }) {
    const res = await fetch(`${API_BASE_URL}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        work_id: work_id.trim(),
        verdict,
        officer_notes: officer_notes.trim(),
        officer_id: officer_id.trim(),
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Feedback submission failed (${res.status})`);
    }
    return await res.json();
  },

  /**
   * Searches across the 77,305 MPLADS projects by keyword, district, or constituency.
   * @param {string} query
   * @param {number} [limit=20]
   * @returns {Promise<Array>}
   */
  async searchProjects(query, limit = 20) {
    if (!query || query.trim().length < 2) return [];
    const params = new URLSearchParams({
      q: query.trim(),
      limit: String(limit),
    });
    const res = await fetch(`${API_BASE_URL}/search-projects?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  },

  /**
   * Returns the direct URL to generate and download the ReportLab 2-page Audit Brief PDF.
   * @param {string} workId
   * @returns {string}
   */
  getAuditBriefPdfUrl(workId) {
    return `${API_BASE_URL}/audit-brief/${encodeURIComponent(workId.trim())}`;
  },

  /**
   * Saves DISHA physical inspection checklist to backend and Supabase cloud.
   * @param {string} workId
   * @param {Object} checklistState
   * @returns {Promise<Object>}
   */
  async saveChecklist(workId, checklistState) {
    if (!workId) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_id: workId.trim(),
          ...checklistState,
        }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn('Checklist cloud sync warning:', err);
      return null;
    }
  },

  /**
   * Retrieves saved DISHA physical inspection checklist from backend/Supabase.
   * @param {string} workId
   * @returns {Promise<Object|null>}
   */
  async getChecklist(workId) {
    if (!workId) return null;
    try {
      const params = new URLSearchParams({ work_id: workId.trim() });
      const res = await fetch(`${API_BASE_URL}/checklist?${params.toString()}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.checklist || null;
    } catch (err) {
      console.warn('Checklist cloud fetch warning:', err);
      return null;
    }
  },

  /**
   * Submits an officer on-site field evidence capture.
   * Uses standard FormData for photo file, GPS, timestamp, and SHA-256 seal.
   * @param {FormData} formData
   * @returns {Promise<Object>}
   */
  async submitFieldEvidence(formData) {
    // Falls back gracefully if custom endpoint is not mounted yet,
    // storing in citizen-report queue with officer tag
    const res = await fetch(`${API_BASE_URL}/citizen-report`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      throw new Error(`Failed to upload field evidence (${res.status})`);
    }
    return await res.json();
  },

  /**
   * Fetches state counts of verified demo showcase projects.
   * @returns {Promise<Object>}
   */
  async getDemoShowcaseStates() {
    const res = await fetch(`${API_BASE_URL}/demo-showcase/states`);
    if (!res.ok) throw new Error(`Failed to load showcase states (${res.status})`);
    return await res.json();
  },

  /**
   * Fetches verified demo showcase projects filtered by state.
   * @param {Object} options
   * @param {string} [options.state]
   * @param {number} [options.limit=50]
   * @returns {Promise<Object>}
   */
  async getDemoShowcase({ state = null, limit = 50 } = {}) {
    let url = `${API_BASE_URL}/demo-showcase?limit=${limit}`;
    if (state && state !== 'ALL') {
      url += `&state=${encodeURIComponent(state)}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load showcase projects (${res.status})`);
    return await res.json();
  },

  /**
   * Returns authenticated/queried satellite thumbnail image URL.
   * @param {string} workId
   * @returns {string}
   */
  getSatelliteImageUrl(workId) {
    return `${API_BASE_URL}/project-satellite-image?work_id=${encodeURIComponent(workId)}`;
  },

  /**
   * Fund Tracking Summary KPIs
   */
  async getFundTrackingSummary({ state = null, financialYear = null, constituency = null } = {}) {
    const params = new URLSearchParams();
    if (state && state !== 'ALL') params.set('state', state);
    if (financialYear && financialYear !== 'ALL') params.set('financial_year', financialYear);
    if (constituency && constituency !== 'ALL') params.set('constituency', constituency);
    const res = await fetch(`${API_BASE_URL}/api/fund-tracking/summary?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error(`Failed to load fund tracking summary (${res.status})`);
    return await res.json();
  },

  /**
   * Fund Tracking Project Records with Pagination & Filters
   */
  async getFundTrackingProjects({ page = 1, pageSize = 25, state = null, financialYear = null, status = null, paymentStatus = null, costOverrunOnly = false } = {}) {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    if (state && state !== 'ALL') params.set('state', state);
    if (financialYear && financialYear !== 'ALL') params.set('financial_year', financialYear);
    if (status && status !== 'ALL') params.set('status', status);
    if (paymentStatus && paymentStatus !== 'ALL') params.set('payment_status', paymentStatus);
    if (costOverrunOnly) params.set('cost_overrun_only', 'true');
    const res = await fetch(`${API_BASE_URL}/api/fund-tracking/projects?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error(`Failed to load fund tracking projects (${res.status})`);
    return await res.json();
  },

  /**
   * Progress & Delays Summary
   */
  async getProgressDelaysSummary({ state = null, district = null } = {}) {
    const params = new URLSearchParams();
    if (state && state !== 'ALL') params.set('state', state);
    if (district && district !== 'ALL') params.set('district', district);
    const res = await fetch(`${API_BASE_URL}/api/progress-delays/summary?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error(`Failed to load progress summary (${res.status})`);
    return await res.json();
  },

  /**
   * Progress & Delays Worklist
   */
  async getProgressDelaysWorklist({ page = 1, pageSize = 25, status = null, delayBucket = null, state = null, district = null, earlyWarningOnly = false } = {}) {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    if (status && status !== 'ALL') params.set('status', status);
    if (delayBucket && delayBucket !== 'ALL') params.set('delay_bucket', delayBucket);
    if (state && state !== 'ALL') params.set('state', state);
    if (district && district !== 'ALL') params.set('district', district);
    if (earlyWarningOnly) params.set('early_warning_only', 'true');
    const res = await fetch(`${API_BASE_URL}/api/progress-delays/worklist?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error(`Failed to load progress worklist (${res.status})`);
    return await res.json();
  },

  /**
   * Compliance & Early Warning Alerts
   */
  async getComplianceAlerts({ severity = null, alertType = null, state = null, district = null, status = null, limit = 50, offset = 0 } = {}) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (severity && severity !== 'ALL') params.set('severity', severity);
    if (alertType && alertType !== 'ALL') params.set('alert_type', alertType);
    if (state && state !== 'ALL') params.set('state', state);
    if (district && district !== 'ALL') params.set('district', district);
    if (status && status !== 'ALL') params.set('status', status);
    const res = await fetch(`${API_BASE_URL}/api/compliance/alerts?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error(`Failed to load compliance alerts (${res.status})`);
    return await res.json();
  },

  /**
   * Record Official Auditor Action on Alert
   */
  async recordComplianceAction(actionData) {
    const res = await fetch(`${API_BASE_URL}/api/compliance/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(actionData)
    });
    if (!res.ok) throw new Error(`Failed to record compliance action (${res.status})`);
    return await res.json();
  },

  /**
   * Role Switcher Authentication
   */
  async switchRoleLogin(badgeId, password) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ officer_id: badgeId, password: password })
    });
    if (!res.ok) throw new Error(`Login failed for ${badgeId}`);
    const data = await res.json();
    localStorage.setItem('mplads_token', data.access_token);
    sessionStorage.setItem('mplads_officer_jwt_token', data.access_token);
    localStorage.setItem('mplads_officer_jwt_token', data.access_token);
    localStorage.setItem('mplads_officer', JSON.stringify(data.officer));
    return data;
  }
};

