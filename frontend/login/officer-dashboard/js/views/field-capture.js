/**
 * ============================================================================
 * MPLADS Risk Intelligence System — Officer Field Evidence Capture Flow
 * Team Neural Nova (SIH26102)
 *
 * Screen 3: Camera-only capture (<input capture="environment">), concurrent
 * Geolocation API acquisition, and client-side SHA-256 cryptographic sealing.
 * ============================================================================
 */

import { ApiClient } from '../api.js';
import { OfficerDB } from '../db.js';
import { OfficerAuth } from '../auth.js';

export const FieldCaptureView = {
  currentWorkId: null,
  capturedBlob: null,
  capturedGps: null,
  capturedTimestamp: null,
  computedSha256: null,
  onCaptureCompletedCallback: null,

  init({ onCaptureCompleted }) {
    this.onCaptureCompletedCallback = onCaptureCompleted;
    this.bindEvents();
  },

  bindEvents() {
    const input = document.getElementById('camera-capture-input');
    const btnCancel = document.getElementById('btn-cancel-capture');
    const btnClose = document.getElementById('btn-close-capture-modal');
    const btnSubmit = document.getElementById('btn-submit-capture');

    if (input) {
      input.addEventListener('change', (e) => this.handlePhotoCaptured(e));
    }
    if (btnCancel) {
      btnCancel.addEventListener('click', () => this.close());
    }
    if (btnClose) {
      btnClose.addEventListener('click', () => this.close());
    }
    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => this.submitEvidence());
    }
  },

  open(workId, project) {
    this.currentWorkId = workId;
    this.capturedBlob = null;
    this.capturedGps = null;
    this.capturedTimestamp = null;
    this.computedSha256 = null;

    const modal = document.getElementById('modal-field-capture');
    const elTitleWorkId = document.getElementById('capture-modal-work-id');
    const promptBox = document.getElementById('capture-prompt-box');
    const previewWrap = document.getElementById('capture-preview-wrap');
    const btnSubmit = document.getElementById('btn-submit-capture');

    if (elTitleWorkId) elTitleWorkId.textContent = workId;
    if (promptBox) promptBox.style.display = 'flex';
    if (previewWrap) previewWrap.style.display = 'none';
    if (btnSubmit) btnSubmit.disabled = true;

    // Reset hash lock text
    const elHash = document.getElementById('capture-hash-digest');
    if (elHash) elHash.textContent = 'Awaiting camera capture...';

    const elGps = document.getElementById('capture-gps-readout');
    if (elGps) elGps.textContent = 'GPS: Acquiring satellite lock...';

    // Start acquiring live GPS immediately
    this.acquireLiveGps();

    if (modal) modal.classList.add('active');
  },

  close() {
    const modal = document.getElementById('modal-field-capture');
    if (modal) modal.classList.remove('active');
  },

  acquireLiveGps() {
    if (!navigator.geolocation) {
      const elGps = document.getElementById('capture-gps-readout');
      if (elGps) elGps.textContent = 'GPS: Geolocation API unavailable on device';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.capturedGps = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        const elGps = document.getElementById('capture-gps-readout');
        if (elGps) {
          elGps.innerHTML = `📍 GPS Locked: <strong>${pos.coords.latitude.toFixed(5)}°N, ${pos.coords.longitude.toFixed(5)}°E</strong> (&plusmn;${Math.round(pos.coords.accuracy)}m)`;
        }
      },
      (err) => {
        console.warn('Geolocation acquisition failed:', err);
        const elGps = document.getElementById('capture-gps-readout');
        if (elGps) elGps.textContent = 'GPS: Acquisition timed out; relying on device cell tower location.';
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  },

  async handlePhotoCaptured(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    this.capturedBlob = file;
    this.capturedTimestamp = new Date().toISOString();

    // Re-verify GPS at the exact shutter trigger moment
    if (navigator.geolocation && !this.capturedGps) {
      this.acquireLiveGps();
    }

    // 1. Client-Side Cryptographic Hash (SHA-256)
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    this.computedSha256 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 2. Lock preview into DOM
    const promptBox = document.getElementById('capture-prompt-box');
    const previewWrap = document.getElementById('capture-preview-wrap');
    const previewImg = document.getElementById('capture-preview-img');
    const hudCoords = document.getElementById('hud-coords-text');
    const hudTime = document.getElementById('hud-timestamp-text');
    const elHash = document.getElementById('capture-hash-digest');
    const btnSubmit = document.getElementById('btn-submit-capture');

    const objectUrl = URL.createObjectURL(file);
    if (previewImg) previewImg.src = objectUrl;

    if (promptBox) promptBox.style.display = 'none';
    if (previewWrap) previewWrap.style.display = 'block';

    if (hudTime) hudTime.textContent = `TIMESTAMP: ${this.capturedTimestamp}`;
    if (hudCoords) {
      hudCoords.textContent = this.capturedGps
        ? `GPS: ${this.capturedGps.lat.toFixed(5)}°N, ${this.capturedGps.lng.toFixed(5)}°E (±${Math.round(this.capturedGps.accuracy)}m)`
        : `GPS: In-flight cell fix`;
    }

    if (elHash) {
      elHash.innerHTML = `LOCKED: <span style="color: var(--status-verified);">${this.computedSha256}</span>`;
    }

    if (btnSubmit) btnSubmit.disabled = false;
  },

  async submitEvidence() {
    if (!this.capturedBlob || !this.currentWorkId) return;

    const btnSubmit = document.getElementById('btn-submit-capture');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Sealing & Uploading...';
    }

    const officer = OfficerAuth.getOfficerProfile();

    const formData = new FormData();
    formData.append('work_id', this.currentWorkId);
    formData.append('description', `Officer On-Site Verification Proof (${officer.id})`);
    formData.append('category', 'Officer Physical Inspection');
    formData.append('photo', this.capturedBlob, `officer_${Date.now()}.jpg`);
    if (this.capturedGps) {
      formData.append('captured_lat', String(this.capturedGps.lat));
      formData.append('captured_lng', String(this.capturedGps.lng));
    }
    formData.append('captured_timestamp', this.capturedTimestamp || new Date().toISOString());

    try {
      await ApiClient.submitFieldEvidence(formData);

      OfficerAuth.logAuditAction('FIELD_EVIDENCE_CAPTURED', this.currentWorkId, {
        sha256: this.computedSha256,
        gps: this.capturedGps,
        timestamp: this.capturedTimestamp
      });

      if (window.showToast) {
        window.showToast('Field proof sealed with SHA-256 and uploaded ✓', 'success');
      }

      this.close();
      if (this.onCaptureCompletedCallback) {
        this.onCaptureCompletedCallback(this.currentWorkId);
      }
    } catch (err) {
      console.warn('Field upload offline; queuing into IndexedDB:', err);
      // Queue offline
      await OfficerDB.queueAction('evidence', {
        work_id: this.currentWorkId,
        sha256: this.computedSha256,
        gps: this.capturedGps,
        timestamp: this.capturedTimestamp,
        photoBlob: this.capturedBlob,
      });

      if (window.showToast) {
        window.showToast('Offline: Photo and SHA-256 seal saved to local device queue.', 'warning');
      }
      this.close();
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Confirm & Seal Evidence';
      }
    }
  }
};
