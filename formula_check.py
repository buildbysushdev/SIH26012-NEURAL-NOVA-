import sys, io, urllib.request, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

def get(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read())

all_p = get("http://127.0.0.1:8000/flagged-projects?limit=500")

# Clean projects: no citizen reports, no feedback, all signals present
clean = [p for p in all_p
         if p.get("citizen_report_count", 0) == 0
         and not p.get("feedback_status")
         and p.get("nlp_similarity_score") is not None
         and p.get("cost_risk_score") is not None]

print(f"Clean data points (no citizen, no feedback): {len(clean)}")
print()
print(f"{'cost':>6} {'nlp':>6} {'sat':>8} {'API':>7}  (all 3 signals present only)")
print("-" * 45)
for p in clean[:15]:
    sat = p.get("satellite_risk_score")
    print(f"{p['cost_risk_score']:6.1f} {p['nlp_similarity_score']:6.1f} {str(sat):>8}  {p['risk_score']:7.1f}")

# Now find projects with satellite_risk_score present too (3-signal points)
three_sig = [p for p in clean if p.get("satellite_risk_score") is not None]
print(f"\n3-signal clean points: {len(three_sig)}")
for p in three_sig[:8]:
    c, n, s, api = p["cost_risk_score"], p["nlp_similarity_score"], p["satellite_risk_score"], p["risk_score"]
    # Try formula: api = w_c*c + w_n*n + w_s*s
    # If we assume w_s=0.2: contribution = 0.2*100 = 20
    # api - 0.2*s = w_c*c + w_n*n
    remainder = api - 0.2*s
    print(f"  cost={c:.1f} nlp={n:.1f} sat={s:.1f} API={api}  (API - 0.2*sat = {remainder:.2f})")
