"""Step C: Side-by-side comparison of orphan (8000) vs new server (8001)."""
import sys, io, urllib.request, urllib.parse, json
import pandas as pd
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

def get(url):
    with urllib.request.urlopen(url, timeout=15) as r:
        return json.loads(r.read())

print("=== Step C: Side-by-side comparison ===\n")

# Get top 20 from each server
orphan  = get("http://127.0.0.1:8000/flagged-projects?limit=20")
new_srv = get("http://127.0.0.1:8001/flagged-projects?limit=20")

print(f"Orphan  top-{len(orphan)} project count: OK")
print(f"New srv top-{len(new_srv)} project count: OK")

# Check root health
h8000 = get("http://127.0.0.1:8000/")
h8001 = get("http://127.0.0.1:8001/")
print(f"\n  Orphan  total_projects: {h8000['total_projects']}")
print(f"  New srv total_projects: {h8001['total_projects']}")

# Index by work_id for comparison
idx_orphan  = {p["work_id"]: p for p in orphan}
idx_new     = {p["work_id"]: p for p in new_srv}
all_ids     = list(dict.fromkeys(list(idx_orphan.keys()) + list(idx_new.keys())))[:20]

print(f"\n{'work_id':<35} {'cost_z_O':>8} {'cost_z_N':>8} {'nlp_O':>6} {'nlp_N':>6} {'risk_O':>7} {'risk_N':>7} {'match':>6}")
print("-"*95)

all_match = True
deltas = []
for wid in all_ids:
    po = idx_orphan.get(wid)
    pn = idx_new.get(wid)
    if po is None:
        print(f"  {wid[-30:]:<30}  MISSING from orphan")
        continue
    if pn is None:
        print(f"  {wid[-30:]:<30}  MISSING from new server")
        all_match = False
        continue

    cz_o = po.get("cost_zscore") or 0
    cz_n = pn.get("cost_zscore") or 0
    nl_o = po.get("nlp_similarity_score") or 0
    nl_n = pn.get("nlp_similarity_score") or 0
    rs_o = po.get("risk_score") or 0
    rs_n = pn.get("risk_score") or 0
    delta = abs(rs_o - rs_n)
    deltas.append(delta)
    ok = "OK" if delta <= 0.1 else ("WARN" if delta <= 2.0 else "FAIL")
    if ok == "FAIL":
        all_match = False
    print(f"  {wid[-30:]:<30}  {cz_o:>8.2f} {cz_n:>8.2f}  {nl_o:>6.1f} {nl_n:>6.1f}  {rs_o:>7.1f} {rs_n:>7.1f}  {ok:>6}")

print(f"\n  Max delta: {max(deltas):.2f}  Mean delta: {sum(deltas)/len(deltas):.3f}")
print(f"\n  {'ALL SCORES MATCH' if all_match else 'SOME SCORES DIFFER — investigate before switching'}")

# Also test /project for the top work_id
top_wid = orphan[0]["work_id"]
p8000 = get(f"http://127.0.0.1:8000/project?work_id={urllib.parse.quote(top_wid)}")["project"]
p8001 = get(f"http://127.0.0.1:8001/project?work_id={urllib.parse.quote(top_wid)}")["project"]
print(f"\n=== /project spot check: {top_wid} ===")
for field in ["risk_score","cost_risk_score","nlp_similarity_score","satellite_status","cost_zscore"]:
    v0, v1 = p8000.get(field), p8001.get(field)
    match = "OK" if v0 == v1 else "DIFF"
    print(f"  {field:<28}: orphan={v0}  new={v1}  {match}")
