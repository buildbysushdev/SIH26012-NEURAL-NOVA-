/**
 * ============================================================================
 * Fund Utilization & Payment Tracking View
 * Team Neural Nova (SIH26102) — MoSPI MPLADS Risk Intelligence
 * ============================================================================
 */

import { ApiClient } from '../api.js';

export const FundTrackingView = {
  container: null,
  onNavigateToProject: null,
  currentPage: 1,
  pageSize: 20,
  totalPages: 1,
  totalRecords: 0,
  filters: {
    state: 'ALL',
    financialYear: 'ALL',
    paymentStatus: 'ALL',
    costOverrunOnly: false
  },

  init(navCallback) {
    this.container = document.getElementById('view-fund-tracking');
    this.onNavigateToProject = navCallback;
    this.bindEvents();
  },

  bindEvents() {
    if (!this.container) return;

    // Filter changes
    const fySelect = this.container.querySelector('#fund-filter-fy');
    if (fySelect) {
      fySelect.addEventListener('change', (e) => {
        this.filters.financialYear = e.target.value;
        this.currentPage = 1;
        this.load();
      });
    }

    const stateSelect = this.container.querySelector('#fund-filter-state');
    if (stateSelect) {
      stateSelect.addEventListener('change', (e) => {
        this.filters.state = e.target.value;
        this.currentPage = 1;
        this.load();
      });
    }

    const paymentSelect = this.container.querySelector('#fund-filter-payment');
    if (paymentSelect) {
      paymentSelect.addEventListener('change', (e) => {
        this.filters.paymentStatus = e.target.value;
        this.currentPage = 1;
        this.load();
      });
    }

    const overrunBtn = this.container.querySelector('#fund-filter-overrun-btn');
    if (overrunBtn) {
      overrunBtn.addEventListener('click', () => {
        this.filters.costOverrunOnly = !this.filters.costOverrunOnly;
        overrunBtn.classList.toggle('active', this.filters.costOverrunOnly);
        this.currentPage = 1;
        this.load();
      });
    }

    // Pagination
    const prevBtn = this.container.querySelector('#fund-page-prev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.loadProjectsOnly();
        }
      });
    }

    const nextBtn = this.container.querySelector('#fund-page-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.currentPage < this.totalPages) {
          this.currentPage++;
          this.loadProjectsOnly();
        }
      });
    }
  },

  formatCrores(num) {
    if (num === null || num === undefined || isNaN(num)) return '₹ 0.00 Cr';
    const cr = num / 10000000;
    return `₹ ${cr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
  },

  formatInr(num) {
    if (num === null || num === undefined || isNaN(num)) return '₹ 0';
    return `₹ ${Math.round(num).toLocaleString('en-IN')}`;
  },

  async load() {
    if (!this.container) return;
    this.renderLoading();

    try {
      // 1. Load summary KPIs
      const summaryPromise = ApiClient.getFundTrackingSummary({
        state: this.filters.state,
        financialYear: this.filters.financialYear
      });

      // 2. Load projects table
      const projectsPromise = ApiClient.getFundTrackingProjects({
        page: this.currentPage,
        pageSize: this.pageSize,
        state: this.filters.state,
        financialYear: this.filters.financialYear,
        paymentStatus: this.filters.paymentStatus,
        costOverrunOnly: this.filters.costOverrunOnly
      });

      const [summary, projectsData] = await Promise.all([summaryPromise, projectsPromise]);

      this.renderSummary(summary);
      this.renderProjects(projectsData);
    } catch (err) {
      console.error('Error loading fund tracking data:', err);
      const tbody = this.container.querySelector('#fund-projects-tbody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--text-tertiary);">Unable to load fund tracking data (${err.message}).</td></tr>`;
      }
    }
  },

  async loadProjectsOnly() {
    const tbody = this.container.querySelector('#fund-projects-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--text-tertiary);"><span class="loading-spinner"></span> Loading page ${this.currentPage}...</td></tr>`;
    }

    try {
      const projectsData = await ApiClient.getFundTrackingProjects({
        page: this.currentPage,
        pageSize: this.pageSize,
        state: this.filters.state,
        financialYear: this.filters.financialYear,
        paymentStatus: this.filters.paymentStatus,
        costOverrunOnly: this.filters.costOverrunOnly
      });
      this.renderProjects(projectsData);
    } catch (err) {
      console.error('Error loading fund projects page:', err);
    }
  },

  renderLoading() {
    const kpiElements = [
      'fund-kpi-sanctioned', 'fund-kpi-released', 'fund-kpi-expenditure',
      'fund-kpi-balance', 'fund-kpi-utilization', 'fund-kpi-pending'
    ];
    kpiElements.forEach(id => {
      const el = this.container.querySelector(`#${id}`);
      if (el) el.innerHTML = '<span style="font-size:0.7em; opacity:0.6;">Loading...</span>';
    });

    const tbody = this.container.querySelector('#fund-projects-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--text-tertiary);"><span class="loading-spinner"></span> Loading fund utilization analytics...</td></tr>`;
    }
  },

  renderSummary(data) {
    if (!data) return;

    // Sanctioned
    const sancEl = this.container.querySelector('#fund-kpi-sanctioned');
    if (sancEl) sancEl.textContent = this.formatCrores(data.total_sanctioned);

    // Released
    const relEl = this.container.querySelector('#fund-kpi-released');
    if (relEl) relEl.textContent = this.formatCrores(data.total_released);

    // Expenditure
    const expEl = this.container.querySelector('#fund-kpi-expenditure');
    if (expEl) expEl.textContent = this.formatCrores(data.total_expenditure);

    // Remaining Balance
    const balEl = this.container.querySelector('#fund-kpi-balance');
    if (balEl) {
      balEl.textContent = this.formatCrores(data.remaining_balance);
      balEl.style.color = data.remaining_balance >= 0 ? '#10B981' : '#F87171';
    }

    // Fund Utilization %
    const utilEl = this.container.querySelector('#fund-kpi-utilization');
    const utilProgress = this.container.querySelector('#fund-kpi-util-progress');
    const utilVal = data.fund_utilization_pct || 0;
    if (utilEl) utilEl.textContent = `${utilVal.toFixed(1)}%`;
    if (utilProgress) {
      utilProgress.style.width = `${Math.min(100, Math.max(0, utilVal))}%`;
      utilProgress.style.backgroundColor = utilVal >= 75 ? '#10B981' : (utilVal >= 40 ? '#F59E0B' : '#EF4444');
    }

    // Pending Payments & Overruns
    const pendEl = this.container.querySelector('#fund-kpi-pending');
    if (pendEl) {
      pendEl.innerHTML = `
        <span style="color:#F59E0B;">${(data.pending_payments_count || 0).toLocaleString()}</span>
        <span style="font-size:0.7em; color:var(--text-tertiary);"> (${this.formatCrores(data.pending_payments_amount)})</span>
      `;
    }

    const overrunBadge = this.container.querySelector('#fund-overrun-badge-count');
    if (overrunBadge) {
      overrunBadge.textContent = `${data.cost_overruns_count || 0} Overruns`;
    }
  },

  renderProjects(data) {
    const tbody = this.container.querySelector('#fund-projects-tbody');
    if (!tbody) return;

    if (!data || !data.results || data.results.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--text-tertiary);">No fund tracking records matching active filters.</td></tr>`;
      this.updatePagination(1, 1, 0);
      return;
    }

    this.currentPage = data.page || 1;
    this.totalPages = data.total_pages || 1;
    this.totalRecords = data.total || 0;

    let html = '';
    data.results.forEach((p) => {
      const utilPct = p.utilization_pct !== null ? p.utilization_pct : 0;
      let utilColor = '#10B981'; // green
      if (utilPct < 40) utilColor = '#EF4444'; // red
      else if (utilPct < 75) utilColor = '#F59E0B'; // yellow

      const isOverrun = p.is_cost_overrun;
      const overrunPill = isOverrun 
        ? `<span class="badge-overrun" title="Expenditure exceeds Sanctioned limit">+${this.formatInr(p.cost_overrun_amount)} Overrun</span>`
        : '';

      const payStatus = String(p.payment_status || 'Completed');
      let payBadgeClass = 'badge-neutral';
      const psLower = payStatus.toLowerCase();
      if (psLower.includes('success') || psLower.includes('complete')) payBadgeClass = 'badge-success';
      else if (psLower.includes('pending')) payBadgeClass = 'badge-warning';
      else if (psLower.includes('fail')) payBadgeClass = 'badge-danger';

      html += `
        <tr class="clickable-row" data-work-id="${escapeHtml(p.work_id)}">
          <td style="font-family:var(--font-mono); font-size:12px; color:#38BDF8; font-weight:600;">
            ${escapeHtml(p.work_id)}
          </td>
          <td style="max-width:260px;">
            <div style="font-weight:500; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
              ${escapeHtml(p.work_description || 'MPLADS Development Project')}
            </div>
            <div style="font-size:11px; color:var(--text-tertiary);">
              ${escapeHtml(p.work_category || 'Infrastructure')} &bull; FY ${escapeHtml(p.financial_year || '2024-2025')}
            </div>
          </td>
          <td>
            <div style="font-size:13px; color:var(--text-secondary);">${escapeHtml(p.state || '–')}</div>
            <div style="font-size:11px; color:var(--text-tertiary);">${escapeHtml(p.constituency || '–')}</div>
          </td>
          <td style="text-align:right; font-family:var(--font-mono); font-size:12px; font-weight:600;">
            ${this.formatInr(p.sanction_amount)}
          </td>
          <td style="text-align:right; font-family:var(--font-mono); font-size:12px; color:#94A3B8;">
            ${this.formatInr(p.total_fund_disbursed)}
          </td>
          <td style="text-align:right; font-family:var(--font-mono); font-size:12px; font-weight:600; color:${isOverrun ? '#EF4444' : 'var(--text-primary)'};">
            ${this.formatInr(p.amount_disbursed_completed)}
            ${overrunPill}
          </td>
          <td style="text-align:right; font-family:var(--font-mono); font-size:12px; font-weight:600; color:${p.remaining_balance >= 0 ? '#10B981' : '#EF4444'};">
            ${this.formatInr(p.remaining_balance)}
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="flex:1; background:rgba(255,255,255,0.08); height:6px; border-radius:3px; overflow:hidden;">
                <div style="width:${Math.min(100, Math.max(0, utilPct))}%; height:100%; background:${utilColor}; border-radius:3px;"></div>
              </div>
              <span style="font-family:var(--font-mono); font-size:11px; font-weight:600; color:${utilColor}; min-width:36px;">
                ${utilPct.toFixed(0)}%
              </span>
            </div>
          </td>
          <td>
            <span class="status-badge ${payBadgeClass}">${escapeHtml(payStatus)}</span>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

    // Attach row click handlers
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
    const pageNum = this.container.querySelector('#fund-page-num');
    const prevBtn = this.container.querySelector('#fund-page-prev');
    const nextBtn = this.container.querySelector('#fund-page-next');
    const counterBadge = this.container.querySelector('#fund-counter-badge');

    if (pageNum) pageNum.textContent = `Page ${page} of ${Math.max(1, totalPages)}`;
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= totalPages;
    if (counterBadge) {
      counterBadge.textContent = `${total.toLocaleString()} total statutory projects`;
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
