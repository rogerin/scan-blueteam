"""Verify that the operator stop path preserves a partial campaign."""

import json
import http.client
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from pentest_pipeline.web_server import CampaignConsole, ConsoleHTTPServer


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

            def fake_scan(config, *, stop_event, on_event, ai_advisor, ai_planner):
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


class WebConsoleInputTests(unittest.TestCase):
    def test_post_requires_authorization_and_ai_key_then_uses_submitted_url(self):
        secret = "sk-test-only-never-log"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config_file = root / "scope.json"
            config_file.write_text(json.dumps({
                "target_url": "https://4.migbot.com.br/#/",
                "allowed_hosts": ["4.migbot.com.br"],
            }), encoding="utf-8")
            seen = []

            class _CompletedResult:
                def to_dict(self):
                    return {
                        "run_id": "dynamic-url-test", "target": seen[-1],
                        "campaign_name": "test", "status": "completed",
                        "started_at": "2026-11-12T00:00:00+00:00",
                        "ended_at": "2026-11-12T00:00:01+00:00",
                        "stop_reason": "planned_tests_complete", "actions": [],
                        "findings": [], "observations": [], "recommendations": [],
                        "summary": {"requests": 1, "findings": 0},
                    }

            def fake_scan(config, *, stop_event, on_event, ai_advisor, ai_planner):
                seen.append(config.target_url)
                self.assertIsNotNone(ai_planner)
                self.assertIsNotNone(ai_advisor)
                return _CompletedResult()

            with patch("pentest_pipeline.web_server.REPORTS", root / "reports"), patch(
                "pentest_pipeline.web_server.run_scan", side_effect=fake_scan
            ), patch.dict("os.environ", {"OPENAI_API_KEY": ""}):
                console = CampaignConsole(config_file)
                server = ConsoleHTTPServer(("127.0.0.1", 0), console)
                worker = threading.Thread(target=server.serve_forever, daemon=True)
                worker.start()
                try:
                    def post(payload):
                        connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=3)
                        connection.request("POST", "/api/campaign/start",
                                           body=json.dumps(payload),
                                           headers={"Content-Type": "application/json",
                                                    "Origin": f"http://127.0.0.1:{server.server_port}"})
                        response = connection.getresponse()
                        status = response.status
                        data = json.loads(response.read())
                        connection.close()
                        return status, data

                    target = "https://4.migbot.com.br//#/tokensale-ico-ea"
                    self.assertEqual(post({"target_url": target, "api_key": secret})[0], 400)
                    self.assertEqual(post({"target_url": target,
                                           "authorization_confirmed": True})[0], 400)
                    self.assertEqual(post({"target_url": "https://localhost/",
                                           "api_key": secret,
                                           "authorization_confirmed": True})[0], 400)
                    status, _ = post({"target_url": target, "api_key": secret,
                                      "authorization_confirmed": True})
                    self.assertEqual(status, 202)
                    deadline = time.monotonic() + 3
                    while console.snapshot()["running"] and time.monotonic() < deadline:
                        time.sleep(0.01)
                    snapshot = console.snapshot()
                    self.assertEqual(seen, ["https://4.migbot.com.br//"])
                    self.assertEqual(snapshot["scope"]["target"], seen[0])
                    self.assertEqual(snapshot["result"]["status"], "completed")
                    self.assertNotIn(secret, json.dumps(snapshot))
                    self.assertNotIn(secret, (root / "reports" / "dynamic-url-test" / "result.json").read_text())
                finally:
                    server.shutdown()
                    server.server_close()
                    worker.join(timeout=3)


if __name__ == "__main__":
    unittest.main()
