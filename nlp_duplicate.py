"""
NLP Duplicate Detection for MPLADS Risk Intelligence System.
Uses Sentence-BERT (all-MiniLM-L6-v2) to detect ghost/duplicate projects
based on description similarity across MPs and states.

Cache strategy: if nlp_duplicates_cache_5000.csv exists, scores are loaded
from it (exact match to orphan). Otherwise re-runs on flagged projects.

Exports:
  run_nlp_duplicate_detection(df, cache_path, sample_n=5000) -> pd.DataFrame
"""
import os
import logging
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

_SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_CACHE = os.path.join(_SCRIPT_DIR, "nlp_duplicates_cache_5000.csv")
NLP_THRESHOLD  = 0.91   # 91% — intentionally conservative (see GEMINI.md Section 5)


def run_nlp_duplicate_detection(
    df: pd.DataFrame,
    cache_path: str = _DEFAULT_CACHE,
    sample_n: int = 5000,
) -> pd.DataFrame:
    """
    Adds nlp_similarity_score (0-100), similar_project (work_id), similar_state columns.
    Loads from cache if available (guarantees exact match to orphan scores).
    """
    df = df.copy()
    df["nlp_similarity_score"] = 0.0
    df["similar_project"]      = None
    df["similar_state"]        = None

    if os.path.exists(cache_path):
        logger.info(f"Loading NLP scores from cache: {cache_path}")
        _apply_from_cache(df, cache_path)
    else:
        logger.info("No NLP cache found. Running Sentence-BERT scoring...")
        _run_sentence_bert(df, cache_path, sample_n)

    return df


def _apply_from_cache(df: pd.DataFrame, cache_path: str):
    """Merges cached pair scores into the dataframe."""
    cache = pd.read_csv(cache_path)
    if cache.empty or "work_id_a" not in cache.columns:
        return

    # For each project, find its highest-similarity match in the cache
    # A project can appear as work_id_a or work_id_b
    best: dict = {}   # work_id -> (similarity, partner_id, partner_state)

    for _, row in cache.iterrows():
        sim = float(row["similarity"])
        for my_id, partner_id, partner_state in [
            (row["work_id_a"], row["work_id_b"], row.get("state_b", "")),
            (row["work_id_b"], row["work_id_a"], row.get("state_a", "")),
        ]:
            if my_id not in best or sim > best[my_id][0]:
                best[my_id] = (sim, partner_id, partner_state)

    # Apply to dataframe
    for work_id, (sim, partner, state) in best.items():
        mask = df["work_id"] == work_id
        if mask.any():
            df.loc[mask, "nlp_similarity_score"] = round(sim * 100, 1)
            df.loc[mask, "similar_project"]       = partner
            df.loc[mask, "similar_state"]         = state

    flagged_count = (df["nlp_similarity_score"] >= NLP_THRESHOLD * 100).sum()
    logger.info(f"NLP cache applied. {flagged_count} projects above {NLP_THRESHOLD*100:.0f}% threshold.")


def _run_sentence_bert(df: pd.DataFrame, cache_path: str, sample_n: int):
    """Runs Sentence-BERT similarity on flagged projects, saves cache."""
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        logger.warning("sentence_transformers not available. NLP scores will be 0.")
        return

    # Score flagged (cost outlier) projects, up to sample_n
    flagged = df[df.get("is_cost_outlier", False) == True].copy()
    if len(flagged) == 0:
        flagged = df.head(sample_n)
    sample  = flagged.head(sample_n).dropna(subset=["work_description"]).copy()

    model   = SentenceTransformer("all-MiniLM-L6-v2")
    descs   = sample["work_description"].tolist()
    ids     = sample["work_id"].tolist()
    states  = sample["state"].tolist()

    logger.info(f"Encoding {len(descs)} project descriptions...")
    embeddings = model.encode(descs, show_progress_bar=True, batch_size=64)
    embeddings = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)

    # Pairwise cosine similarity — vectorised
    sim_matrix = embeddings @ embeddings.T
    np.fill_diagonal(sim_matrix, 0)

    records = []
    for i in range(len(ids)):
        j = int(np.argmax(sim_matrix[i]))
        sim_val = float(sim_matrix[i, j])
        best_sim = sim_val
        best_j   = j

        if best_sim >= NLP_THRESHOLD:
            mask = df["work_id"] == ids[i]
            df.loc[mask, "nlp_similarity_score"] = round(best_sim * 100, 1)
            df.loc[mask, "similar_project"]       = ids[best_j]
            df.loc[mask, "similar_state"]         = states[best_j]

        # Collect all above-threshold pairs for cache
        for j2 in range(i + 1, len(ids)):
            s = float(sim_matrix[i, j2])
            if s >= 0.70:   # save 70%+ to cache for future analysis
                records.append({
                    "work_id_a": ids[i],
                    "work_id_b": ids[j2],
                    "similarity": round(s, 4),
                    "state_a": states[i],
                    "state_b": states[j2],
                })

    if records:
        pd.DataFrame(records).to_csv(cache_path, index=False)
        logger.info(f"Saved {len(records)} pairs to {cache_path}")
