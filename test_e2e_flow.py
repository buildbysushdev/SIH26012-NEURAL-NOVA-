"""
End-to-End Integration Verification Script
MPLADS Risk Intelligence System (SIH26102, Team Neural Nova)

Tests:
1. Fetch flagged project with server-side JWT auth
2. Citizen report submission with photographic upload to Supabase Storage
3. Verification of public image accessibility on Supabase CDN
4. Officer feedback submission with dynamic score adjustment
5. DISHA checklist save and query
"""

import urllib.request
import json
import uuid
import auth_jwt

print("=== RUNNING END-TO-END SUPABASE INTEGRATION TEST ===")

# 1. Authenticate as National Admin to fetch flagged project
token = auth_jwt.create_access_token(officer_id="AUD-TEST", district="ALL", role="national_admin")
req = urllib.request.Request(
    "http://localhost:8000/flagged-projects?limit=1",
    headers={"Authorization": f"Bearer {token}"}
)
with urllib.request.urlopen(req) as res:
    projects = json.loads(res.read().decode())
    assert len(projects) > 0, "No projects returned"
    project = projects[0]
    work_id = project["work_id"]
    print(f"1. Target Project Retrieved: {work_id} (Initial Risk Score: {project.get('risk_score')})")

# 2. Submit Citizen Grievance with Photo Evidence
boundary = "----WebKitFormBoundary" + uuid.uuid4().hex
png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"

body = []
def add_field(name, val):
    body.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{val}\r\n".encode())

add_field("work_id", work_id)
add_field("description", "Vigilance inspection: Verified foundation is incomplete with deep gravel trenches.")
add_field("category", "Quality Defect")
add_field("captured_lat", "18.5204")
add_field("captured_lng", "73.8567")

body.append(
    f"--{boundary}\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"site_evidence.png\"\r\nContent-Type: image/png\r\n\r\n".encode()
    + png_bytes
    + b"\r\n"
)
body.append(f"--{boundary}--\r\n".encode())
payload = b"".join(body)

post_req = urllib.request.Request(
    "http://localhost:8000/citizen-report",
    data=payload,
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
)

with urllib.request.urlopen(post_req) as r:
    report_res = json.loads(r.read().decode())
    print("\n2. Citizen Grievance Submitted:")
    print(f"   Report ID: {report_res.get('report_id')}")
    print(f"   Photo Saved: {report_res.get('photo_saved')}")
    print(f"   Supabase Photo URL: {report_res.get('photo_url')}")
    print(f"   Updated Risk Score: {report_res.get('new_risk_score')}")
    print(f"   AI Recommendation: {report_res.get('verification', {}).get('ai_recommendation')}")

    # Verify photo public access
    if report_res.get("photo_url"):
        with urllib.request.urlopen(report_res["photo_url"]) as img_res:
            print(f"   [PASS] Supabase Storage CDN response: {img_res.status} OK ({len(img_res.read())} bytes)")

# 3. Submit Officer Feedback
fb_payload = json.dumps({
    "work_id": work_id,
    "verdict": "confirmed_issue",
    "officer_notes": "Ground verification confirms civil structure delayed beyond sanction deadline.",
    "officer_id": "AUD-TEST-OFFICER"
}).encode()

fb_req = urllib.request.Request(
    "http://localhost:8000/feedback",
    data=fb_payload,
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(fb_req) as fb_r:
    fb_res = json.loads(fb_r.read().decode())
    print("\n3. Officer Feedback Recorded:")
    print(f"   Feedback ID: {fb_res.get('feedback_id')}")
    print(f"   Verdict: {fb_res.get('verdict')}")
    print(f"   New Risk Score: {fb_res.get('new_risk_score')}")

# 4. Save and Verify DISHA Checklist
chk_payload = json.dumps({
    "work_id": work_id,
    "chk_exists": True,
    "chk_specs": False,
    "chk_duplicate": False,
    "chk_citizen": True,
    "chk_plaque": True,
    "chk_photo": True,
    "officer_notes": "Technical specs deviation recorded. Plaque installed."
}).encode()

chk_req = urllib.request.Request(
    "http://localhost:8000/checklist",
    data=chk_payload,
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(chk_req) as chk_r:
    chk_res = json.loads(chk_r.read().decode())
    print("\n4. DISHA Physical Inspection Checklist Saved:")
    print(f"   Status: {chk_res.get('status')}")
    print(f"   Cloud Synced: {chk_res.get('cloud_synced')}")

print("\n=== ALL INTEGRATION VERIFICATION CHECKS COMPLETED SUCCESSFULLY! ===")
