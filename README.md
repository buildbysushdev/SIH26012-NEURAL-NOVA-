# MPLADS AI — Intelligent Monitoring & Risk Analytics Platform

Frontend prototype for Smart India Hackathon 2026 · Problem Statement PS 26102.

Frontend-only. All data is realistic mock data served through a Promise-based
mock API layer (`src/services/api.ts`) designed to be swapped for real backend
calls without touching page components.

## Run it

```bash
npm install
npm run dev
``

Build for production:
```bash
npm run build
npm run preview
```

## Three portals, one app

1. **Super Admin Portal** (`/admin/...`) — full system-level access: manage
   officers, view system-wide analytics, audit logs, all projects/alerts/
   citizen reports across India.
   - Demo login: `admin@mplads.ai` / `admin123`

2. **Officer Portal** (`/dashboard`, `/projects`, `/alerts`, ...) — the
   monitoring dashboard used day-to-day by MPLADS officers. Four demo
   accounts are provided (all password `officer123`):
   - `officer1@mplads.ai` — R. Kulkarni, Pune, Maharashtra
   - `officer2@mplads.ai` — A. Deshmukh, Nashik, Maharashtra
   - `officer3@mplads.ai` — K. Iyer, Karnataka
   - `officer4@mplads.ai` — S. Verma, Lucknow, Uttar Pradesh

3. **Citizen Portal** (`/citizen`) — public, no login required. Search
   projects, view public project status, and report issues.

Start at `/login` to choose a portal, or go straight to `/citizen`.

## Architecture notes for backend integration

- `src/services/api.ts` is the only file that should need real endpoints.
  Every function already returns the exact shape pages expect.
- `src/data/mockData.ts` is the mock dataset generator — delete once real
  data is wired up.
- `src/context/AuthContext.tsx` holds mock login logic for both officer and
  super admin roles; replace `loginOfficer` / `loginSuperAdmin` internals
  with real auth calls.
- Officer and Super Admin portals share the same page components
  (Projects, ProjectDetail, Alerts, RiskMap, Analytics, Reports, Settings)
  mounted at different route prefixes (`/` vs `/admin/`), coordinated via
  `src/lib/usePortalBase.ts` so links stay inside the correct portal.
