/**
 * ============================================================================
 * MPLADS Risk Intelligence System — Master Application Controller
 * Team Neural Nova (SIH26102)
 *
 * Bootstraps views, manages navigation, provides toast notifications,
 * and orchestrates offline sync.
 * ============================================================================
 */

import { WorklistView } from './views/worklist.js';
import { DetailView } from './views/detail.js';
import { FieldCaptureView } from './views/field-capture.js';
import { ApiClient } from './api.js';
import { OfficerDB } from './db.js';
import { OfficerAuth } from './auth.js';

class OfficerDashboardApp {
  constructor() {
    this.currentView = 'worklist';
  }

  async init() {
    console.log('Initializing MPLADS Officer Verification Dashboard...');

    this.setupGlobalToasts();
    this.setupNetworkMonitoring();
    this.setupQuickSearch();
    this.setupNavigation();
    this.registerServiceWorker();

    // Initialize subviews
    WorklistView.init((workId) => this.navigateToProject(workId));

    DetailView.init({
      onFeedbackApplied: (workId, result) => {
        // Refresh worklist silently in background
        WorklistView.load();
      },
      onFieldCaptureTrigger: (workId, project) => {
        FieldCaptureView.open(workId, project);
      }
    });

    FieldCaptureView.init({
      onCaptureCompleted: (workId) => {
        // Refresh detail view
        DetailView.load(workId);
      }
    });

    // Initial load: authenticate auditor session and load scoped worklist
    await OfficerAuth.ensureAuthenticated();
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
          // Re-package and upload
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
            // If currently on detail view, or directly jump to first match
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

    const goHome = () => this.navigateToWorklist();

    if (brandLink) brandLink.addEventListener('click', goHome);
    if (breadcrumbWorklist) breadcrumbWorklist.addEventListener('click', goHome);
  }

  navigateToWorklist() {
    this.currentView = 'worklist';
    const viewWorklist = document.getElementById('view-worklist');
    const viewDetail = document.getElementById('view-detail');
    const bcDetailWrap = document.getElementById('breadcrumb-detail-wrap');

    if (viewWorklist) viewWorklist.classList.add('active');
    if (viewDetail) viewDetail.classList.remove('active');
    if (bcDetailWrap) bcDetailWrap.style.display = 'none';

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navigateToProject(workId) {
    this.currentView = 'detail';
    const viewWorklist = document.getElementById('view-worklist');
    const viewDetail = document.getElementById('view-detail');
    const bcDetailWrap = document.getElementById('breadcrumb-detail-wrap');
    const bcDetailId = document.getElementById('breadcrumb-detail-id');

    if (viewWorklist) viewWorklist.classList.remove('active');
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
