import json
from pathlib import Path
import subprocess
import sys
import unittest

DEMO_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(DEMO_DIR))

from check_indexer_freshness import FreshnessError, check_indexer_freshness  # noqa: E402


class CheckIndexerFreshnessTests(unittest.TestCase):
    def test_accepts_a_recent_millisecond_tip(self):
        result = check_indexer_freshness(
            {"data": {"block": {"timestamp": 1_000_000}}},
            now_ms=1_030_000,
            max_age_ms=300_000,
        )

        self.assertTrue(result)

    def test_rejects_a_stale_tip(self):
        with self.assertRaisesRegex(FreshnessError, "stale"):
            check_indexer_freshness(
                {"data": {"block": {"timestamp": 1_000_000}}},
                now_ms=1_400_001,
                max_age_ms=300_000,
            )

    def test_rejects_graphql_errors_and_missing_tip_data(self):
        fixtures = [
            {"errors": [{"message": "synthetic failure"}]},
            {"data": {"block": None}},
            {"data": {"block": {}}},
            {"data": {"block": {"timestamp": "1000000"}}},
        ]

        for fixture in fixtures:
            with self.subTest(fixture=fixture):
                with self.assertRaisesRegex(FreshnessError, "malformed"):
                    check_indexer_freshness(
                        fixture,
                        now_ms=1_030_000,
                        max_age_ms=300_000,
                    )

    def test_rejects_a_tip_too_far_in_the_future(self):
        with self.assertRaisesRegex(FreshnessError, "future"):
            check_indexer_freshness(
                {"data": {"block": {"timestamp": 1_200_001}}},
                now_ms=1_000_000,
                max_age_ms=300_000,
                max_future_skew_ms=60_000,
            )

    def test_cli_prints_status_only_for_a_fresh_tip(self):
        process = subprocess.run(
            [
                sys.executable,
                str(DEMO_DIR / "check_indexer_freshness.py"),
                "--now-ms",
                "1030000",
                "--max-age-seconds",
                "300",
            ],
            input=json.dumps({"data": {"block": {"timestamp": 1_000_000}}}),
            text=True,
            capture_output=True,
            check=False,
        )

        self.assertEqual(process.returncode, 0)
        self.assertEqual(process.stdout.strip(), "INDEXER_FRESH")
        self.assertEqual(process.stderr, "")

    def test_cli_fails_closed_without_printing_runtime_values(self):
        timestamp = 1_000_000
        process = subprocess.run(
            [
                sys.executable,
                str(DEMO_DIR / "check_indexer_freshness.py"),
                "--now-ms",
                "1400001",
                "--max-age-seconds",
                "300",
            ],
            input=json.dumps({"data": {"block": {"timestamp": timestamp}}}),
            text=True,
            capture_output=True,
            check=False,
        )

        self.assertNotEqual(process.returncode, 0)
        self.assertEqual(process.stdout, "")
        self.assertIn("INDEXER_NOT_FRESH: stale", process.stderr)
        self.assertNotIn(str(timestamp), process.stderr)


if __name__ == "__main__":
    unittest.main()
