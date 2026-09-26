# MPLADS Risk Intelligence Frontend

React interface for the SIH26102 MPLADS monitoring system. Citizen search and reporting, officer review, and Super Admin views use the FastAPI backend configured by `VITE_BACKEND_URL`.

## Local development

```bash
npm install
npm run dev
```

The backend must be running separately. Authentication is performed by `/auth/login`; the frontend does not contain a credential bypass or an automatic administrator token.

## Data integrity

Operational records come from the backend. The geographic constants in `src/data/geography.ts` are filter labels only. Mutations report success only after the backend confirms persistence. Satellite panels label Esri World Imagery as reference imagery and do not claim automated structure detection.

## Build

```bash
npm run build
```
