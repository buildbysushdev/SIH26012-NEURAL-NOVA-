"""
Gemini API explainability module — MPLADS Risk Intelligence System
SIH26102 / Team Neural Nova

ARCHITECTURE CONTRACT:
  - Detection models (Isolation Forest, Sentence-BERT, SegFormer) decide WHAT
    is flagged and produce the numeric risk scores.
  - This module is the EXPLANATION LAYER ONLY. It turns already-computed
    structured scores into short, human-readable text for auditors.
  - Gemini is NEVER called to re-score, re-rank, or override any model output.
  - Scores are read-only inputs here; they are NEVER written back.

Exports:
  explain_flagged_project(project: dict, language: str = "English") -> str
    Called ONCE per flagged project, after all scoring is done.
    Returns plain-English explanation as JSON {"explanation": str, "signals": list}.

  summarize_citizen_report(report_text: str, max_chars: int = 500) -> dict
    Called ONCE per citizen report submission, after the report is saved.
    Returns {"summary": str, "category": str} where category is one of:
      quality_concern | non_completion | fund_misuse | contractor_issue | other

  synthesize_audit_doubts(project: dict, language: str = "English") -> str
    Called from audit_brief.py for full dossier generation.
    Returns 3 numbered audit questions as plain text.

Token efficiency:
  - System prompts are MODULE-LEVEL CONSTANTS (~60 tokens each), built once.
  - Only structured numeric/short-text fields sent to Gemini — NOT full raw rows.
  - work_description truncated to 80 chars max before sending.
  - max_output_tokens capped at 150 (flag explanation) / 100 (citizen summary).
  - Structured JSON output requested so parsing is cheap and reliable.
  - All calls log token usage for cost tracking.
"""

import os
import json
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Fixed system prompts — built once at module load, reused for every call.
# Changing these changes ALL explanation output, so edit deliberately.
# ---------------------------------------------------------------------------

_SYSTEM_FLAG_EXPLANATION = (
    "You are a concise audit assistant for India's MPLAD Scheme. "
    "Given structured risk scores for one project, output ONLY valid JSON: "
    '{"explanation": "<1-2 sentences>", "signals": ["<signal1>", "<signal2>"]}. '
    "Use factual, neutral language. Never use the word fraud. "
    "explanation must be under 60 words. signals is a list of 1-3 short phrases."
)

_SYSTEM_CITIZEN_SUMMARIZER = (
    "You are a concise assistant summarizing citizen complaints about Indian government projects. "
    "Output ONLY valid JSON: "
    '{"summary": "<1 sentence>", "category": "<tag>"}. '
    "category must be exactly one of: quality_concern, non_completion, "
    "fund_misuse, contractor_issue, other. "
    "summary must be under 30 words."
)

_SYSTEM_AUDIT_DOUBTS = (
    "You are an audit officer reviewing MPLAD Scheme projects. "
    "Output ONLY 3 numbered audit questions as plain text, one per line. "
    "Be specific to the project signals. No preamble."
)

# Valid citizen report categories — used for validation of Gemini output.
VALID_CATEGORIES = frozenset(
    ["quality_concern", "non_completion", "fund_misuse", "contractor_issue", "other"]
)

# ---------------------------------------------------------------------------
# API key and client initialisation — lazy singleton
# ---------------------------------------------------------------------------

def _get_api_key() -> Optional[str]:
    """Retrieves GOOGLE_API_KEY from .env file or process environment."""
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
    key = os.environ.get("GOOGLE_API_KEY")
    if key and not key.startswith("your-"):
        return key
    return None


_genai_client = None   # lazy singleton — initialised once, reused every call


def _get_client():
    """Returns a configured google.genai Client (singleton) or None.
    Uses the new google-genai SDK (google.genai), not the deprecated google.generativeai.
    """
    global _genai_client
    if _genai_client is not None:
        return _genai_client
    api_key = _get_api_key()
    if not api_key:
        logger.warning("GOOGLE_API_KEY not found — Gemini calls will use template fallback.")
        return None
    try:
        # Prefer new SDK (google-genai package)
        from google import genai
        client = genai.Client(api_key=api_key)
        _genai_client = client
        logger.info("Gemini client (google.genai) initialised successfully.")
        return _genai_client
    except ImportError:
        pass
    except Exception as e:
        logger.warning(f"Gemini client init (google.genai) failed: {e}")
        return None
    # Fallback: try deprecated google.generativeai if new SDK not installed
    try:
        import google.generativeai as genai_legacy  # noqa: F401 — only as last resort
        genai_legacy.configure(api_key=api_key)
        _genai_client = genai_legacy
        logger.info("Gemini client (google.generativeai legacy) initialised.")
        return _genai_client
    except Exception as e:
        logger.warning(f"Gemini client init (legacy) failed: {e}")
        return None


