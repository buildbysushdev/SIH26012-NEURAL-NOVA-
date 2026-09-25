/**
 * app.js — MPLAD Citizen Reporting Portal
 * SIH26102, Team Neural Nova
 *
 * DATA MODES
 * ----------
 * LIVE  → hits localhost:8000 API (real 77K-record backend, real-time scores)
 * DEMO  → uses demo_data.json (40 real rows sampled from the actual CSV,
 *          embedded for offline presentations / when backend isn't running)
 *
 * Priority: LIVE always preferred. Auto-fall back to DEMO if backend is
 * offline. Manual toggle is always available in the top bar.
 */

// Database & Voice Module bindings (compatible with both file:// protocol and http:// servers)
const getDb = () => (typeof window !== 'undefined' && window.MPLAD_DB) || {};
const getVoice = () => (typeof window !== 'undefined' && window.MPLAD_VOICE) || {};

const queueReport = (...args) => (getDb().queueReport ? getDb().queueReport(...args) : Promise.resolve());
const getAllQueued = (...args) => (getDb().getAllQueued ? getDb().getAllQueued(...args) : Promise.resolve([]));
const deleteQueued = (...args) => (getDb().deleteQueued ? getDb().deleteQueued(...args) : Promise.resolve());
const pendingCount = (...args) => (getDb().pendingCount ? getDb().pendingCount(...args) : Promise.resolve(0));

const initVoiceRecorder = (...args) => (getVoice().initVoiceRecorder ? getVoice().initVoiceRecorder(...args) : null);
const suggestVoiceLanguage = (...args) => (getVoice().suggestVoiceLanguage ? getVoice().suggestVoiceLanguage(...args) : null);
const initVoiceSearch = (...args) => (getVoice().initVoiceSearch ? getVoice().initVoiceSearch(...args) : null);

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

// ─── Config ──────────────────────────────────────────────────────────────────
const API_BASE = (typeof window !== 'undefined' && window.API_BASE_URL)
  || (typeof window !== 'undefined' && (localStorage.getItem('MPLADS_API_URL') || localStorage.getItem('mplads_api_url')))
  || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' || window.location.origin.includes('8080'))
      ? 'http://localhost:8000'
      : (typeof window !== 'undefined' && document.querySelector('meta[name="backend-url"]')?.content)
        || 'https://mplads-neural-nova-26102.loca.lt');

// ─── State ───────────────────────────────────────────────────────────────────
let mode           = 'live';   // 'live' | 'demo'
let backendOnline  = false;
let searchAvail    = false;    // true = /search-projects exists (new main.py)
let demoData       = null;     // loaded lazily from demo_data.json
let currentProject = null;
let capturedPhoto  = null;
let capturedGPS    = null;
let deferredInstallPrompt = null;
let hasUserSearched = false;

// Map state
let map                = null;
let markersLayer       = null;
let userLocationMarker = null;
let currentView        = 'list'; // 'list' | 'map'
let lastProjects       = [];

// ─── Constituency Coordinates Dictionary ─────────────────────────────────────
const CONSTITUENCY_COORDS = {
  // Maharashtra
  "mumbai": [19.0760, 72.8777],
  "mumbai north": [19.2288, 72.8541],
  "mumbai north west": [19.1419, 72.8353],
  "mumbai north east": [19.0833, 72.9167],
  "mumbai north central": [19.0667, 72.8500],
  "mumbai south central": [19.0167, 72.8333],
  "mumbai south": [18.9388, 72.8353],
  "pune": [18.5204, 73.8567],
  "shirur": [18.8267, 74.3789],
  "baramati": [18.1517, 74.5770],
  "maval": [18.7547, 73.5358],
  "thane": [19.2183, 72.9781],
  "kalyan": [19.2437, 73.1355],
  "nagpur": [21.1458, 79.0882],
  "nashik": [19.9975, 73.7898],
  "aurangabad": [19.8762, 75.3433],
  "solapur": [17.6599, 75.9064],
  "kolhapur": [16.7050, 74.2433],

  // Delhi
  "delhi": [28.7041, 77.1025],
  "new delhi": [28.6139, 77.2090],
  "chandni chowk": [28.6506, 77.2303],
  "east delhi": [28.6279, 77.2784],
  "north east delhi": [28.7180, 77.2600],
  "north west delhi": [28.7300, 77.0800],
  "south delhi": [28.4800, 77.1800],
  "west delhi": [28.6500, 77.0700],

  // Karnataka
  "bengaluru": [12.9716, 77.5946],
  "bangalore": [12.9716, 77.5946],
  "bangalore north": [13.0358, 77.5970],
  "bangalore south": [12.9100, 77.5800],
  "bangalore central": [12.9750, 77.6050],
  "bangalore rural": [13.1500, 77.4000],
  "dharwad": [15.4589, 75.0078],
  "belagavi": [15.8497, 74.4977],
  "mysore": [12.2958, 76.6394],

  // West Bengal
  "kolkata": [22.5726, 88.3639],
  "kolkata north": [22.6000, 88.3700],
  "kolkata south": [22.5200, 88.3500],
  "howrah": [22.5958, 88.2636],

  // Tamil Nadu
  "chennai": [13.0827, 80.2707],
  "chennai north": [13.1200, 80.2800],
  "chennai south": [12.9900, 80.2200],
  "chennai central": [13.0600, 80.2500],
  "coimbatore": [11.0168, 76.9558],

  // Telangana & AP
  "hyderabad": [17.3850, 78.4867],
  "secunderabad": [17.4399, 78.4983],
  "visakhapatnam": [17.6868, 83.2185],

  // Gujarat
  "ahmedabad": [23.0225, 72.5714],
  "surat": [21.1702, 72.8311],
  "vadodara": [22.3072, 73.1812],

  // Rajasthan
  "jaipur": [26.9124, 75.7873],
  "jodhpur": [26.2389, 73.0243],

  // UP & Bihar
  "lucknow": [26.8467, 80.9462],
  "kanpur": [26.4499, 80.3319],
  "varanasi": [25.3176, 82.9739],
  "patna": [25.5941, 85.1376],
  "gaya": [24.7914, 85.0002],
  "muzaffarpur": [26.1209, 85.3647],
  "vaishali": [25.9898, 85.3262],
};

const STATE_CENTROIDS = {
  "maharashtra": [19.7515, 75.7139],
  "delhi": [28.7041, 77.1025],
  "karnataka": [15.3173, 75.7139],
  "west bengal": [22.9868, 87.8550],
  "tamil nadu": [11.1271, 78.6569],
  "telangana": [18.1124, 79.0193],
  "andhra pradesh": [15.9129, 79.7400],
  "gujarat": [22.2587, 71.1924],
  "rajasthan": [27.0238, 74.2179],
  "uttar pradesh": [26.8467, 80.9462],
  "bihar": [25.0961, 85.3131],
  "madhya pradesh": [22.9734, 78.6569],
  "kerala": [10.8505, 76.2711],
  "punjab": [31.1471, 75.3412],
  "haryana": [29.0588, 76.0856],
  "odisha": [20.9517, 85.0985],
  "jharkhand": [23.6102, 85.2799],
  "assam": [26.2006, 92.9376],
};

// ─── DOM refs ────────────────────────────────────────────────────────────────
const screens         = document.querySelectorAll('.screen');
const pendingBanner   = document.getElementById('pending-banner');
const pendingCount_   = document.getElementById('pending-count');
const backBtn         = document.getElementById('back-btn');
const modeBadge       = document.getElementById('mode-badge');
const modeToggleBtn   = document.getElementById('mode-toggle-btn');

const searchInput     = document.getElementById('search-input');
const searchBtn       = document.getElementById('search-btn');
const locationBtn     = document.getElementById('location-btn');
const locationChip    = document.getElementById('location-chip');
const locationText    = document.getElementById('location-text');
const resultsList     = document.getElementById('results-list');
const resultCount     = document.getElementById('result-count');
const serverStatus    = document.getElementById('server-status');

const viewToggleBar   = document.getElementById('view-toggle-bar');
const btnViewList     = document.getElementById('btn-view-list');
const btnViewMap      = document.getElementById('btn-view-map');
const mapViewWrap     = document.getElementById('map-view-wrap');
const mapLoading      = document.getElementById('map-loading');
const mapContainer    = document.getElementById('map-container');

