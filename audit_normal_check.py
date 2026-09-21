import pandas as pd
import numpy as np

df = pd.read_csv("MPLADS_real_raw_data_77312_works.csv", low_memory=False)
df["sanction_amount"] = pd.to_numeric(df["sanction_amount"], errors="coerce")
df = df.dropna(subset=["sanction_amount","work_id"])

# z-score per category
df["cost_zscore"] = df.groupby("work_category")["sanction_amount"].transform(
    lambda x: (x - x.mean()) / (x.std() + 1e-9))

# Normal: z-score very close to 0 (typical cost for category)
typical = df[df["cost_zscore"].abs() < 0.1].sample(5, random_state=7)
for _, row in typical.iterrows():
    print(f"work_id={row['work_id']}  amt={int(row['sanction_amount'])}  zscore={row['cost_zscore']:.4f}  cat={str(row.get('work_category','?'))[:20]}  desc={str(row.get('work_description','?'))[:35]}")