# Preferred model names in priority order — gemini-3.6-flash first per API guidance
_MODEL_PREFERENCE = [
    "gemini-3.6-flash",
    "gemini-2.5-flash-preview-05-20",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]


def _is_new_sdk(client) -> bool:
    """Returns True if client is the new google.genai.Client, False if legacy."""
    return hasattr(client, "models") and not hasattr(client, "GenerativeModel")


def _call_gemini(system_prompt: str, user_prompt: str, max_output_tokens: int) -> Optional[str]:
    """
    Makes a single Gemini API call using either the new google.genai or legacy SDK.
    Returns the raw response text or None if unavailable/errored.
    Logs token usage for cost tracking.
    """
    client = _get_client()
    if client is None:
        return None

    full_prompt = f"{system_prompt}\n\n{user_prompt}"

    if _is_new_sdk(client):
        # ── New google.genai SDK path ──────────────────────────────────────
        from google.genai import types as genai_types
        config = genai_types.GenerateContentConfig(
            max_output_tokens=max_output_tokens,
            temperature=0.1,
        )
        for model_name in _MODEL_PREFERENCE:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=full_prompt,
                    config=config,
                )
                # Extract text — try the top-level .text shortcut first (new SDK),
                # then walk candidates[0].content.parts with full null guards.
                text = None
                if hasattr(response, "text") and response.text:
                    text = response.text.strip()
                elif response.candidates:
                    cand = response.candidates[0]
                    content = getattr(cand, "content", None)
                    parts   = getattr(content, "parts", None) if content else None
                    if parts:
                        for part in parts:
                            part_text = getattr(part, "text", None)
                            if part_text:
                                text = part_text.strip()
                                break

                # Log token usage
                try:
                    um = response.usage_metadata
                    logger.info(
                        f"[Gemini/{model_name}] "
                        f"prompt_tokens={um.prompt_token_count} "
                        f"output_tokens={um.candidates_token_count} "
                        f"total={um.total_token_count}"
                    )
                except Exception:
                    logger.debug("[Gemini] token usage metadata unavailable.")

                return text
            except Exception as e:
                err_str = str(e)
                if "404" in err_str or "no longer available" in err_str or "not found" in err_str.lower():
                    logger.debug(f"Model {model_name} unavailable, trying next: {e}")
                    continue
                logger.warning(f"Gemini API call failed ({model_name}): {e}")
                return None
        logger.warning("All preferred Gemini models unavailable.")
        return None
    else:
        # ── Legacy google.generativeai SDK path ────────────────────────────
        for model_name in _MODEL_PREFERENCE:
            try:
                model = client.GenerativeModel(model_name)
                gen_cfg = client.types.GenerationConfig(
                    max_output_tokens=max_output_tokens,
                    temperature=0.1,
                )
                response = model.generate_content(full_prompt, generation_config=gen_cfg)
                text = response.text.strip() if response.text else None
                try:
                    um = response.usage_metadata
                    logger.info(
                        f"[Gemini-legacy/{model_name}] "
                        f"prompt_tokens={um.prompt_token_count} "
                        f"output_tokens={um.candidates_token_count} "
                        f"total={um.total_token_count}"
                    )
                except Exception:
                    pass
                return text
            except Exception as e:
                err_str = str(e)
                if "404" in err_str or "no longer available" in err_str:
                    logger.debug(f"Legacy model {model_name} unavailable, trying next.")
                    continue
                logger.warning(f"Gemini legacy API call failed ({model_name}): {e}")
                return None
        logger.warning("All legacy Gemini models unavailable.")
        return None


def _parse_json_response(text: str, required_keys: list) -> Optional[dict]:
    """
    Attempts to parse Gemini's text response as JSON.
    Handles several common model formatting quirks:
      - Markdown code fences (```json ... ``` or bare ``` ... ```)
      - JSON embedded in surrounding prose (extracts first {...} block)
      - Truncated JSON (partial strings) — returns None so fallback kicks in
    Returns the dict if all required_keys are present, else None.
    """
    if not text:
        return None

    # Step 1: strip any markdown code fences (```json, ```JSON, or bare ```)
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip())

    # Step 2: if after stripping fences there's still no JSON object, try to
    # extract the first {...} block from the string (handles prose wrapping)
    if not cleaned.lstrip().startswith("{"):
        match = re.search(r"(\{.*\})", cleaned, flags=re.DOTALL)
        if match:
            cleaned = match.group(1)
        else:
            logger.warning(f"Gemini response has no JSON object. Raw: {text[:120]}")
            return None

    try:
        obj = json.loads(cleaned)
        if all(k in obj for k in required_keys):
            return obj
        logger.warning(f"Gemini JSON missing required keys {required_keys}. Got: {list(obj.keys())}")
        return None
    except json.JSONDecodeError as e:
        logger.warning(f"Gemini response was not valid JSON: {e}. Raw: {text[:200]}")
        return None


