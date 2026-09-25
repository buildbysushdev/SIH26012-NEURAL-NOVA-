"""
generate_flowcharts_pdf.py — Generates a publication-grade, ultra-high-definition
vector PDF of all MPLADS system architecture and workflow diagrams.
SIH26102, Team Neural Nova
"""
import os
import base64
import subprocess
import pymupdf

def get_base64_image(file_path: str) -> str:
    if os.path.exists(file_path):
        with open(file_path, "rb") as f:
            data = base64.b64encode(f.read()).decode("utf-8")
            ext = os.path.splitext(file_path)[1].replace(".", "").lower()
            if ext == "svg":
                return f"data:image/svg+xml;base64,{data}"
            return f"data:image/{ext};base64,{data}"
    return ""

def generate_pdf():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    emblem_b64 = get_base64_image(os.path.join(base_dir, "frontend", "assets", "emblem_cleaned.png"))
    flag_b64 = get_base64_image(os.path.join(base_dir, "frontend", "assets", "india_flag.png"))

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>MPLADS Risk Intelligence System — Architecture & Workflow Diagrams</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({{
      startOnLoad: true,
      theme: 'default',
      themeVariables: {{
        primaryColor: '#e0ecf8',
        primaryTextColor: '#002147',
        primaryBorderColor: '#003366',
        lineColor: '#003366',
        secondaryColor: '#fef3c7',
        tertiaryColor: '#f0fdf4',
        edgeLabelBackground: '#ffffff',
        fontFamily: 'Inter, -apple-system, sans-serif'
      }},
      flowchart: {{
        htmlLabels: true,
        useMaxWidth: false,
        curve: 'basis'
      }},
      sequence: {{
        useMaxWidth: false,
        showSequenceNumbers: true,
        actorFontFamily: 'Inter, sans-serif',
        noteFontFamily: 'Inter, sans-serif',
        messageFontFamily: 'Inter, sans-serif',
        actorFontSize: 12,
        noteFontSize: 11,
        messageFontSize: 11,
        actorMargin: 24,
        messageMargin: 16,
        boxMargin: 8,
        boxTextMargin: 4,
        noteMargin: 8,
        mirrorActors: false
      }}
    }});
  </script>
  <style>
    @page {{
      size: A4 landscape;
      margin: 7mm 11mm 7mm 11mm;
    }}
    *, *::before, *::after {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}
    body {{
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.4;
      font-size: 12px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }}

    .page {{
      page-break-inside: avoid;
      break-inside: avoid;
      height: 195mm;
      max-height: 195mm;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
      position: relative;
    }}
    .page:not(:last-of-type) {{
      page-break-after: always;
      break-after: page;
    }}
    .page:last-of-type {{
      page-break-after: auto;
      break-after: auto;
    }}

    /* Masthead Header */
    .masthead {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #003366;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }}
    .masthead-left {{
      display: flex;
      align-items: center;
      gap: 12px;
    }}
    .emblem-img {{
      height: 50px;
      width: auto;
      object-fit: contain;
    }}
    .flag-img {{
      height: 32px;
      width: auto;
      border: 1px solid #cbd5e1;
      border-radius: 3px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }}
    .titles-group {{
      display: flex;
      flex-direction: column;
    }}
    .ministry-title {{
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}
    .portal-title {{
      font-size: 17px;
      font-weight: 800;
      color: #002147;
      letter-spacing: -0.2px;
      line-height: 1.15;
    }}
    .portal-subtitle {{
      font-size: 11px;
      font-weight: 600;
      color: #0056b3;
    }}
    .masthead-right {{
      display: flex;
      align-items: center;
      gap: 12px;
      text-align: right;
    }}
    .meta-tag {{
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }}
    .badge-sih {{
      background: #003366;
      color: #ffffff;
      font-size: 9.5px;
      font-weight: 800;
      padding: 2.5px 7px;
      border-radius: 4px;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }}
    .team-tag {{
      font-size: 10.5px;
      font-weight: 700;
      color: #0f172a;
    }}

    /* Section Header */
    .section-header {{
      background: #f8fafc;
      border-left: 4px solid #003366;
      border-top: 1px solid #e2e8f0;
      border-right: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 5px 12px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }}
    .section-title {{
      font-size: 13px;
      font-weight: 800;
      color: #002147;
    }}
    .section-desc {{
      font-size: 10.5px;
      color: #475569;
      font-weight: 500;
    }}
    .section-badge {{
      background: #e0f2fe;
      color: #0369a1;
      font-weight: 700;
      font-size: 10px;
      padding: 2.5px 7px;
      border-radius: 10px;
      border: 1px solid #bae6fd;
    }}

    /* Diagram Box */
    .diagram-container {{
      flex: 1;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      border-radius: 7px;
      padding: 8px 12px;
      margin-bottom: 8px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.03);
      overflow: hidden;
    }}
    .diagram-container svg {{
      max-width: 100% !important;
      max-height: 375px !important;
      height: auto !important;
    }}

    /* Technical Card Grid */
    .tech-grid {{
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 8px;
    }}
    .tech-card {{
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      padding: 6px 9px;
    }}
    .tech-card-title {{
      font-size: 10px;
      font-weight: 800;
      color: #003366;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 2px;
    }}
    .tech-card-desc {{
      font-size: 9.5px;
      color: #334155;
      line-height: 1.32;
    }}

    /* Math Box */
    .math-formula-box {{
      background: #f0f7ff;
      border: 1.5px solid #b8d0e8;
      border-radius: 5px;
      padding: 7px 12px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-around;
      align-items: center;
    }}
    .math-item {{
      text-align: center;
    }}
    .math-label {{
      font-size: 9.5px;
      font-weight: 700;
      color: #003366;
      text-transform: uppercase;
      margin-bottom: 1.5px;
    }}
    .math-formula {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 11.5px;
      font-weight: 700;
      color: #002147;
    }}

    /* Footer */
    .page-footer {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #e2e8f0;
      padding-top: 4px;
      font-size: 9.5px;
      color: #64748b;
      font-weight: 500;
    }}
    .footer-left {{
      display: flex;
      align-items: center;
      gap: 6px;
    }}
    .footer-right {{
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      color: #003366;
    }}
  </style>
