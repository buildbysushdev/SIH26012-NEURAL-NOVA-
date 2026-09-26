"""
chatbot_groq.py — High-Speed Groq AI Chatbot Service for MPLADS Citizens & Officers
Team Neural Nova — SIH26102

Architecture:
- Chatbot inference is routed through Groq LPU API (<300ms latency) using high-parameter models:
  Primary:  openai/gpt-oss-120b
  Fallback: qwen/qwen3.8-27b
- Gemini is kept strictly as the audit summarization and risk explanation layer in Super Admin portal.
- Provides official MoSPI citizen assistance regarding:
  1. How to report grievances and defects
  2. How geotagged photo verification and cryptographic hashes work
  3. How satellite physical verification (Copernicus Sentinel-2 & SegFormer AI) works
  4. How MPLADS funds (Rs 5 Crore/year per MP) and project lifecycle works
  5. Ensuring reporter anonymity & whistleblower protection
"""

import os
import json
import logging
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional

logger = logging.getLogger("chatbot_groq")

# Load environment variables if not loaded
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
if not GROQ_API_KEY:
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("GROQ_API_KEY="):
                    GROQ_API_KEY = line.split("=", 1)[1].strip().strip('"').strip("'")
                elif line.startswith("GROQ_MODEL=") and not os.getenv("GROQ_MODEL"):
                    os.environ["GROQ_MODEL"] = line.split("=", 1)[1].strip().strip('"').strip("'")

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b"]

CITIZEN_SYSTEM_PROMPT = """You are MPLADS Sahayak, an official AI Citizen Decision-Support Assistant for the Ministry of Statistics and Programme Implementation (MoSPI), Government of India.

Your responsibilities:
1. Guide citizens on how to search for local development projects and report anomalies or defects.
2. Explain physical evidence verification:
   - Geotagged Photo Verification: Photos uploaded by citizens are checked for GPS coordinates, EXIF timestamps, and cryptographic SHA-256 hashes to prevent duplicate/stale photo fraud.
   - Satellite Physical Verification: Projects with locality coordinates are cross-checked against Copernicus Sentinel-2 multispectral passes and analyzed by the SegFormer AI land-cover neural network to detect whether physical structures exist on the ground.
3. Whistleblower Protection: Emphasize that citizen reports are 100% anonymous and never expose the citizen's personal identity to local contractors.
4. Scheme Guidelines: Explain that MPLADS provides ₹5 Crore annually per Member of Parliament for creating durable community assets (roads, drinking water, community centers, schools, healthcare).
5. Tone: Polite, transparent, informative, and authoritative, matching official Government of India portal standards.
6. Formatting: Use concise paragraphs, bullet points, and bold keywords. Keep answers under 180 words."""

OFFICER_SYSTEM_PROMPT = """You are the MoSPI MPLADS Vigilance & Audit AI Copilot, an official decision-support assistant for District Nodal Officers, State Authorities, and National Auditors.

Your responsibilities:
1. Advise on DISHA 6-point statutory on-site inspection protocols (Physical Existence, Specification Adherence, Duplicate Prevention, Citizen Feedback, Asset Inscription Plaque, Geotagged Evidence).
2. Interpret unsupervised risk scores: Cost anomalies (Isolation Forest), NLP duplicate description clusters (Sentence-BERT), and Satellite absence alerts (SegFormer).
3. Provide statutory fund utilization benchmarks under MoSPI Revised Guidelines (Sanctioned vs Released vs Actual Expenditure, Unspent Balances, Overrun flags).
4. Tone: Analytical, authoritative, audit-focused. Always emphasize that all scores are unsupervised prioritization signals for human auditors, not automated legal verdicts."""


def _call_groq_api(messages: List[Dict[str, str]], max_tokens: int = 400) -> Optional[str]:
    """Helper to query Groq chat completion API with model rotation."""
    api_key = GROQ_API_KEY or os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        logger.warning("GROQ_API_KEY not configured. Falling back to local advisory.")
        return None

    configured_model = os.getenv("GROQ_MODEL", "").strip()
    candidate_models = [configured_model] if configured_model else []
    for m in DEFAULT_MODELS:
        if m not in candidate_models:
            candidate_models.append(m)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "MPLADS-NeuralNova-SIH26102/1.0"
    }

    for model in candidate_models:
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.3
        }

        try:
            req = urllib.request.Request(
                GROQ_ENDPOINT,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5.0) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    choices = data.get("choices") or []
                    if choices and choices[0].get("message"):
                        content = choices[0]["message"].get("content", "").strip()
                        if content:
                            return content
        except urllib.error.HTTPError as he:
            logger.warning(f"Groq API model {model} returned HTTP {he.code}: {he.reason}")
        except Exception as ex:
            logger.warning(f"Groq API connection error with model {model}: {ex}")

    return None


