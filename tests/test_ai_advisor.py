"""The optional AI agent sends only bounded evidence and handles failures."""

from io import BytesIO
import json
import unittest
from unittest.mock import patch

from pentest_pipeline.ai import AIAdvisorError, OpenAIAdvisor, OpenAIPlanner, OpenAISourceReviewer
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

    def test_source_reviewer_sends_only_bounded_curated_context(self) -> None:
        captured = {}
        response = {"status": "completed", "output": [{"type": "message", "content": [{
            "type": "output_text", "text": json.dumps({"priorities": [{
                "id": "sql_search", "priority": "high",
            }]})
        }]}]}

        def fake_urlopen(request, timeout):
            captured["payload"] = json.loads(request.data)
            return BytesIO(json.dumps(response).encode())

        hypothesis = {
            "id": "sql_search", "title": "Busca compõe SQL com q",
            "source_evidence_class": "pinned_upstream_code",
            "target_status": "unverified_on_target",
            "related_dynamic_checks": ["sql_error_exposure"],
            "correlation_limit": "Sinal não comprova que o commit está no alvo.",
            "source_excerpt": "SELECT secret FROM users", "raw_code": "private JWT key",
            "evidence": "HTTP body with secret", "url": "https://example.invalid/token",
        }
        with patch("pentest_pipeline.ai.urlopen", side_effect=fake_urlopen):
            suggestions = OpenAISourceReviewer("test-only-key").review([hypothesis])

        payload = captured["payload"]
        self.assertEqual(payload["model"], "gpt-6-luna")
        self.assertFalse(payload["store"])
        self.assertTrue(payload["text"]["format"]["strict"])
        self.assertNotIn("tools", payload)
        self.assertEqual(payload["text"]["format"]["schema"]["properties"]["priorities"]
                         ["items"]["properties"]["id"]["enum"], ["sql_search"])
        self.assertEqual(json.loads(payload["input"]), {"hypotheses": [{
            "id": "sql_search", "title": "Busca compõe SQL com o parâmetro q",
            "source_status": "pinned_upstream_code",
            "target_status": "unverified_on_target",
            "related_check": "sql_error_exposure",
            "limitations": "O sinal HTTP relacionado não comprova que o alvo usa o código do commit.",
        }]})
        self.assertEqual(len(suggestions), 1)
        self.assertEqual(suggestions[0]["id"], "sql_search")
        self.assertEqual(suggestions[0]["priority"], "high")
        self.assertIn("sem confirmação", suggestions[0]["rationale"])
        self.assertIn("não comprova", suggestions[0]["limitation"])
        self.assertIn("controle sintético", suggestions[0]["next_step"])
        self.assertEqual(hypothesis["target_status"], "unverified_on_target")

    def test_source_reviewer_rejects_invented_id_and_target_promotion(self) -> None:
        item = {"id": "sql_search", "title": "Busca SQL",
                "source_status": "pinned_upstream_code", "target_status": "unverified_on_target"}
        response = {"status": "completed", "output": [{"type": "message", "content": [{
            "type": "output_text", "text": json.dumps({"priorities": [{
                "id": "made_up", "priority": "high",
            }]})
        }]}]}
        with patch("pentest_pipeline.ai.urlopen", return_value=BytesIO(json.dumps(response).encode())):
            with self.assertRaisesRegex(AIAdvisorError, "invented"):
                OpenAISourceReviewer("test-only-key").review([item])
        with patch("pentest_pipeline.ai.urlopen") as network:
            with self.assertRaisesRegex(AIAdvisorError, "unverified target"):
                OpenAISourceReviewer("test-only-key").review([{**item, "target_status": "confirmed"}])
            with self.assertRaisesRegex(AIAdvisorError, "unknown or duplicate"):
                OpenAISourceReviewer("test-only-key").review([item, item])
            network.assert_not_called()

    def test_source_reviewer_rejects_false_related_check_and_free_model_claims(self) -> None:
        item = {"id": "sql_search", "source_status": "pinned_upstream_code",
                "target_status": "unverified_on_target",
                "related_dynamic_checks": ["ftp_listing"]}
        with patch("pentest_pipeline.ai.urlopen") as network:
            with self.assertRaisesRegex(AIAdvisorError, "unsupported related check"):
                OpenAISourceReviewer("test-only-key").review([item])
            network.assert_not_called()

        item["related_dynamic_checks"] = ["sql_error_exposure"]
        response = {"status": "completed", "output": [{"type": "message", "content": [{
            "type": "output_text", "text": json.dumps({"priorities": [{
                "id": "sql_search", "priority": "high",
                "rationale": "Vulnerabilidade confirmada no alvo",
            }]})
        }]}]}
        with patch("pentest_pipeline.ai.urlopen", return_value=BytesIO(json.dumps(response).encode())):
            with self.assertRaisesRegex(AIAdvisorError, "invalid priority"):
                OpenAISourceReviewer("test-only-key").review([item])

    def test_source_reviewer_uses_canonical_title_instead_of_secret_like_input(self) -> None:
        item = {"id": "sql_search", "title": "sk-proj-secret",
                "source_status": "pinned_upstream_code", "target_status": "unverified_on_target"}
        response = {"status": "completed", "output": [{"type": "message", "content": [{
            "type": "output_text", "text": '{"priorities":[]}'
        }]}]}
        captured = {}

        def fake_urlopen(request, timeout):
            captured["payload"] = json.loads(request.data)
            return BytesIO(json.dumps(response).encode())

        with patch("pentest_pipeline.ai.urlopen", side_effect=fake_urlopen):
            self.assertEqual(OpenAISourceReviewer("test-only-key").review([item]), [])
        self.assertNotIn("sk-proj-secret", captured["payload"]["input"])
        self.assertIn("Busca compõe SQL com o parâmetro q", captured["payload"]["input"])

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