</head>
<body>

  <!-- ================= PAGE 1 ================= -->
  <section class="page">
    <header class="masthead">
      <div class="masthead-left">
        <img src="{emblem_b64}" alt="Emblem" class="emblem-img" />
        <div class="titles-group">
          <span class="ministry-title">Ministry of Statistics &amp; Programme Implementation &bull; Government of India</span>
          <h1 class="portal-title">MPLADS Risk Intelligence System</h1>
          <span class="portal-subtitle">AI-Powered Decision-Support System for Public Works Vigilance</span>
        </div>
      </div>
      <div class="masthead-right">
        <div class="meta-tag">
          <span class="badge-sih">SIH 2026 &bull; PS: SIH26102</span>
          <span class="team-tag">Team Neural Nova &bull; Architectural Blueprint</span>
        </div>
        <img src="{flag_b64}" alt="India Flag" class="flag-img" />
      </div>
    </header>

    <div class="section-header">
      <div>
        <h2 class="section-title">1. End-to-End Multi-Modal System Architecture</h2>
        <span class="section-desc">Four-subsystem pipeline connecting raw 77K records to officer audit actions and dynamic feedback loops</span>
      </div>
      <span class="section-badge">Master System Flow</span>
    </div>

    <div class="diagram-container">
      <pre class="mermaid">
