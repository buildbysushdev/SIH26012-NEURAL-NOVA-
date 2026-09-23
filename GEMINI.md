PROJECT: MPLAD Risk Intelligence System (SIH26102, Team Neural Nova)
MY ROLE: Backend, AI/ML, and integration lead. I am a beginner working
with AI agents — explain what code does before moving to the next step.

WHAT WE'RE BUILDING: An AI-powered decision-support dashboard flagging
suspicious MPLAD Scheme (India's MP-directed local development fund)
projects using cost anomaly detection, NLP duplicate detection, satellite
verification, and citizen reporting — combined into one explainable risk
score for government auditors.

CRITICAL RULE: This is a RISK-PRIORITIZATION tool, never a "fraud
verdict." No confirmed fraud-label dataset exists anywhere — all ML here
is UNSUPERVISED (Isolation Forest, similarity scoring). Do not attempt
supervised fraud classification; there is no ground truth to train on.

TECH STACK: Python + FastAPI, scikit-learn (Isolation Forest),
sentence-transformers (duplicate detection), SHAP (explainability),
PostgreSQL/SQLite, satellite APIs (Google Earth Engine / Sentinel Hub).

RULES FOR YOU (the agent):
- Always run a PLANNING step before writing code for a new module —
  show me the plan, wait for my approval, then execute.
- Keep each module in its own file/service — never merge multiple
  modules into one large file.
- One task boundary at a time — finish and confirm one module before
  starting the next, don't try to build several at once.
- If you're unsure about a government-data fact or statistic, say so
  explicitly rather than inventing a plausible-sounding number.
SIH26102 — Project Instructions & Guardrails
Team Neural Nova — Master reference for AI agents (Antigravity/Gemini)
Keep this file updated as the project evolves. Edit only the relevant section when something changes — don't rewrite the whole file each time.

1. Project context (read this first, every session)
PROJECT: MPLAD Risk Intelligence System (SIH26102, Team Neural Nova)
GOAL: AI-powered decision-support dashboard flagging suspicious MPLAD Scheme
projects using cost anomaly detection, NLP duplicate detection, satellite
verification, and citizen reporting — combined into one explainable risk score.

CRITICAL FRAMING: Risk-prioritization tool for human auditors, NEVER an
automated fraud verdict. No confirmed fraud-label dataset exists anywhere —
all ML is UNSUPERVISED. Never attempt supervised fraud classification.

TECH STACK: Python + FastAPI, scikit-learn (Isolation Forest),
transformers/SegFormer (satellite), sentence-transformers (NLP duplicates),
SHAP + Gemini API (explainability), React + Leaflet (frontend).

DATA: Real 77,305-record MPLADS dataset (MPLADS_real_raw_data_77312_works.csv).
Raw columns only — never reuse another team's computed anomaly scores/labels
from reference repos, only their raw government data columns.
2. Module reference — what each file does
File	Purpose	Status
main.py	FastAPI app, all endpoints, loads/scores data at startup	✅ Tested
data_pipeline.py	Loads and cleans the 77K dataset	✅ Tested
anomaly_detector.py	Isolation Forest cost anomaly scoring	✅ Tested
nlp_duplicate.py	Sentence-BERT duplicate/ghost-project detection	✅ Verified
explain_gemini.py	Gemini API wrapper for plain-language explanations, with template fallback	✅ Working
satellite_check.py + satellite_detector.py	SegFormer-based structure detection, fine-tuned on LandCover.ai	✅ Validated
verification_pipeline.py	AI evidence cross-verification (GPS, satellite, text spam, duplicate, photo hash)	✅ Validated
citizen_reports.py	Citizen report submission + AI verification + dynamic risk score boost	✅ Working
location_enricher.py	Locality extraction from work_description + two-tier geocode cache (district CSV + locality CSV); tags every project with location_precision ('precise'/'locality'/'district'/'unavailable'); called at startup from main.py lifespan	✅ Validated
Feedback loop (in main.py)	Officer false-positive downweighting	✅ Working
Audit brief PDF (in main.py)	One-page PDF generation per flagged project	✅ Working
auth_jwt.py	Server-side HMAC-SHA256 JWT auth + district jurisdiction scoping	✅ Validated
supabase_sync.py	Supabase cloud sync (citizen-evidence storage, reports, verifications, feedback, checklists, SHA-256 photo seals, audit logs)	✅ Validated
officer_checklist.py	DISHA on-site inspection checklist API (POST/GET) with cloud upsert + local CSV cache	✅ Validated
Officer Dashboard (frontend/officer-dashboard)	Authoritative DISHA inspection case-management workspace + PWA offline sync	✅ Validated

Known fixed bugs — do not reintroduce:

Work IDs contain slashes (WS/MP893/2024-2025/171163) — always use query params, never path params, for anything containing a work_id.
Missing data becomes NaN, which breaks JSON — always sanitize with .where(pd.notnull(...), None) before returning API responses.
File paths must be script-relative (os.path.dirname(__file__)), never assume a specific working directory — this caused the earlier ERR_CONNECTION_REFUSED incident.
GPS coordinates: the raw 77K dataset has NO per-project GPS. Coordinates are resolved by location_enricher.py in three tiers: (1) locality geocode from work_description (24.5% of records have an extractable village/panchayat name); (2) constituency centroid from CONSTITUENCY_COORDS dict + geocode_district_cache.csv (72.8% district-level); (3) unavailable (27.2% — Rajya Sabha nominated constituencies with personal names, not geocodable). Never use the old India centroid fallback (20.5937, 78.9629) — that was a bug, now fixed.
location_precision values: 'precise' (future per-project GPS), 'locality' (village geocoded, 2km tolerance), 'district' (constituency centroid, 25km tolerance), 'unavailable'. GPS verification weights in verify_citizen_report() adapt per tier — district precision reduces GPS signal weight from 30%→20%, freeing 10% to text+duplicate signals.
Geocache files: geocode_district_cache.csv (701 rows, already built) and geocode_locality_cache.csv (not yet built — run 'python location_enricher.py --build-locality-cache' before demo, takes ~1-2h). Both are committed to repo, safe (no credentials).

3. Agent behavior rules
Always PLAN before writing code for a new module — show the plan, wait for approval, then execute.
One task/module at a time — finish and confirm before starting the next.
Never rewrite tested, working logic without being explicitly asked to.
If unsure about a government-data fact or statistic, say so — never invent a plausible-sounding number.
Prefer transfer learning / pretrained models over training from scratch given our time constraints.
I am a beginner — explain what code does before moving on.
4. Security guardrails
This system handles real (if public) government data and has citizen-facing, file-upload-accepting endpoints — treat it accordingly, even as a hackathon prototype.

API keys and secrets
Gemini API key lives in an environment variable (GOOGLE_API_KEY) — never hardcoded in any file.
Add a .gitignore covering: .env, *.key, venv/, .venv/, __pycache__/, any local data exports containing credentials.
Before every git commit, agent should confirm no API key or secret is present in the diff.
Input validation
work_id query parameters: validate against expected format (matches the real dataset's ID pattern) before using in any lookup — prevents injection-style abuse even though we're not using raw SQL.
Citizen report photo uploads: validate actual file type (not just the extension — check the file's real content/MIME type), enforce a maximum file size (e.g. 5MB), and store uploads outside any web-servable directory to prevent someone uploading an executable disguised as an image.
Any text field (citizen report description, feedback comments): sanitize before storing/displaying to prevent script injection if ever rendered in the frontend.
API exposure
CORS allow_origins=["*"] in main.py is fine for local hackathon development but must be tightened to your actual frontend's domain before any public demo or deployment — flag this explicitly before demo day.
Error responses should return generic messages to the client ("Project not found") — never leak internal file paths, stack traces, or library versions in API error responses; log the full detail server-side only.
Citizen protection (also a genuine feature, not just security)
Citizen reports should not require or expose the reporter's real identity in any officer-facing view — protects citizens from potential local retaliation for flagging a project. This is worth mentioning explicitly in your PPT as a deliberate design choice, not just a technical afterthought.
Rate limiting
POST /citizen-report and POST /feedback should have basic rate limiting (even a simple in-memory counter per IP for the hackathon stage) to prevent spam/abuse of the score-boosting mechanism — without this, someone could artificially inflate or deflate a project's risk score by submitting many fake reports.
Before demo day — final check
Confirm no .env file, API key, or the raw LandCover.ai training data credentials (if any) are visible in your GitHub repo if you push it publicly.
Run through Part 1 of the audit checklist one more time after any last-minute change — a "small" late fix has broken more demos than anything else.
Update the module status table and known-bugs list whenever something changes — that's the section future agent sessions rely on most.
satellite training requires CUDA torch at D:\torch_cuda (installed with TEMP redirected to D: due to C: space constraints).
  To replicate on another machine: mkdir D:\pip_temp D:\torch_cuda, set TEMP=D:\pip_temp, then:
  pip install torch --index-url https://download.pytorch.org/whl/cu128 --no-cache-dir --target D:\torch_cuda
  Then add "D:\torch_cuda" as one line to backend\.venv\Lib\site-packages\torch_d_drive.pth 

  satellite_check.py + satellite_detector.py — ✅ Validated on 5 held-out tiles (never seen in training).
  False-negative sweep: 1,650/1,654 building patches detected correctly (0.2% FN rate).
  3 of 5 tiles: 100% detection. 2 tiles: 98.9-99.3% (4 FNs all in localized dense-urban zones).
  ⚠️  Building-vs-road % breakdown is approximate (model confuses the two for built-up areas).
  ✅  "structure_detected" flag is reliable — use that, not the exact class split, for audit decisions.
  Train setup: 36 training tiles, 5 held-out, 25 epochs, class-weighted loss (building/road weight=20x),
  CUDA torch at D:\torch_cuda, model saved to landcover_segformer/.

5. Combined risk score formula (reverse-engineered from 495 live data points, max error 0.05)
Step 1 — Base score (2-signal, no satellite):
  risk_score = 0.5 × cost_risk_score + 0.5 × nlp_similarity_score
  Proven: least-squares fit on 495 clean points → w_cost=0.500025, w_nlp=0.499989

Step 2 — Citizen report boost (applied before clamping):
  +15.0 flat on the FIRST citizen report only (subsequent reports increment count but don't re-boost)
  Source: citizen_reports.py line 143: if curr_count == 0: new_score = old_score + 15.0

Step 3 — Clamp to [0, 100]

Step 4 — Officer feedback (applied to clamped score, source: feedback_loop.py lines 64-66):
  false_positive     → risk_score - 25.0  (clamped ≥ 0)
  confirmed_issue    → risk_score + 5.0   (clamped ≤ 100)
  dampened_similarity→ risk_score - 10.0  (clamped ≥ 0)  ← applied to projects NLP-similar to a FP

Manual verification (all exact, not approximate):
  Citizen boost:     0.5×cost + 0.5×nlp = 66.5  →  +15 citizen = 81.5  ✅
  Confirmed_issue:   0.5×44.1 + 0.5×88.9 = 66.5  →  +15 = 81.5  →  +5 CI = 86.5  ✅
  False_positive B:  0.5×88.6 + 0.5×94.2 = 91.4  →  +15 = 106.4  →  cap→100  →  -25 FP = 75.0  ✅
  False_positive C:  0.5×88.6 + 0.5×90.7 = 89.65 →  +15 = 104.65 →  cap→100  →  -25 FP = 75.0  ✅

Note: satellite_risk_score is recorded as a standalone signal (100 = structure absent at reported location).
The running server's original main.py (source deleted after server started Sep 18 — process is orphaned)
may include satellite_risk_score in a 3-signal formula when GEE imagery is available.
In development/offline mode, only the 2-signal formula is active.

Note on main.py: The original monolithic main.py was deleted after the server started on Sep 18, 2026.
The server runs entirely from in-memory state. confirmed by: no main.pyc in any __pycache__,
no main.py in any non-venv location. The modular backend/app/ refactor is an in-progress replacement.
Restart the server from backend/app/main.py before demo day to run the new modular structure.