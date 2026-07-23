import json
import logging
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx

from app.feedback import FEEDBACK_RATE_LIMITER
from app.main import app
from app.privacy import SensitiveAccessLogFilter


FEEDBACK_PAYLOAD = {
    "question": "Apakah jawaban ini membantu?",
    "answer": "Ini jawaban edukasi umum.",
    "intent": "health_general",
    "safetyLevel": "low",
    "rating": "like",
    "reason": "Jelas.",
}


class BackendSecurityHttpTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self._temporary_directory = tempfile.TemporaryDirectory()
        self.feedback_path = Path(self._temporary_directory.name) / "feedback.jsonl"
        self.audit_path = Path(self._temporary_directory.name) / "audit.jsonl"
        self._feedback_path_patch = patch("app.feedback._STORE_PATH", self.feedback_path)
        self._audit_path_patch = patch("app.audit_log._LOG_PATH", self.audit_path)
        self._feedback_path_patch.start()
        self._audit_path_patch.start()
        FEEDBACK_RATE_LIMITER.clear()
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        )

    async def asyncTearDown(self) -> None:
        await self.client.aclose()
        FEEDBACK_RATE_LIMITER.clear()
        self._audit_path_patch.stop()
        self._feedback_path_patch.stop()
        self._temporary_directory.cleanup()

    async def test_admin_feedback_accepts_only_valid_bearer(self) -> None:
        with patch.dict(os.environ, {"VITANUSA_ADMIN_TOKEN": "valid-admin-secret"}):
            valid = await self.client.get(
                "/admin/feedback",
                headers={"Authorization": "Bearer valid-admin-secret"},
            )
            invalid = await self.client.get(
                "/admin/feedback",
                headers={"Authorization": "Bearer wrong-secret"},
            )
            basic = await self.client.get(
                "/admin/feedback",
                headers={"Authorization": "Basic valid-admin-secret"},
            )

        self.assertEqual(valid.status_code, 200)
        self.assertEqual(invalid.status_code, 401)
        self.assertEqual(basic.status_code, 401)
        self.assertEqual(invalid.headers["www-authenticate"], "Bearer")
        self.assertNotIn("wrong-secret", invalid.text)

    async def test_admin_feedback_rejects_query_token_even_with_valid_bearer(self) -> None:
        with patch.dict(os.environ, {"VITANUSA_ADMIN_TOKEN": "valid-admin-secret"}):
            response = await self.client.get(
                "/admin/feedback?token=valid-admin-secret",
                headers={"Authorization": "Bearer valid-admin-secret"},
            )

        self.assertEqual(response.status_code, 400)
        self.assertNotIn("valid-admin-secret", response.text)

    async def test_feedback_burst_returns_429_without_extra_storage(self) -> None:
        environment = {
            "VITANUSA_FEEDBACK_RATE_LIMIT_REQUESTS": "2",
            "VITANUSA_FEEDBACK_RATE_LIMIT_WINDOW_SECONDS": "60",
        }
        with patch.dict(os.environ, environment):
            first = await self.client.post("/feedback", json=FEEDBACK_PAYLOAD)
            second = await self.client.post("/feedback", json=FEEDBACK_PAYLOAD)
            rejected = await self.client.post("/feedback", json=FEEDBACK_PAYLOAD)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(rejected.status_code, 429)
        self.assertEqual(rejected.headers["retry-after"], "60")
        self.assertEqual(len(self.feedback_path.read_text(encoding="utf-8").splitlines()), 2)

    async def test_feedback_retention_keeps_only_latest_records(self) -> None:
        environment = {
            "VITANUSA_FEEDBACK_MAX_RECORDS": "2",
            "VITANUSA_FEEDBACK_RATE_LIMIT_REQUESTS": "10",
        }
        with patch.dict(os.environ, environment):
            for reason in ("pertama", "kedua", "ketiga"):
                response = await self.client.post(
                    "/feedback",
                    json={**FEEDBACK_PAYLOAD, "reason": reason},
                )
                self.assertEqual(response.status_code, 200)

        entries = [
            json.loads(line)
            for line in self.feedback_path.read_text(encoding="utf-8").splitlines()
        ]
        self.assertEqual([entry["reasonRedacted"] for entry in entries], ["kedua", "ketiga"])

    async def test_audit_log_excludes_health_narrative_and_sensitive_values(self) -> None:
        narrative = (
            "Saya sakit sejak kemarin token=private-token "
            "uid=user-private dan email saya pasien@example.test"
        )
        response = await self.client.post(
            "/ask",
            json={"question": narrative},
        )

        self.assertEqual(response.status_code, 200)
        raw_log = self.audit_path.read_text(encoding="utf-8")
        entry = json.loads(raw_log)
        self.assertNotIn("questionPreview", entry)
        self.assertNotIn("question", entry)
        for sensitive_value in (
            narrative,
            "private-token",
            "user-private",
            "pasien@example.test",
        ):
            self.assertNotIn(sensitive_value, raw_log)

    async def test_feedback_queue_redacts_tokens_secrets_and_uid(self) -> None:
        sensitive_reason = (
            "Bearer private-bearer token=private-token "
            "secret:private-secret uid=user-private"
        )
        response = await self.client.post(
            "/feedback",
            json={**FEEDBACK_PAYLOAD, "reason": sensitive_reason},
        )

        self.assertEqual(response.status_code, 200)
        raw_queue = self.feedback_path.read_text(encoding="utf-8")
        for sensitive_value in (
            "private-bearer",
            "private-token",
            "private-secret",
            "user-private",
        ):
            self.assertNotIn(sensitive_value, raw_queue)

    def test_access_log_redacts_entire_query_string(self) -> None:
        record = logging.LogRecord(
            "uvicorn.access",
            logging.INFO,
            __file__,
            1,
            '%s - "%s %s HTTP/%s" %d',
            (
                "127.0.0.1:1234",
                "GET",
                "/admin/feedback?token=private-token&uid=user-private",
                "1.1",
                400,
            ),
            None,
        )

        self.assertTrue(SensitiveAccessLogFilter().filter(record))
        rendered = record.getMessage()
        self.assertIn("/admin/feedback?[query dihapus]", rendered)
        self.assertNotIn("private-token", rendered)
        self.assertNotIn("user-private", rendered)


if __name__ == "__main__":
    unittest.main()