flowchart TD
    subgraph DataIngestion["1. Data Ingestion & Enrichment Subsystem"]
        RAW["MPLADS Real Government Dataset\n77,312 Public Works"] --> CLEAN["Data Cleaning & Categorization\nSanitization & Category Grouping"]
        CLEAN --> GEO["Location Enricher Engine\nLocality Regex & 701-District Cache"]
    end

    subgraph ScoringEngine["2. Multi-Modal Risk Engine (Strictly Unsupervised ML)"]
        GEO --> S1["Signal 1: Cost Anomaly\nIsolation Forest + Category Z-Scores"]
        GEO --> S2["Signal 2: NLP Duplicates\nSentence-BERT all-MiniLM-L6-v2"]
        GEO --> S3["Signal 3: Satellite Verification\nFine-Tuned SegFormer + Sentinel-2"]
        
        S1 --> BASE["Base Risk Score Formula\n0.5 × Cost + 0.5 × NLP Similarity"]
        S2 --> BASE
    end

    subgraph CitizenEvidence["3. Citizen Vigilance & Verification"]
        CP["Citizen Reporting Portal\nVoice / Photo / GPS / PWA"] --> PIPE["AI Evidence Verification\nGPS Tolerance, Photo SHA-256 Seal"]
        PIPE --> BOOST["Dynamic Score Boost\n+15.0 on 1st Verified Report"]
        BOOST --> BASE
    end

    subgraph OfficerWorkspace["4. DISHA Officer Workspace & Oversight"]
        BASE --> API["FastAPI Master Engine\n11 Production Endpoints"]
        API --> AUTH["HMAC-SHA256 JWT Auth\nDistrict Jurisdiction Scoping"]
        AUTH --> DASH["Officer Inspection Dashboard\nPrioritized Worklist & Leaflet Map"]
        DASH --> PDF["Supervisory Audit Dossier\nAutomated 2-Page PDF Brief"]
        DASH --> FEED["Officer Feedback Loop\nFalse-Positive Downweighting"]
    end

    FEED -.->|"False Positive: -25.0 | Confirmed Issue: +5.0\nDuplicate Dampening: -10.0"| BASE
      </pre>
    </div>

    <div class="tech-grid">
      <div class="tech-card">
        <div class="tech-card-title">Data Ingestion</div>
        <div class="tech-card-desc">77,312 real MPLADS works. 3-tier geocode resolution (Locality, District centroid, Unavailable).</div>
      </div>
      <div class="tech-card">
        <div class="tech-card-title">Cost Anomaly</div>
        <div class="tech-card-desc">Isolation Forest partitioned by work category. Generates 0–100 cost outlier risk score.</div>
      </div>
      <div class="tech-card">
        <div class="tech-card-title">Duplicate Detection</div>
        <div class="tech-card-desc">384-dimensional Sentence-BERT embeddings. Cosine threshold &ge; 91% prevents ghost funding.</div>
      </div>
      <div class="tech-card">
        <div class="tech-card-title">Officer Feedback</div>
        <div class="tech-card-desc">Interactive false-positive dampening (-25 score) prevents systemic audit bias.</div>
      </div>
    </div>

    <footer class="page-footer">
      <div class="footer-left">
        <span>MPLADS Vigilance Decision-Support System (SIH26102)</span>
        <span>&bull;</span>
        <span>Official Architectural Specifications</span>
      </div>
      <div class="footer-right">Page 1 of 4</div>
    </footer>
  </section>

  <!-- ================= PAGE 2 ================= -->
  <section class="page">
    <header class="masthead">
      <div class="masthead-left">
        <img src="{emblem_b64}" alt="Emblem" class="emblem-img" />
        <div class="titles-group">
          <span class="ministry-title">Ministry of Statistics &amp; Programme Implementation &bull; Government of India</span>
          <h1 class="portal-title">Combined Risk Score Mathematical Formulation</h1>
          <span class="portal-subtitle">Unsupervised Multi-Signal Scoring Engine &bull; Zero Ground-Truth Fraud Labels</span>
        </div>
      </div>
      <div class="masthead-right">
        <div class="meta-tag">
          <span class="badge-sih">SIH 2026 &bull; PS: SIH26102</span>
          <span class="team-tag">Team Neural Nova &bull; Mathematical Proof</span>
        </div>
        <img src="{flag_b64}" alt="India Flag" class="flag-img" />
      </div>
    </header>

    <div class="section-header">
      <div>
        <h2 class="section-title">2. Risk Prioritization Scoring Formulation</h2>
        <span class="section-desc">Strict mathematical bounds [0, 100], auditable deterministic weightings, and statutory auditor overrides</span>
      </div>
      <span class="section-badge">Scoring Pipeline</span>
    </div>

    <div class="diagram-container">
      <pre class="mermaid">
