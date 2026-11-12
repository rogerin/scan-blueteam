"""Local source review must correlate safely without producing target findings."""

from threading import Barrier
from unittest import TestCase
from unittest.mock import patch

from pentest_pipeline.models import Finding
from pentest_pipeline.source_review import (DeploymentMatchAgent, SourceCatalogAgent,
                                           TargetSignalAgent, run_parallel_source_review)


class _Events:
    def __init__(self) -> None:
        self.actions: list[dict] = []

    def record(self, type_: str, phase: str, message: str, **details: object) -> None:
        self.actions.append({"type": type_, "phase": phase, "message": message, **details})


def _finding(check: str, status: str = "confirmed") -> Finding:
    return Finding(
        id=f"{check}-test", title=check, severity="low", status=status,
        confidence="high", check=check, url="https://4.migbot.com.br/",
        evidence="bounded metadata", impact="conditional", proof="bounded proof",
        limitations="This does not prove exploitation.",
    )


class SourceReviewTests(TestCase):
    def test_three_agents_run_in_parallel_and_keep_hypotheses_unverified(self) -> None:
        barrier = Barrier(3, timeout=3)
        original_source = SourceCatalogAgent.run
        original_target = TargetSignalAgent.run
        original_deployment = DeploymentMatchAgent.run

        def source(agent, review):
            barrier.wait()
            return original_source(agent, review)

        def target(agent, findings):
            barrier.wait()
            return original_target(agent, findings)

        def deployment(agent, framework):
            barrier.wait()
            return original_deployment(agent, framework)

        events = _Events()
        findings = [_finding("sql_error_exposure"), _finding("ftp_listing"),
                    _finding("public_metrics", "confirmed"),
                    _finding("sql_error_exposure", "inconclusive")]
        with patch.object(SourceCatalogAgent, "run", source), \
             patch.object(TargetSignalAgent, "run", target), \
             patch.object(DeploymentMatchAgent, "run", deployment):
            review = run_parallel_source_review(
                "https://4.migbot.com.br/#/", findings,
                {"version": "22.2.2"}, events)

        assert review is not None
        self.assertEqual(review["status"], "reference_only")
        self.assertEqual(review["target_source_match"], "not_verified")
        self.assertEqual(len(review["hypotheses"]), 14)
        self.assertEqual(len(review["agent_runs"]), 3)
        self.assertTrue(all(run["status"] == "completed" for run in review["agent_runs"]))
        self.assertEqual({signal["check"] for signal in review["target_signals"]},
                         {"sql_error_exposure", "ftp_listing"})
        self.assertTrue(all(item["target_status"] == "unverified_on_target"
                            for item in review["hypotheses"]))
        correlated = {item["id"] for item in review["hypotheses"]
                      if item["correlation"] == "related_observation_only"}
        self.assertEqual(correlated, {"sql_search", "public_file_indexes"})
        self.assertEqual(len([event for event in events.actions
                              if event["type"] == "agent_start"]), 3)
        self.assertEqual(len([event for event in events.actions
                              if event["type"] == "agent_result"]), 3)

    def test_generic_host_does_not_launch_source_agents(self) -> None:
        events = _Events()
        review = run_parallel_source_review("https://example.com/", [], {}, events)
        self.assertIsNone(review)
        self.assertEqual(events.actions, [])

    def test_source_catalog_rejects_unpinned_links(self) -> None:
        from pentest_pipeline.upstream_catalog import build_upstream_review

        review = build_upstream_review("https://4.migbot.com.br/")
        review["hypotheses"][0]["source_refs"] = ["https://example.com/other"]
        with self.assertRaisesRegex(ValueError, "untrusted reference"):
            SourceCatalogAgent().run(review)
