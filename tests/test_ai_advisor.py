"""The optional AI agent sends only bounded evidence and handles failures."""

from io import BytesIO
import json
import unittest
from unittest.mock import patch

from pentest_pipeline.ai import AIAdvisorError, OpenAIAdvisor
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
            "observations": [{"type": "ai_advisor", "model": "gpt-6-luna", "status": "completed"}],
            "recommendations": [{"source": "ai", "finding_id": "sql-error-test",
                                 "guidance": "Parametrize a busca.", "code_hint": "db.prepare(sql).all(term)",
                                 "verification": "Teste aspas sem erro interno."}],
        })
        self.assertIn("## Orientação por IA", report)
        self.assertIn("gpt-6-luna", report)
        self.assertIn("Parametrize a busca.", report)


if __name__ == "__main__":
    unittest.main()
