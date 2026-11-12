from __future__ import annotations

from email.message import Message
from http.client import IncompleteRead
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import threading
import unittest

from pentest_pipeline import ScopeConfig, ScopeError, compare_runs, run_scan
from pentest_pipeline.agents import SurfaceTestAgent
from pentest_pipeline.scope import safe_url
from pentest_pipeline.transport import BoundedTransport, NetworkFailure, Response


class ScopeTests(unittest.TestCase):
    def test_exact_host_scheme_port_and_method(self) -> None:
        config = ScopeConfig(target_url="https://4.migbot.com.br/#/",
                             allowed_hosts=("4.migbot.com.br",))
        config.validate()
        self.assertEqual(config.assert_request(config.target_url), "https://4.migbot.com.br/")
        for url in ("https://4.migbot.com.br.evil.example/",
                    "http://4.migbot.com.br/", "https://4.migbot.com.br:8443/",
                    "https://user@4.migbot.com.br/"):
            with self.subTest(url=url), self.assertRaises(ScopeError):
                config.assert_request(url)
        with self.assertRaises(ScopeError):
            config.assert_request(config.target_url, "POST")

    def test_redirect_is_recorded_but_never_followed(self) -> None:
        seen: list[str] = []

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                seen.append(self.path)
                self.send_response(302)
                self.send_header("Location", "https://outside.example/private")
                self.end_headers()

            def log_message(self, *_args: object) -> None:
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            port = server.server_address[1]
            config = ScopeConfig(target_url=f"http://127.0.0.1:{port}/",
                                 allowed_hosts=("127.0.0.1",), allowed_schemes=("http",),
                                 allowed_ports=(port,), allow_private_ips=True,
                                 max_requests=1, max_assets=0)
            transport = BoundedTransport(config)
            response = transport.request(config.target_url)
            self.assertEqual(response.status, 302)
            self.assertEqual(seen, ["/"])
            self.assertEqual(transport.request_count, 1)
            self.assertEqual(transport.actions[-1]["headers"]["Location"],
                             "https://outside.example/private")
        finally:
            server.shutdown()
            server.server_close()
            worker.join(timeout=2)

    def test_stop_event_prevents_first_request(self) -> None:
        config = ScopeConfig(target_url="https://4.migbot.com.br/",
                             allowed_hosts=("4.migbot.com.br",))
        stopped = threading.Event()
        stopped.set()
        result = run_scan(config, stop_event=stopped)
        self.assertEqual(result.status, "stopped")
        self.assertEqual(result.summary["requests"], 0)

    def test_denied_url_never_records_userinfo_or_query(self) -> None:
        config = ScopeConfig(target_url="https://4.migbot.com.br/",
                             allowed_hosts=("4.migbot.com.br",))
        url = "https://alice:synthetic-password@4.migbot.com.br/a?token=synthetic-token#fragment"
        self.assertEqual(safe_url(url), "https://4.migbot.com.br/a")
        transport = BoundedTransport(config)
        with self.assertRaises(ScopeError):
            transport.request(url)
        recorded = str(transport.actions)
        self.assertNotIn("synthetic-password", recorded)
        self.assertNotIn("synthetic-token", recorded)
        self.assertNotIn("alice", recorded)

    def test_read_error_becomes_network_failure_and_closes_response(self) -> None:
        class BrokenResponse:
            status = 200
            headers = Message()
            closed = False

            def read(self, _limit: int) -> bytes:
                raise IncompleteRead(b"partial", 10)

            def close(self) -> None:
                self.closed = True

        class FakeOpener:
            def __init__(self, response: BrokenResponse):
                self.response = response

            def open(self, *_args: object, **_kwargs: object) -> BrokenResponse:
                return self.response

        response = BrokenResponse()
        config = ScopeConfig(target_url="http://127.0.0.1:12345/",
                             allowed_hosts=("127.0.0.1",), allowed_schemes=("http",),
                             allowed_ports=(12345,), allow_private_ips=True)
        transport = BoundedTransport(config)
        transport._opener = FakeOpener(response)
        with self.assertRaises(NetworkFailure):
            transport.request(config.target_url)
        self.assertTrue(response.closed)
        self.assertEqual(transport.request_count, 1)
        self.assertEqual(transport.actions[-1]["message"], "Response read failed")


