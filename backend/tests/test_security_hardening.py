import unittest

from fastapi.testclient import TestClient

from app.main import ASK_RATE_LIMITER, app
from app.rate_limit import RateLimiter


class RateLimiterTests(unittest.TestCase):
    def test_sliding_window_blocks_after_limit(self):
        limiter = RateLimiter(requests=2, window_seconds=60)
        self.assertTrue(limiter.allow("client", now=100.0))
        self.assertTrue(limiter.allow("client", now=101.0))
        self.assertFalse(limiter.allow("client", now=102.0))
        self.assertTrue(limiter.allow("client", now=161.0))

    def test_client_state_is_bounded(self):
        limiter = RateLimiter(requests=2, window_seconds=60, max_clients=2)
        limiter.allow("one", now=100.0)
        limiter.allow("two", now=100.0)
        limiter.allow("three", now=101.0)
        self.assertLessEqual(len(limiter._events), 2)


class ApiSecurityHardeningTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()

    def setUp(self):
        ASK_RATE_LIMITER.clear()

    def test_ask_rejects_oversized_question(self):
        response = self.client.post("/ask", json={"question": "x" * 4001})
        self.assertEqual(response.status_code, 422)

    def test_ask_is_rate_limited(self):
        for _ in range(20):
            response = self.client.post("/ask", json={"question": "Apa itu air putih?"})
            self.assertEqual(response.status_code, 200)
        response = self.client.post("/ask", json={"question": "Apa itu air putih?"})
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers.get("Retry-After"), "60")

    def test_localhost_cors_is_limited_to_http_and_https(self):
        response = self.client.options(
            "/ask",
            headers={
                "Origin": "http://localhost:9999",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("access-control-allow-origin"), "http://localhost:9999")

    def test_unapproved_cors_origin_is_rejected(self):
        response = self.client.options(
            "/ask",
            headers={
                "Origin": "https://evil.example",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        self.assertNotEqual(response.headers.get("access-control-allow-origin"), "https://evil.example")
