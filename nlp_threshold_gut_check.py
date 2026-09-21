import sys, io
import pandas as pd
import numpy as np
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

df = pd.read_csv("nlp_duplicates_cache_5000.csv")
df["sim_pct"] = df["similarity"] * 100

print("=== NLP Similarity Score Distribution ===")
print(f"Total pairs in cache: {len(df)}")
print()

# Bucket distribution
buckets = [(70,75),(75,80),(80,85),(85,90),(90,91),(91,92),(92,95),(95,100)]
print(f"{'Range':>10}  {'Count':>6}  {'%':>6}  Bar")
for lo, hi in buckets:
    n = ((df.sim_pct >= lo) & (df.sim_pct < hi)).sum()
    pct = n/len(df)*100
    bar = "#" * int(pct * 1.5)
    print(f"  {lo}-{hi}%:   {n:>6}  {pct:>5.1f}%  {bar}")

# The key question: what's in the 80-91% band?
print()
print("=== Pairs in 80-91% band (would be flagged if threshold lowered) ===")
mid = df[(df.sim_pct >= 80) & (df.sim_pct < 91)].sort_values("sim_pct", ascending=False)
print(f"Count: {len(mid)}")
print()
# Load descriptions to check if these look like real duplicates or false positives
raw = pd.read_csv("MPLADS_real_raw_data_77312_works.csv", low_memory=False)
raw = raw[["work_id","work_description","state"]].dropna(subset=["work_id"])

for _, row in mid.head(8).iterrows():
    desc_a = raw.loc[raw.work_id==row.work_id_a, "work_description"].values
    desc_b = raw.loc[raw.work_id==row.work_id_b, "work_description"].values
    da = str(desc_a[0]) if len(desc_a) else "N/A"
    db = str(desc_b[0]) if len(desc_b) else "N/A"
    print(f"  {row.sim_pct:.1f}%  [{row.get('state_a','?')} vs {row.get('state_b','?')}]")
    print(f"    A: {da[:60]}")
    print(f"    B: {db[:60]}")
    print()
