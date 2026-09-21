import sys, io, urllib.request, json, numpy as np
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

def get(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read())

all_p = get("http://127.0.0.1:8000/flagged-projects?limit=500")

# === Step 1: Pure 2-signal points (no sat, no cit, no feedback) ===
clean = [p for p in all_p
         if p.get("citizen_report_count", 0) == 0
         and not p.get("feedback_status")
         and p.get("satellite_risk_score") is None
         and p.get("nlp_similarity_score") is not None
         and p.get("cost_risk_score") is not None]

print(f"2-signal clean points: {len(clean)}")

# Fit: API = w_cost*cost + w_nlp*nlp
costs = np.array([p["cost_risk_score"] for p in clean])
nlps  = np.array([p["nlp_similarity_score"] for p in clean])
apis  = np.array([p["risk_score"] for p in clean])

# Least-squares fit: API = w1*cost + w2*nlp
A = np.column_stack([costs, nlps])
weights, res, _, _ = np.linalg.lstsq(A, apis, rcond=None)
print(f"Fitted weights: cost={weights[0]:.6f}  nlp={weights[1]:.6f}")
print(f"Sum of weights: {weights[0]+weights[1]:.6f}")

# Verify: manual formula with w=0.5 each
manual = 0.5*costs + 0.5*nlps
residuals = apis - manual
print(f"\nWith w_cost=0.5, w_nlp=0.5:")
print(f"  Max error: {np.abs(residuals).max():.3f}")
print(f"  Mean error: {np.abs(residuals).mean():.4f}")
print(f"  All within 0.1? {(np.abs(residuals) <= 0.1).all()}")

# Show 5 examples
print("\nSample verification (cost, nlp, formula=0.5+0.5, API):")
for i in range(5):
    f = 0.5*costs[i] + 0.5*nlps[i]
    print(f"  0.5x{costs[i]:.1f} + 0.5x{nlps[i]:.1f} = {f:.2f}  API={apis[i]:.1f}  err={abs(f-apis[i]):.2f}")

# === Step 2: Verify citizen boost = exactly +15 (first report only) ===
print("\n=== Citizen boost verification ===")
# Projects with exactly 1 citizen report, no feedback, no sat
cit1 = [p for p in all_p
        if p.get("citizen_report_count", 0) == 1
        and not p.get("feedback_status")
        and p.get("satellite_risk_score") is None]
if cit1:
    for p in cit1[:5]:
        base = 0.5*p["cost_risk_score"] + 0.5*p["nlp_similarity_score"]
        boost = p["risk_score"] - base
        print(f"  base={base:.1f}  API={p['risk_score']}  boost={boost:.1f}")

# === Step 3: Look at confirmed_issue vs false_positive adjustments ===
print("\n=== feedback adjustments ===")
for fb_type in ["confirmed_issue", "false_positive"]:
    fb_p = [p for p in all_p
            if p.get("feedback_status") == fb_type
            and p.get("satellite_risk_score") is None
            and p.get("citizen_report_count", 0) > 0]
    if fb_p:
        print(f"\n{fb_type} (no sat, has cit) - {len(fb_p)} projects:")
        for p in fb_p[:3]:
            base = 0.5*p["cost_risk_score"] + 0.5*p["nlp_similarity_score"]
            print(f"  cost={p['cost_risk_score']} nlp={p['nlp_similarity_score']} cit={p['citizen_report_count']}  base={base:.1f}  API={p['risk_score']}")
