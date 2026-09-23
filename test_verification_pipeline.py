"""
Unit and Integration Test Suite for AI Evidence Cross-Verification System
SIH26102 — Team Neural Nova

Tests the 5 core scenarios:
1. GENUINE REPORT (GPS match, detailed text, fresh photo, unique) -> APPROVE (>=80)
2. LOCATION MISMATCH (GPS 3km away) -> REVIEW / MISMATCH
3. SPAM TEXT ("bad project", too short) -> SPAM
4. DUPLICATE REPORT (same description within 7 days) -> DUPLICATE
5. REUSED PHOTO (same photo hash) -> REUSED
"""

import sys
import os
import unittest
from datetime import datetime, timezone, timedelta

# Ensure workspace root is in python path
WORKSPACE_ROOT = os.path.dirname(os.path.abspath(__file__))
if WORKSPACE_ROOT not in sys.path:
    sys.path.insert(0, WORKSPACE_ROOT)

import verification_pipeline


class TestVerificationPipeline(unittest.TestCase):
    def setUp(self):
        # Sample official project in Pune
        self.project_pune = {
            "work_id": "WS/TEST/2024-2025/999001",
            "work_category": "Roads / Bridges",
            "work_description": "Construction of concrete arterial road and side drain in Sector 4",
            "state": "Maharashtra",
            "constituency": "Pune",
            "latitude": 18.5204,
            "longitude": 73.8567,
            "satellite_status": "visible",
        }

    def test_case_1_genuine_report(self):
        """
        Test Case 1: GENUINE REPORT
        - GPS within 100m of project
        - Detailed description (200+ chars)
        - Unique first report
        - Photo taken today (fresh)
        Expected: confidence_score >= 80, recommendation APPROVE
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        report = {
            "work_id": self.project_pune["work_id"],
            "description": (
                "Comprehensive on-site citizen inspection: The concrete arterial road surfacing is completely cracked "
                "with exposed iron mesh near the main junction. Rainwater drainage channels are clogged with debris, "
                "leading to severe waterlogging across the entire 400-meter stretch."
            ),
            "captured_lat": 18.5208,   # ~55 meters away
            "captured_lng": 73.8570,
            "captured_timestamp": now_iso,
            "photo_hash": "gen_photo_hash_" + now_iso,
            "photo_filename": "genuine_road_inspection.jpg",
        }

        res = verification_pipeline.verify_citizen_report(
            report_data=report,
            project_data=self.project_pune,
            photo_bytes=b"fake_image_bytes_genuine_test",
        )

        print("\n--- TEST 1: GENUINE REPORT ---")
        print(f"Confidence Score: {res['confidence_score']}/100")
        print(f"Recommendation: {res['ai_recommendation']}")
        print(f"Location Check: {res['checks']['location_check']}")
        print(f"Text Check: {res['checks']['text_check']}")
        print(f"Reasoning: {res['ai_reasoning']}")

        self.assertGreaterEqual(res["confidence_score"], 80)
        self.assertEqual(res["ai_recommendation"], "APPROVE")
        self.assertEqual(res["checks"]["location_check"], "MATCH")
        self.assertEqual(res["checks"]["text_check"], "GENUINE")

    def test_case_2_location_mismatch(self):
        """
        Test Case 2: LOCATION MISMATCH
        - GPS is 3.5 km away from project
        - Everything else genuine
        Expected: confidence_score ~40-55, recommendation REVIEW, location_check = MISMATCH
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        # 18.5520, 73.8567 is approx 3.5 km north of 18.5204
        report = {
            "work_id": self.project_pune["work_id"],
            "description": (
                "Inspection of the road site shows improper construction quality, asphalt degradation, "
                "and no supervisor present during working hours despite official signboards."
            ),
            "captured_lat": 18.5520,  # ~3.5 km away
            "captured_lng": 73.8567,
            "captured_timestamp": now_iso,
            "photo_hash": "mismatch_loc_hash_" + now_iso,
            "photo_filename": "mismatch_loc.jpg",
        }

        res = verification_pipeline.verify_citizen_report(
            report_data=report,
            project_data=self.project_pune,
            photo_bytes=b"fake_image_bytes_mismatch_test",
        )

        print("\n--- TEST 2: LOCATION MISMATCH ---")
        print(f"Confidence Score: {res['confidence_score']}/100")
        print(f"Recommendation: {res['ai_recommendation']}")
        print(f"Location Check: {res['checks']['location_check']}")
        print(f"Issues: {res['issues']}")

        self.assertEqual(res["checks"]["location_check"], "MISMATCH")
        self.assertLessEqual(res["confidence_score"], 65)
        self.assertIn("location", " ".join(res["issues"]).lower())

    def test_case_3_spam_text(self):
        """
        Test Case 3: SPAM TEXT
        - Description is "bad project" (< 20 chars)
        - GPS matches
        Expected: text_check = SPAM, score penalized
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        report = {
            "work_id": self.project_pune["work_id"],
            "description": "bad project",  # only 11 characters
            "captured_lat": 18.5205,
            "captured_lng": 73.8567,
            "captured_timestamp": now_iso,
            "photo_hash": "spam_text_hash_" + now_iso,
            "photo_filename": "photo_spam.jpg",
        }

        res = verification_pipeline.verify_citizen_report(
            report_data=report,
            project_data=self.project_pune,
            photo_bytes=b"fake_image_bytes_spam_test",
        )

        print("\n--- TEST 3: SPAM TEXT ---")
        print(f"Confidence Score: {res['confidence_score']}/100")
        print(f"Recommendation: {res['ai_recommendation']}")
        print(f"Text Check: {res['checks']['text_check']}")
        print(f"Issues: {res['issues']}")

        self.assertEqual(res["checks"]["text_check"], "SPAM")
        self.assertEqual(res["scores"]["text_score"], 0)

    def test_case_4_duplicate_report(self):
        """
        Test Case 4: DUPLICATE REPORT
        - Same description as prior report on same work_id
        Expected: duplicate_check = DUPLICATE
        """
        text = "Deep potholes on the main highway road junction causing traffic congestion and accidents daily."
        # Call duplicate checker directly with previous report list containing exact description
        check, score, reason = verification_pipeline.check_duplicate_reports(
            work_id="WS/TEST/DUPLICATE",
            description=text,
            recent_work_reports=[{"description": text, "work_id": "WS/TEST/DUPLICATE"}],
        )

        print("\n--- TEST 4: DUPLICATE REPORT ---")
        print(f"Duplicate Check: {check}")
        print(f"Score: {score}")
        print(f"Reason: {reason}")

        self.assertEqual(check, "DUPLICATE")
        self.assertEqual(score, 0)

    def test_case_5_reused_photo(self):
        """
        Test Case 5: REUSED PHOTO
        - Same photo_hash found in prior photo hashes
        Expected: metadata_check = REUSED, score = 0
        """
        reused_hash = "abcdef1234567890deadbeefcafebabe11223344556677889900aabbccddeeff"
        check, score, reason = verification_pipeline.check_photo_metadata(
            has_photo=True,
            photo_hash=reused_hash,
            captured_timestamp=datetime.now(timezone.utc).isoformat(),
            prior_photo_hashes=[reused_hash],
        )

        print("\n--- TEST 5: REUSED PHOTO ---")
        print(f"Metadata Check: {check}")
        print(f"Score: {score}")
        print(f"Reason: {reason}")

        self.assertEqual(check, "REUSED")
        self.assertEqual(score, 0)


if __name__ == "__main__":
    unittest.main()
