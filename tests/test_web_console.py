"""Verify that the operator stop path preserves a partial campaign."""

import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from pentest_pipeline.web_server import CampaignConsole


class _StoppedResult:
    def to_dict(self):
        return {
            "run_id": "local-stop-test",
            "target": "https://4.migbot.com.br/",
            "campaign_name": "test",
            "started_at": "2026-11-12T00:00:00+00:00",
            "ended_at": "2026-11-12T00:00:01+00:00",
            "status": "stopped",
            "stop_reason": "operator_requested",
            "actions": [{"timestamp": "2026-11-12T00:00:00+00:00", "type": "request", "phase": "discovery", "message": "Synthetic request"}],
            "findings": [],
            "recommendations": [],
            "summary": {"requests": 1, "findings": 0},
        }


class WebConsoleStopTests(unittest.TestCase):
    def test_stop_preserves_result_and_audit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config_file = root / "scope.json"
            config_file.write_text(json.dumps({
                "target_url": "https://4.migbot.com.br/#/",
                "allowed_hosts": ["4.migbot.com.br"],
            }))

            def fake_scan(config, *, stop_event, on_event, ai_advisor):
                on_event({"timestamp": "2026-11-12T00:00:00+00:00", "type": "request", "phase": "discovery", "message": "Synthetic request"})
                self.assertTrue(stop_event.wait(2), "the stop signal never reached the scan")
                return _StoppedResult()

            with patch("pentest_pipeline.web_server.REPORTS", root / "reports"), patch(
                "pentest_pipeline.web_server.run_scan", side_effect=fake_scan
            ):
                console = CampaignConsole(config_file)
                self.assertTrue(console.start()[0])
                self.assertFalse(console.start()[0])
                self.assertTrue(console.stop()[0])
                deadline = time.monotonic() + 3
                while console.snapshot()["running"] and time.monotonic() < deadline:
                    time.sleep(0.01)
                snapshot = console.snapshot()
                self.assertFalse(snapshot["running"])
                self.assertEqual(snapshot["result"]["status"], "stopped")
                self.assertEqual(snapshot["result"]["stop_reason"], "operator_requested")
                self.assertTrue((root / "reports" / "local-stop-test" / "result.json").is_file())
                self.assertTrue(any(item["phase"] == "stop" for item in snapshot["events"]))


if __name__ == "__main__":
    unittest.main()
