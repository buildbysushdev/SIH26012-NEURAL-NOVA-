import sys, io, urllib.request, json
import pandas as pd
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE = "http://127.0.0.1:8000"
def get(url):
    with urllib.request.urlopen(url, timeout=20) as r:
        return json.loads(r.read())

flagged = get(f"{BASE}/flagged-projects?limit=500")
print(f"Got {len(flagged)} flagged projects from orphan")

records = []
for p in flagged:
    records.append({
        "work_id":              p.get("work_id"),
        "cost_risk_score":      p.get("cost_risk_score"),
        "is_cost_outlier":      p.get("is_cost_outlier", True),
        "cost_zscore":          p.get("cost_zscore"),
        "nlp_similarity_score": p.get("nlp_similarity_score"),
        "similar_project":      p.get("similar_project"),
        "similar_state":        p.get("similar_state"),
        "satellite_risk_score": p.get("satellite_risk_score"),
        "satellite_status":     p.get("satellite_status"),
        "risk_score_orphan":    p.get("risk_score"),
        "citizen_report_count": p.get("citizen_report_count", 0),
        "feedback_status":      p.get("feedback_status"),
    })

df = pd.DataFrame(records)
df.to_csv("orphan_scores_backup.csv", index=False)
print(f"Saved -> orphan_scores_backup.csv ({len(df)} rows)")
print(f"risk_score_orphan range: {df.risk_score_orphan.min():.1f} - {df.risk_score_orphan.max():.1f}")
print(f"cost_risk_score range:   {df.cost_risk_score.min():.1f} - {df.cost_risk_score.max():.1f}")
print(f"nlp range:               {df.nlp_similarity_score.min():.1f} - {df.nlp_similarity_score.max():.1f}")

import os
cache_ok = os.path.exists("nlp_duplicates_cache_5000.csv")
print(f"\nnlp_duplicates_cache_5000.csv: {'EXISTS' if cache_ok else 'MISSING'}")
if cache_ok:
    c = pd.read_csv("nlp_duplicates_cache_5000.csv")
    print(f"  Pairs in cache: {len(c)}  Columns: {list(c.columns)}")

print("\nStep A COMPLETE.")
