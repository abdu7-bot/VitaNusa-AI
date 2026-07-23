import json
import logging
import multiprocessing
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx

from app.client_identity import resolve_feedback_client
from app.feedback import FEEDBACK_RATE_LIMITER, FeedbackRateLimiter
from app.main import app
from app.privacy import SensitiveAccessLogFilter, redact_sensitive_data


FEEDBACK_PAYLOAD = {
    "question": "Apakah jawaban ini membantu?",
    "answer": "Ini jawaban edukasi umum.",
    "intent": "health_general",
    "safetyLevel": "low",
    "rating": "like",
    "reason": "Jelas.",
}


def _record_feedback_batch(store_path: str, reasons: list[str]) -> None:
    import app.feedback as feedback_module

    feedback_module._STORE_PATH = Path(store_path)
    for reason in reasons:
        feedback_module.record_feedback(
            feedback_module.FeedbackRequest(**{**FEEDBACK_PAYLOAD, "reason": reason})
        )


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

    async def test_assignment_and_recursive_json_secrets_are_redacted_on_write_and_read(
        self,
    ) -> None:
        double_encoded = json.dumps(json.dumps({
            "authorization": "double-authorization-canary",
            "items": [{"bearer": "double-bearer-canary"}],
        }))
        deeply_encoded = "authorization=depth-limit-canary"
        for _ in range(6):
            deeply_encoded = json.dumps(deeply_encoded)
        nested_json = json.dumps({
            "assignments": [
                "authorization=authorization-canary",
                "bearer : bearer-canary",
                "bearer=bearer-equals-canary",
                r'\"authorization\" = \"escaped-authorization-canary\"',
                "bearer = 'quoted-bearer-canary'",
            ],
            "nested": {
                "array": [
                    {"authorization": "nested-authorization-canary"},
                    {"bearer": "nested-bearer-canary"},
                ],
                "doubleEncoded": double_encoded,
                "depthLimited": deeply_encoded,
            },
        })
        response = await self.client.post(
            "/feedback",
            json={**FEEDBACK_PAYLOAD, "answer": nested_json},
        )
        self.assertEqual(response.status_code, 200)

        legacy_entry = {
            "feedbackId": "legacy",
            "status": "pending_review",
            "nested": {"secret": "legacy-secret"},
        }
        with self.feedback_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(legacy_entry) + "\n")
        with patch.dict(os.environ, {"VITANUSA_ADMIN_TOKEN": "admin-secret"}):
            admin_response = await self.client.get(
                "/admin/feedback",
                headers={"Authorization": "Bearer admin-secret"},
            )

        self.assertEqual(admin_response.status_code, 200)
        persisted = self.feedback_path.read_text(encoding="utf-8")
        displayed = admin_response.text
        for sensitive_value in (
            "authorization-canary",
            "bearer-canary",
            "bearer-equals-canary",
            "escaped-authorization-canary",
            "quoted-bearer-canary",
            "nested-authorization-canary",
            "nested-bearer-canary",
            "double-authorization-canary",
            "double-bearer-canary",
            "depth-limit-canary",
        ):
            self.assertNotIn(sensitive_value, persisted)
            self.assertNotIn(sensitive_value, displayed)
        self.assertNotIn("legacy-secret", displayed)

    def test_sensitive_redaction_handles_quoted_and_escaped_json(self) -> None:
        value = (
            r'{"token":"quoted-token","nested":"{\"uid\":\"escaped-uid\",'
            r'\"secret\":\"escaped-secret\"}"}'
        )
        redacted = redact_sensitive_data(value)
        self.assertNotIn("quoted-token", redacted)
        self.assertNotIn("escaped-uid", redacted)
        self.assertNotIn("escaped-secret", redacted)

    def test_forwarded_header_requires_explicit_trusted_proxy(self) -> None:
        forwarded = "198.51.100.24"
        with patch.dict(os.environ, {"VITANUSA_TRUSTED_PROXY_IPS": ""}):
            self.assertEqual(
                resolve_feedback_client("203.0.113.10", forwarded),
                "203.0.113.10",
            )
        with patch.dict(os.environ, {"VITANUSA_TRUSTED_PROXY_IPS": "203.0.113.0/24"}):
            self.assertEqual(
                resolve_feedback_client("203.0.113.10", forwarded),
                forwarded,
            )
            self.assertEqual(
                resolve_feedback_client(
                    "203.0.113.10",
                    "198.51.100.24, 203.0.113.11",
                ),
                forwarded,
            )

    def test_runtime_disables_implicit_uvicorn_proxy_headers(self) -> None:
        render_config = (
            Path(__file__).resolve().parents[2] / "render.yaml"
        ).read_text(encoding="utf-8")
        self.assertIn("--no-proxy-headers", render_config)

    def test_rate_limit_state_is_shared_between_worker_instances(self) -> None:
        environment = {
            "VITANUSA_FEEDBACK_RATE_LIMIT_REQUESTS": "1",
            "VITANUSA_FEEDBACK_RATE_LIMIT_WINDOW_SECONDS": "60",
        }
        with patch.dict(os.environ, environment):
            first_worker = FeedbackRateLimiter()
            second_worker = FeedbackRateLimiter()
            self.assertTrue(first_worker.allow("198.51.100.24", now=1000))
            self.assertFalse(second_worker.allow("198.51.100.24", now=1001))

    def test_concurrent_process_compaction_keeps_all_new_feedback(self) -> None:
        old_reasons = [f"lama-{index}" for index in range(20)]
        worker_a_reasons = [f"worker-a-{index}" for index in range(10)]
        worker_b_reasons = [f"worker-b-{index}" for index in range(10)]
        environment = {"VITANUSA_FEEDBACK_MAX_RECORDS": "30"}
        with patch.dict(os.environ, environment):
            _record_feedback_batch(str(self.feedback_path), old_reasons)
            context = multiprocessing.get_context("fork")
            processes = [
                context.Process(
                    target=_record_feedback_batch,
                    args=(str(self.feedback_path), reasons),
                )
                for reasons in (worker_a_reasons, worker_b_reasons)
            ]
            for process in processes:
                process.start()
            for process in processes:
                process.join(timeout=20)
                self.assertEqual(process.exitcode, 0)

        entries = [
            json.loads(line)
            for line in self.feedback_path.read_text(encoding="utf-8").splitlines()
        ]
        self.assertEqual(len(entries), 30)
        retained_reasons = {entry["reasonRedacted"] for entry in entries}
        self.assertTrue(set(worker_a_reasons).issubset(retained_reasons))
        self.assertTrue(set(worker_b_reasons).issubset(retained_reasons))

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
