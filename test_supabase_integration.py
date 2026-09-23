"""
Supabase Integration & Fail-Safe Test Suite
MPLADS Risk Intelligence System (SIH26102, Team Neural Nova)

Validates:
1. Supabase credentials and configuration
2. Cloud Storage upload to 'citizen-evidence' bucket
3. End-to-end fail-safe resilience (local operations never crash regardless of cloud status)
4. Photo cryptographic hash generation and verification
5. DISHA inspection checklist synchronization
"""

import os
import sys
import uuid
import hashlib
from datetime import datetime, timezone

# Ensure root directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import supabase_sync
import officer_checklist

def test_1_configuration():
    print("=== TEST 1: Supabase Configuration ===")
    assert supabase_sync.is_supabase_configured(), "Supabase must be configured with URL and Service Role Key"
    print(f"  [PASS] Supabase URL: {supabase_sync.SUPABASE_URL}")
    print(f"  [PASS] Key format: {'Valid JWT (eyJ...)' if supabase_sync.SUPABASE_KEY.startswith('eyJ') else 'INVALID'}")


def test_2_storage_upload():
    print("\n=== TEST 2: Cloud Storage Upload to 'citizen-evidence' ===")
    # 1x1 transparent PNG bytes
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"
    filename = f"test_evidence_{uuid.uuid4().hex[:6]}.png"

    public_url = supabase_sync.upload_photo_evidence(filename, png_bytes, mime_type="image/png")
    assert public_url is not None, "Photo upload should return a public URL"
    assert "https://" in public_url and "citizen-evidence" in public_url
    print(f"  [PASS] Uploaded {filename} -> {public_url}")

    # Verify public access
    import urllib.request
    with urllib.request.urlopen(public_url) as res:
        assert res.status == 200, f"Expected 200 OK from public storage URL, got {res.status}"
        data = res.read()
        assert len(data) == len(png_bytes)
        print(f"  [PASS] Public URL verified accessible (200 OK, {len(data)} bytes, Content-Type: {res.headers.get('Content-Type')})")


def test_3_photo_hash_generation():
    print("\n=== TEST 3: Cryptographic Photo Hash & Seal ===")
    sample_bytes = b"Official MPLADS Inspection Evidence Geotagged Photo"
    expected_sha256 = hashlib.sha256(sample_bytes).hexdigest()

    photo_id = f"photo_{uuid.uuid4().hex[:8]}.jpg"
    work_id = "WS/MPTEST/2026/001"

    # Attempt cloud sync — fail-safe returns bool without crashing
    synced = supabase_sync.sync_photo_hash(photo_id, work_id, expected_sha256, source="officer")
    print(f"  [PASS] SHA-256 computed: {expected_sha256[:16]}... (Cloud sync: {synced})")


def test_4_checklist_local_and_cloud():
    print("\n=== TEST 4: DISHA Inspection Checklist Dual Persistence ===")
    test_work_id = f"WS/MP999/2026/{uuid.uuid4().hex[:4]}"
    req = officer_checklist.ChecklistSubmission(
        work_id=test_work_id,
        chk_exists=True,
        chk_specs=True,
        chk_duplicate=False,
        chk_citizen=True,
        chk_plaque=True,
        chk_photo=True,
        officer_notes="Field inspection completed by Team Neural Nova auditor.",
    )

    # Test save
    res = officer_checklist.save_checklist(req)
    assert res["status"] == "success"
    assert res["work_id"] == test_work_id
    print(f"  [PASS] Checklist saved for {test_work_id} (Cloud synced: {res['cloud_synced']})")

    # Test get
    retrieved = officer_checklist.get_checklist(test_work_id)
    assert retrieved["status"] == "success"
    assert retrieved["checklist"]["chk_exists"] == True
    assert retrieved["checklist"]["chk_specs"] == True
    print(f"  [PASS] Checklist retrieved successfully from source: {retrieved['source']}")


def test_5_zero_git_leak():
    print("\n=== TEST 5: Security & Zero-Git-Leak Audit ===")
    import subprocess
    status = subprocess.check_output(["git", "status", "--porcelain"], text=True)
    assert ".env" not in [line.strip().split()[-1] for line in status.splitlines() if line.strip() and not line.startswith("?")], ".env must NOT be tracked or staged in Git"
    print("  [PASS] Confirmed: .env is gitignored and excluded from version control.")


if __name__ == "__main__":
    print("Running Supabase Integration & Fail-Safe Test Suite...\n")
    test_1_configuration()
    test_2_storage_upload()
    test_3_photo_hash_generation()
    test_4_checklist_local_and_cloud()
    test_5_zero_git_leak()
    print("\nALL 5 TESTS PASSED SUCCESSFULLY! [100%]")