class MonitorTests(unittest.TestCase):
    def test_diff_identifies_new_resolved_and_changed(self) -> None:
        baseline = {"status": "completed", "target": "https://example.com/", "run_id": "old",
                    "findings": [{"id": "a", "severity": "low", "status": "confirmed"},
                                 {"id": "b", "severity": "low", "status": "confirmed"},
                                 {"id": "c", "severity": "low", "status": "confirmed"}]}
        current = {"status": "completed", "target": "https://example.com/", "run_id": "new",
                   "findings": [{"id": "a", "severity": "low", "status": "confirmed"},
                                {"id": "b", "severity": "medium", "status": "confirmed"},
                                {"id": "d", "severity": "low", "status": "inconclusive"}]}
        diff = compare_runs(baseline, current)
        self.assertEqual(diff["summary"], {"new": 1, "resolved": 1, "changed": 1, "unchanged": 1})
        self.assertEqual(diff["new"][0]["id"], "d")
        self.assertEqual(diff["resolved"][0]["id"], "c")

    def test_failed_run_cannot_claim_findings_resolved(self) -> None:
        completed = {"status": "completed", "target": "https://example.com/", "findings": []}
        failed = {"status": "failed", "target": "https://example.com/", "findings": []}
        with self.assertRaises(ValueError):
            compare_runs(completed, failed)

    def test_changed_rules_do_not_create_false_regressions(self) -> None:
        baseline = {"status": "completed", "target": "https://example.com/",
                    "summary": {"ruleset_hash": "old"}, "findings": [{"id": "a"}]}
        current = {"status": "completed", "target": "https://example.com/",
                   "summary": {"ruleset_hash": "new"}, "findings": []}
        with self.assertRaisesRegex(ValueError, "different test rules"):
            compare_runs(baseline, current)


class SurfaceChecksTests(unittest.TestCase):
    def test_unrecognized_success_response_does_not_claim_resolution(self) -> None:
        config = ScopeConfig(target_url="https://4.migbot.com.br/",
                             allowed_hosts=("4.migbot.com.br",), max_assets=0,
                             ftp_path="/ftp/", metrics_path=None, search_path=None)

        class FakeTransport:
            def __init__(self):
                self.config = config
                self.request_count = 0
                self.actions = []

            def request(self, url, *, phase):
                self.request_count += 1
                return Response(url, 200, Message(), b"<html>Unknown page</html>", False, 1)

            def record(self, type_, phase, message, **details):
                self.actions.append({"type": type_, "phase": phase, "message": message, **details})

        transport = FakeTransport()
        findings, observations, complete = SurfaceTestAgent().run(config, transport)
        self.assertFalse(complete)
        self.assertEqual(findings, [])
        self.assertEqual(observations, [])
        self.assertTrue(any(item["type"] == "decision" and "needs review" in item["message"]
                            for item in transport.actions))

    def test_declared_checks_capture_only_metadata(self) -> None:
        seen: list[str] = []

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                seen.append(self.path)
                if self.path == "/":
                    status, body, content_type = 200, b"<html>OK</html>", "text/html"
                elif self.path == "/ftp/":
                    status, body, content_type = 200, b"<title>listing directory /ftp/</title><a href='secret.txt'>x</a>", "text/html"
                elif self.path == "/metrics":
                    status, body, content_type = 200, b"# HELP process_test secret_value\n# TYPE process_test gauge\n", "text/plain"
                elif self.path == "/rest/products/search?q=apple":
                    status, body, content_type = 200, b"[]", "application/json"
                elif self.path == "/rest/products/search?q=apple%27":
                    status, body, content_type = 500, b"SQLITE_ERROR private_stack_detail", "text/plain"
                elif self.path == "/api/Challenges":
                    status, body, content_type = 200, (
                        b'{"data":[{"name":"Score Board","difficulty":1,"tutorialOrder":2},'
                        b'{"name":"First Steps","difficulty":1,"tutorialOrder":1},'
                        b'{"name":"Another","difficulty":2,"category":"Misc"}]}'), "application/json"
                else:
                    status, body, content_type = 404, b"", "text/plain"
                self.send_response(status)
                self.send_header("Content-Type", content_type)
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *_args: object) -> None:
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            port = server.server_address[1]
            config = ScopeConfig(target_url=f"http://127.0.0.1:{port}/",
                                 allowed_hosts=("127.0.0.1",), allowed_schemes=("http",),
                                 allowed_ports=(port,), allow_private_ips=True,
                                 max_requests=6, max_assets=0, min_interval_seconds=0.5,
                                 ftp_path="/ftp/", metrics_path="/metrics",
                                 search_path="/rest/products/search",
                                 challenge_path="/api/Challenges")
            result = run_scan(config)
            checks = {finding.check for finding in result.findings}
            self.assertEqual(result.status, "completed")
            self.assertEqual(result.summary["requests"], 6)
            self.assertTrue({"ftp_listing", "public_metrics", "sql_error_exposure"} <= checks)
            beginner = next(item for item in result.observations if item.get("type") == "beginner_challenges")
            self.assertEqual(beginner["difficulty_counts"], {"1": 2, "2": 1})
            self.assertEqual(beginner["tutorial_names"], ["First Steps", "Score Board"])
            self.assertEqual(seen, ["/", "/ftp/", "/metrics",
                                    "/rest/products/search?q=apple",
                                    "/rest/products/search?q=apple%27", "/api/Challenges"])
            stored = str(result.to_dict())
            self.assertNotIn("secret.txt", stored)
            self.assertNotIn("secret_value", stored)
            self.assertNotIn("private_stack_detail", stored)
        finally:
            server.shutdown()
            server.server_close()
            worker.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