# ---------------------------------------------------------------------------
# Template fallbacks — used when Gemini is unavailable or returns bad output.
# These are always kept in sync with the function signatures above.
# ---------------------------------------------------------------------------

def _template_explanation(project: dict) -> str:
    """Plain-text fallback explanation when Gemini is unavailable."""
    cost_z  = project.get("cost_zscore", 0) or 0
    nlp_sim = project.get("nlp_similarity_score", 0) or 0
    similar = project.get("similar_project", "another project")
    sim_st  = project.get("similar_state", "another state")
    cit_ct  = project.get("citizen_report_count", 0) or 0

    reasons = []
    if abs(cost_z) >= 1.5:
        reasons.append(f"cost significantly above category peers (z-score: {cost_z:.2f})")
    if nlp_sim >= 85:
        reasons.append(
            f"description is {nlp_sim:.1f}% similar to {similar} ({sim_st}), "
            f"suggesting possible duplication"
        )
    if cit_ct > 0:
        reasons.append(f"{cit_ct} citizen report(s) filed")
    if not reasons:
        reasons.append("combined cost and NLP risk signals triggered")
    return f"Flagged: {'; '.join(reasons)}. Recommended for field verification."


def _template_doubts(project: dict) -> str:
    """Numbered audit questions fallback when Gemini is unavailable."""
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
            f"2. Is this a duplicate of {similar}? "
            f"Description overlap is {nlp_sim:.1f}%."
        )
    doubts.append(
        "3. Has a physical inspection been conducted and documented per DISHA guidelines?"
    )
    return "\n".join(doubts)


def _template_citizen_summary(report_text: str) -> dict:
    """Minimal fallback citizen summary when Gemini is unavailable."""
    text_lower = report_text.lower()
    if any(w in text_lower for w in ["incomplete", "not complete", "unfinished", "abandoned"]):
        cat = "non_completion"
    elif any(w in text_lower for w in ["quality", "poor", "broken", "damaged", "bad work"]):
        cat = "quality_concern"
    elif any(w in text_lower for w in ["money", "fund", "misuse", "embezzle", "stolen"]):
        cat = "fund_misuse"
    elif any(w in text_lower for w in ["contractor", "company", "vendor", "builder"]):
        cat = "contractor_issue"
    else:
        cat = "other"
    # Truncate to a clean 1-sentence summary
    summary = report_text.strip()[:120].rstrip(".!?") + "."
    return {"summary": summary, "category": cat}


# ---------------------------------------------------------------------------
# Public API — these are the ONLY functions called from outside this module.
# ---------------------------------------------------------------------------

def explain_flagged_project(project: dict, language: str = "English") -> str:
    """
    Generates a 1-2 sentence plain-English explanation of why a project was
    flagged, using already-computed risk scores as input.

    ARCHITECTURE NOTE:
      - Input: structured scores from Isolation Forest + Sentence-BERT + citizen module.
      - Output: explanation TEXT only. Scores in `project` are never modified here.
      - Called ONCE per flagged project when a detail view is requested.
      - Sends only 7 minimal fields to Gemini — NOT the full project row.

    Args:
        project: dict containing scored project fields (read-only).
        language: response language (default "English").

    Returns:
        Plain-text explanation string (from Gemini JSON or template fallback).
    """
    # ── Snapshot scores BEFORE calling Gemini (for architecture verification) ──
    score_before = project.get("risk_score")

    # ── Build a minimal, token-efficient user prompt ──
    desc_raw  = project.get("work_description") or ""
    desc_clip = desc_raw[:80] + ("…" if len(desc_raw) > 80 else "")  # max 80 chars

    user_prompt = (
        f"Project: {project.get('work_id')} | State: {project.get('state')} | "
        f"MP: {project.get('mp_name')}\n"
        f"Description (truncated): {desc_clip}\n"
        f"Sanction: Rs {project.get('sanction_amount', 0):,.0f} | "
        f"Cost Z-Score: {project.get('cost_zscore', 0):.2f} | "
        f"NLP Similarity: {project.get('nlp_similarity_score', 0):.1f}% | "
        f"Citizen Reports: {project.get('citizen_report_count', 0)} | "
        f"Risk Score: {project.get('risk_score', 0):.1f}\n"
        f"Language: {language}"
    )

    # ── Call Gemini (max 250 tokens — JSON object needs headroom for signals list) ──
    # 150 was too tight: the model started generating and got cut off mid-string.
    raw_text = _call_gemini(_SYSTEM_FLAG_EXPLANATION, user_prompt, max_output_tokens=250)

    result_text = None
    if raw_text:
        parsed = _parse_json_response(raw_text, required_keys=["explanation", "signals"])
        if parsed:
            result_text = parsed["explanation"]

    if result_text is None:
        logger.debug("explain_flagged_project: using template fallback.")
        result_text = _template_explanation(project)

    # ── Verify score was NOT modified (architecture contract) ──
    score_after = project.get("risk_score")
    if score_before != score_after:
        logger.error(
            f"ARCHITECTURE VIOLATION: risk_score changed inside explain_flagged_project! "
            f"Before={score_before}, After={score_after}. This must never happen."
        )

    return result_text