flowchart LR
    A["Cost Risk Score\n(0 - 100)\nIsolation Forest"] -->|Weight: 0.5| C["Weighted Base Score\n0.5 × Cost + 0.5 × NLP"]
    B["NLP Similarity Score\n(0 - 100)\nSentence-BERT"] -->|Weight: 0.5| C
    C --> D{{"Citizen Report\nVerified?"}}
    D -->|First Report| E["Dynamic Boost\nAdd +15.0 Points"]
    D -->|No Reports| F["Unboosted Base\nScore Unchanged"]
    E --> G["Boundary Clamping\nClamp to [0, 100]"]
    F --> G
    G --> H{{"Auditor Feedback\nDetermination"}}
    H -->|False Positive| I["Downweight Score\nScore - 25.0 (Min 0)"]
    H -->|Confirmed Issue| J["Escalate Score\nScore + 5.0 (Max 100)"]
    H -->|Duplicate Dampen| K["Dampen Duplicates\nScore - 10.0 (Min 0)"]
    H -->|No Action| L["Final Audit Score\nBounded [0, 100]"]
    I --> L
    J --> L
    K --> L
      </pre>
    </div>

    <div class="math-formula-box">
      <div class="math-item">
        <div class="math-label">Step 1: Base Score</div>
        <div class="math-formula">Score_base = 0.5 × CostScore + 0.5 × NLPScore</div>
      </div>
      <div class="math-item">
        <div class="math-label">Step 2: Citizen Boost</div>
        <div class="math-formula">Score_boost = Score_base + 15.0 (1st report only)</div>
      </div>
      <div class="math-item">
        <div class="math-label">Step 3: Normalization</div>
        <div class="math-formula">Score_norm = min(100.0, max(0.0, Score_boost))</div>
      </div>
      <div class="math-item">
        <div class="math-label">Step 4: Statutory Override</div>
        <div class="math-formula">FP: -25.0 | Confirmed: +5.0 | Dampen: -10.0</div>
      </div>
    </div>

    <div class="tech-grid">
      <div class="tech-card">
        <div class="tech-card-title">Reverse-Engineered Fit</div>
        <div class="tech-card-desc">Least-squares fit on 495 live points: w_cost = 0.500025, w_nlp = 0.499989 (Max error &le; 0.05).</div>
      </div>
      <div class="tech-card">
        <div class="tech-card-title">Single Citizen Boost</div>
        <div class="tech-card-desc">+15.0 is awarded on the FIRST report only. Subsequent reports increment count without inflating score.</div>
      </div>
      <div class="tech-card">
        <div class="tech-card-title">False Positive Guard</div>
        <div class="tech-card-desc">When an officer records False Positive, score drops by 25 points and dampens NLP twins by 10 points.</div>
      </div>
      <div class="tech-card">
        <div class="tech-card-title">Explainability Layer</div>
        <div class="tech-card-desc">Gemini Flash provides plain-language justification using read-only inputs without modifying scores.</div>
      </div>
    </div>

    <footer class="page-footer">
      <div class="footer-left">
        <span>MPLADS Vigilance Decision-Support System (SIH26102)</span>
        <span>&bull;</span>
        <span>Auditable Mathematical Proof</span>
      </div>
      <div class="footer-right">Page 2 of 4</div>
    </footer>
  </section>

  <!-- ================= PAGE 3 ================= -->
  <section class="page">
    <header class="masthead">
      <div class="masthead-left">
        <img src="{emblem_b64}" alt="Emblem" class="emblem-img" />
        <div class="titles-group">
          <span class="ministry-title">Ministry of Statistics &amp; Programme Implementation &bull; Government of India</span>
          <h1 class="portal-title">Citizen Vigilance &amp; AI Verification Pipeline</h1>
          <span class="portal-subtitle">Zero-Barrier Intake &bull; Web Crypto SHA-256 Sealing &bull; Multi-Tier Geofencing</span>
        </div>
      </div>
      <div class="masthead-right">
        <div class="meta-tag">
          <span class="badge-sih">SIH 2026 &bull; PS: SIH26102</span>
          <span class="team-tag">Team Neural Nova &bull; Citizen Pipeline</span>
        </div>
        <img src="{flag_b64}" alt="India Flag" class="flag-img" />
      </div>
    </header>

    <div class="section-header">
      <div>
        <h2 class="section-title">3. Citizen Grievance Intake &amp; AI Cross-Verification Sequence</h2>
        <span class="section-desc">Client-side cryptographic fingerprinting, audio transcription, and dynamic score dispatching</span>
      </div>
      <span class="section-badge">Sequence Workflow</span>
    </div>

    <div class="diagram-container">
      <pre class="mermaid">
