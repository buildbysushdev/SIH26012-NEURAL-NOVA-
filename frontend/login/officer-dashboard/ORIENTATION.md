# Officer Verification Dashboard — Architecture & Orientation Guide
**Project:** MPLADS Risk Intelligence System (SIH26102, Team Neural Nova)  
**Location:** `frontend/officer-dashboard/`  
**Target User:** District Planning Officers, DISHA Inspectors, and Ministry Vigilance Auditors

---

## 🗺️ System Map & File Directory

```
frontend/officer-dashboard/
├── ORIENTATION.md                     # [This File] Master component map & architectural contract
├── index.html                         # Shell page: semantic layout, navigation header, view containers, modals
├── manifest.json                      # PWA web manifest for officer mobile installation
├── sw.js                              # Service Worker: offline caching of app shell & worklist, Background Sync
├── css/
│   ├── variables.css                  # Design tokens: slate/dark zinc color scales, Inter typography, density tokens
│   ├── layout.css                     # Global grid, header HUD, view transitions, responsive layout
│   ├── components.css                 # Dense tables, badges, 4-signal matrix, evidence cards, DISHA checklist, buttons
│   └── field-capture.css              # Mobile camera HUD, GPS readout badge, cryptographic hash lock indicator
└── js/
    ├── api.js                         # Unified backend client (handles real FastAPI queries, headers, error sanitation)
    ├── auth.js                        # Officer role scoping, district jurisdiction validation, audit action logging
    ├── db.js                          # IndexedDB client: offline worklist cache, field captures, checklist drafts
    ├── views/
    │   ├── worklist.js                # Landing screen: prioritized worklist table, multi-column filters, risk sort
    │   ├── detail.js                  # Core screen: project admin info, 4-signal breakdown, Leaflet map, evidence & DISHA checklist
    │   └── field-capture.js           # Officer on-site capture flow: camera-only capture, live GPS, SHA-256 seal & queue
    └── app.js                         # Main application lifecycle, screen routing, online/offline sync event listener
```

---

## 📄 File Responsibilities

| File Path | Primary Responsibility | Data Source / APIs |
|---|---|---|
| `ORIENTATION.md` | Single source of truth for the dashboard structure; keeps all team members aligned | N/A |
| `index.html` | Application shell with persistent officer HUD, search bar, active screen containers, and modal dialogs | Static shell |
| `manifest.json` | Web App Manifest allowing field officers to install the dashboard to their home screen as a standalone PWA | PWA standard |
| `sw.js` | Service Worker providing offline asset caching and Background Sync for field-captured evidence | Cache Storage & Background Sync API |
| `css/variables.css` | Stripe/Linear-grade design tokens: slate surfaces (`#090D16`, `#0F172A`, `#1E293B`), refined amber (`#F59E0B`), emerald (`#10B981`), critical red (`#EF4444`) | CSS Custom Properties |
| `css/layout.css` | Header bar (officer jurisdiction, sync badge), sidebar/breadcrumbs, view container, and responsive split view | CSS Flex/Grid |
| `css/components.css` | Dense audit tables, color-coded badges, 4-signal breakdown grid, evidence cards, DISHA checklist, and action buttons | CSS Components |
| `css/field-capture.css` | On-site camera capture HUD, live GPS coordinate readout, SHA-256 computation pulse animation | CSS Mobile HUD |
| `js/api.js` | Modular API service wrapping all real backend calls with error trapping, query sanitization, and automatic `Authorization: Bearer <token>` attachment | `http://localhost:8000` |
| `js/auth.js` | Authenticates with `POST /auth/token`, manages HMAC-SHA256 JWT tokens, handles district scoping requests, and maintains local audit logs | `POST /auth/token`, `GET /auth/me` |
| `js/db.js` | IndexedDB abstraction (`OfficerDashboardDB`) for offline storage of worklists, checklist drafts, and captured photos | IndexedDB API |
| `js/views/worklist.js` | Renders prioritized worklist with risk badges, filter controls (District, Risk Tier, Status, Precision), and sorting | `GET /flagged-projects` |
| `js/views/detail.js` | Renders project dossier: 4-signal breakdown cards, Leaflet map with precision rings, evidence chain of custody, DISHA checklist, feedback loop | `GET /project?work_id=`, `POST /feedback`, `GET /audit-brief/{work_id}`, `GET /citizen-reports?work_id=` |
| `js/views/field-capture.js` | Handles `<input capture="environment">`, HTML5 Geolocation API, Web Crypto `crypto.subtle.digest("SHA-256")`, and immutability lock | Browser Hardware APIs |
| `js/app.js` | App bootstrapping, screen switching, global toast notification system, and network change auto-sync | Window events |

