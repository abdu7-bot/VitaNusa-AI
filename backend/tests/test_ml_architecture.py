from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

from app.feedback import FeedbackRequest, list_pending_feedback, record_feedback
from app.knowledge_base import build_knowledge_context, retrieve_knowledge
from app.privacy import redact_pii


class PrivacyRedactionTests(unittest.TestCase):
    def test_email_and_phone_are_redacted(self) -> None:
        text = redact_pii("Hubungi saya di budi@example.com atau 081234567890.")
        self.assertNotIn("budi@example.com", text)
        self.assertNotIn("081234567890", text)

    def test_normal_text_is_left_alone(self) -> None:
        text = "Perut saya mual sejak pagi."
        self.assertEqual(redact_pii(text), text)


class KnowledgeBaseTests(unittest.TestCase):
    def test_health_general_returns_verified_entry_for_known_symptom(self) -> None:
        entries = retrieve_knowledge("health_general", "perut saya mual sejak pagi")
        self.assertTrue(entries)
        self.assertIn("istirahat cukup", entries[0].verified_text.lower())

    def test_unknown_intent_has_no_entries(self) -> None:
        entries = retrieve_knowledge("greeting", "halo")
        self.assertEqual(entries, ())

    def test_context_always_includes_low_confidence_instruction(self) -> None:
        context = build_knowledge_context("greeting", "halo")
        self.assertIn("belum cukup yakin", context.lower())


class FeedbackQueueTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        self._path = Path(self._tmpdir.name) / "feedback.jsonl"
        self._env_patch = {"VITANUSA_FEEDBACK_STORE_PATH": str(self._path)}
        self._old_environ = dict(os.environ)
        os.environ.update(self._env_patch)
        # feedback.py reads the path once at import time via a module-level
        # constant, so patch the module attribute directly for this test.
        import app.feedback as feedback_module

        self._feedback_module = feedback_module
        self._original_store_path = feedback_module._STORE_PATH
        feedback_module._STORE_PATH = self._path

    def tearDown(self) -> None:
        self._feedback_module._STORE_PATH = self._original_store_path
        os.environ.clear()
        os.environ.update(self._old_environ)
        self._tmpdir.cleanup()

    def test_feedback_is_queued_as_pending_review_and_pii_redacted(self) -> None:
        receipt = record_feedback(
            FeedbackRequest(
                question="Kenapa jawabannya soal mual malah bahas assalamualaikum?",
                answer="Waalaikumsalam...",
                intent="greeting",
                safetyLevel="low",
                rating="dislike",
                reason="Hubungi saya di budi@example.com untuk detail.",
            )
        )
        self.assertTrue(receipt.feedbackId)
        self.assertEqual(receipt.status, "pending_review")

        pending = list_pending_feedback()
        self.assertEqual(len(pending), 1)
        entry = pending[0]
        self.assertEqual(entry["status"], "pending_review")
        self.assertEqual(entry["rating"], "dislike")
        self.assertNotIn("budi@example.com", entry["reasonRedacted"])

        # Nothing here ever mutates keyword lists, prompts, or the knowledge
        # base automatically -- verify the queue is a plain, inert log.
        raw_lines = self._path.read_text(encoding="utf-8").strip().splitlines()
        self.assertEqual(len(raw_lines), 1)
        json.loads(raw_lines[0])  # must be valid, appendable JSON


if __name__ == "__main__":
    unittest.main()