sequenceDiagram
    autonumber
    actor Citizen as Citizen Reporter
    participant Portal as Citizen PWA Portal
    participant AI as Gemini & Vision AI
    participant Backend as FastAPI Server
    participant Officer as DISHA Inspector

    Citizen->>Portal: Search Project (by Constituency / Keyword / Voice)
    Portal-->>Citizen: Display matching public works with sanction amounts
    Citizen->>Portal: Capture site photo + Optional voice description
    Portal->>Portal: Compute in-browser SHA-256 hash & capture GPS
    Portal->>Backend: Submit Report (Multipart form with hash & coordinates)
    Backend->>AI: Gemini Flash Audio Transcription + Grievance Categorization
    Backend->>Backend: Cross-check GPS against 3-tier location cache
    Backend->>Backend: Store in CSV / Supabase & increment report count
    Backend->>Backend: Apply +15.0 Dynamic Risk Score Boost
    Backend-->>Citizen: Return 11-char tracking code (e.g., CR-A1B2C3D4)
    Backend->>Officer: Dispatch flagged case to District Officer worklist
      </pre>
    </div>

    <div class="tech-grid">
      <div class="tech-card">
        <div class="tech-card-title">Precise GPS Tier</div>
        <div class="tech-card-desc">100m – 200m radial tolerance for exact worksite coordinates. Full 30% verification weight.</div>
      </div>
      <div class="tech-card">
        <div class="tech-card-title">Locality Regex Tier</div>
        <div class="tech-card-desc">2km primary tolerance (10km ceiling) for village/panchayat extracted from project description.</div>
      </div>
      <div class="tech-card">
        <div class="tech-card-title">District Centroid Tier</div>
        <div class="tech-card-desc">25km primary tolerance. Adapts weight (30% &rarr; 20%), shifting 10% to photo and text verification.</div>
      </div>
      <div class="tech-card">
        <div class="tech-card-title">Evidence Fingerprinting</div>
        <div class="tech-card-desc">Browser Web Crypto SHA-256 hash prevents tampering; verified against uploaded payload.</div>
      </div>
    </div>

    <footer class="page-footer">
      <div class="footer-left">
        <span>MPLADS Vigilance Decision-Support System (SIH26102)</span>
        <span>&bull;</span>
        <span>Citizen Security &amp; Geofencing</span>
      </div>
      <div class="footer-right">Page 3 of 4</div>
    </footer>
  </section>

  <!-- ================= PAGE 4 ================= -->
  <section class="page">
    <header class="masthead">
      <div class="masthead-left">
        <img src="{emblem_b64}" alt="Emblem" class="emblem-img" />
        <div class="titles-group">
          <span class="ministry-title">Ministry of Statistics &amp; Programme Implementation &bull; Government of India</span>
          <h1 class="portal-title">DISHA Officer Inspection &amp; Statutory Oversight</h1>
          <span class="portal-subtitle">Cryptographic Scoping &bull; Digital On-Site Checklists &bull; Statutory Audit Dossier</span>
        </div>
      </div>
      <div class="masthead-right">
        <div class="meta-tag">
          <span class="badge-sih">SIH 2026 &bull; PS: SIH26102</span>
          <span class="team-tag">Team Neural Nova &bull; Statutory Oversight</span>
        </div>
        <img src="{flag_b64}" alt="India Flag" class="flag-img" />
      </div>
    </header>

    <div class="section-header">
      <div>
        <h2 class="section-title">4. DISHA Officer Workflow &amp; Jurisdiction Scoping</h2>
        <span class="section-desc">GIGW 3.0 compliant workspace for district inspection officers and central auditors</span>
      </div>
      <span class="section-badge">Officer Lifecycle</span>
    </div>

    <div class="diagram-container">
      <pre class="mermaid">