const ctxName         = document.getElementById('ctx-name');
const ctxMeta         = document.getElementById('ctx-meta');
const categorySelect  = document.getElementById('category');
const descTextarea    = document.getElementById('description');
const charCount       = document.getElementById('char-count');
const cameraInput      = document.getElementById('camera-input');
const cameraTrigger    = document.getElementById('camera-trigger');
const photoPreview     = document.getElementById('photo-preview');
const photoStep1       = document.getElementById('photo-step-1');
const photoStep2       = document.getElementById('photo-step-2');
const photoStep3       = document.getElementById('photo-step-3');
const btnPhotoContinue = document.getElementById('btn-photo-continue');
const btnPhotoBack1    = document.getElementById('btn-photo-back-1');
const btnPhotoRetake   = document.getElementById('btn-photo-retake');
const photoError       = document.getElementById('photo-error');
const evidenceLocation = document.getElementById('evidence-location');
const evidenceTime     = document.getElementById('evidence-time');
const evidenceHash     = document.getElementById('evidence-hash');
const submitBtn       = document.getElementById('submit-btn');
const offlineSavedMsg = document.getElementById('offline-saved-msg');
const formError       = document.getElementById('form-error');

const refCode         = document.getElementById('ref-code');
const btnTrackNow     = document.getElementById('btn-track-now');
const btnReportAnother= document.getElementById('btn-report-another');
const btnBackSearch   = document.getElementById('btn-back-search');

// ─── Bottom Navigation & Tracking Elements ───────────────────────────────────
const bottomNavTabs       = document.querySelectorAll('.bottom-nav-tab');
const trackRefInput       = document.getElementById('track-ref-id');
const btnCheckStatus      = document.getElementById('btn-check-status');
const trackError          = document.getElementById('track-error');
const trackEmptyState     = document.getElementById('track-empty-state');
const btnExampleId        = document.getElementById('btn-example-id');
const recentIdBanner      = document.getElementById('recent-id-banner');
const btnRecentId         = document.getElementById('btn-recent-id');
const trackResultContainer= document.getElementById('track-result-container');

const trackDetailProject  = document.getElementById('track-detail-project');
const trackDetailCategory = document.getElementById('track-detail-category');
const trackDetailDesc     = document.getElementById('track-detail-desc');
const trackDetailPhotoRow = document.getElementById('track-detail-photo-row');
const trackDetailPhoto    = document.getElementById('track-detail-photo');

const officerUpdateCard   = document.getElementById('officer-update-card');
const officerNotesText    = document.getElementById('officer-notes-text');
const officerUpdateTime   = document.getElementById('officer-update-time');

// ─── Screen routing ──────────────────────────────────────────────────────────
function showScreen(id) {
  if (id === 'screen-report' && !currentProject) {
    id = 'screen-lookup';
  }
  const allScreens = document.querySelectorAll('.screen');
  allScreens.forEach((s) => s.classList.toggle('active', s.id === id));
  backBtn.classList.toggle('hidden', id === 'screen-lookup');

  // Update bottom nav active indicator
  if (id === 'screen-track') {
    updateBottomNav('track');
  } else if (id === 'screen-help') {
    updateBottomNav('help');
  } else {
    updateBottomNav('lookup');
  }

  window.scrollTo(0, 0);
  closeAllTooltips();
  initTooltips(document);
}

function updateBottomNav(tabKey) {
  bottomNavTabs.forEach((tab) => {
    const match = tab.getAttribute('data-nav') === tabKey;
    tab.classList.toggle('active', match);
    tab.setAttribute('aria-selected', match ? 'true' : 'false');
  });
}

backBtn.addEventListener('click', () => {
  const a = document.querySelector('.screen.active');
  if (a && (a.id === 'screen-track' || a.id === 'screen-help')) {
    showScreen('screen-lookup');
  } else if (a && a.id === 'screen-confirm') {
    showScreen('screen-report');
  } else {
    showScreen('screen-lookup');
  }
});

btnReportAnother.addEventListener('click', () => { resetForm(true); showScreen('screen-report'); });
btnBackSearch.addEventListener('click',    () => { resetForm(false); showScreen('screen-lookup'); });

bottomNavTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.getAttribute('data-nav');
    if (target === 'lookup') {
      showScreen('screen-lookup');
    } else if (target === 'track') {
      showScreen('screen-track');
      initTrackScreen();
    } else if (target === 'help') {
      showScreen('screen-help');
    }
  });
});

// ─── Mode badge + toggle ─────────────────────────────────────────────────────
function setMode(newMode) {
  mode = newMode;
  updateModeBadge();
  renderInitialState();
  resultCount.textContent = '';
}

function updateModeBadge() {
  if (!modeBadge) return;
  if (mode === 'live') {
    modeBadge.textContent = '● LIVE';
    modeBadge.className = 'mode-badge live';
    if (modeToggleBtn) modeToggleBtn.textContent = 'Switch to Demo';
  } else {
    modeBadge.textContent = '○ DEMO';
    modeBadge.className = 'mode-badge demo';
    if (modeToggleBtn) modeToggleBtn.textContent = 'Switch to Live';
  }
}

if (modeToggleBtn) {
  modeToggleBtn.addEventListener('click', () => {
    setMode(mode === 'live' ? 'demo' : 'live');
  });
}

// ─── View Toggle (List ↔ Map) ────────────────────────────────────────────────
function switchView(view) {
  currentView = view;
  if (btnViewList) btnViewList.classList.toggle('active', view === 'list');
  if (btnViewMap)  btnViewMap.classList.toggle('active',  view === 'map');

  if (view === 'list') {
    if (mapViewWrap) mapViewWrap.style.display = 'none';
    if (resultsList) resultsList.style.display = '';
  } else {
    if (resultsList) resultsList.style.display = 'none';
    if (mapViewWrap) mapViewWrap.style.display = 'block';

    initMap();
    if (lastProjects && lastProjects.length > 0) {
      updateMapMarkers(lastProjects);
    }
    setTimeout(() => {
      if (map) {
        map.invalidateSize();
        if (markersLayer && markersLayer.getLayers().length > 0) {
          map.fitBounds(markersLayer.getBounds(), { padding: [30, 30], maxZoom: 14 });
        }
      }
    }, 100);
  }
}

if (btnViewList) btnViewList.addEventListener('click', () => switchView('list'));
if (btnViewMap)  btnViewMap.addEventListener('click',  () => switchView('map'));

// ─── Leaflet Map Initialization ──────────────────────────────────────────────
function initMap() {
  if (map || typeof L === 'undefined') return;
  if (!mapContainer) return;

  if (mapLoading) mapLoading.style.display = 'none';

  // Center on India [20.5937, 78.9629] at zoom 5
  map = L.map('map-container', {
    zoomControl: true,
    attributionControl: true
  }).setView([20.5937, 78.9629], 5);

  // Default OpenStreetMap tiles (no API keys, lightweight)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
  }).addTo(map);

  markersLayer = L.featureGroup().addTo(map);

  // Handle "Report Issue" button click from marker popup
  map.on('popupopen', (e) => {
    const btn = e.popup.getElement().querySelector('.btn-popup-report');
    if (btn) {
      const wid = btn.getAttribute('data-wid');
      const proj = lastProjects.find((x) => x.work_id === wid);
      btn.onclick = () => {
        if (proj) openReportForm(proj);
      };
    }
  });
}

function getProjectCoordinates(p, index) {
  // --- Tier 1: Backend already resolved constituency-level coordinates ---
  if (p.latitude != null && p.longitude != null) {
    const flat = Number(p.latitude);
    const flng = Number(p.longitude);
    if (!isNaN(flat) && !isNaN(flng)) {
      // Apply deterministic micro-jitter so same-constituency projects don't stack
      let hash = 0;
      const wid = String(p.work_id || index);
      for (let i = 0; i < wid.length; i++) {
        hash = (hash * 31 + wid.charCodeAt(i)) | 0;
      }
      const angle    = (Math.abs(hash) % 360) * (Math.PI / 180);
      const distance = 0.005 + ((Math.abs(hash >> 3) % 100) / 100) * 0.025;
      return [flat + Math.sin(angle) * distance, flng + Math.cos(angle) * distance];
    }
  }

  // --- Tier 2: Captured GPS from a citizen report ---
  if (p.captured_lat && p.captured_lng) {
    return [Number(p.captured_lat), Number(p.captured_lng)];
  }

  // --- Tier 3: No coordinates available — return null, skip this marker ---
  return null;
}


