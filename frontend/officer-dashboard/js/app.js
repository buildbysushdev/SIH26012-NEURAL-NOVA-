/**
 * ============================================================================
 * MPLADS Risk Intelligence System — Master Application Controller
 * Team Neural Nova (SIH26102)
 *
 * Bootstraps views, manages navigation across:
 *   1. Prioritized Worklist (Unsupervised Risk Scoring)
 *   2. Fund Utilization & Payment Tracking (Statutory Statutory Disbursal)
 *   3. Project Progress & Delay Monitoring (Milestones & Timeline Analytics)
 *   4. Automated Compliance & Early-Warning Alerts (Rule-Based Vigilance)
 *   5. Deep Case Detail & Satellite Dossier
 *
 * Orchestrates Stakeholder Role Switching & Jurisdictional Scoping
 * (MoSPI National Admin, State Nodal, District Officer, MP Dashboard).
 * ============================================================================
 */

import { WorklistView } from './views/worklist.js';
import { DetailView } from './views/detail.js';
import { FieldCaptureView } from './views/field-capture.js';
import { FundTrackingView } from './views/fund-tracking.js';
import { ProgressDelaysView } from './views/progress-delays.js';
import { ComplianceView } from './views/compliance.js';
import { ApiClient } from './api.js';
import { OfficerDB } from './db.js';
import { OfficerAuth } from './auth.js';

class OfficerDashboardApp {
  constructor() {
    this.currentView = 'worklist';
    this.roleCredentials = {
      'ADMIN-NEURAL-NOVA': 'admin@SIH2026',
      'AUDITOR-VIGILANCE-01': 'officer@SIH2026',
      'STATE-KA-NODAL': 'state@SIH2026',
      'STATE-MH-NODAL': 'state@SIH2026',
      'OFFICER-DELHI-01': 'officer@SIH2026',
      'OFFICER-MH-01': 'officer@SIH2026',
      'MP-DHARWAD-01': 'mp@SIH2026'
    };
  }

  async init() {
    console.log('Initializing MPLADS Officer Verification Dashboard...');

    this.setupGlobalToasts();
    this.setupNetworkMonitoring();
    this.setupQuickSearch();
    this.setupNavigation();
    this.setupRoleSwitcher();
    this.registerServiceWorker();

    // Initialize subviews
    WorklistView.init((workId) => this.navigateToProject(workId));

    FundTrackingView.init((workId) => this.navigateToProject(workId));

    ProgressDelaysView.init((workId) => this.navigateToProject(workId));

    ComplianceView.init((workId) => this.navigateToProject(workId));

    DetailView.init({
      onFeedbackApplied: (workId, result) => {
        WorklistView.load();
      },
      onFieldCaptureTrigger: (workId, project) => {
        FieldCaptureView.open(workId, project);
      }
    });

    FieldCaptureView.init({
      onCaptureCompleted: (workId) => {
        DetailView.load(workId);
      }
    });

    // Initial load: authenticate auditor session and load scoped worklist
    await OfficerAuth.ensureAuthenticated();
    this.updateOfficerHeaderHud();
    await WorklistView.load();
  }