def answer_citizen_query_groq(query: str, history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    """
    Answers citizen verification and MPLADS questions using Groq AI.
    Provides sub-second inference with verified MoSPI guidance.
    """
    q_clean = (query or "").strip()
    if not q_clean:
        return {
            "status": "error",
            "message": "Please enter a question or doubt about your local MPLADS project.",
            "provider": "groq"
        }

    # Build conversation context
    messages = [{"role": "system", "content": CITIZEN_SYSTEM_PROMPT}]

    if history and isinstance(history, list):
        for h in history[-4:]:
            role = "assistant" if h.get("role") in ["assistant", "bot"] else "user"
            content = str(h.get("content") or "").strip()
            if content:
                messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": q_clean})

    reply = _call_groq_api(messages, max_tokens=350)
    if reply:
        return {
            "status": "success",
            "message": reply,
            "provider": "groq",
            "helpline": "1800-11-2026 | mplads@nic.in"
        }

    # Deterministic fallback if Groq API is temporarily unreachable
    return {
        "status": "success",
        "message": _get_citizen_fallback_response(q_clean),
        "provider": "local_fallback",
        "helpline": "1800-11-2026 | mplads@nic.in"
    }


def answer_officer_query_groq(query: str, history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    """
    Provides fast audit intelligence guidance to District Officers and National Auditors using Groq AI.
    """
    q_clean = (query or "").strip()
    if not q_clean:
        return {
            "reply": "Please specify your audit or risk intelligence query.",
            "model": "groq/fallback"
        }

    messages = [{"role": "system", "content": OFFICER_SYSTEM_PROMPT}]
    if history and isinstance(history, list):
        for h in history[-4:]:
            role = "assistant" if h.get("role") in ["assistant", "bot"] else "user"
            content = str(h.get("content") or "").strip()
            if content:
                messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": q_clean})

    reply = _call_groq_api(messages, max_tokens=400)
    if reply:
        return {
            "reply": reply,
            "model": "groq/openai/gpt-oss-120b"
        }

    return {
        "reply": "The Groq AI copilot advisory service is operating in offline mode. Please review the project risk signals, cost anomaly z-scores, and the 12-point DISHA checklist on the dashboard.",
        "model": "local-rules-engine"
    }


def _get_citizen_fallback_response(q: str) -> str:
    """Standardized deterministic responses matching official MoSPI rules."""
    ql = q.lower()
    if "photo" in ql or "camera" in ql or "image" in ql:
        return (
            "**📸 Geotagged Photo Verification Protocol:**\n"
            "• Every report photo is verified for GPS latitude/longitude and EXIF timestamps.\n"
            "• A cryptographic SHA-256 digital hash is generated to detect duplicate or downloaded images.\n"
            "• Photos taken directly on-site at the project location receive higher verification confidence."
        )
    if "satellite" in ql or "proof" in ql or "segformer" in ql:
        return (
            "**🛰️ Satellite Physical Verification:**\n"
            "• Projects with resolved coordinates are analyzed against Copernicus Sentinel-2 multispectral passes.\n"
            "• Our fine-tuned SegFormer deep-learning detector inspects the optical pass for physical built structures.\n"
            "• If a structure is absent despite 100% fund disbursement, the project is prioritized for physical audit."
        )
    if "anonymous" in ql or "safety" in ql or "identity" in ql:
        return (
            "**🔒 Whistleblower & Citizen Protection:**\n"
            "• Your reports are completely anonymous. Personal identities are never shared with local agencies.\n"
            "• All submissions go directly to district vigilance and supervisory auditors."
        )
    return (
        "**🏛️ MPLADS Citizen Grievance Assistance:**\n"
        "• Under the MPLAD Scheme, MPs recommend durable community infrastructure up to ₹5 Crore annually.\n"
        "• If you observe delayed execution, poor quality, or missing assets, submit a report with on-site photos.\n"
        "• For official assistance, contact the MoSPI Citizen Helpline at 1800-11-2026 or mplads@nic.in."
    )
