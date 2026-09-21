"""
Data Pipeline for MPLADS Risk Intelligence System.
Loads and cleans the 77K-record MPLADS dataset and adds computed columns.

Exports:
  load_and_clean(csv_path: str) -> pd.DataFrame
  add_cost_zscore(df: pd.DataFrame) -> pd.DataFrame
"""
import os
import numpy as np
import pandas as pd


def load_and_clean(csv_path: str) -> pd.DataFrame:
    """
    Reads the raw MPLADS CSV, coerces numeric types, drops null work_ids,
    and adds disbursed_vs_sanctioned_ratio.
    Returns a clean DataFrame with all 19 raw columns plus the ratio.
    """
    df = pd.read_csv(csv_path, low_memory=False)

    # Drop rows with no work_id (cannot be keyed or scored)
    df = df.dropna(subset=["work_id"]).reset_index(drop=True)

    # Coerce numeric columns
    numeric_cols = [
        "sanction_amount",
        "amount_disbursed_completed",
        "total_fund_disbursed",
        "num_payments",
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Derived column: disbursed vs sanctioned ratio
    df["disbursed_vs_sanctioned_ratio"] = np.where(
        df["sanction_amount"].fillna(0) > 0,
        df["amount_disbursed_completed"].fillna(0) / df["sanction_amount"],
        np.nan,
    )

    return df


def add_cost_zscore(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes per-work_category z-score of sanction_amount.
    Fully deterministic — no randomness. Adds column 'cost_zscore'.
    Single-project categories and zero-std categories get zscore=0.
    """
    df = df.copy()
    df["cost_zscore"] = 0.0

    for cat, group in df.groupby("work_category"):
        idx = group.index
        amounts = group["sanction_amount"].fillna(0)
        std = amounts.std()
        mean = amounts.mean()
        if std > 0:
            df.loc[idx, "cost_zscore"] = (amounts - mean) / std
        # else stays 0.0

    df["cost_zscore"] = df["cost_zscore"].fillna(0.0).round(6)
    return df