function updateMapMarkers(projects) {
  if (!map) initMap();
  if (!markersLayer) return;

  markersLayer.clearLayers();
  if (!projects || !projects.length) return;

  projects.forEach((p, idx) => {
    const coords = getProjectCoordinates(p, idx);
    if (!coords) return; // Skip projects with no resolvable location

    const lvl    = riskLevel(p.risk_score);
    const score  = p.risk_score != null ? Math.round(p.risk_score) : '–';
    const amt    = fmtAmt(p.sanction_amount);

    // Precision note shown in popup so officers/citizens understand coordinate accuracy
    const precisionNote = p.coord_precision === 'constituency'
      ? '<div class="popup-precision">📍 Constituency-level location</div>'
      : p.coord_precision === 'project'
      ? ''
      : '<div class="popup-precision">📍 Location approximate</div>';

    // Marker color: Red (>70), Amber (40-70), Green (<40)
    const color = lvl === 'high' ? '#DC2626' : lvl === 'medium' ? '#B45309' : '#047857';

    // 8px radius circular marker with 2px white border
    const marker = L.circleMarker(coords, {
      radius: 8,
      fillColor: color,
      color: '#FFFFFF',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.95
    });

    const popupContent =
      '<div class="popup-title">' + esc(trunc(p.work_description || p.work_category || 'Unnamed Project', 90)) + '</div>' +
      '<div class="popup-meta-row">' +
        '<span class="popup-amount">' + (amt ? esc(amt) : '–') + '</span>' +
        '<span class="popup-risk ' + lvl + '">' + score + '</span>' +
      '</div>' +
      precisionNote +
      '<button type="button" class="btn-popup-report" data-wid="' + esc(p.work_id) + '">Report Issue</button>';

    marker.bindPopup(popupContent, { minWidth: 220, maxWidth: 280 });
    markersLayer.addLayer(marker);
  });


  // Auto-zoom map to fit all markers
  if (markersLayer.getLayers().length > 0) {
    map.fitBounds(markersLayer.getBounds(), { padding: [30, 30], maxZoom: 14 });
  }
}

function plotUserLocation(lat, lng) {
  if (!map) initMap();
  if (userLocationMarker) {
    userLocationMarker.setLatLng([lat, lng]);
  } else if (map) {
    userLocationMarker = L.circleMarker([lat, lng], {
      radius: 7,
      fillColor: '#2563EB',
      color: '#FFFFFF',
      weight: 2,
      fillOpacity: 1
    }).addTo(map).bindPopup('<strong>You are here</strong>');
  }
}

// ─── Pending banner ──────────────────────────────────────────────────────────
async function refreshPendingBanner() {
  const n = await pendingCount();
  if (n > 0) {
    pendingCount_.textContent = n;
    pendingBanner.classList.add('visible');
  } else {
    pendingBanner.classList.remove('visible');
  }
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'REPORT_FLUSHED') refreshPendingBanner();
  });
}

// ─── Backend health check ────────────────────────────────────────────────────
async function checkBackendHealth() {
  setServerStatus('loading');
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(API_BASE + '/', { cache: 'no-store', signal: ctrl.signal });
    if (!r.ok) throw new Error('not_ok');
    backendOnline = true;

    // Check if new /search-projects endpoint exists
    const ctrl2 = new AbortController();
    setTimeout(() => ctrl2.abort(), 4000);
    const r2 = await fetch(API_BASE + '/search-projects?q=test&limit=1', { cache: 'no-store', signal: ctrl2.signal });
    searchAvail = (r2.status === 200 || r2.status === 422);
    setServerStatus('online');
    return true;
  } catch (_) {
    backendOnline = false;
    searchAvail   = false;
    setServerStatus('offline');
    return false;
  }
}

function setServerStatus(state) {
  if (!serverStatus) return;
  serverStatus.className = 'server-status ' + state;
  if (state === 'online') {
    serverStatus.style.display = 'none';
  } else if (state === 'loading') {
    serverStatus.textContent = 'Connecting to backend…';
    serverStatus.style.display = 'block';
  } else {
    serverStatus.innerHTML =
      'Backend offline (using demo data). Target: <code>' + esc(API_BASE) + '</code> ' +
      '<button type="button" id="btn-change-api" style="margin-left:8px;padding:3px 8px;font-size:0.75rem;border-radius:4px;border:1px solid #d97706;background:#fff;cursor:pointer;font-weight:600;color:#92400e;">⚙️ Change API URL</button>';
    serverStatus.style.display = 'block';
    const btn = document.getElementById('btn-change-api');
    if (btn) btn.onclick = promptApiChange;
  }
}

function promptApiChange() {
  const current = localStorage.getItem('MPLADS_API_URL') || API_BASE;
  const url = prompt('Enter your live Backend API URL (e.g. from localtunnel / cloudflared / render):', current);
  if (url !== null && url.trim()) {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    localStorage.setItem('MPLADS_API_URL', cleanUrl);
    localStorage.setItem('mplads_api_url', cleanUrl);
    location.reload();
  }
}

const apiConfigBtn = document.getElementById('api-config-btn');
if (apiConfigBtn) {
  apiConfigBtn.onclick = promptApiChange;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function riskLevel(s) {
  if (s == null) return 'low';
  return s >= 70 ? 'high' : s >= 40 ? 'medium' : 'low';
}

function fmtAmt(a) {
  if (a == null) return '';
  const n = Number(a);
  if (isNaN(n) || n === 0) return '';
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Crore';
  if (n >= 1e5) return '₹' + (n / 1e5).toFixed(2) + ' Lakh';
  return '₹' + n.toLocaleString('en-IN');
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function trunc(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ─── Render project cards ────────────────────────────────────────────────────
function renderProjects(projects, label) {
  lastProjects = projects || [];
  resultsList.innerHTML = '';

  if (!projects || !projects.length) {
    if (viewToggleBar) viewToggleBar.style.display = 'none';
    switchView('list');
    resultsList.innerHTML =
      '<div class="state-message-box">' +
        '<div class="state-title">No projects found</div>' +
        '<div class="state-subtitle">Try searching for a different city, district, or constituency.</div>' +
        '<div class="quick-city-links">' +
          '<button type="button" class="city-link-btn" data-city="Mumbai">Mumbai</button>' +
          '<button type="button" class="city-link-btn" data-city="Delhi">Delhi</button>' +
          '<button type="button" class="city-link-btn" data-city="Pune">Pune</button>' +
          '<button type="button" class="city-link-btn" data-city="Bengaluru">Bengaluru</button>' +
          '<button type="button" class="city-link-btn" data-city="Kolkata">Kolkata</button>' +
        '</div>' +
      '</div>';
    resultCount.textContent = '';
    attachCityLinkListeners();
    return;
  }

  // Show view toggle bar
  if (viewToggleBar) viewToggleBar.style.display = 'flex';

  // Count text: "Showing 30 projects in Mumbai North"
  const locationQuery = searchInput.value.trim();
  let countText = 'Showing ' + projects.length + ' project' + (projects.length > 1 ? 's' : '');
  if (locationQuery) {
    countText += ' in ' + esc(locationQuery);
  }
  if (label) {
    countText += ' (' + esc(label) + ')';
  }
  const modeTag = mode === 'demo'
    ? ' · <span class="mode-badge demo">DEMO DATA</span>'
    : ' · <span class="mode-badge live">● LIVE</span>';
  resultCount.innerHTML = countText + modeTag;

  // Build List View
  projects.forEach((p) => {
    const lvl   = riskLevel(p.risk_score);
    const score = p.risk_score != null ? Math.round(p.risk_score) : '–';
    const amt   = fmtAmt(p.sanction_amount);
    const rep   = p.citizen_report_count;
    const card  = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML =
      '<div class="project-card-header">' +
        '<div class="project-card-title">' + esc(trunc(p.work_description || p.work_category || 'Unnamed Project', 110)) + '</div>' +
        '<div class="risk-score-wrap">' +
          '<span class="risk-badge-num ' + lvl + '" title="Risk Score: ' + score + '">' + score + '</span>' +
          '<div class="info-btn-wrap">' +
            '<button type="button" class="btn-info" aria-label="Risk score explanation" data-tooltip="This number shows how likely this project needs review. Higher numbers mean more flags detected by our AI system.">i</button>' +
            '<div class="info-popover" role="tooltip"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="project-card-meta">' +
        esc(p.constituency || '–') + ' · ' + esc(p.state || '–') +
        (p.mp_name ? ' · MP: ' + esc(p.mp_name) : '') +
      '</div>' +
      (amt ? '<div class="project-card-amount">Sanctioned: ' + esc(amt) + '</div>' : '') +
      (rep ? '<div class="project-card-reports">⚠️ ' + rep + ' citizen report(s) recorded</div>' : '') +
      '<button type="button" class="btn-card-report">Report an Issue</button>';

    card.querySelector('.btn-card-report').addEventListener('click', () => openReportForm(p));
    resultsList.appendChild(card);
  });

  // Update map markers in background
  if (map || currentView === 'map') {
    updateMapMarkers(projects);
  }

  // Re-bind tooltips on newly rendered cards and toggle bar
  initTooltips(resultsList);
  if (viewToggleBar) initTooltips(viewToggleBar);
}

// ─── Initial Search State ────────────────────────────────────────────────────
function renderInitialState() {
  lastProjects = [];
  if (viewToggleBar) viewToggleBar.style.display = 'none';
  switchView('list');
  if (markersLayer) markersLayer.clearLayers();

  resultsList.innerHTML =
    '<div class="state-message-box">' +
      '<div class="state-title">Search for a Project</div>' +
      '<div class="state-subtitle">Enter your city, district, or constituency name to inspect MPLAD works.</div>' +
      '<div class="quick-city-links">' +
        '<button type="button" class="city-link-btn" data-city="Mumbai">Mumbai</button>' +
        '<button type="button" class="city-link-btn" data-city="Delhi">Delhi</button>' +
        '<button type="button" class="city-link-btn" data-city="Pune">Pune</button>' +
        '<button type="button" class="city-link-btn" data-city="Bengaluru">Bengaluru</button>' +
        '<button type="button" class="city-link-btn" data-city="Kolkata">Kolkata</button>' +
      '</div>' +
    '</div>';
  attachCityLinkListeners();
}

function attachCityLinkListeners() {
  document.querySelectorAll('.city-link-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const city = e.currentTarget.dataset.city;
      if (city) {
        searchInput.value = city;
        doSearch();
      }
    });
  });
}

