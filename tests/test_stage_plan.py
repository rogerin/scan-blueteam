from __future__ import annotations

from email.message import Message
from unittest import TestCase
from unittest.mock import patch
from urllib.parse import urlsplit

from pentest_pipeline import ScopeConfig, run_scan
from pentest_pipeline.report import render_markdown
from pentest_pipeline.transport import Response


class _FakeTransport:
    """In-memory responses; a plan test must never contact the target."""

    def __init__(self, config: ScopeConfig, **_kwargs: object) -> None:
        self.config = config
        self.actions: list[dict] = []
        self.request_count = 0

    def record(self, type_: str, phase: str, message: str, **details: object) -> None:
        self.actions.append({"type": type_, "phase": phase, "message": message, **details})

    def request(self, url: str, *, method: str = "GET", phase: str = "test") -> Response:
        scoped_url = self.config.assert_request(url, method)
        self.request_count += 1
        self.record("request", phase, "synthetic request", method=method,
                    url=scoped_url, request_number=self.request_count)
        headers = Message()
        if urlsplit(scoped_url).path == "/":
            headers["Content-Type"] = "text/html"
            return Response(scoped_url, 200, headers, b"<html><body>Home</body></html>", False, 0)
        headers["Content-Type"] = "text/plain"
        return Response(scoped_url, 404, headers, b"", False, 0)


class StagePlanTests(TestCase):
    def test_any_target_runs_parallel_analysis_without_new_findings(self) -> None:
        class Reviewer:
            model = "mock-model"

            def review(self, items):
                if not all(item["status"] == "unverified_on_target" for item in items):
                    raise AssertionError("A follow-up hypothesis was promoted")
                first = items[0]
                return [{"id": first["id"], "priority": "medium",
                         "rationale": "Priorizado por IA sem confirmação de falha.",
                         "next_step": first["verification"],
                         "limitation": first["limitations"]}]

        for target in ("https://4.migbot.com.br/#/", "https://example.com/#/"):
            with self.subTest(target=target):
                config = ScopeConfig.for_target_url(target)
                with patch("pentest_pipeline.pipeline.BoundedTransport", _FakeTransport):
                    result = run_scan(config, selected_checks=(), ai_target_reviewer=Reviewer())

                analysis = next(item for item in result.observations
                                if item.get("type") == "target_multiagent_analysis")
                ai = next(item for item in result.observations
                          if item.get("type") == "target_ai_review")
                self.assertEqual(analysis["status"], "completed")
                self.assertEqual(len(analysis["agent_runs"]), 3)
                self.assertEqual(ai["status"], "completed")
                self.assertEqual(ai["priorities"][0]["id"], analysis["hypotheses"][0]["id"])
                self.assertEqual(result.summary["findings"], len(result.findings))
                self.assertTrue(all(item["status"] == "unverified_on_target"
                                    for item in analysis["hypotheses"]))
                events = result.actions
                self.assertLess(next(i for i, event in enumerate(events)
                                     if event.get("step_id") == "target_analysis"),
                                next(i for i, event in enumerate(events)
                                     if event.get("type") == "agent_start"))
                self.assertIn("Análise multiagente do alvo", render_markdown(result))

    def test_target_analysis_accepts_exact_origin_without_trailing_slash(self) -> None:
        config = ScopeConfig(target_url="https://4.MIGBOT.com.br",
                             allowed_hosts=("4.migbot.com.br",), max_assets=0)
        with patch("pentest_pipeline.pipeline.BoundedTransport", _FakeTransport):
            result = run_scan(config, selected_checks=())
        self.assertTrue(any(item.get("type") == "target_multiagent_analysis"
                            for item in result.observations))

    def test_each_selected_check_has_a_plan_before_its_request(self) -> None:
        config = ScopeConfig.for_target_url("https://example.com/#/")
        with patch("pentest_pipeline.pipeline.BoundedTransport", _FakeTransport):
            result = run_scan(config, selected_checks=("robots_txt",))

        self.assertEqual(result.status, "completed")
        events = result.actions
        plans = [event for event in events if event["type"] == "stage_plan"]
        planned_ids = [event["step_id"] for event in plans]
        self.assertIn("scope", planned_ids)
        self.assertIn("discovery", planned_ids)
        self.assertIn("robots_txt", planned_ids)
        self.assertNotIn("security_txt", planned_ids)
        for event in plans:
            for field in ("hypothesis", "action", "expected_result", "stop_condition"):
                self.assertIsInstance(event[field], str)
                self.assertTrue(event[field].strip())
            self.assertEqual(event["check_id"], event["step_id"])

        first_request = next(index for index, event in enumerate(events)
                             if event["type"] == "request")
        self.assertLess(next(index for index, event in enumerate(events)
                             if event.get("step_id") == "scope"), first_request)
        self.assertLess(next(index for index, event in enumerate(events)
                             if event.get("step_id") == "discovery"), first_request)
        robots_plan = next(index for index, event in enumerate(events)
                           if event.get("step_id") == "robots_txt")
        robots_request = next(index for index, event in enumerate(events)
                              if event["type"] == "request" and
                              urlsplit(event["url"]).path == "/robots.txt")
        self.assertLess(robots_plan, robots_request)

        observation = next(item for item in result.observations
                           if item.get("type") == "agent_plan")
        self.assertEqual([step["step_id"] for step in observation["steps"]], planned_ids)

    def test_ai_planner_is_logged_before_its_allowed_choice(self) -> None:
        config = ScopeConfig.for_target_url("https://example.com/")

        class Planner:
            model = "test-model"

            def plan(self, *_args: object) -> list[str]:
                return ["security_txt"]

        with patch("pentest_pipeline.pipeline.BoundedTransport", _FakeTransport):
            result = run_scan(config, ai_planner=Planner())
        events = result.actions
        ai_plan_index = next(index for index, event in enumerate(events)
                             if event.get("step_id") == "ai_planning")
        ai_choice_index = next(index for index, event in enumerate(events)
                               if event.get("source") == "ai" and
                               event.get("check_ids"))
        self.assertLess(ai_plan_index, ai_choice_index)
        self.assertIn("security_txt", result.summary["selected_checks"])
        self.assertNotIn("robots_txt", [event.get("step_id") for event in events
                                         if event["type"] == "stage_plan"])
