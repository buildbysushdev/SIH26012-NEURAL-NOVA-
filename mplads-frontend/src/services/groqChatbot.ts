/**
 * Groq AI Copilot Service for Super Admin & Officer Portals
 * 
 * Provides ultra-fast (<300ms) database analysis, risk diagnosis, and statutory audit suggestions.
 * STRICT READ-ONLY MODE: Analyzes data and advises officers; performs zero database mutations.
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  latencyMs?: number;
  modelUsed?: string;
}

export interface CopilotContext {
  role: 'officer' | 'super_admin';
  userName?: string;
  district?: string;
  state?: string;
  currentPage?: string;
  selectedWorkId?: string;
  summaryStats?: {
    totalProjects?: number;
    flaggedCount?: number;
    totalExpenditureCr?: number;
  };
}

export const PRIMARY_MODEL = "backend-advisory";
export const FALLBACK_MODEL = "openai/gpt-oss-20b";

export function buildSystemPrompt(context: CopilotContext): string {
  const isSuperAdmin = context.role === 'super_admin';
  const roleName = isSuperAdmin ? "MoSPI Super Admin / Central Vigilance Authority" : "District Nodal Officer / Field Auditor";
  const jurisdiction = context.district ? `${context.district}, ${context.state || 'India'}` : (context.state || "National Jurisdiction");

  return `You are the MoSPI MPLADS Intelligence Copilot (Team Neural Nova, SIH26102), an AI decision-support advisor built specifically for ${roleName}.

---
### 🔒 STRICT ARCHITECTURAL DIRECTIVE — READ-ONLY ADVISORY MODE:
1. You have ZERO authority or capability to write, update, modify, delete, or touch anything in the backend database.
2. Your sole function is DATA ANALYSIS, ANOMALY DIAGNOSIS, and STATUTORY SUGGESTIONS based on the MPLADS data and DISHA guidelines.
3. If an officer or admin asks you to "update", "approve", "change status", "delete", or "modify" a record or fund allocation, you MUST explicitly state:
   "⚠️ Read-Only Advisory Notice: As an AI Intelligence Copilot, I operate in strict read-only mode to preserve statutory integrity. I cannot modify database records or sanction statuses. Please follow the official DISHA workflow to record physical inspection findings or statutory determinations."

---
### 📊 GROUNDED MPLADS DATABASE & SYSTEM CONTEXT:
- **Data Scope**: Use only the live project totals supplied by the current MPLADS registry and portal context.
- **Risk Score Architecture**: Multi-signal formula combining:
  * Cost Risk Score: Statistical outlier detection (Z-Score > 2.5 against category/district medians).
  * NLP Duplicate Score: Semantic transformer cosine similarity (>91% duplicate threshold).
  * Sentinel-2 Satellite Verification: 3-state spectral detection (Activity Detected, High Vegetation / Unstarted, or Cloud/Unavailable).
  * Citizen Grievances: Cross-verified citizen photo submissions with SHA-256 tamper-proof seals.
  * Officer Feedback Loop: Bayesian correction based on ground inspection findings.
- **Statutory DISHA 6-Point Inspection Checklist**:
  1. Physical asset exists on ground
  2. Specifications match sanction order
  3. No duplicate funding from other schemes (MGNREGA, PMGSY, etc.)
  4. Citizen grievances verified
  5. MPLADS permanent plaque installed with MP name & sanction date
  6. Geotagged photographic evidence uploaded & cryptographically sealed

---
### 🎯 USER CONTEXT:
- **Role**: ${roleName}
- **Assigned District/Scope**: ${jurisdiction}
- **Current Portal View**: ${context.currentPage || "General Dashboard"}
${context.selectedWorkId ? `- **Currently Focused Project**: ${context.selectedWorkId}` : ""}

---
### 💡 RESPONSE GUIDELINES:
- Deliver crisp, highly professional, actionable audit insights.
- Use clear bullet points, bold numbers, and markdown tables when comparing cost metrics or risk breakdowns.
- Offer strategic recommendations: e.g., prioritizing joint physical verifications for works with delay >180 days and cost >₹50 Lakhs.
- Always remain polite, authoritative, and focused strictly on governance transparency.`;
}

export async function sendGroqCopilotMessage(
  history: { role: 'user' | 'assistant'; content: string }[],
  userMessage: string,
  context: CopilotContext
): Promise<{ reply: string; latencyMs: number; model: string }> {
  const startTime = performance.now();
  const backend = (import.meta as any).env?.VITE_BACKEND_URL || ((import.meta as any).env?.DEV ? "http://localhost:8000" : window.location.origin);
  const token = localStorage.getItem("mplads_token") || "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${backend}/api/audit-chatbot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: userMessage, history: history.slice(-6), context }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "Advisory service unavailable");
    return { reply: data.reply, latencyMs: Math.round(performance.now() - startTime), model: data.model || "backend-advisory" };
  } catch {
    return { reply: generateLocalAdvisoryFallback(userMessage, context), latencyMs: Math.round(performance.now() - startTime), model: "local-rules-engine (fallback)" };
  } finally {
    clearTimeout(timer);
  }
}

function generateLocalAdvisoryFallback(query: string, context: CopilotContext): string {
  const q = query.toLowerCase();

  if (q.includes("delay") || q.includes("timeline")) {
    return `### ⏱️ Statutory Analysis on Project Delays
Based on the current MPLADS registry available to this portal:
- **Critical Threshold**: Projects exceeding **180 days** past their scheduled completion date without an approved revised administrative sanction require a mandatory joint site inspection.
- **Top Delay Factors**: Delayed tendering, contractor liquidity constraints, and right-of-way disputes in civil road works.
- **Recommended Action**: Issue a formal Notice of Explanation under DISHA Rule 4.2 to the executing agency and verify physical milestone progress before releasing the next fund installment.`;
  }

  if (q.includes("cost") || q.includes("outlier") || q.includes("anomaly")) {
    return `### 💰 Cost Risk & Anomaly Assessment
- **Methodology**: Cost risk score is computed by calculating the **Z-score** of per-unit project costs against identical category works in the same district and state.
- **Threshold**: Works with cost risk score **>75%** (Z-score > 2.5) exhibit expenditure significantly above peer works.
- **Auditor Suggestion**: Review the detailed itemized Schedule of Rates (SOR) and check whether material costs (cement, bitumen, steel) were procured via open e-tendering.`;
  }

  if (q.includes("duplicate") || q.includes("nlp") || q.includes("similarity")) {
    return `### 🔍 Duplicate Work Risk Advisory
- **Detection Algorithm**: Transformer-based NLP model flagging semantic text similarity **>91%** across works within 5km radius or identical ward descriptions.
- **Common Risk**: Double-claiming of community halls, borewells, or road resurfacing already funded under State Schemes or Urban Local Body budgets.
- **Auditor Suggestion**: Verify the MPLADS mandatory engraved plaque on site to confirm exclusive central scheme asset attribution.`;
  }

  return `### 📋 MoSPI MPLADS Intelligence Advisory
**Jurisdiction**: ${context.district || "National"} | **Mode**: Strict Read-Only Advisory

I have analyzed your query regarding **"${query}"**.
- **Dataset Reference**: The current live MPLADS registry and the jurisdiction shown above.
- **Core Recommendation**: Ensure physical inspection is conducted as per the **6-point DISHA statutory checklist** before approving fund utilization certificates.
- *Notice: I operate in read-only advisory mode and cannot modify database values directly.*`;
}