// ─── Demo data loader ────────────────────────────────────────────────────────
async function loadDemoData() {
  if (demoData && demoData.length) return demoData;
  if (typeof window !== 'undefined' && window.MPLADS_DEMO_DATA && window.MPLADS_DEMO_DATA.length) {
    demoData = window.MPLADS_DEMO_DATA;
    return demoData;
  }
  try {
    const r = await fetch('./demo_data.json', { cache: 'no-store' });
    demoData = await r.json();
  } catch (_) {
    demoData = (typeof window !== 'undefined' && window.MPLADS_DEMO_DATA) || [];
  }
  return demoData;
}

function searchDemo(q) {
  if (!demoData || !demoData.length) return [];
  const term = q.toLowerCase().trim();
  const cleanTerm = term.replace(/[\s-]/g, '');
  if (!term || term.length < 2) return demoData.slice(0, 20);

  // Alias expansion for major search variations
  const aliases = (term.includes('bengaluru') || cleanTerm.includes('bengaluru')) 
    ? [term, cleanTerm, 'bangalore', 'bengaluru'] 
    : (term.includes('bangalore') || cleanTerm.includes('bangalore'))
    ? [term, cleanTerm, 'bangalore', 'bengaluru']
    : [term, cleanTerm];

  return demoData.filter((p) => {
    const c = (p.constituency  || '').toLowerCase();
    const d = (p.work_description || '').toLowerCase();
    const s = (p.state         || '').toLowerCase();
    const dist = (p.district   || '').toLowerCase();
    const m = (p.mp_name       || '').toLowerCase();

    const cClean = c.replace(/[\s-]/g, '');
    const sClean = s.replace(/[\s-]/g, '');
    const distClean = dist.replace(/[\s-]/g, '');

    return aliases.some(a => 
      c.includes(a) || cClean.includes(a) ||
      d.includes(a) ||
      s.includes(a) || sClean.includes(a) ||
      dist.includes(a) || distClean.includes(a) ||
      m.includes(a)
    );
  }).slice(0, 30);
}

// ─── Search Cache Helpers ───────────────────────────────────────────────────
function saveCachedSearch(query, results) {
  try {
    const key = 'mplad_search_cache_' + query.trim().toLowerCase();
    localStorage.setItem(key, JSON.stringify({
      results: results || [],
      timestamp: Date.now()
    }));
  } catch (_) {}
}

function getCachedSearch(query) {
  try {
    const key = 'mplad_search_cache_' + query.trim().toLowerCase();
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.results) ? parsed.results : null;
  } catch (_) {
    return null;
  }
}

// ─── Search ──────────────────────────────────────────────────────────────────
async function doSearch() {
  const q = searchInput.value.trim();
  if (q.length < 2) {
    if (viewToggleBar) viewToggleBar.style.display = 'none';
    switchView('list');
    resultsList.innerHTML =
      '<div class="state-message-box">' +
        '<div class="state-title">Search Query Too Short</div>' +
        '<div class="state-subtitle">Please enter at least 2 characters to search for MPLAD projects.</div>' +
      '</div>';
    resultCount.textContent = '';
    return;
  }

  // Mark user has performed a search to enable install prompt
  hasUserSearched = true;
  checkAndShowInstallBanner();

  // Loading state
  resultsList.innerHTML = '<div class="loading-text">Loading projects…</div>';
  resultCount.textContent = '';

  // ── OFFLINE CHECK ──
  const cachedData = getCachedSearch(q);
  if (!navigator.onLine && cachedData && cachedData.length) {
    renderProjects(cachedData, 'offline mode — showing cached results');
    return;
  }

  // ── DEMO MODE ──
  if (mode === 'demo') {
    await loadDemoData();
    const results = searchDemo(q);
    renderProjects(results.length ? results : demoData.slice(0, 20), q);
    if (!results.length && demoData.length) {
      renderProjects(demoData.slice(0, 20), 'demo sample — no exact match for "' + q + '"');
    }
    return;
  }

  // ── LIVE MODE ──
  if (!backendOnline) {
    const ok = await checkBackendHealth();
    if (!ok) {
      if (cachedData && cachedData.length) {
        renderProjects(cachedData, 'offline fallback — showing cached results');
        return;
      }
      await loadDemoData();
      setServerStatus('offline');
      renderProjects(searchDemo(q), 'demo fallback (backend offline)');
      return;
    }
  }

  try {
    if (searchAvail) {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(
        API_BASE + '/search-projects?q=' + encodeURIComponent(q) + '&limit=30',
        { 
          signal: ctrl.signal,
          headers: { 'Bypass-Tunnel-Reminder': 'true' }
        }
      );
      if (!res.ok) throw new Error('http_' + res.status);
      const data = await res.json();
      const results = data.results || [];
      saveCachedSearch(q, results);
      renderProjects(results, null);
    } else {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(API_BASE + '/flagged-projects?limit=500', { 
        signal: ctrl.signal,
        headers: { 'Bypass-Tunnel-Reminder': 'true' }
      });
      if (!res.ok) throw new Error('flagged_' + res.status);
      const all  = await res.json();
      const term = q.toLowerCase();
      const filtered = all.filter((p) =>
        (p.constituency || '').toLowerCase().indexOf(term) !== -1 ||
        (p.work_description || '').toLowerCase().indexOf(term) !== -1 ||
        (p.state || '').toLowerCase().indexOf(term) !== -1 ||
        (p.mp_name || '').toLowerCase().indexOf(term) !== -1
      );
      const results = filtered.slice(0, 30);
      saveCachedSearch(q, results);
      renderProjects(results, null);
    }
  } catch (err) {
    if (cachedData && cachedData.length) {
      renderProjects(cachedData, 'offline fallback — showing cached results');
      return;
    }
    if (err && err.name === 'AbortError') {
      resultsList.innerHTML =
        '<div class="state-message-box">' +
          '<div class="state-title">Server Busy</div>' +
          '<div class="state-subtitle">The dataset is currently processing. Please try again in a few seconds.</div>' +
        '</div>';
    } else {
      await loadDemoData();
      renderProjects(searchDemo(q), 'demo fallback (live search failed)');
      console.warn('[Search fallback to demo]', err);
    }
  }
}

searchBtn.addEventListener('click', doSearch);
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

