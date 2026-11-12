"""A pinned source review must not turn into live target findings."""

from unittest import TestCase

from pentest_pipeline.upstream_catalog import (UPSTREAM_COMMIT, UPSTREAM_HYPOTHESIS_IDS,
                                               build_upstream_review)


class UpstreamCatalogTests(TestCase):
    def test_known_lab_lists_fourteen_reference_only_hypotheses(self) -> None:
        review = build_upstream_review("https://4.migbot.com.br//#/tokensale-ico-ea",
                                       ("ftp_listing", "sql_error_exposure"))
        self.assertEqual(review["status"], "reference_only")
        self.assertEqual(review["target_source_match"], "not_verified")
        self.assertEqual(len(review["hypotheses"]), 14)
        self.assertEqual(len({item["id"] for item in review["hypotheses"]}), 14)
        self.assertEqual({item["id"] for item in review["hypotheses"]}, UPSTREAM_HYPOTHESIS_IDS)
        self.assertTrue(all(item["target_status"] == "unverified_on_target"
                            for item in review["hypotheses"]))
        self.assertTrue(all(all(UPSTREAM_COMMIT in ref for ref in item["source_refs"])
                            for item in review["hypotheses"]))
        sql = next(item for item in review["hypotheses"] if item["id"] == "sql_search")
        self.assertEqual(sql["related_dynamic_checks"], ["sql_error_exposure"])
        self.assertEqual(sql["correlation"], "related_observation_only")
        self.assertNotIn("confirmed", sql["target_status"])

    def test_other_host_never_inherits_juice_shop_claims(self) -> None:
        review = build_upstream_review("https://example.com/", ("ftp_listing",))
        self.assertEqual(review["status"], "not_applicable")
        self.assertEqual(review["hypotheses"], [])
        self.assertEqual(build_upstream_review("https://4.migbot.com.br:8443/")["hypotheses"], [])

    def test_catalog_omits_key_material_and_exploit_payloads(self) -> None:
        review = build_upstream_review("https://4.migbot.com.br/")
        data = str(review).lower()
        for prohibited in ("-----begin", "private key-----", "sk-proj-", "union select",
                           "<script>", "169.254.169.254", "password hash:"):
            self.assertNotIn(prohibited, data)
