/**
 * ============================================================================
 * Automated Compliance & Early-Warning Alerts View
 * Team Neural Nova (SIH26102) — MoSPI MPLADS Risk Intelligence
 * ============================================================================
 */

import { ApiClient } from '../api.js';

export const ComplianceView = {
  container: null,
  onNavigateToProject: null,
  limit: 50,
  offset: 0,
  totalAlerts: 0,
  activeAlertForModal: null,
  filters: {
    severity: 'ALL',
    alertType: 'ALL',
    status: 'ALL'
  },

  init(navCallback) {
    this.container = document.getElementById('view-compliance');
    this.onNavigateToProject = navCallback;
    this.bindEvents();
    this.bindModalEvents();
  },

  bindEvents() {
    if (!this.container) return;

    // Filters
    const sevSelect = this.container.querySelector('#compliance-filter-severity');
    if (sevSelect) {
      sevSelect.addEventListener('change', (e) => {
        this.filters.severity = e.target.value;
        this.offset = 0;
        this.load();
      });
    }

    const typeSelect = this.container.querySelector('#compliance-filter-type');
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        this.filters.alertType = e.target.value;
        this.offset = 0;
        this.load();
      });
    }

    const statusSelect = this.container.querySelector('#compliance-filter-status');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.filters.status = e.target.value;
        this.offset = 0;
        this.load();
      });
    }
  },

  bindModalEvents() {
    const modal = document.getElementById('modal-compliance-action');
    if (!modal) return;

    const btnClose = modal.querySelector('#btn-close-action-modal');
    const btnCancel = modal.querySelector('#btn-cancel-action-modal');
    const btnSubmit = modal.querySelector('#btn-submit-action-modal');

    const closeModal = () => {
      modal.classList.remove('active');
      this.activeAlertForModal = null;
    };

    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    if (btnSubmit) {
      btnSubmit.addEventListener('click', async () => {
        if (!this.activeAlertForModal) return;

        const actionType = modal.querySelector('#action-modal-type-select').value;
        const assignedTo = modal.querySelector('#action-modal-assign-input').value.trim();
        const remarks = modal.querySelector('#action-modal-remarks-input').value.trim();

        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Recording Action...';

        try {
          await ApiClient.recordComplianceAction({
            alert_id: this.activeAlertForModal.alert_id,
            project_id: this.activeAlertForModal.project_id,
            action: actionType,
            assigned_to: assignedTo || undefined,
            remarks: remarks || undefined
          });

          if (window.showToast) {
            window.showToast(`Auditor action recorded for alert ${this.activeAlertForModal.alert_id} ✓`, 'success');
          }

          closeModal();
          this.load();
        } catch (err) {
          console.error('Error submitting compliance action:', err);
          if (window.showToast) window.showToast(`Failed: ${err.message}`, 'error');
        } finally {
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'Submit Official Action';
        }
      });
    }
  },

  openActionModal(alertItem) {
    this.activeAlertForModal = alertItem;
    const modal = document.getElementById('modal-compliance-action');
    if (!modal) return;

    modal.querySelector('#action-modal-alert-id').textContent = alertItem.alert_id;
    modal.querySelector('#action-modal-project-id').textContent = alertItem.project_id;
    modal.querySelector('#action-modal-reason').textContent = alertItem.reason;
    modal.querySelector('#action-modal-assign-input').value = alertItem.assigned_authority || '';
    modal.querySelector('#action-modal-remarks-input').value = alertItem.audit_remarks || '';

    modal.classList.add('active');
  },

  async load() {
    if (!this.container) return;
    this.renderLoading();

    try {
      const data = await ApiClient.getComplianceAlerts({
        severity: this.filters.severity,
        alertType: this.filters.alertType,
        status: this.filters.status,
        limit: this.limit,
        offset: this.offset
      });

      this.renderSummary(data);
      this.renderAlerts(data);
    } catch (err) {
      console.error('Error loading compliance alerts:', err);
      const list = this.container.querySelector('#compliance-alerts-list');
      if (list) {
        list.innerHTML = `<div style="text-align:center; padding:32px; color:var(--text-tertiary);">Unable to load compliance alerts (${err.message}).</div>`;
      }
    }
  },

  renderLoading() {
    const kpis = ['comp-kpi-crit', 'comp-kpi-high', 'comp-kpi-med', 'comp-kpi-open', 'comp-kpi-resolved'];
    kpis.forEach(id => {
      const el = this.container.querySelector(`#${id}`);
      if (el) el.innerHTML = '<span style="font-size:0.7em; opacity:0.6;">Loading...</span>';
    });

    const list = this.container.querySelector('#compliance-alerts-list');
    if (list) {
      list.innerHTML = `<div style="text-align:center; padding:32px; color:var(--text-tertiary);"><span class="loading-spinner"></span> Scanning multi-vector statutory compliance rules...</div>`;
    }
  },

  renderSummary(data) {
    if (!data) return;

    const sev = data.counts_by_severity || {};
    const stat = data.counts_by_status || {};

    const critEl = this.container.querySelector('#comp-kpi-crit');
    if (critEl) critEl.textContent = (sev.CRITICAL || 0).toLocaleString();

    const highEl = this.container.querySelector('#comp-kpi-high');
    if (highEl) highEl.textContent = (sev.HIGH || 0).toLocaleString();

    const medEl = this.container.querySelector('#comp-kpi-med');
    if (medEl) medEl.textContent = (sev.MEDIUM || 0).toLocaleString();

    const openEl = this.container.querySelector('#comp-kpi-open');
    if (openEl) openEl.textContent = (stat.OPEN || 0).toLocaleString();

    const resEl = this.container.querySelector('#comp-kpi-resolved');
    if (resEl) resEl.textContent = (stat.RESOLVED || 0).toLocaleString();
  },

  renderAlerts(data) {
    const list = this.container.querySelector('#compliance-alerts-list');
    const counterBadge = this.container.querySelector('#compliance-counter-badge');
    if (!list) return;

    if (!data || !data.results || data.results.length === 0) {
      list.innerHTML = `<div style="text-align:center; padding:48px; color:var(--text-tertiary);">No active compliance alerts matching filters.</div>`;
      if (counterBadge) counterBadge.textContent = 'Showing 0 alerts';
      return;
    }

    if (counterBadge) {
      counterBadge.textContent = `Showing ${data.results.length} of ${data.total.toLocaleString()} statutory alerts`;
    }

    let html = '';
    data.results.forEach((a) => {
      const sev = a.severity || 'MEDIUM';
      let sevClass = 'sev-med';
      if (sev === 'CRITICAL') sevClass = 'sev-crit';
      else if (sev === 'HIGH') sevClass = 'sev-high';

      const stat = a.status || 'OPEN';
      let statBadgeClass = 'badge-open';
      if (stat === 'ACKNOWLEDGED') statBadgeClass = 'badge-acknowledged';
      else if (stat === 'RESOLVED') statBadgeClass = 'badge-resolved';

      html += `
        <div class="compliance-card ${sevClass}" data-alert-id="${escapeHtml(a.alert_id)}">
          <div class="compliance-card-header">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="severity-badge ${sevClass}">${escapeHtml(sev)}</span>
              <span class="alert-type-badge">${escapeHtml(a.alert_type)}</span>
              <span class="alert-id-text">${escapeHtml(a.alert_id)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="status-pill ${statBadgeClass}">${escapeHtml(stat)}</span>
              <span style="font-size:11px; color:var(--text-tertiary);">${escapeHtml(a.date_generated || '2026-09-25')}</span>
            </div>
          </div>

          <div class="compliance-card-body">
            <div style="margin-bottom:8px;">
              <span class="project-link" data-work-id="${escapeHtml(a.project_id)}">
                🔍 ${escapeHtml(a.project_id)}
              </span>
              <span style="color:var(--text-secondary); font-size:13px; margin-left:6px;">
                ${escapeHtml(a.project_name || 'MPLADS Project')}
              </span>
            </div>

            <div class="compliance-reason-box">
              <span class="reason-icon">📋</span>
              <span class="reason-text">${escapeHtml(a.reason)}</span>
            </div>

            ${a.audit_remarks ? `
              <div class="audit-remarks-box">
                <span style="font-weight:600; color:#38BDF8;">Auditor Observation:</span> ${escapeHtml(a.audit_remarks)}
                <span style="font-size:10px; color:var(--text-tertiary); margin-left:6px;">(by ${escapeHtml(a.last_officer || 'Officer')})</span>
              </div>
            ` : ''}

            <div class="compliance-card-footer">
              <div style="font-size:12px; color:var(--text-tertiary);">
                🏛️ Assigned: <span style="color:var(--text-secondary);">${escapeHtml(a.assigned_authority || 'District Authority')}</span>
                &bull; Location: <span style="color:var(--text-secondary);">${escapeHtml(a.district || a.constituency || '–')}, ${escapeHtml(a.state || '–')}</span>
              </div>

              <div class="compliance-card-actions">
                ${stat === 'OPEN' ? `
                  <button type="button" class="btn-action-ack" data-alert-id="${escapeHtml(a.alert_id)}" data-proj-id="${escapeHtml(a.project_id)}">
                    ✓ Acknowledge
                  </button>
                ` : ''}
                <button type="button" class="btn-action-manage" data-alert-idx="${escapeHtml(a.alert_id)}">
                  📝 Take Action / Remark
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    list.innerHTML = html;

    // Attach listeners
    list.querySelectorAll('.project-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.stopPropagation();
        const wid = link.getAttribute('data-work-id');
        if (wid && this.onNavigateToProject) this.onNavigateToProject(wid);
      });
    });

    list.querySelectorAll('.btn-action-ack').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const aid = btn.getAttribute('data-alert-id');
        const pid = btn.getAttribute('data-proj-id');
        btn.disabled = true;
        btn.textContent = 'Acknowledging...';
        try {
          await ApiClient.recordComplianceAction({
            alert_id: aid,
            project_id: pid,
            action: 'acknowledge'
          });
          if (window.showToast) window.showToast(`Alert ${aid} acknowledged ✓`, 'success');
          this.load();
        } catch (err) {
          if (window.showToast) window.showToast(`Error: ${err.message}`, 'error');
          btn.disabled = false;
        }
      });
    });

    list.querySelectorAll('.btn-action-manage').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const aid = btn.getAttribute('data-alert-idx');
        const alertItem = data.results.find(x => x.alert_id === aid);
        if (alertItem) this.openActionModal(alertItem);
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
