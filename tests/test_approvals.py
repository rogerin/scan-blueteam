"""Approval decisions are explicit, bounded and independent of network access."""

import threading
import unittest

from pentest_pipeline.approvals import ApprovalQueue


class ApprovalQueueTests(unittest.TestCase):
    def test_waits_for_human_decision_and_records_sanitized_context(self):
        events = []
        queue = ApprovalQueue(["quoted_search"], on_event=events.append)
        request_id = queue.propose("quoted_search",
                                   target="https://example.test/search?q=secret#fragment",
                                   reason="  Comparar   resposta de busca   sintética  ")
        item = queue.snapshot()[0]
        self.assertEqual(item["status"], "pending")
        self.assertEqual(item["target"], "https://example.test/search")
        self.assertEqual(item["reason"], "Comparar resposta de busca sintética")
        self.assertNotIn("secret", str(events))

        completed = []
        worker = threading.Thread(target=lambda: completed.append(queue.wait(request_id)))
        worker.start()
        try:
            self.assertTrue(queue.decide(request_id, True))
            worker.join(timeout=2)
            self.assertEqual(completed, ["approved"])
            self.assertEqual(queue.snapshot()[0]["status"], "approved")
            self.assertFalse(queue.decide(request_id, False))
            self.assertEqual([event["status"] for event in events], ["pending", "approved"])
        finally:
            if worker.is_alive():
                queue.decide(request_id, False)
                worker.join(timeout=2)

    def test_reject_and_stop_never_approve(self):
        queue = ApprovalQueue(["quoted_search"])
        rejected = queue.propose("quoted_search", target="https://example.test/", reason="Teste condicionado")
        self.assertTrue(queue.decide(rejected, False))
        self.assertEqual(queue.wait(rejected), "rejected")
        stopped = threading.Event()
        pending = queue.propose("quoted_search", target="https://example.test/", reason="Teste condicionado")
        observed = []
        worker = threading.Thread(target=lambda: observed.append(queue.wait(pending, stop_event=stopped)))
        worker.start()
        stopped.set()
        worker.join(timeout=2)
        self.assertEqual(observed, ["cancelled"])
        self.assertEqual(queue.snapshot()[-1]["status"], "cancelled")
        self.assertFalse(queue.decide(pending, True))

    def test_allowlist_and_immutable_snapshots(self):
        queue = ApprovalQueue(["quoted_search"])
        with self.assertRaisesRegex(ValueError, "outside"):
            queue.propose("post_passwords", target="https://example.test/", reason="Não permitido")
        with self.assertRaises(ValueError):
            queue.propose("quoted_search", target="invalid", reason="Teste")
        with self.assertRaises(ValueError):
            queue.propose("quoted_search", target="https://example.test/", reason=" ")
        request_id = queue.propose("quoted_search", target="https://example.test/", reason="Teste")
        snapshot = queue.snapshot()
        snapshot[0]["status"] = "approved"
        self.assertEqual(queue.snapshot()[0]["status"], "pending")
        self.assertFalse(queue.decide("missing", True))
        with self.assertRaises(ValueError):
            queue.decide(request_id, "yes")
        with self.assertRaises(ValueError):
            queue.wait("missing")
        self.assertTrue(queue.decide(request_id, False))

    def test_callback_error_does_not_approve_or_stall(self):
        def bad_callback(_event):
            raise RuntimeError("observer failed")

        queue = ApprovalQueue(["quoted_search"], on_event=bad_callback)
        request_id = queue.propose("quoted_search", target="https://example.test/", reason="Teste")
        self.assertTrue(queue.decide(request_id, False))
        self.assertEqual(queue.wait(request_id), "rejected")

    def test_pending_decision_expires_without_execution(self):
        queue = ApprovalQueue(["quoted_search"], decision_timeout_seconds=0.01)
        request_id = queue.propose("quoted_search", target="https://example.test/", reason="Teste")
        self.assertEqual(queue.wait(request_id), "expired")
        self.assertEqual(queue.snapshot()[0]["status"], "expired")
        self.assertFalse(queue.decide(request_id, True))


if __name__ == "__main__":
    unittest.main()