flowchart LR
    subgraph Auth["1. Authentication & Scoping"]
        direction TB
        LOGIN["Officer Login\nPOST /auth/login"] --> JWT["Cryptographic JWT\nRole & District Scope"]
        JWT --> SCOPE{{"District Scope"}}
        SCOPE -->|National| ALL["MoSPI Admin\nAll 543 Seats"]
        SCOPE -->|District| FILTER["District Officer\nScoped to District"]
    end

    subgraph Inspection["2. Audit Case Inspection"]
        direction TB
        ALL --> WORKLIST["Prioritized Worklist\nRanked by Risk Score"]
        FILTER --> WORKLIST
        WORKLIST --> DETAIL["Detailed Dossier\n4 Signals & High-Res Map"]
    end

    subgraph Statutory["3. Statutory Determination"]
        direction TB
        DETAIL --> CHECK["DISHA On-Site Checklist\nIndexedDB + Cloud Sync"]
        DETAIL --> DOSSIER["Supervisory Audit Brief\n2-Page PDF Dossier"]
        DETAIL --> VERDICT["Record Determination\nConfirmed Non-Compliance / FP"]
    end
      </pre>
    </div>

    <div class="tech-grid">
      <div class="tech-card">
        <div class="tech-card-title">Jurisdiction Scoping</div>
        <div class="tech-card-desc">Officers cannot view records outside statutory district boundary; strictly enforced server-side.</div>
      </div>
      <div class="tech-card">
        <div class="tech-card-title">DISHA Digital Checklist</div>
        <div class="tech-card-desc">10-point statutory physical verification form with offline caching and Supabase synchronization.</div>
      </div>
      <div class="tech-card">
        <div class="tech-card-title">2-Page Audit Brief</div>
        <div class="tech-card-desc">ReportLab-generated PDF dossier with Sentinel-2 aerial thumbnail, cost Z-score, and Gemini notes.</div>
      </div>
      <div class="tech-card">
        <div class="tech-card-title">Statutory Compliance</div>
        <div class="tech-card-desc">Adheres to Information Technology Act 2000 &bull; DPDP Act 2023 &bull; GIGW 3.0 Government Standards.</div>
      </div>
    </div>

    <footer class="page-footer">
      <div class="footer-left">
        <span>MPLADS Vigilance Decision-Support System (SIH26102)</span>
        <span>&bull;</span>
        <span>Statutory Audit &amp; Compliance</span>
      </div>
      <div class="footer-right">Page 4 of 4</div>
    </footer>
  </section>

</body>
</html>
"""

    html_file = os.path.join(base_dir, "MPLADS_System_Flowcharts_SIH26102.html")
    pdf_file = os.path.join(base_dir, "MPLADS_System_Flowcharts_SIH26102.pdf")

    with open(html_file, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"Generated HTML source at: {html_file}")

    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    if not os.path.exists(chrome_path):
        chrome_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

    cmd = [
        chrome_path,
        "--headless",
        "--disable-gpu",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=8000",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_file}",
        f"file:///{html_file.replace(os.sep, '/')}"
    ]

    print("Running Chrome headless PDF conversion...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(pdf_file) and os.path.getsize(pdf_file) > 1000:
        size_kb = os.path.getsize(pdf_file) / 1024
        print(f"SUCCESS! Created PDF at: {pdf_file} ({size_kb:.1f} KB)")
        
        # Verify page count and extract text with PyMuPDF
        doc = pymupdf.open(pdf_file)
        # Remove any trailing empty pages
        modified = False
        while len(doc) > 0 and len(doc[-1].get_text().strip()) == 0:
            print(f"Trimming empty trailing page {len(doc)}...")
            doc.delete_page(-1)
            modified = True
        
        if modified:
            temp_pdf = pdf_file + ".tmp.pdf"
            doc.save(temp_pdf, incremental=False, deflate=True)
            doc.close()
            os.replace(temp_pdf, pdf_file)
            doc = pymupdf.open(pdf_file)

        print(f"Final Verified PDF page count: {len(doc)} pages")
        
        # Render high-resolution preview images
        preview_dir = os.path.join(base_dir, "pdf_preview_pages")
        os.makedirs(preview_dir, exist_ok=True)
        # Clear out old preview pages
        for f in os.listdir(preview_dir):
            if f.endswith(".png"):
                os.remove(os.path.join(preview_dir, f))

        for i, page in enumerate(doc):
            lines = [l.strip() for l in page.get_text().split("\n") if l.strip()]
            title = lines[0] if lines else "Empty"
            print(f"  Page {i+1}: {title} ({len(lines)} text elements)")
            pix = page.get_pixmap(dpi=150)
            img_path = os.path.join(preview_dir, f"page_{i+1}.png")
            pix.save(img_path)
            print(f"    Saved preview: {img_path}")
            
        doc.close()
        return pdf_file
    else:
        print("PDF generation failed:", res.stderr)
        return None

if __name__ == "__main__":
    generate_pdf()