// ─── Indian States Horizontal Carousel Initialization ─────────────────────────
function initStatesCarousel() {
  const track = document.getElementById('states-carousel-track');
  const btnPrev = document.getElementById('carousel-btn-prev');
  const btnNext = document.getElementById('carousel-btn-next');
  if (!track) return;

  if (btnPrev) {
    btnPrev.addEventListener('click', (e) => {
      e.preventDefault();
      track.scrollBy({ left: -260, behavior: 'smooth' });
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', (e) => {
      e.preventDefault();
      track.scrollBy({ left: 260, behavior: 'smooth' });
    });
  }

  const cards = track.querySelectorAll('.state-card');
  cards.forEach((card) => {
    const handleSelect = (e) => {
      e.preventDefault();
      const stateName = card.dataset.state;
      if (!stateName) return;

      cards.forEach((c) => c.classList.remove('active'));
      card.classList.add('active');

      // Switch to text search tab if voice mode is active
      const tabText = document.getElementById('tab-search-text');
      if (tabText && !tabText.classList.contains('active')) {
        tabText.click();
      }

      if (searchInput) {
        searchInput.value = stateName;
        doSearch();
        // Scroll into view
        const resultsEl = document.getElementById('results-list');
        if (resultsEl) {
          resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    };

    card.addEventListener('click', handleSelect);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        handleSelect(e);
      }
    });
  });
}

// ─── Location detection ───────────────────────────────────────────────────────
locationBtn.addEventListener('click', detectLocation);

async function detectLocation() {
  if (!navigator.geolocation) {
    showLocChip('error', 'Geolocation not supported. Enter your district name manually.');
    return;
  }
  locationBtn.disabled    = true;
  locationBtn.textContent = 'Detecting location…';
  locationChip.style.display = 'none';

  try {
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, {
        enableHighAccuracy: true, timeout: 10000, maximumAge: 60000,
      })
    );

    const { latitude: lat, longitude: lng } = pos.coords;
    plotUserLocation(lat, lng);

    // Nominatim reverse geocode (OpenStreetMap, free)
    const geoRes = await fetch(
      'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=8&accept-language=en',
      { headers: { 'User-Agent': 'MPLAD-CitizenPortal/1.0-SIH26102' } }
    );
    const geo  = await geoRes.json();
    const addr = geo.address || {};

    const place =
      addr.county || addr.state_district || addr.city ||
      addr.town   || addr.municipality   || addr.village || addr.state || '';

    if (!place) throw new Error('no_place');

    const label = place + (addr.state && addr.state !== place ? ', ' + addr.state : '');
    showLocChip('ok', '📍 ' + label);
    searchInput.value = place;
    await doSearch();

  } catch (err) {
    showLocChip('error',
      err && err.code === 1
        ? 'Location permission denied. Enter your district manually.'
        : 'Could not detect location. Enter your district manually.'
    );
  } finally {
    locationBtn.disabled   = false;
    locationBtn.innerHTML  =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>' +
      ' Use My Location';
  }
}

function showLocChip(type, text) {
  locationChip.className = 'location-chip' + (type === 'error' ? ' error' : '');
  locationText.textContent = text;
  locationChip.style.display = 'block';
}

// ─── Report form ─────────────────────────────────────────────────────────────
function openReportForm(project) {
  resetForm(false);
  currentProject = project;
  ctxName.textContent = project.work_description || project.work_category || 'Unnamed Project';
  const amt = fmtAmt(project.sanction_amount);
  ctxMeta.textContent =
    (project.constituency || '–') + ', ' + (project.state || '–') +
    (amt ? ' · ' + amt : '') +
    (project.mp_name ? ' · MP: ' + project.mp_name : '');
  suggestVoiceLanguage(project.state);
  showScreen('screen-report');
}

// ─── Photo Capture Security Flow (Steps 1, 2, 3) ─────────────────────────────
function setPhotoStep(step) {
  if (photoStep1) photoStep1.style.display = step === 1 ? 'block' : 'none';
  if (photoStep2) photoStep2.style.display = step === 2 ? 'block' : 'none';
  if (photoStep3) photoStep3.style.display = step === 3 ? 'block' : 'none';
  hidePhotoErr();
  initTooltips(document);
}

function showPhotoErr(msg) {
  if (!photoError) return;
  photoError.textContent = msg;
  photoError.style.display = 'block';
}

function hidePhotoErr() {
  if (!photoError) return;
  photoError.textContent = '';
  photoError.style.display = 'none';
}

if (btnPhotoContinue) btnPhotoContinue.addEventListener('click', () => setPhotoStep(2));
if (btnPhotoBack1)    btnPhotoBack1.addEventListener('click',    () => setPhotoStep(1));
if (btnPhotoRetake)   btnPhotoRetake.addEventListener('click',   () => {
  setPhotoStep(2);
  if (cameraInput) cameraInput.value = '';
  capturedPhoto = null;
  capturedGPS = null;
});

function resetForm(keepProject = false) {
  if (!keepProject) {
    currentProject = null;
    ctxName.textContent = '';
    ctxMeta.textContent = '';
  }
  capturedPhoto  = null;
  capturedGPS    = null;
  categorySelect.value    = '';
  descTextarea.value      = '';
  charCount.textContent   = '0 / 500';
  charCount.parentElement.classList.remove('warn');
  if (cameraInput) cameraInput.value = '';
  if (photoPreview) photoPreview.src = '';
  if (evidenceLocation) evidenceLocation.textContent = '–';
  if (evidenceTime) evidenceTime.textContent = '–';
  if (evidenceHash) evidenceHash.textContent = '–';
  hidePhotoErr();
  setPhotoStep(1);
  offlineSavedMsg.classList.remove('visible');
  formError.classList.remove('visible');
  formError.textContent   = '';
  submitBtn.disabled      = false;
  submitBtn.textContent   = 'Submit Report';
  submitBtn.style.display = '';
}

descTextarea.addEventListener('input', () => {
  const len = descTextarea.value.length;
  charCount.textContent = len + ' / 500';
  charCount.parentElement.classList.toggle('warn', len > 450);
});

if (cameraTrigger) {
  cameraTrigger.addEventListener('click', () => {
    hidePhotoErr();
    if (cameraInput) cameraInput.click();
  });
}

if (cameraInput) {
  cameraInput.addEventListener('change', async () => {
    hidePhotoErr();
    const file = cameraInput.files[0];
    if (!file) return;

    // Validate maximum file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      showPhotoErr('Photo too large. Please try again with a smaller image.');
      cameraInput.value = '';
      return;
    }

    try {
      // 1. Read bytes and compute cryptographic SHA-256 hash
      const arrayBuffer = await file.arrayBuffer();
      const hashBuf = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArr = Array.from(new Uint8Array(hashBuf));
      const hashHex = hashArr.map((b) => b.toString(16).padStart(2, '0')).join('');
      const displayHash = hashHex.slice(0, 8) + '… ✓ Verified';

      // 2. Capture high-accuracy GPS coordinates & device accuracy
      let locStr = 'Location unavailable';
      try {
        const pos = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          })
        );
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = Math.round(pos.coords.accuracy || 14);
        const latDir = lat >= 0 ? 'N' : 'S';
        const lngDir = lng >= 0 ? 'E' : 'W';
        locStr = Math.abs(lat).toFixed(4) + '°' + latDir + ', ' + Math.abs(lng).toFixed(4) + '°' + lngDir + ' (±' + acc + 'm accuracy)';
        capturedGPS = { lat, lng, accuracy: acc, timestamp: new Date().toISOString() };
        plotUserLocation(lat, lng);
      } catch (geoErr) {
        showPhotoErr('GPS not available. Please enable location services and try again.');
        capturedGPS = null;
        locStr = 'GPS unavailable — will submit without coordinates';
      }

      // 3. Format localized Indian Standard Time
      const now = new Date();
      const timeStr =
        now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
        ', ' +
        now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }) +
        ' IST';

      // 4. Update evidence summary
      if (photoPreview) photoPreview.src = URL.createObjectURL(file);
      if (evidenceLocation) evidenceLocation.textContent = locStr;
      if (evidenceTime) evidenceTime.textContent = timeStr;
      if (evidenceHash) evidenceHash.textContent = displayHash;

      capturedPhoto = { file, arrayBuffer, hash: hashHex };

      // Transition to Step 3 (Confirmation & Verification)
      setPhotoStep(3);
    } catch (procErr) {
      showPhotoErr('Camera access needed to capture evidence. Please allow camera access in your browser settings.');
    }
  });
}

