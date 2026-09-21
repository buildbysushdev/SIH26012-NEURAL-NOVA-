"""
Stress testing script for MPLADS Risk Intelligence System API.
Executes both happy-path and deliberate edge-case / broken requests against:
- GET /flagged-projects
- GET /project
- POST /citizen-report
- GET /audit-brief/{work_id} and GET /audit-brief
- POST /feedback
- GET /feedback
"""
import io
import json
import urllib.request
import urllib.error
import urllib.parse
from typing import Dict, Any, Tuple

BASE_URL = "http://127.0.0.1:8000"


def make_request(
    path: str,
    method: str = "GET",
    params: Dict[str, Any] = None,
    json_data: Dict[str, Any] = None,
    form_data: Dict[str, Any] = None,
    files: Dict[str, Tuple[str, bytes, str]] = None,
) -> Tuple[int, Any]:
    url = f"{BASE_URL}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)

    headers = {}
    body = None

    if json_data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(json_data).encode("utf-8")
    elif form_data is not None or files is not None:
        # Multipart form data
        boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
        parts = []
        if form_data:
            for k, v in form_data.items():
                parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode("utf-8"))
        if files:
            for k, (fname, fbytes, ftype) in files.items():
                parts.append(
                    f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"; filename=\"{fname}\"\r\nContent-Type: {ftype}\r\n\r\n".encode("utf-8")
                    + fbytes + b"\r\n"
                )
        parts.append(f"--{boundary}--\r\n".encode("utf-8"))
        body = b"".join(parts)

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content_type = resp.headers.get("Content-Type", "")
            raw = resp.read()
            if "application/json" in content_type:
                return resp.status, json.loads(raw.decode("utf-8"))
            elif "application/pdf" in content_type:
                return resp.status, f"<PDF {len(raw)} bytes, header: {raw[:8]}>"
            else:
                return resp.status, raw.decode("utf-8", errors="replace")[:200]
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            parsed = json.loads(raw.decode("utf-8"))
        except Exception:
            parsed = raw.decode("utf-8", errors="replace")[:200]
        return e.code, parsed
    except Exception as e:
        return 0, str(e)


def run_all_stress_tests():
    print("=== STARTING MPLADS API STRESS TESTING ===")
    results = []

    tests = [
        # 1. /flagged-projects
        ("GET /flagged-projects (valid limit=5)", "GET", "/flagged-projects", {"limit": 5}, None, None, None),
        ("GET /flagged-projects (limit=0)", "GET", "/flagged-projects", {"limit": 0}, None, None, None),
        ("GET /flagged-projects (negative limit=-5)", "GET", "/flagged-projects", {"limit": -5}, None, None, None),
        ("GET /flagged-projects (huge limit=999999)", "GET", "/flagged-projects", {"limit": 999999}, None, None, None),
        ("GET /flagged-projects (non-integer limit=abc)", "GET", "/flagged-projects", {"limit": "abc"}, None, None, None),

        # 2. /project
        ("GET /project (valid slashed work_id)", "GET", "/project", {"work_id": "WS/MP317/2024-2025/145098"}, None, None, None),
        ("GET /project (missing work_id)", "GET", "/project", {}, None, None, None),
        ("GET /project (empty work_id='')", "GET", "/project", {"work_id": ""}, None, None, None),
        ("GET /project (non-existent work_id)", "GET", "/project", {"work_id": "NON_EXISTENT_WORK_ID_9999"}, None, None, None),
        ("GET /project (injection/path-traversal chars)", "GET", "/project", {"work_id": "../../etc/passwd<script>"}, None, None, None),

        # 3. /citizen-report
        (
            "POST /citizen-report (valid with test photo)",
            "POST", "/citizen-report", None, None,
            {"work_id": "WS/MP317/2024-2025/145198", "description": "Stress test report on site inspection"},
            {"photo": ("test.jpg", b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00", "image/jpeg")}
        ),
        (
            "POST /citizen-report (missing work_id)",
            "POST", "/citizen-report", None, None,
            {"description": "Missing work ID"},
            None
        ),
        (
            "POST /citizen-report (empty work_id='')",
            "POST", "/citizen-report", None, None,
            {"work_id": "", "description": "Empty work ID test"},
            None
        ),
        (
            "POST /citizen-report (non-existent work_id)",
            "POST", "/citizen-report", None, None,
            {"work_id": "NON_EXISTENT_WORK_ID_9999", "description": "Reporting on fake project"},
            None
        ),
        (
            "POST /citizen-report (empty description='')",
            "POST", "/citizen-report", None, None,
            {"work_id": "WS/MP317/2024-2025/145198", "description": "   "},
            None
        ),
        (
            "POST /citizen-report (0-byte empty photo file)",
            "POST", "/citizen-report", None, None,
            {"work_id": "WS/MP317/2024-2025/145198", "description": "Report with 0-byte photo"},
            {"photo": ("empty.jpg", b"", "image/jpeg")}
        ),

        # 4. /audit-brief
        ("GET /audit-brief/{work_id} (valid path)", "GET", "/audit-brief/WS/MP317/2024-2025/145198", None, None, None, None),
        ("GET /audit-brief?work_id= (valid query)", "GET", "/audit-brief", {"work_id": "WS/MP317/2024-2025/145198"}, None, None, None),
        ("GET /audit-brief (non-existent project)", "GET", "/audit-brief/NON_EXISTENT_WORK_ID_9999", None, None, None, None),
        ("GET /audit-brief (missing work_id on query)", "GET", "/audit-brief", {}, None, None, None),

        # 5. /feedback
        (
            "POST /feedback (valid false_positive)",
            "POST", "/feedback", None,
            {"work_id": "WS/MP317/2024-2025/145198", "verdict": "false_positive", "officer_notes": "Stress test FP"},
            None, None
        ),
        (
            "POST /feedback (valid confirmed_issue)",
            "POST", "/feedback", None,
            {"work_id": "WS/MP317/2024-2025/145198", "verdict": "confirmed_issue", "officer_notes": "Stress test CI"},
            None, None
        ),
        (
            "POST /feedback (non-existent work_id)",
            "POST", "/feedback", None,
            {"work_id": "NON_EXISTENT_WORK_ID_9999", "verdict": "false_positive"},
            None, None
        ),
        (
            "POST /feedback (invalid verdict='fraud')",
            "POST", "/feedback", None,
            {"work_id": "WS/MP317/2024-2025/145198", "verdict": "fraud"},
            None, None
        ),
        (
            "POST /feedback (missing work_id)",
            "POST", "/feedback", None,
            {"verdict": "false_positive"},
            None, None
        ),
        (
            "POST /feedback (empty body {})",
            "POST", "/feedback", None,
            {},
            None, None
        ),
    ]

    for name, method, path, params, json_data, form_data, files in tests:
        status_code, body = make_request(path, method, params, json_data, form_data, files)
        is_500 = (status_code == 500)
        is_err = (status_code == 0)
        flag = "[CRASH 500]" if is_500 else ("[NET ERR]" if is_err else f"[{status_code}]")
        print(f"{flag:12} | {name}")
        results.append({
            "test": name,
            "method": method,
            "path": path,
            "status": status_code,
            "body": body,
            "is_crash": is_500 or is_err
        })

    print(f"\nCompleted {len(results)} tests.")
    crashes = [r for r in results if r["is_crash"]]
    print(f"Total Crashes (500s / Unhandled exceptions): {len(crashes)}")
    for c in crashes:
        print(f"  - {c['test']}: {c['status']} -> {c['body']}")


if __name__ == "__main__":
    run_all_stress_tests()