  setupGlobalToasts() {
    window.showToast = (msg, type = 'info') => {
      const container = document.getElementById('toast-container');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.innerHTML = `
        <div style="flex: 1; line-height: 1.4;">${escapeHtml(msg)}</div>
      `;
      container.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        toast.style.transition = 'all 200ms ease';
        setTimeout(() => toast.remove(), 200);
      }, 4000);
    };
  }

  setupNetworkMonitoring() {
    const badge = document.getElementById('sync-status-badge');
    const label = document.getElementById('sync-status-label');

    const updateStatus = () => {
      const isOnline = navigator.onLine;
      if (badge && label) {
        if (isOnline) {
          badge.classList.remove('offline');
          label.textContent = 'Live Connected';
          this.flushOfflineQueue();
        } else {
          badge.classList.add('offline');
          label.textContent = 'Offline Mode (Cached)';
          window.showToast('Device is offline. Changes saved locally to IndexedDB.', 'warning');
        }
      }
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
  }

  async flushOfflineQueue() {
    try {
      const queue = await OfficerDB.getSyncQueue();
      if (!queue || queue.length === 0) return;

      window.showToast(`Syncing ${queue.length} offline items to backend...`, 'info');

      for (const item of queue) {
        if (item.type === 'feedback') {
          await ApiClient.submitFeedback(item.payload);
          await OfficerDB.removeSyncItem(item.id);
        } else if (item.type === 'evidence') {
          const formData = new FormData();
          formData.append('work_id', item.payload.work_id);
          formData.append('description', 'Officer On-Site Verification Proof (Offline Synced)');
          formData.append('category', 'Officer Physical Inspection');
          if (item.payload.photoBlob) {
            formData.append('photo', item.payload.photoBlob, `officer_sync_${Date.now()}.jpg`);
          }
          if (item.payload.gps) {
            formData.append('captured_lat', String(item.payload.gps.lat));
            formData.append('captured_lng', String(item.payload.gps.lng));
          }
          formData.append('captured_timestamp', item.payload.timestamp || new Date().toISOString());

          await ApiClient.submitFieldEvidence(formData);
          await OfficerDB.removeSyncItem(item.id);
        }
      }

      window.showToast('Background sync complete. All local records uploaded ✓', 'success');
      WorklistView.load();
    } catch (err) {
      console.warn('Queue flush encountered error:', err);
    }
  }

  setupQuickSearch() {
    const input = document.getElementById('quick-search-input');
    if (!input) return;

    let debounceTimer;
    input.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const val = e.target.value.trim();
      if (val.length < 2) return;

      debounceTimer = setTimeout(async () => {
        try {
          const results = await ApiClient.searchProjects(val, 10);
          if (results && results.length > 0) {
            window.showToast(`Found ${results.length} matches across MPLADS corpus`, 'info');
          }
        } catch (err) {
          console.warn('Quick search error:', err);
        }
      }, 400);
    });
  }

  setupNavigation() {
    const brandLink = document.getElementById('nav-brand-home');
    const breadcrumbWorklist = document.getElementById('breadcrumb-worklist');

    const goHome = () => this.switchTab('worklist');

    if (brandLink) brandLink.addEventListener('click', goHome);
    if (breadcrumbWorklist) breadcrumbWorklist.addEventListener('click', goHome);

    // Primary Tab Buttons
    const tabButtons = document.querySelectorAll('.nav-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) this.switchTab(tab);
      });
    });
  }

  setupRoleSwitcher() {
    const roleSelect = document.getElementById('role-switcher-select');
    if (!roleSelect) return;

    // Set initial select value based on current stored officer
    const stored = localStorage.getItem('mplads_officer');
    if (stored) {
      try {
        const p = JSON.parse(stored);
        if (p.officer_id) roleSelect.value = p.officer_id;
      } catch (_) {}
    }

    roleSelect.addEventListener('change', async (e) => {
      const badgeId = e.target.value;
      const pwd = this.roleCredentials[badgeId] || 'officer@SIH2026';

      try {
        window.showToast(`Authenticating role: ${badgeId}...`, 'info');
        const res = await ApiClient.switchRoleLogin(badgeId, pwd);
        const officer = res.officer || {};

        // Update local session state
        OfficerAuth.CURRENT_OFFICER.id = officer.officer_id;
        OfficerAuth.CURRENT_OFFICER.jurisdiction = officer.district || 'ALL';
        OfficerAuth.CURRENT_OFFICER.role = officer.role;

        this.updateOfficerHeaderHud();

        let roleLabel = 'National Admin';
        if (officer.role === 'state_nodal') roleLabel = `State Nodal (${officer.state})`;
        else if (officer.role === 'district_officer') roleLabel = `District Officer (${officer.district})`;
        else if (officer.role === 'mp_dashboard') roleLabel = `MP Dashboard (${officer.district} Constituency)`;

        window.showToast(`Active Jurisdiction: ${roleLabel} ✓`, 'success');

        // Reload active view
        this.refreshCurrentView();
      } catch (err) {
        console.error('Role switch failed:', err);
        window.showToast(`Role switch failed: ${err.message}`, 'error');
      }
    });
  }

  updateOfficerHeaderHud() {
    const profile = OfficerAuth.getOfficerProfile();
    const idEl = document.querySelector('.officer-hud-badge .officer-id');
    const jurEl = document.querySelector('.officer-hud-badge .officer-jurisdiction');

    if (idEl) idEl.textContent = profile.id;
    if (jurEl) {
      let jurText = profile.jurisdiction;
      if (profile.role === 'national_admin') jurText = 'ALL DISTRICTS (MoSPI)';
      else if (profile.role === 'state_nodal') jurText = `STATE SCOPE (${profile.jurisdiction})`;
      else if (profile.role === 'district_officer') jurText = `DISTRICT (${profile.jurisdiction})`;
      else if (profile.role === 'mp_dashboard') jurText = `CONSTITUENCY (${profile.jurisdiction})`;
      jurEl.textContent = jurText;
    }
  }

  switchTab(tabName) {
    this.currentView = tabName;

    // Update tab button styles
    const tabButtons = document.querySelectorAll('.nav-tab-btn');
    tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    // Hide all view panels
    const viewPanels = [
      'view-worklist',
      'view-fund-tracking',
      'view-progress-delays',
      'view-compliance',
      'view-detail'
    ];

    viewPanels.forEach(pId => {
      const panel = document.getElementById(pId);
      if (panel) panel.classList.remove('active');
    });

    const bcDetailWrap = document.getElementById('breadcrumb-detail-wrap');
    if (bcDetailWrap) bcDetailWrap.style.display = 'none';

    // Show target panel
    const targetPanelId = `view-${tabName}`;
    const targetPanel = document.getElementById(targetPanelId);
    if (targetPanel) {
      targetPanel.classList.add('active');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Load data for selected view
    this.refreshCurrentView();
  }

  refreshCurrentView() {
    if (this.currentView === 'worklist') {
      WorklistView.load();
    } else if (this.currentView === 'fund-tracking') {
      FundTrackingView.load();
    } else if (this.currentView === 'progress-delays') {
      ProgressDelaysView.load();
    } else if (this.currentView === 'compliance') {
      ComplianceView.load();
    }
  }

  navigateToProject(workId) {
    this.currentView = 'detail';

    // Update tab buttons: deselect
    document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));

    const viewPanels = [
      'view-worklist',
      'view-fund-tracking',
      'view-progress-delays',
      'view-compliance'
    ];
    viewPanels.forEach(pId => {
      const p = document.getElementById(pId);
      if (p) p.classList.remove('active');
    });

    const viewDetail = document.getElementById('view-detail');
    const bcDetailWrap = document.getElementById('breadcrumb-detail-wrap');
    const bcDetailId = document.getElementById('breadcrumb-detail-id');

    if (viewDetail) viewDetail.classList.add('active');
    if (bcDetailWrap) bcDetailWrap.style.display = 'inline-flex';
    if (bcDetailId) bcDetailId.textContent = workId;

    window.scrollTo({ top: 0, behavior: 'smooth' });
    DetailView.load(workId);
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        console.log('Officer Dashboard SW registered:', reg.scope);
      }).catch(err => {
        console.warn('SW registration failed:', err);
      });
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new OfficerDashboardApp();
  app.init();
});
