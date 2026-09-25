/**
 * ============================================================================
 * Project Progress & Delay Monitoring View
 * Team Neural Nova (SIH26102) — MoSPI MPLADS Risk Intelligence
 * ============================================================================
 */

import { ApiClient } from '../api.js';

export const ProgressDelaysView = {
  container: null,
  onNavigateToProject: null,
  currentPage: 1,
  pageSize: 20,
  totalPages: 1,
  totalRecords: 0,
  filters: {
    delayBucket: 'ALL',
    status: 'ALL',
    earlyWarningOnly: false
  },

  init(navCallback) {
    this.container = document.getElementById('view-progress-delays');
    this.onNavigateToProject = navCallback;
    this.bindEvents();
  },

  bindEvents() {
    if (!this.container) return;

    // Filter controls
    const bucketSelect = this.container.querySelector('#delay-filter-bucket');
    if (bucketSelect) {
      bucketSelect.addEventListener('change', (e) => {
        this.filters.delayBucket = e.target.value;
        this.currentPage = 1;
        this.load();
      });
    }

    const statusSelect = this.container.querySelector('#delay-filter-status');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.filters.status = e.target.value;
        this.currentPage = 1;
        this.load();
      });
    }

    const warningBtn = this.container.querySelector('#delay-filter-warning-btn');
    if (warningBtn) {
      warningBtn.addEventListener('click', () => {
        this.filters.earlyWarningOnly = !this.filters.earlyWarningOnly;
        warningBtn.classList.toggle('active', this.filters.earlyWarningOnly);
        this.currentPage = 1;
        this.load();
      });
    }

    // Pagination
    const prevBtn = this.container.querySelector('#delay-page-prev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.loadWorklistOnly();
        }
      });
    }

    const nextBtn = this.container.querySelector('#delay-page-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.currentPage < this.totalPages) {
          this.currentPage++;
          this.loadWorklistOnly();
        }
      });
    }
  },

  async load() {
    if (!this.container) return;
    this.renderLoading();

    try {
      // 1. Fetch summary
      const summaryPromise = ApiClient.getProgressDelaysSummary();

      // 2. Fetch worklist
      const worklistPromise = ApiClient.getProgressDelaysWorklist({
        page: this.currentPage,
        pageSize: this.pageSize,
        delayBucket: this.filters.delayBucket,
        status: this.filters.status,
        earlyWarningOnly: this.filters.earlyWarningOnly
      });

      const [summary, worklistData] = await Promise.all([summaryPromise, worklistPromise]);

      this.renderSummary(summary);
      this.renderWorklist(worklistData);
    } catch (err) {
      console.error('Error loading progress & delays:', err);
      const tbody = this.container.querySelector('#delay-projects-tbody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-tertiary);">Unable to load progress & delay analytics (${err.message}).</td></tr>`;
      }
    }
  },

  async loadWorklistOnly() {
    const tbody = this.container.querySelector('#delay-projects-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-tertiary);"><span class="loading-spinner"></span> Loading page ${this.currentPage}...</td></tr>`;
    }

    try {
      const worklistData = await ApiClient.getProgressDelaysWorklist({
        page: this.currentPage,
        pageSize: this.pageSize,
        delayBucket: this.filters.delayBucket,
        status: this.filters.status,
        earlyWarningOnly: this.filters.earlyWarningOnly
      });
      this.renderWorklist(worklistData);
    } catch (err) {
      console.error('Error loading delay worklist page:', err);
    }
  },

  renderLoading() {
    const kpis = ['delay-kpi-total', 'delay-kpi-critical', 'delay-kpi-moderate', 'delay-kpi-avg', 'delay-kpi-active'];
    kpis.forEach(id => {
      const el = this.container.querySelector(`#${id}`);
      if (el) el.innerHTML = '<span style="font-size:0.7em; opacity:0.6;">Loading...</span>';
    });

    const tbody = this.container.querySelector('#delay-projects-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-tertiary);"><span class="loading-spinner"></span> Computing statutory timelines and delay vectors...</td></tr>`;
    }
  },

  renderSummary(data) {
    if (!data) return;

    // Total Delayed
    const totEl = this.container.querySelector('#delay-kpi-total');
    if (totEl) totEl.textContent = (data.delayed_count || 0).toLocaleString();

    // Critical Delays (>180d)
    const critEl = this.container.querySelector('#delay-kpi-critical');
    if (critEl) critEl.textContent = (data.critical_delays || 0).toLocaleString();

    // Moderate Delays (90-180d)
    const modEl = this.container.querySelector('#delay-kpi-moderate');
    if (modEl) modEl.textContent = (data.moderate_delays || 0).toLocaleString();

    // Average Delay Days
    const avgEl = this.container.querySelector('#delay-kpi-avg');
    if (avgEl) avgEl.textContent = `${Math.round(data.avg_delay_days || 0)} Days`;

    // Active in Progress
    const actEl = this.container.querySelector('#delay-kpi-active');
    if (actEl) actEl.textContent = (data.in_progress_count || 0).toLocaleString();

    // Milestones strip
    const mContainer = this.container.querySelector('#milestones-progress-strip');
    if (mContainer && data.milestones_summary) {
      const m = data.milestones_summary;
      mContainer.innerHTML = `
        <div class="milestone-step-pill">
          <span class="m-step">M1</span>
          <span class="m-name">Recommended</span>
          <span class="m-val">${(m.M1_recommended || 0).toLocaleString()}</span>
        </div>
        <div class="milestone-arrow">→</div>
        <div class="milestone-step-pill">
          <span class="m-step">M2</span>
          <span class="m-name">Sanctioned</span>
          <span class="m-val">${(m.M2_sanctioned || 0).toLocaleString()}</span>
        </div>
        <div class="milestone-arrow">→</div>
        <div class="milestone-step-pill">
          <span class="m-step">M3</span>
          <span class="m-name">First Disbursal</span>
          <span class="m-val">${(m.M3_fund_released || 0).toLocaleString()}</span>
        </div>
        <div class="milestone-arrow">→</div>
        <div class="milestone-step-pill active">
          <span class="m-step">M4</span>
          <span class="m-name">Mid-Stage Work</span>
          <span class="m-val">${(m.M4_in_progress || 0).toLocaleString()}</span>
        </div>
        <div class="milestone-arrow">→</div>
        <div class="milestone-step-pill done">
          <span class="m-step">M5</span>
          <span class="m-name">Completed</span>
          <span class="m-val">${(m.M5_completed || 0).toLocaleString()}</span>
        </div>
      `;
    }
  },

  renderWorklist(data) {
    const tbody = this.container.querySelector('#delay-projects-tbody');
    if (!tbody) return;

    if (!data || !data.results || data.results.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-tertiary);">No delayed projects matching selected criteria.</td></tr>`;
      this.updatePagination(1, 1, 0);
      return;
    }

    this.currentPage = data.page || 1;
    this.totalPages = data.total_pages || 1;
    this.totalRecords = data.total || 0;

    let html = '';
    data.results.forEach((p) => {
      const delayDays = p.delay_days || 0;
      let delayBadgeClass = 'badge-delay-low';
      let delayBadgeIcon = '⏱️';
      if (delayDays > 180) {
        delayBadgeClass = 'badge-delay-crit';
        delayBadgeIcon = '🚨';
      } else if (delayDays > 90) {
        delayBadgeClass = 'badge-delay-high';
        delayBadgeIcon = '⚠️';
      } else if (delayDays > 30) {
        delayBadgeClass = 'badge-delay-mid';
      }

      // Early warning chips
      let warningChips = '';
      if (p.early_warning_flags && p.early_warning_flags.length > 0) {
        p.early_warning_flags.forEach(f => {
          warningChips += `<span class="flag-chip" title="${escapeHtml(f)}">⚠️ ${escapeHtml(f)}</span>`;
        });
      }

      html += `
        <tr class="clickable-row" data-work-id="${escapeHtml(p.work_id)}">
          <td style="font-family:var(--font-mono); font-size:12px; color:#38BDF8; font-weight:600;">
            ${escapeHtml(p.work_id)}
          </td>
          <td style="max-width:260px;">
            <div style="font-weight:500; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
              ${escapeHtml(p.work_description || 'MPLADS Project')}
            </div>
            <div style="font-size:11px; color:var(--text-tertiary);">
              ${escapeHtml(p.work_category || 'Infrastructure')}
            </div>
          </td>
          <td>
            <div style="font-size:13px; color:var(--text-secondary);">${escapeHtml(p.district || p.constituency || '–')}</div>
            <div style="font-size:11px; color:var(--text-tertiary);">${escapeHtml(p.state || '–')}</div>
          </td>
          <td style="font-family:var(--font-mono); font-size:12px; color:var(--text-secondary);">
            ${escapeHtml(p.sanction_date || '–')}
          </td>
          <td style="font-family:var(--font-mono); font-size:12px; font-weight:600;">
            ${(p.days_elapsed || 0).toLocaleString()} days
          </td>
          <td>
            <span class="delay-pill ${delayBadgeClass}">
              ${delayBadgeIcon} +${delayDays}d overdue
            </span>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="milestone-badge">${escapeHtml(p.current_milestone_code || 'M2')}</span>
              <span style="font-size:12px; color:var(--text-secondary);">${escapeHtml(p.current_milestone_name || 'Sanctioned')}</span>
            </div>
          </td>
          <td>
            <div style="display:flex; flex-direction:column; gap:4px;">
              ${warningChips || '<span style="font-size:11px; color:var(--text-tertiary);">Standard tracking</span>'}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

    // Attach click events
    tbody.querySelectorAll('tr.clickable-row').forEach(row => {
      row.addEventListener('click', () => {
        const wid = row.getAttribute('data-work-id');
        if (wid && this.onNavigateToProject) {
          this.onNavigateToProject(wid);
        }
      });
    });

    this.updatePagination(this.currentPage, this.totalPages, this.totalRecords);
  },

  updatePagination(page, totalPages, total) {
    const pageNum = this.container.querySelector('#delay-page-num');
    const prevBtn = this.container.querySelector('#delay-page-prev');
    const nextBtn = this.container.querySelector('#delay-page-next');
    const counterBadge = this.container.querySelector('#delay-counter-badge');

    if (pageNum) pageNum.textContent = `Page ${page} of ${Math.max(1, totalPages)}`;
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= totalPages;
    if (counterBadge) {
      counterBadge.textContent = `${total.toLocaleString()} delayed statutory projects`;
    }
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
