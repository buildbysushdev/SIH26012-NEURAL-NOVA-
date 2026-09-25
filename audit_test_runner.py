import requests
import time
import json

BASE = "http://localhost:8000"
results = []

def test_ep(name, method, url, **kwargs):
    start = time.perf_counter()
    try:
        if method == "GET":
            r = requests.get(url, timeout=10, **kwargs)
        elif method == "POST":
            r = requests.post(url, timeout=10, **kwargs)
        elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
        return {
            "endpoint": name,
            "status": r.status_code,
            "time_ms": elapsed_ms,
            "ok": r.status_code in [200, 201],
            "len": len(r.content),
            "err": None
        }
    except Exception as e:
        elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
        return {
            "endpoint": name,
            "status": 0,
            "time_ms": elapsed_ms,
            "ok": False,
            "len": 0,
            "err": str(e)
        }

# 1. Root & Health
results.append(test_ep("GET /", "GET", f"{BASE}/"))
results.append(test_ep("GET /health", "GET", f"{BASE}/health"))

# 2. Auth Login
login_res = test_ep("POST /auth/login", "POST", f"{BASE}/auth/login", json={"officer_id": "AUDITOR-VIGILANCE-01", "password": "officer@SIH2026"})
results.append(login_res)

token = ""
try:
    token = requests.post(f"{BASE}/auth/login", json={"officer_id": "AUDITOR-VIGILANCE-01", "password": "officer@SIH2026"}).json()["access_token"]
except Exception as e:
    print("Login token err:", e)

headers = {"Authorization": f"Bearer {token}"} if token else {}

# 3. Auth Me
results.append(test_ep("GET /auth/me", "GET", f"{BASE}/auth/me", headers=headers))

# 4. Flagged Projects (Auth)
results.append(test_ep("GET /flagged-projects", "GET", f"{BASE}/flagged-projects?limit=5", headers=headers))

# 5. Project Detail
results.append(test_ep("GET /project", "GET", f"{BASE}/project?work_id=WS/MP418/2024-2025/133409"))

# 6. Search Projects
results.append(test_ep("GET /search-projects", "GET", f"{BASE}/search-projects?q=road&limit=5"))

# 7. Satellite Image
results.append(test_ep("GET /project-satellite-image", "GET", f"{BASE}/project-satellite-image?work_id=WS/MP418/2024-2025/133409"))

# 8. Citizen Chatbot
results.append(test_ep("POST /api/citizen-chatbot", "POST", f"{BASE}/api/citizen-chatbot", json={"query": "What is MPLADS?"}))

# 9. Citizen Report POST
results.append(test_ep("POST /citizen-report", "POST", f"{BASE}/citizen-report", json={
    "work_id": "WS/MP418/2024-2025/133409",
    "category": "Poor quality",
    "description": "Crack formed on newly paved section",
    "captured_lat": 26.1471,
    "captured_lng": 87.4718
}))

# 10. List Citizen Reports
results.append(test_ep("GET /citizen-reports", "GET", f"{BASE}/citizen-reports"))

# 11. Citizen Report Verification
results.append(test_ep("GET /citizen-report-verification/{id}", "GET", f"{BASE}/citizen-report-verification/CR-0001"))

# 12. Feedback POST
results.append(test_ep("POST /feedback", "POST", f"{BASE}/feedback", json={
    "work_id": "WS/MP418/2024-2025/133409",
    "verdict": "confirmed_issue",
    "officer_notes": "Audit verification confirms road damage",
    "officer_id": "OFF-001"
}))

# 13. Feedback History GET
results.append(test_ep("GET /feedback", "GET", f"{BASE}/feedback"))

# 14. Audit Brief PDF
results.append(test_ep("GET /audit-brief", "GET", f"{BASE}/audit-brief?work_id=WS/MP418/2024-2025/133409"))

# 15. Project Analysis Report
results.append(test_ep("GET /project-analysis-report", "GET", f"{BASE}/project-analysis-report?work_id=WS/MP418/2024-2025/133409"))

# 16. Checklist POST
results.append(test_ep("POST /checklist", "POST", f"{BASE}/checklist", json={
    "work_id": "WS/MP418/2024-2025/133409",
    "officer_id": "OFF-001",
    "items": [{"item_id": "chk_board", "passed": True}]
}))

# 17. Checklist GET
results.append(test_ep("GET /checklist", "GET", f"{BASE}/checklist?work_id=WS/MP418/2024-2025/133409"))

# 18. Demo Showcase
results.append(test_ep("GET /demo-showcase", "GET", f"{BASE}/demo-showcase"))
results.append(test_ep("GET /demo-showcase/states", "GET", f"{BASE}/demo-showcase/states"))
results.append(test_ep("GET /demo-showcase/sample", "GET", f"{BASE}/demo-showcase/sample"))

print(f"{'Endpoint':<40} | {'Status':<6} | {'Latency':<9} | {'Result':<6} | {'Bytes':<7}")
print("-" * 75)
for r in results:
    res_str = "PASS" if r['ok'] else "FAIL"
    print(f"{r['endpoint']:<40} | {r['status']:<6} | {r['time_ms']:>6} ms | {res_str:<6} | {r['len']:<7}")
