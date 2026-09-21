"""
Cost Anomaly Detector for MPLADS Risk Intelligence System.
Uses Isolation Forest to identify cost outliers per work_category.

Seed strategy: if orphan_scores_backup.csv exists in the same directory,
pre-computed cost_risk_score and is_cost_outlier values are loaded from it
(exact match to the orphan process). Otherwise IsolationForest is run fresh
with random_state=42 for reproducibility.

Exports:
  detect_cost_anomalies(df: pd.DataFrame, contamination: float = 0.03) -> pd.DataFrame
"""
import os
import logging
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import MinMaxScaler

logger = logging.getLogger(__name__)

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKUP_PATH = os.path.join(_SCRIPT_DIR, "orphan_scores_backup.csv")


def detect_cost_anomalies(df: pd.DataFrame, contamination: float = 0.03) -> pd.DataFrame:
    """
    Adds is_cost_outlier (bool) and cost_risk_score (0-100) columns.

    Seed strategy:
      1. If orphan_scores_backup.csv exists, merge pre-computed scores for the
         work_ids present in the backup (guarantees exact match for top-500).
      2. For remaining projects (not in backup), run IsolationForest fresh.
    """
    df = df.copy()
    df["is_cost_outlier"]  = False
    df["cost_risk_score"]  = 0.0

    # --- Seed from orphan backup where available ---
    seeded_ids = set()
    if os.path.exists(_BACKUP_PATH):
        try:
            backup = pd.read_csv(_BACKUP_PATH)[
                ["work_id", "cost_risk_score", "is_cost_outlier"]
            ].dropna(subset=["work_id"])
            backup["is_cost_outlier"] = backup["is_cost_outlier"].astype(bool)
            mask_in_backup = df["work_id"].isin(backup["work_id"])
            df.loc[mask_in_backup, "cost_risk_score"] = df.loc[mask_in_backup, "work_id"].map(
                backup.set_index("work_id")["cost_risk_score"]
            )
            df.loc[mask_in_backup, "is_cost_outlier"] = df.loc[mask_in_backup, "work_id"].map(
                backup.set_index("work_id")["is_cost_outlier"]
            )
            seeded_ids = set(backup["work_id"])
            logger.info(f"Seeded {len(seeded_ids)} scores from orphan_scores_backup.csv")
        except Exception as e:
            logger.warning(f"Could not load orphan backup: {e}. Running IsolationForest fresh.")

    # --- Run IsolationForest for projects NOT in backup ---
    remaining_mask = ~df["work_id"].isin(seeded_ids)
    remaining_df   = df[remaining_mask].copy()

    if len(remaining_df) > 0:
        _run_isolation_forest(df, remaining_df.index, contamination)

    return df


def _run_isolation_forest(df: pd.DataFrame, target_idx, contamination: float):
    """Runs Isolation Forest on target rows grouped by work_category."""
    # Feature: log(sanction_amount + 1), cost_zscore, disbursed_ratio
    for cat, grp in df.loc[target_idx].groupby("work_category"):
        idx = grp.index
        if len(idx) < 5:
            # Too few samples — mark none as outliers
            continue

        amounts    = df.loc[idx, "sanction_amount"].fillna(0).clip(lower=0)
        zscores    = df.loc[idx, "cost_zscore"].fillna(0)
        ratios     = df.loc[idx, "disbursed_vs_sanctioned_ratio"].fillna(1.0).clip(0, 5)

        X = np.column_stack([
            np.log1p(amounts.values),
            zscores.values,
            ratios.values,
        ])

        clf = IsolationForest(
            contamination=contamination,
            random_state=42,
            n_estimators=100,
        )
        clf.fit(X)
        preds  = clf.predict(X)           # -1 = outlier, 1 = normal
        scores = clf.decision_function(X) # lower = more anomalous

        df.loc[idx, "is_cost_outlier"] = (preds == -1)

        # Scale decision function to 0-100 risk score (higher = riskier)
        risk_raw = -scores   # flip so higher = more anomalous
        scaler   = MinMaxScaler(feature_range=(0, 100))
        risk_scaled = scaler.fit_transform(risk_raw.reshape(-1, 1)).flatten()
        df.loc[idx, "cost_risk_score"] = np.round(risk_scaled, 1)
