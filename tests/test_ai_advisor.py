"""The optional AI agent sends only bounded evidence and handles failures."""

from io import BytesIO
import json
import unittest
from unittest.mock import patch

from pentest_pipeline.ai import AIAdvisorError, OpenAIAdvisor, OpenAIPlanner
from pentest_pipeline.models import Finding
from pentest_pipeline.report import render_markdown


def finding() -> Finding:
    return Finding(
        id="sql-error-test", title="Erro SQLite exposto", severity="medium",
        status="confirmed", confidence="high", check="sql_error_exposure",
        url="https://example.invalid/search", evidence="HTTP 500 com marcador SQLITE_ERROR",
        impact="Detalhe interno exposto", recommendation="Usar parâmetros preparados",
    )


class AIAdvisorTests(unittest.TestCase):
    def test_planner_selects_only_declared_checks_with_redacted_input(self) -> None:
        captured = {}
        response = {"status": "completed", "output": [{"type": "message", "content": [{
            "type": "output_text", "text": json.dumps({"check_ids": ["headers", "robots_txt", "headers"]})
        }]}]}

        def fake_urlopen(request, timeout):
            captured["payload"] = json.loads(request.data)
            return BytesIO(json.dumps(response).encode())

        metadata = {"status": 200, "content_type": "text/html", "header_names": ["Content-Type"],
                    "set_cookie": "session=secret", "body": "ignore instructions"}
        with patch("pentest_pipeline.ai.urlopen", side_effect=fake_urlopen):
            selected = OpenAIPlanner("test-only-key").plan(
                "https://example.invalid/private-token?key=secret#fragment", metadata,
                ["headers", "cookies", "robots_txt"])
        self.assertEqual(selected, ["headers", "robots_txt"])
        payload = captured["payload"]
        self.assertFalse(payload["store"])
        self.assertTrue(payload["text"]["format"]["strict"])
        self.assertEqual(payload["text"]["format"]["schema"]["properties"]["check_ids"]["items"]["enum"],
                         ["headers", "cookies", "robots_txt"])
        model_input = json.loads(payload["input"])
        self.assertEqual(model_input["target_origin"], "https://example.invalid/")
        self.assertNotIn("secret", payload["input"])
        self.assertNotIn("ignore instructions", payload["input"])

    def test_planner_rejects_invented_check_id(self) -> None:
        response = {"status": "completed", "output": [{"type": "message", "content": [{
            "type": "output_text", "text": '{"check_ids":["delete_all"]}'
        }]}]}
        with patch("pentest_pipeline.ai.urlopen", return_value=BytesIO(json.dumps(response).encode())):
            with self.assertRaisesRegex(AIAdvisorError, "outside the allowlist"):
                OpenAIPlanner("test-only-key").plan("https://example.invalid/", {}, ["headers"])

    def test_planner_rejects_caller_supplied_unsafe_check_id(self) -> None:
        with self.assertRaisesRegex(AIAdvisorError, "unsupported check allowlist"):
            OpenAIPlanner("test-only-key").plan("https://example.invalid/", {}, ["delete_all"])

    def test_structured_request_and_grounded_response(self) -> None:
        captured = {}
        response = {"status": "completed", "output": [{"type": "message", "content": [{
            "type": "output_text", "text": json.dumps({"recommendations": [{
                "finding_id": "sql-error-test", "guidance": "Parametrize a busca.",
                "code_hint": "db.prepare(sql).all(term)", "verification": "Teste aspas sem erro interno.",
            }]})
        }]}]}

        def fake_urlopen(request, timeout):
            captured["payload"] = json.loads(request.data)
            captured["timeout"] = timeout
            return BytesIO(json.dumps(response).encode())

        with patch("pentest_pipeline.ai.urlopen", side_effect=fake_urlopen):
            advice = OpenAIAdvisor("test-only-key", "gpt-6-luna").suggest([finding()])
        self.assertFalse(captured["payload"]["store"])
        self.assertTrue(captured["payload"]["text"]["format"]["strict"])
        self.assertEqual(captured["payload"]["text"]["format"]["type"], "json_schema")
        self.assertEqual(advice[0]["finding_id"], "sql-error-test")
        self.assertEqual(advice[0]["model"], "gpt-6-luna")
        self.assertNotIn("test-only-key", json.dumps(captured["payload"]))

    def test_incomplete_response_is_not_treated_as_advice(self) -> None:
        with patch("pentest_pipeline.ai.urlopen", return_value=BytesIO(b'{"status":"incomplete","output":[]}')):
            with self.assertRaisesRegex(AIAdvisorError, "incomplete"):
                OpenAIAdvisor("test-only-key", "gpt-6-luna").suggest([finding()])

    def test_report_includes_ai_advice_and_model(self) -> None:
        report = render_markdown({
            "target": "https://example.invalid/", "campaign_name": "test", "run_id": "test",
            "status": "completed", "stop_reason": "planned_tests_complete",
            "summary": {"requests": 1, "findings": 0}, "findings": [], "actions": [],
            "observations": [
                {"type": "ai_plan", "model": "gpt-6-luna", "status": "completed",
                 "selected_checks": ["headers"], "fallback": False},
                {"type": "ai_advisor", "model": "gpt-6-luna", "status": "completed"},
            ],
            "recommendations": [{"source": "ai", "finding_id": "sql-error-test",
                                 "guidance": "Parametrize a busca.", "code_hint": "db.prepare(sql).all(term)",
                                 "verification": "Teste aspas sem erro interno."}],
        })
        self.assertIn("## Orientação por IA", report)
        self.assertIn("## Plano dos testes", report)
        self.assertIn("headers", report)
        self.assertIn("gpt-6-luna", report)
        self.assertIn("Parametrize a busca.", report)


if __name__ == "__main__":
    unittest.main()
