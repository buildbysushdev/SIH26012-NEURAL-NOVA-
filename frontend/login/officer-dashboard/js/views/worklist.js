/**
 * ============================================================================
 * MPLADS Risk Intelligence System — Prioritized Worklist View
 * Team Neural Nova (SIH26102)
 *
 * Screen 1: Dense, fast, prioritized audit table with multi-factor filters
 * and non-accusatory risk grading.
 * ============================================================================
 */

import { ApiClient } from '../api.js';
import { OfficerDB } from '../db.js';
import { OfficerAuth } from '../auth.js';

export const WorklistView = {
  allProjects: [],
  filteredProjects: [],
  sortField: 'risk_score',
  sortAsc: false,
  onSelectProjectCallback: null,

  init(onSelectProject) {
    this.onSelectProjectCallback = onSelectProject;
    this.bindFilterEvents();
  },

  bindFilterEvents() {
    const elDistrict = document.getElementById('filter-district');
    const elRisk = document.getElementById('filter-risk-tier');
    const elStatus = document.getElementById('filter-status');
    const elPrecision = document.getElementById('filter-precision');
    const elReset = document.getElementById('btn-reset-filters');

    if (elDistrict) {
      elDistrict.addEventListener('change', async () => {
        const dist = elDistrict.value || 'ALL';
        // Request newly scoped JWT token from server
        await OfficerAuth.setJurisdiction(dist);
        // Reload from backend with the new token
        await this.load();
      });
    }
    if (elRisk) elRisk.addEventListener('change', () => this.applyFilters());
    if (elStatus) elStatus.addEventListener('change', () => this.applyFilters());
    if (elPrecision) elPrecision.addEventListener('change', () => this.applyFilters());
    if (elReset) {
      elReset.addEventListener('click', async () => {
        if (elDistrict) elDistrict.value = '';
        if (elRisk) elRisk.value = 'ALL';
        if (elStatus) elStatus.value = 'ALL';
        if (elPrecision) elPrecision.value = 'ALL';
        await OfficerAuth.setJurisdiction('ALL');
        await this.load();
      });
    }
  },

  async load() {
    const tableBody = document.getElementById('worklist-tbody');
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 32px; color: var(--text-tertiary);">Loading prioritized MPLADS works...</td></tr>`;
    }

    try {
      // Real API call
      const data = await ApiClient.getFlaggedProjects({ limit: 50 });
      this.allProjects = data || [];
      // Cache to IndexedDB for offline access
      await OfficerDB.cacheProjects(this.allProjects);
    } catch (err) {
      console.warn('Network request failed, falling back to local IndexedDB cache:', err);
      this.allProjects = await OfficerDB.getCachedProjects();
    }

    this.populateDistrictFilter();
    this.applyFilters();
    this.renderMetrics();
  },

  populateDistrictFilter() {
    const select = document.getElementById('filter-district');
    if (!select) return;

    const districts = new Set();
    this.allProjects.forEach(p => {
      const d = p.district || p.constituency;
      if (d) districts.add(d.toUpperCase());
    });

    const currentVal = select.value;
    select.innerHTML = `<option value="">All Jurisdictions / Districts</option>`;
    Array.from(districts).sort().forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      select.appendChild(opt);
    });
    select.value = currentVal;
  },

  applyFilters() {
    const elDistrict = document.getElementById('filter-district');
    const elRisk = document.getElementById('filter-risk-tier');
    const elStatus = document.getElementById('filter-status');
    const elPrecision = document.getElementById('filter-precision');

    const filterDistrict = (elDistrict ? elDistrict.value : '').toUpperCase();
    const filterRisk = elRisk ? elRisk.value : 'ALL';
    const filterStatus = elStatus ? elStatus.value : 'ALL';
    const filterPrecision = elPrecision ? elPrecision.value : 'ALL';

    this.filteredProjects = this.allProjects.filter(p => {
      // District filter
      if (filterDistrict) {
        const d = (p.district || p.constituency || '').toUpperCase();
        if (d !== filterDistrict) return false;
      }

      // Risk Tier filter
      const score = Number(p.risk_score || 0);
      if (filterRisk === 'HIGH' && score <= 70) return false;
      if (filterRisk === 'MID' && (score < 40 || score > 70)) return false;
      if (filterRisk === 'LOW' && score >= 40) return false;

      // Status filter
      const status = p.feedback_status || 'unreviewed';
      if (filterStatus === 'UNREVIEWED' && status !== 'unreviewed' && status !== null) return false;
      if (filterStatus === 'CONFIRMED_ISSUE' && status !== 'confirmed_issue') return false;
      if (filterStatus === 'FALSE_POSITIVE' && status !== 'false_positive') return false;

      // Precision filter
      const prec = (p.location_precision || p.coord_precision || 'district').toLowerCase();
      if (filterPrecision !== 'ALL' && prec !== filterPrecision.toLowerCase()) return false;

      return true;
    });

    // Sort by risk_score descending by default
    this.filteredProjects.sort((a, b) => {
      const scoreA = Number(a[this.sortField] || 0);
      const scoreB = Number(b[this.sortField] || 0);
      return this.sortAsc ? scoreA - scoreB : scoreB - scoreA;
    });

    this.renderTable();
    this.renderCounter();
  },

  renderCounter() {
    const counter = document.getElementById('filter-counter-badge');
    if (counter) {
      counter.textContent = `Showing ${this.filteredProjects.length} of ${this.allProjects.length} works`;
    }
  },

  renderMetrics() {
    const total = this.allProjects.length;
    let highCount = 0;
    let midCount = 0;
    let totalScore = 0;

    this.allProjects.forEach(p => {
      const s = Number(p.risk_score || 0);
      totalScore += s;
      if (s > 70) highCount++;
      else if (s >= 40) midCount++;
    });

    const avg = total > 0 ? (totalScore / total).toFixed(1) : '0.0';

    const elTotal = document.getElementById('metric-total-flagged');
    const elHigh = document.getElementById('metric-high-priority');
    const elMid = document.getElementById('metric-moderate');
    const elAvg = document.getElementById('metric-avg-score');

    if (elTotal) elTotal.textContent = total.toLocaleString();
    if (elHigh) elHigh.textContent = highCount.toLocaleString();
    if (elMid) elMid.textContent = midCount.toLocaleString();
    if (elAvg) elAvg.textContent = `${avg} / 100`;
  },

  renderTable() {
    const tableBody = document.getElementById('worklist-tbody');
    if (!tableBody) return;

    if (this.filteredProjects.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 48px; color: var(--text-tertiary);">No projects match the active filter criteria.</td></tr>`;
      return;
    }

    tableBody.innerHTML = this.filteredProjects.map(p => {
      const score = Number(p.risk_score || 0).toFixed(1);
      const riskClass = Number(score) > 70 ? 'high' : Number(score) >= 40 ? 'mid' : 'low';

      // Location precision tag
      const prec = (p.location_precision || p.coord_precision || 'district').toLowerCase();
      const precLabel = prec === 'precise' ? '🎯 Precise' : prec === 'locality' ? '📍 Locality (2km)' : prec === 'district' ? '🏛️ District' : '❓ Unavailable';
      const precClass = prec;

      // Status
      const statusRaw = p.feedback_status || 'unreviewed';
      let statusLabel = 'Unreviewed';
      let statusClass = 'unreviewed';
      if (statusRaw === 'confirmed_issue') {
        statusLabel = 'Confirmed Issue';
        statusClass = 'confirmed-issue';
      } else if (statusRaw === 'false_positive') {
        statusLabel = 'Verified / Normal';
        statusClass = 'false-positive';
      }

      // Top flag reason synthesis
      let topReason = '';
      if (p.cost_zscore && Number(p.cost_zscore) > 3.0) {
        topReason = `Cost z-score +${Number(p.cost_zscore).toFixed(1)}σ outlier vs category mean`;
      } else if (p.nlp_similarity_score && Number(p.nlp_similarity_score) > 85) {
        topReason = `NLP duplicate pattern match (${Number(p.nlp_similarity_score).toFixed(0)}% similarity)`;
      } else if (p.citizen_report_count && Number(p.citizen_report_count) > 0) {
        topReason = `Active citizen vigilance grievance logged (+15.0 boost)`;
      } else {
        topReason = p.work_description || 'Elevated statistical anomaly index';
      }

      const dist = p.district || p.constituency || '–';
      const constVal = p.constituency || '–';

      return `
        <tr data-work-id="${p.work_id}">
          <td class="col-work-id">${escapeHtml(p.work_id)}</td>
          <td class="col-district">${escapeHtml(dist)}</td>
          <td>${escapeHtml(constVal)}</td>
          <td>
            <span class="risk-score-badge ${riskClass}">${score}</span>
          </td>
          <td class="col-reason" title="${escapeHtml(topReason)}">${escapeHtml(topReason)}</td>
          <td>
            <span class="badge-precision ${precClass}">${precLabel}</span>
          </td>
          <td>
            <span class="badge-status ${statusClass}">${statusLabel}</span>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row click listeners
    tableBody.querySelectorAll('tr[data-work-id]').forEach(row => {
      row.addEventListener('click', () => {
        const wid = row.getAttribute('data-work-id');
        if (wid && this.onSelectProjectCallback) {
          this.onSelectProjectCallback(wid);
        }
      });
    });
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
