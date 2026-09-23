"""
Gemini API explainability module for MPLADS Risk Intelligence System.
Exports: explain_flagged_project(project: dict) -> str
         synthesize_audit_doubts(project: dict) -> str
Required by audit_brief.py line 37.
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

def _get_api_key() -> Optional[str]:
    """Retrieves GOOGLE_API_KEY from os.environ or .env file."""
    # 1. Check .env file in root
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("GOOGLE_API_KEY=") and not line.startswith("#"):
                        val = line.split("=", 1)[1].strip()
                        if val and not val.startswith("your-"):
                            return val
        except Exception:
            pass

    # 2. Check process environment
    key = os.environ.get("GOOGLE_API_KEY")
    if key and not key.startswith("your-"):
        return key
    return None


_genai = None


def _get_client():
    global _genai
    if _genai is not None:
        return _genai
    api_key = _get_api_key()
    if not api_key:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        _genai = genai
        return _genai
    except Exception as e:
        logger.warning(f"Gemini client init failed: {e}")
        return None


def _template_explanation(project: dict) -> str:
    cost_z  = project.get("cost_zscore", 0) or 0
    nlp_sim = project.get("nlp_similarity_score", 0) or 0
    similar = project.get("similar_project", "another project")
    sim_st  = project.get("similar_state", "another state")
    desc    = project.get("work_description", "N/A")
    mp      = project.get("mp_name", "N/A")
    cit_ct  = project.get("citizen_report_count", 0) or 0

    reasons = []
    if abs(cost_z) >= 1.5:
        reasons.append(
            f"cost is significantly above similar projects in its category (z-score: {cost_z:.2f})"
        )
    if nlp_sim >= 85:
        reasons.append(
            f"description is {nlp_sim:.1f}% similar to {similar} in {sim_st}, "
            f"suggesting possible duplication or ghost project"
        )
    if cit_ct > 0:
        reasons.append(f"{cit_ct} citizen report(s) have been filed against this project")
    if not reasons:
        reasons.append("multiple risk signals triggered across cost and NLP signals")

    return (
        f"Flagged because: {'; '.join(reasons)}. "
        f"Project description: \"{desc}\". Responsible MP: {mp}. "
        f"Recommended for supervisory review and field verification."
    )


def _template_doubts(project: dict) -> str:
    cost_z  = project.get("cost_zscore", 0) or 0
    nlp_sim = project.get("nlp_similarity_score", 0) or 0
    similar = project.get("similar_project", "N/A")
    doubts = []
    if abs(cost_z) >= 1.5:
        doubts.append(
            f"1. Why does this project cost significantly more than similar-category "
            f"works? (z-score: {cost_z:.2f})"
        )
    if nlp_sim >= 85:
        doubts.append(
            f"2. Is this project a duplicate of {similar}? "
            f"Description overlap is {nlp_sim:.1f}%."
        )
    doubts.append(
        "3. Has a physical inspection been conducted and documented per DISHA guidelines?"
    )
    return "\n".join(doubts)


def _get_generative_model(client):
    for m in ["gemini-3.6-flash", "gemini-flash-latest", "gemini-2.5-flash", "gemini-1.5-flash"]:
        try:
            return client.GenerativeModel(m)
        except Exception:
            continue
    return client.GenerativeModel("gemini-3.6-flash")


def explain_flagged_project(project: dict, language: str = "English") -> str:
    client = _get_client()
    if client is None:
        return _template_explanation(project)
    try:
        model = _get_generative_model(client)
        prompt = (
            f"You are an audit assistant for India's MPLAD Scheme. "
            f"Explain in 2-3 plain sentences why this project was flagged as suspicious in {language}:\n"
            f"Work ID: {project.get('work_id')}\n"
            f"Description: {project.get('work_description')}\n"
            f"State: {project.get('state')}, MP: {project.get('mp_name')}\n"
            f"Sanction Amount: Rs. {project.get('sanction_amount', 0):,.0f}\n"
            f"Cost Z-Score: {project.get('cost_zscore', 0):.2f}\n"
            f"NLP Similarity: {project.get('nlp_similarity_score', 0):.1f}% "
            f"to {project.get('similar_project')} ({project.get('similar_state')})\n"
            f"Citizen Reports: {project.get('citizen_report_count', 0)}\n"
            f"Write a brief, factual explanation. Do not use the word fraud."
        )
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        logger.warning(f"Gemini API call skipped/failed: {e}. Falling back to template explanation.")
        return _template_explanation(project)


def synthesize_audit_doubts(project: dict, language: str = "English") -> str:
    client = _get_client()
    if client is None:
        return _template_doubts(project)
    try:
        model = _get_generative_model(client)
        prompt = (
            f"You are an audit officer reviewing MPLAD Scheme projects. "
            f"Generate 3 specific audit questions in {language} for this flagged project:\n"
            f"Work ID: {project.get('work_id')}\n"
            f"Description: {project.get('work_description')}\n"
            f"State: {project.get('state')}, MP: {project.get('mp_name')}\n"
            f"Cost Z-Score: {project.get('cost_zscore', 0):.2f}\n"
            f"NLP Similarity: {project.get('nlp_similarity_score', 0):.1f}% "
            f"to {project.get('similar_project')}\n"
            f"Format as numbered questions only."
        )
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        logger.warning(f"Gemini doubt synthesis fallback: {e}")
        return _template_doubts(project)