def summarize_citizen_report(report_text: str, max_chars: int = 500) -> dict:
    """
    Summarizes a citizen complaint and assigns a category tag.

    ARCHITECTURE NOTE:
      - Called ONCE per report submission, after the report is saved to CSV.
      - Never called per dataset row. Never modifies any risk score.
      - Input text is capped at max_chars (default 500) before sending.
      - Output is {"summary": str, "category": str} where category must be
        one of: quality_concern | non_completion | fund_misuse |
                contractor_issue | other

    Args:
        report_text: raw citizen complaint text (may be messy/informal).
        max_chars: maximum characters to send to Gemini (default 500).

    Returns:
        dict with "summary" (str) and "category" (str) keys.
        Falls back to keyword-based template if Gemini unavailable.
    """
    if not report_text or not report_text.strip():
        return {"summary": "No description provided.", "category": "other"}

    # ── Cap input length — never send more than max_chars ──
    text_to_send = report_text.strip()[:max_chars]
    input_length = len(report_text.strip())

    user_prompt = f"Citizen complaint text ({input_length} chars, truncated to {len(text_to_send)}):\n{text_to_send}"

    # ── Call Gemini (max 100 tokens — only need 1 sentence + 1 tag) ──
    raw_text = _call_gemini(_SYSTEM_CITIZEN_SUMMARIZER, user_prompt, max_output_tokens=100)

    if raw_text:
        parsed = _parse_json_response(raw_text, required_keys=["summary", "category"])
        if parsed:
            # Validate category is one of the 5 allowed values
            cat = parsed.get("category", "other")
            if cat not in VALID_CATEGORIES:
                logger.warning(
                    f"Gemini returned unknown category '{cat}', forcing to 'other'."
                )
                cat = "other"
            return {
                "summary": str(parsed.get("summary", "")).strip()[:200],
                "category": cat,
            }

    logger.debug("summarize_citizen_report: using template fallback.")
    return _template_citizen_summary(report_text)


def synthesize_audit_doubts(project: dict, language: str = "English") -> str:
    """
    Generates 3 specific audit questions for a flagged project.
    Used by audit_brief.py for full dossier generation.

    ARCHITECTURE NOTE:
      - Read-only: scores in `project` are never modified.
      - Sends only the structured score fields — NOT the full project row.
      - work_description truncated to 80 chars for token efficiency.

    Args:
        project: dict containing scored project fields (read-only).
        language: question language (default "English").

    Returns:
        Numbered questions as plain-text string (Gemini or template fallback).
    """
    desc_raw  = project.get("work_description") or ""
    desc_clip = desc_raw[:80] + ("…" if len(desc_raw) > 80 else "")

    user_prompt = (
        f"Project: {project.get('work_id')} | State: {project.get('state')}\n"
        f"Description (truncated): {desc_clip}\n"
        f"Cost Z-Score: {project.get('cost_zscore', 0):.2f} | "
        f"NLP Similarity: {project.get('nlp_similarity_score', 0):.1f}% "
        f"to {project.get('similar_project', 'N/A')}\n"
        f"Risk Score: {project.get('risk_score', 0):.1f}\n"
        f"Language: {language}"
    )

    raw_text = _call_gemini(_SYSTEM_AUDIT_DOUBTS, user_prompt, max_output_tokens=150)

    if raw_text and raw_text.strip():
        return raw_text.strip()

    logger.debug("synthesize_audit_doubts: using template fallback.")
    return _template_doubts(project)
