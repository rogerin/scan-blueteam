"""Historical demo screenshot must be linked only with exact provenance."""

from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

from pentest_pipeline.demo_archive import attach_demo_archive
from pentest_pipeline.models import Finding, ScanResult


class _Events:
    def __init__(self) -> None:
        self.actions: list[dict] = []

    def record(self, type_: str, phase: str, message: str, **details: object) -> None:
        self.actions.append({"type": type_, "phase": phase, "message": message, **details})


def _result(target: str = "https://4.migbot.com.br/") -> ScanResult:
    return ScanResult(
        run_id="archive-test", target=target, campaign_name="test", started_at="now",
        findings=[Finding(
            id="ftp_listing-test", title="Listagem /ftp/", severity="low",
            status="confirmed", confidence="high", check="ftp_listing",
            url="https://4.migbot.com.br/ftp/", evidence="Índice com link",
            impact="Nomes públicos", proof="GET /ftp/: HTTP 200",
            limitations="Lista nomes; não lê arquivos.",
        )],
    )


class DemoArchiveTests(TestCase):
    def test_exact_demo_listing_gets_historical_caption_and_hash(self) -> None:
        result, events = _result(), _Events()
        self.assertTrue(attach_demo_archive(result, events))
        finding = result.findings[0]
        self.assertEqual(finding.screenshot, "/evidence/ftp-listagem.png")
        self.assertEqual(finding.screenshot_sha256,
                         "bc24f75789d8ec2cf314e89dcffb135ba3d9457bd9e8c68cef94ecf354354bba")
        self.assertIn("histórica e separada", finding.screenshot_caption)
        self.assertIn("não é a resposta desta execução", finding.screenshot_caption)
        self.assertIn("não comprova leitura", finding.screenshot_caption)
        self.assertEqual(len(events.actions), 1)
        self.assertEqual(events.actions[0]["type"], "evidence_link")
        self.assertEqual(events.actions[0]["phase"], "archive")

    def test_other_origins_and_unconfirmed_routes_never_inherit_image(self) -> None:
        for target in ("https://example.org/", "https://4.migbot.com.br.evil/",
                       "http://4.migbot.com.br/", "https://4.migbot.com.br:8443/"):
            with self.subTest(target=target):
                result, events = _result(target), _Events()
                self.assertFalse(attach_demo_archive(result, events))
                self.assertFalse(result.findings[0].screenshot)
                self.assertEqual(events.actions, [])
        for status, url in (("inconclusive", "https://4.migbot.com.br/ftp/"),
                            ("confirmed", "https://4.migbot.com.br/support/logs"),
                            ("confirmed", "https://example.org/ftp/")):
            with self.subTest(status=status, url=url):
                result, events = _result(), _Events()
                result.findings[0].status = status
                result.findings[0].url = url
                self.assertFalse(attach_demo_archive(result, events))
                self.assertFalse(result.findings[0].screenshot)
                self.assertEqual(events.actions, [])

    def test_changed_or_missing_image_is_never_linked(self) -> None:
        with TemporaryDirectory() as directory:
            image = Path(directory) / "ftp-listagem.png"
            result, events = _result(), _Events()
            with patch("pentest_pipeline.demo_archive._ARCHIVE_IMAGE", image):
                self.assertFalse(attach_demo_archive(result, events))
                image.write_bytes(b"different image")
                self.assertFalse(attach_demo_archive(result, events))
            self.assertFalse(result.findings[0].screenshot)
            self.assertEqual(events.actions, [])

    def test_existing_screenshot_is_not_overwritten(self) -> None:
        result, events = _result(), _Events()
        result.findings[0].screenshot = "/evidence/current.png"
        self.assertFalse(attach_demo_archive(result, events))
        self.assertEqual(result.findings[0].screenshot, "/evidence/current.png")
        self.assertEqual(events.actions, [])