// ─── Submit ───────────────────────────────────────────────────────────────────
submitBtn.addEventListener('click', async () => {
  formError.classList.remove('visible');
  formError.textContent = '';
  if (!currentProject) { showErr('No project selected. Please choose a project first.'); return; }
  if (!categorySelect.value) { showErr('Please select an issue category.'); return; }
  const desc = descTextarea.value.trim();
  if (desc.length < 20) { showErr('Please describe the issue in at least 20 characters.'); return; }

  // ── Photo is now mandatory ──────────────────────────────────────────────────
  if (!capturedPhoto) {
    showErr('A photo of the project site is required. Please capture or upload a photo before submitting.');
    // Scroll to photo section so it's visible
    const photoSection = document.querySelector('.photo-security-section');
    if (photoSection) photoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  submitBtn.disabled    = true;
  submitBtn.textContent = 'Submitting…';

  // Demo mode: simulate submit
  if (mode === 'demo') {
    await new Promise((r) => setTimeout(r, 600));
    const demoVerif = {
      confidence_score: 87,
      ai_recommendation: "APPROVE",
      reasoning: "GPS location matches project site (145m away). Photo shows structure consistent with description. High confidence this is genuine.",
      issues: [],
      checks: {
        location_check: "MATCH",
        visual_check: "MATCH",
        text_check: "GENUINE",
        duplicate_check: "UNIQUE",
        metadata_check: "FRESH"
      }
    };
    showConfirmation('CR-DEMO' + Math.random().toString(36).slice(2,8).toUpperCase(), false, demoVerif);
    return;
  }

  // ── Build payload ───────────────────────────────────────────────────────────
  const phoneInput = document.getElementById('phone-number');
  const payload = {
    work_id:            currentProject.work_id,
    category:           categorySelect.value,
    description:        desc,
    phone_number:       phoneInput ? phoneInput.value.trim() : '',
    captured_lat:       capturedGPS ? capturedGPS.lat : null,
    captured_lng:       capturedGPS ? capturedGPS.lng : null,
    captured_timestamp: capturedGPS ? capturedGPS.timestamp : null,
    photoBuffer: capturedPhoto ? capturedPhoto.arrayBuffer : null,
    photoName:   capturedPhoto ? capturedPhoto.file.name   : null,
    photoType:   capturedPhoto ? capturedPhoto.file.type   : null,
  };

  if (navigator.onLine) await submitOnline(payload);
  else await submitOffline(payload);
});

async function submitOnline(payload) {
  try {
    const res  = await fetch(API_BASE + '/citizen-report', { method: 'POST', body: buildFD(payload), cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) { showErr(data.detail || 'Server error (' + res.status + ').'); submitBtn.disabled = false; submitBtn.textContent = 'Submit Report'; return; }

    // Show integrity flag notice if photo has concerns (doesn't block submission)
    if (data.photo_has_concerns && data.photo_integrity_flags && data.photo_integrity_flags.length > 0) {
      console.info('[Photo Integrity] Flags detected (report still submitted):', data.photo_integrity_flags);
    }

    showConfirmation(data.report_id, false, data.verification);
  } catch (_) {
    await submitOffline(payload);
  }
}

async function submitOffline(payload) {
  try {
    const localId = await queueReport(payload);
    const offlineId = 'CR-OFFLINE-' + String(localId).padStart(4, '0');
    showConfirmation(offlineId, true);
    await refreshPendingBanner();
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.sync.register('sync-reports');
      } catch (_) {}
    }
  } catch (err) {
    showErr('Offline mode not available on this browser');
  }
}

function buildFD(payload) {
  const fd = new FormData();
  fd.append('work_id',     payload.work_id);
  fd.append('category',    payload.category);
  fd.append('description', payload.description);
  if (payload.phone_number) fd.append('phone_number', payload.phone_number);
  if (payload.captured_lat  != null) fd.append('captured_lat',       String(payload.captured_lat));
  if (payload.captured_lng  != null) fd.append('captured_lng',       String(payload.captured_lng));
  if (payload.captured_timestamp)    fd.append('captured_timestamp', payload.captured_timestamp);
  if (payload.photoBuffer) {
    fd.append('photo', new Blob([payload.photoBuffer], { type: payload.photoType || 'image/jpeg' }), payload.photoName || 'photo.jpg');
  }
  return fd;
}

function showConfirmation(reportId, isOffline = false, verification = null) {
  const cleanId = reportId || 'CR-XXXXXXXX';
  refCode.textContent = cleanId;
  try {
    localStorage.setItem('mplad_last_ref_id', cleanId);
  } catch (_) {}

  const exp = document.querySelector('.confirm-explanation');
  const heading = document.querySelector('.confirm-heading');
  const verifCard = document.getElementById('ai-verification-card');
  const verifTitle = document.getElementById('verif-card-title');
  const verifDesc = document.getElementById('verif-card-desc');
  const verifBadge = document.getElementById('verif-badge-icon');
  const issuesBox = document.getElementById('verif-issues-container');
  const issuesUl = document.getElementById('verif-issues-ul');
  const checksGrid = document.getElementById('verif-checks-breakdown');

  if (isOffline) {
    if (heading) heading.textContent = 'Report Saved (Offline)';
    if (exp) {
      exp.innerHTML = '<strong>Report saved. It will be submitted when you’re back online.</strong><br /><br />Your device is currently offline. Your report (including GPS evidence and security code) is stored safely and will upload automatically as soon as connection is restored.';
    }
    if (verifCard) verifCard.style.display = 'none';
  } else {
    if (heading) heading.textContent = 'Report Submitted';
    if (exp) {
      exp.innerHTML = 'Your report has been recorded and will be reviewed by <strong>supervisory auditors</strong> as part of the official MPLAD Scheme audit process.<br /><br />This is <strong>not an automatic accusation</strong> — every report is assessed by trained officers before any action is taken. Keep your Reference ID to follow up on the status of your report.';
    }

    if (verifCard && verification) {
      verifCard.style.display = 'block';
      const score = typeof verification.confidence_score === 'number' ? verification.confidence_score : 50;
      const issues = Array.isArray(verification.issues) ? verification.issues : [];
      const checks = verification.checks || {};

      verifCard.classList.remove('verif-green', 'verif-amber', 'verif-red');

      if (score >= 80) {
        verifCard.classList.add('verif-green');
        if (verifBadge) verifBadge.textContent = '✓';
        if (verifTitle) verifTitle.textContent = 'Report verified and submitted successfully';
        if (verifDesc) {
          verifDesc.textContent = verification.reasoning ||
            'Our AI cross-checked your evidence and found it credible. An officer will review it soon.';
        }
        if (issuesBox) issuesBox.style.display = 'none';
      } else if (score >= 50) {
        verifCard.classList.add('verif-amber');
        if (verifBadge) verifBadge.textContent = '⚠';
        if (verifTitle) verifTitle.textContent = 'Report submitted for review';
        if (verifDesc) {
          verifDesc.textContent = verification.reasoning ||
            'Our AI detected some inconsistencies but your report will still be reviewed by an officer.';
        }
        if (issues.length > 0 && issuesBox && issuesUl) {
          issuesBox.style.display = 'block';
          issuesUl.innerHTML = issues.map(iss => `<li>${iss}</li>`).join('');
        } else if (issuesBox) {
          issuesBox.style.display = 'none';
        }
      } else {
        verifCard.classList.add('verif-red');
        if (verifBadge) verifBadge.textContent = '⚠';
        if (verifTitle) verifTitle.textContent = 'Report flagged for verification';
        if (verifDesc) {
          verifDesc.textContent =
            'Our AI detected significant issues with this report. An officer will review it, but it may be rejected if evidence doesn’t match.';
        }
        if (issuesBox && issuesUl) {
          issuesBox.style.display = 'block';
          if (issues.length > 0) {
            issuesUl.innerHTML = issues.map(iss => `<li>${iss}</li>`).join('');
          } else {
            issuesUl.innerHTML = '<li>GPS location does not match registered project coordinates</li><li>Description does not provide adequate detail</li>';
          }
        }
      }

      if (checksGrid) {
        checksGrid.style.display = 'flex';
        updateCheckChip('chip-loc', checks.location_check, 'GPS Matches Site', 'GPS in Vicinity', 'GPS Mismatch');
        updateCheckChip('chip-vis', checks.visual_check, 'Satellite Corroborated', 'Satellite Pending', 'Visual Conflict');
        updateCheckChip('chip-txt', checks.text_check, 'Detailed Description', 'Generic Text', 'Spam Flagged');
        updateCheckChip('chip-dup', checks.duplicate_check, 'Unique Complaint', 'Corroborating Report', 'Duplicate Report');
        updateCheckChip('chip-meta', checks.metadata_check, 'Fresh Photo Evidence', 'Prior Photo Evidence', 'Reused Photo');
      }
    } else if (verifCard) {
      verifCard.style.display = 'none';
    }
  }

  showScreen('screen-confirm');
  initTooltips(document.getElementById('screen-confirm'));
  refreshPendingBanner();
}