---

## 🔌 Backend API Integration Points

Every screen connects to our real FastAPI backend (`http://localhost:8000`):

1. **Auditor Authentication & Scoping**: `POST /auth/token` & `GET /auth/me` (Module `auth_jwt.py`)  
   Issues cryptographically signed HMAC-SHA256 JWT tokens binding officer ID, district jurisdiction, and role.
2. **Flagged Projects Feed**: `GET /flagged-projects?limit=50&state=&work_category=&district=`  
   **Server-enforced**: Requires `Authorization: Bearer <token>`. Returns cost-outlier projects strictly filtered by the officer's statutory district boundary. Unauthorized requests receive HTTP 401.
2. **Project Detail & Explanation**: `GET /project?work_id={work_id}`  
   Returns project profile, administrative data, cost z-score, NLP duplicate pair, satellite status, and plain-language explanation.
3. **Citizen Grievance & Evidence Feed**: `GET /citizen-reports?work_id={work_id}`  
   Returns citizen reports, photos, timestamps, and coordinates attached to the project.
4. **AI Cross-Verification Analysis**: `GET /citizen-report-verification/{report_id}`  
   Returns individual signal checks (location, visual, text, duplicate, metadata) and AI confidence score.
5. **Officer Determination & Scoring Feedback**: `POST /feedback`  
   Payload: `{ work_id, verdict: "confirmed_issue" | "false_positive", officer_notes, officer_id }`  
   Dynamically adjusts the project's risk score (-25 for FP, +5 for CI) and dampens NLP duplicates.
6. **Statutory Audit Brief PDF**: `GET /audit-brief/{work_id}`  
   Downloads the publication-grade 2-page supervisory audit brief dossier.
7. **Constituency/Keyword Search**: `GET /search-projects?q={query}`  
   Enables ad-hoc lookup across the entire 77,305-record MPLADS dataset.

---

## 🎨 Design Rules & Non-Accusatory Color Standards
- **Background**: Deep Slate (`#090D16` / `#0F172A`) with high-contrast, razor-sharp borders (`#1E293B`, `#334155`).
- **Accent**: Authority Blue / Indigo (`#2563EB` / `#3B82F6`) — clean, focused, professional.
- **Risk Tiers (Non-Accusatory)**:
  - High Risk / Priority Review (Score > 70): Deep Amber/Orange (`#D97706` / `#F59E0B`). Never red.
  - Moderate Risk (Score 40–70): Gold / Yellow (`#CA8A04` / `#EAB308`).
  - Low Risk (Score < 40): Slate / Neutral (`#64748B`).
  - Compliant / Verified: Emerald (`#059669` / `#10B981`).
- **Integrity Red (`#DC2626` / `#EF4444`)**:
  - Reserved **exclusively** for cryptographic integrity failures (e.g. SHA-256 hash mismatch indicating evidence tampering) or system communication faults.

---

## 🔒 Security & Field Protocols
1. **Zero Raw SQL / Injections**: All project queries use validated parameters.
2. **Chain of Custody (SHA-256)**: Photos taken in the field are hashed immediately in memory via Web Crypto API before disk persistence. Stored hash is compared against the file byte hash on render.
3. **Precision Honesty**: Geolocation accuracy is explicitly categorized:
   - `precise`: Per-project GPS (tight 100m tolerance).
   - `locality`: Village/Panchayat geocoded from description (2km tolerance ring).
   - `district`: Constituency centroid only (25km tolerance ring).
   - `unavailable`: Ungeocoded Rajya Sabha nominee projects.
4. **Offline Resilience**: Offline actions (checklist updates, photo captures) queue in IndexedDB and automatically flush via Service Worker sync upon reconnection.