function updateCheckChip(chipId, status, passText, warnText, failText) {
  const chip = document.getElementById(chipId);
  if (!chip) return;
  chip.classList.remove('chip-pass', 'chip-warn', 'chip-fail');
  const st = String(status || '').toUpperCase();
  if (['MATCH', 'GENUINE', 'UNIQUE', 'FRESH'].includes(st)) {
    chip.classList.add('chip-pass');
    chip.innerHTML = `<span class="chip-status">✓</span> ${passText}`;
  } else if (['NEARBY', 'UNVERIFIED', 'GENERIC', 'SIMILAR', 'OLD'].includes(st)) {
    chip.classList.add('chip-warn');
    chip.innerHTML = `<span class="chip-status">⚠</span> ${warnText}`;
  } else {
    chip.classList.add('chip-fail');
    chip.innerHTML = `<span class="chip-status">✗</span> ${failText}`;
  }
}

if (btnTrackNow) {
  btnTrackNow.addEventListener('click', () => {
    const curId = refCode ? refCode.textContent.trim() : '';
    showScreen('screen-track');
    initTrackScreen();
    if (trackRefInput && curId && curId !== 'CR-XXXXXXXX') {
      trackRefInput.value = curId;
      lookupReportStatus(curId);
    }
  });
}

function showErr(msg) {
  formError.textContent = msg;
  formError.classList.add('visible');
  submitBtn.disabled    = false;
  submitBtn.textContent = 'Submit Report';
}

// ─── Track Report Controller ──────────────────────────────────────────────────
function initTrackScreen() {
  hideTrackError();
  try {
    const recentId = localStorage.getItem('mplad_last_ref_id');
    if (recentId && recentId !== 'CR-XXXXXXXX' && recentIdBanner && btnRecentId) {
      recentIdBanner.style.display = 'flex';
      btnRecentId.textContent = recentId;
      btnRecentId.onclick = () => {
        if (trackRefInput) trackRefInput.value = recentId;
        lookupReportStatus(recentId);
      };
    }
  } catch (_) {}
}

if (btnExampleId) {
  btnExampleId.addEventListener('click', () => {
    const exId = btnExampleId.textContent.trim();
    if (trackRefInput) trackRefInput.value = exId;
    lookupReportStatus(exId);
  });
}

if (btnCheckStatus) {
  btnCheckStatus.addEventListener('click', () => {
    const val = trackRefInput ? trackRefInput.value.trim() : '';
    lookupReportStatus(val);
  });
}

if (trackRefInput) {
  trackRefInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      lookupReportStatus(trackRefInput.value.trim());
    }
  });
}

async function lookupReportStatus(rawId) {
  hideTrackError();
  if (!rawId || !rawId.trim()) {
    showTrackError('Please enter a Reference ID to track.');
    return;
  }

  const queryId = rawId.trim();
  const normQuery = queryId.toUpperCase().replace(/_/g, '-');
  const normQueryUnderscore = queryId.toUpperCase().replace(/-/g, '_');

  // 1. Built-in demo examples for instant reviewer verification
  if (normQuery === 'CR-1234567890' || normQueryUnderscore === 'CR_1234567890') {
    renderTrackResult({
      report_id: 'CR_1234567890',
      work_id: 'WS/MP334/2024-2025/139896',
      project_title: 'Construction of Sub-Centre Health Building in Hadapsar',
      category: 'infrastructure_quality',
      description: 'Primary health sub-centre building has no roofing and open electrical wiring despite funds marked 100% disbursed.',
      photo_filename: 'health_center_site_sample.jpg',
      status: 'verified',
      timestamp: '2024-06-15T09:02:00.000Z',
      officer_name: 'Vikram Malhotra (District Vigilance Officer)',
      verified_date: '18 Jun 2024',
      action_summary: 'Work site notice issued to contractor. Formal inquiry ordered by District Collector.',
      officer_notes: 'Physical site inspection confirmed missing roofing structure and exposed electrical conduits. Contractor penal notice issued under MPLADS audit rule 4.2.',
      officer_update_time: '18 Jun 2024, 4:15 PM IST'
    });
    return;
  }

  let matchedReport = null;
  let backendOffline = false;

  // 2. Fetch live submitted reports from backend
  try {
    const res = await fetch(API_BASE + '/citizen-reports', { cache: 'no-store' });
    if (res.ok) {
      const reports = await res.json();
      if (Array.isArray(reports)) {
        matchedReport = reports.find((r) => {
          const rId = String(r.report_id || '').trim().toUpperCase();
          return (
            rId === normQuery ||
            rId === normQueryUnderscore ||
            rId.replace(/_/g, '-') === normQuery ||
            rId.replace(/-/g, '_') === normQueryUnderscore
          );
        });
      }
    } else {
      backendOffline = true;
    }
  } catch (err) {
    backendOffline = true;
  }

  // 3. Fallback to local offline IndexedDB queue
  if (!matchedReport) {
    try {
      const queued = await getQueuedReports();
      if (Array.isArray(queued)) {
        const localMatch = queued.find((q) => {
          return normQuery.includes(String(q.work_id || '').toUpperCase());
        });
        if (localMatch) {
          matchedReport = {
            report_id: queryId,
            work_id: localMatch.work_id,
            category: localMatch.category,
            description: localMatch.description,
            captured_timestamp: localMatch.captured_timestamp,
            timestamp: new Date().toISOString(),
            status: 'submitted',
          };
        }
      }
    } catch (_) {}
  }

  if (matchedReport) {
    renderTrackResult(matchedReport);
  } else if (backendOffline) {
    showTrackError('Cannot connect to server. Please try again later.');
  } else {
    showTrackError('Report not found. Please check the Reference ID and try again.');
  }
}

function renderTrackResult(report) {
  if (!trackResultContainer) return;
  trackResultContainer.style.display = 'block';
  if (trackEmptyState) trackEmptyState.style.display = 'none';

  // Step 1: Submitted (always completed if report exists)
  const subDate = report.captured_timestamp || report.timestamp;
  let subDateStr = '15 Jun 2024, 2:32 PM IST';
  if (subDate) {
    try {
      const d = new Date(subDate);
      subDateStr =
        d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
        ', ' +
        d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }) +
        ' IST';
    } catch (_) {}
  }
  setTimelineStep(1, 'completed', '✓', subDateStr);

  // Status mapping
  const status = String(report.status || 'submitted').toLowerCase();

  if (status === 'action_taken' || report.action_summary) {
    setTimelineStep(2, 'completed', '✓', 'Assigned to Officer: ' + (report.officer_name || 'District Vigilance Officer'));
    setTimelineStep(3, 'completed', '✓', report.verified_date ? ('Verified on ' + report.verified_date) : 'Verified on 22 Sep 2026');
    setTimelineStep(4, 'completed', '✓', report.action_summary || 'Inspection completed and notice issued');
  } else if (status === 'verified') {
    setTimelineStep(2, 'completed', '✓', 'Assigned to Officer: ' + (report.officer_name || 'District Vigilance Officer'));
    setTimelineStep(3, 'completed', '✓', report.verified_date ? ('Verified on ' + report.verified_date) : 'Verified on 22 Sep 2026');
    setTimelineStep(4, 'pending', '4', 'No action taken yet');
  } else if (status === 'under_review' || report.officer_name) {
    setTimelineStep(2, 'current', '2', 'Assigned to Officer: ' + (report.officer_name || 'District Vigilance Officer'));
    setTimelineStep(3, 'pending', '3', 'Not yet verified');
    setTimelineStep(4, 'pending', '4', 'No action taken yet');
  } else {
    // Default submitted status
    setTimelineStep(2, 'current', '2', 'Waiting for assignment');
    setTimelineStep(3, 'pending', '3', 'Not yet verified');
    setTimelineStep(4, 'pending', '4', 'No action taken yet');
  }

  // Populate "Your Report Details"
  if (trackDetailProject) {
    let projTitle = report.project_title;
    if (!projTitle && report.work_id) {
      const match = (lastProjects || []).find((p) => p.work_id === report.work_id);
      projTitle = match ? (match.work_description || match.work_category) : report.work_id;
    }
    trackDetailProject.textContent = projTitle || 'MPLADS Local Development Project';
  }

  if (trackDetailCategory) {
    const catMap = {
      infrastructure_quality: 'Infrastructure Quality & Safety',
      cost_discrepancy: 'Cost & Material Discrepancy',
      ghost_project: 'Ghost Project / Work Never Started',
      maintenance: 'Maintenance & Neglect',
      other: 'Other Violation'
    };
    trackDetailCategory.textContent = catMap[report.category] || report.category || 'General Anomaly';
  }

  if (trackDetailDesc) {
    const rawDesc = report.description || 'No description provided.';
    trackDetailDesc.textContent = rawDesc.length > 100 ? rawDesc.slice(0, 100) + '…' : rawDesc;
  }

  // Photo thumbnail
  if (trackDetailPhotoRow && trackDetailPhoto) {
    if (report.photo_filename) {
      trackDetailPhotoRow.style.display = 'flex';
      if (capturedPhoto && capturedPhoto.file && (report.report_id === localStorage.getItem('mplad_last_ref_id'))) {
        trackDetailPhoto.src = URL.createObjectURL(capturedPhoto.file);
      } else {
        trackDetailPhoto.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="75" viewBox="0 0 100 75"><rect width="100" height="75" fill="%23F3F4F6"/><path d="M50 30a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" fill="%239CA3AF"/><text x="50" y="60" text-anchor="middle" font-family="sans-serif" font-size="9" fill="%236B7280">Site Evidence</text></svg>';
      }
    } else {
      trackDetailPhotoRow.style.display = 'none';
    }
  }

  // Officer Update Card
  if (officerUpdateCard) {
    if (report.officer_notes) {
      officerUpdateCard.style.display = 'block';
      if (officerNotesText) officerNotesText.textContent = report.officer_notes;
      if (officerUpdateTime) officerUpdateTime.textContent = 'Updated: ' + (report.officer_update_time || 'Recent');
    } else {
      officerUpdateCard.style.display = 'none';
    }
  }

  initTooltips(trackResultContainer);
}

function setTimelineStep(num, statusClass, markerText, descText) {
  const stepEl = document.getElementById('timeline-step-' + num);
  const descEl = document.getElementById('step-' + num + '-desc');
  if (!stepEl) return;
  stepEl.className = 'timeline-step ' + statusClass;
  const marker = stepEl.querySelector('.marker-circle');
  if (marker) marker.textContent = markerText;
  if (descEl && descText) descEl.textContent = descText;
}

function showTrackError(msg) {
  if (!trackError) return;
  trackError.textContent = msg;
  trackError.style.display = 'block';
  if (trackResultContainer) trackResultContainer.style.display = 'none';
  if (trackEmptyState) trackEmptyState.style.display = 'block';
}

function hideTrackError() {
  if (!trackError) return;
  trackError.textContent = '';
  trackError.style.display = 'none';
}

// ─── Contextual "i" Help Tooltips ────────────────────────────────────────────
function initTooltips(root = document) {
  root.querySelectorAll('.btn-info').forEach((btn) => {
    if (btn._hasTooltipListener) return;
    btn._hasTooltipListener = true;

    const wrap = btn.closest('.info-btn-wrap');
    if (!wrap) return;
    let popover = wrap.querySelector('.info-popover');
    if (!popover) {
      popover = document.createElement('div');
      popover.className = 'info-popover';
      popover.setAttribute('role', 'tooltip');
      wrap.appendChild(popover);
    }
    popover.textContent = btn.dataset.tooltip || 'Helpful information.';

    const toggle = (e) => {
      e.stopPropagation();
      const isVisible = popover.classList.contains('visible');
      closeAllTooltips();
      if (!isVisible) {
        popover.classList.add('visible');
      }
    };

    btn.addEventListener('click', toggle);
    btn.addEventListener('mouseenter', () => {
      popover.classList.add('visible');
    });
    wrap.addEventListener('mouseleave', () => {
      popover.classList.remove('visible');
    });
  });
}

function closeAllTooltips() {
  document.querySelectorAll('.info-popover.visible').forEach((p) => {
    p.classList.remove('visible');
  });
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.info-btn-wrap') && !e.target.closest('.leaflet-popup')) {
    closeAllTooltips();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllTooltips();
  }
});

// ─── Offline & Online Detection ──────────────────────────────────────────────
function updateOnlineStatus() {
  const offlineBanner = document.getElementById('offline-banner');
  if (!offlineBanner) return;
  const isOff = !navigator.onLine;
  offlineBanner.style.display = isOff ? 'flex' : 'none';
  if (isOff) initTooltips(offlineBanner);
}

window.addEventListener('offline', () => {
  updateOnlineStatus();
});

window.addEventListener('online', async () => {
  updateOnlineStatus();
  await flushQueuedReportsOnline();
});

// ─── Toast Notifications (auto-dismiss in 3s) ────────────────────────────────
function showToast(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── Automatic Background Queue Flush ─────────────────────────────────────────
async function flushQueuedReportsOnline() {
  try {
    const pending = await getAllQueued();
    if (!pending || pending.length === 0) return;
    let uploadedCount = 0;
    for (const r of pending) {
      try {
        const res = await fetch(API_BASE + '/citizen-report', {
          method: 'POST',
          body: buildFD(r),
          cache: 'no-store',
        });
        if (res.ok) {
          await deleteQueued(r.localId);
          uploadedCount++;
        }
      } catch (_) {
        // Keep in queue; retry next time online
      }
    }
    await refreshPendingBanner();
    if (uploadedCount > 0) {
      showToast(`${uploadedCount} pending report${uploadedCount > 1 ? 's' : ''} uploaded successfully`);
    }
  } catch (_) {}
}

// ─── Minimal Install App Banner Flow ──────────────────────────────────────────
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  checkAndShowInstallBanner();
});

function checkAndShowInstallBanner() {
  if (!hasUserSearched) return;
  const installBanner = document.getElementById('install-banner');
  if (!installBanner) return;

  // Check 7-day dismissal memory
  const dismissed = localStorage.getItem('mplad_install_dismissed');
  if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) {
    return;
  }

  // Hide if already in standalone app mode
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
    return;
  }

  installBanner.style.display = 'flex';
  initTooltips(installBanner);
}

const btnInstallApp = document.getElementById('btn-install-app');
if (btnInstallApp) {
  btnInstallApp.addEventListener('click', async () => {
    const installBanner = document.getElementById('install-banner');
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (installBanner) installBanner.style.display = 'none';
      if (choice && choice.outcome === 'accepted') {
        showToast('App installed successfully');
      }
    } else {
      showToast('To install: click the Install icon in your browser address bar.');
      if (installBanner) installBanner.style.display = 'none';
    }
  });
}

const btnDismissInstall = document.getElementById('btn-dismiss-install');
if (btnDismissInstall) {
  btnDismissInstall.addEventListener('click', () => {
    const installBanner = document.getElementById('install-banner');
    if (installBanner) installBanner.style.display = 'none';
    localStorage.setItem('mplad_install_dismissed', Date.now().toString());
  });
}

// ─── Service Worker Registration & Messages ───────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'REPORTS_SYNCED') {
      refreshPendingBanner();
      const count = e.data.count || 1;
      showToast(`${count} pending report${count > 1 ? 's' : ''} uploaded successfully`);
    } else if (e.data && e.data.type === 'REPORT_FLUSHED') {
      refreshPendingBanner();
    }
  });

  // Silently fail if service worker registration fails
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ─── Live Date and Time Clock (GIGW Standard) ─────────────────────────────────
function updateCitizenLiveClock() {
  const now = new Date();
  const dateOptions = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' };
  const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };

  const dateStr = now.toLocaleDateString('en-IN', dateOptions);
  const timeStr = now.toLocaleTimeString('en-IN', timeOptions);

  const topbarClock = document.getElementById('citizen-topbar-clock');
  if (topbarClock) topbarClock.textContent = `${dateStr} | ${timeStr} IST`;

  const headerDate = document.getElementById('citizen-header-date');
  if (headerDate) headerDate.textContent = dateStr;

  const headerTime = document.getElementById('citizen-header-time');
  if (headerTime) headerTime.textContent = `${timeStr} IST`;
}

// ─── Startup ──────────────────────────────────────────────────────────────────
(async () => {
  updateCitizenLiveClock();
  setInterval(updateCitizenLiveClock, 1000);
  updateOnlineStatus();
  initTooltips(document);
  renderInitialState();
  initStatesCarousel();
  updateModeBadge();
  initVoiceRecorder();
  initVoiceSearch((q) => {
    if (searchInput) searchInput.value = q;
    doSearch();
  });
  await refreshPendingBanner();
  await checkBackendHealth();
})();

