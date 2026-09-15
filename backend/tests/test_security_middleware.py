import asyncio
import unittest
from unittest.mock import patch

from app.security_middleware import SecurityMiddleware


class DummyRequest:
    def __init__(self, headers=None):
        self.headers = headers or {}


class DummyResponse:
    def __init__(self):
        self.headers = {}


class SecurityMiddlewareUnitTests(unittest.TestCase):
    def test_invalid_content_length_returns_400(self):
        middleware = SecurityMiddleware(lambda scope, receive, send: None)
        request = DummyRequest({"content-length": "abc"})

        async def run():
            response = await middleware.dispatch(request, lambda _: None)
            self.assertEqual(response.status_code, 400)

        asyncio.run(run())

    def test_oversized_content_length_returns_413(self):
        with patch.dict("os.environ", {"VITANUSA_MAX_REQUEST_BYTES": "100"}):
            middleware = SecurityMiddleware(lambda scope, receive, send: None)
        request = DummyRequest({"content-length": "101"})

        async def run():
            response = await middleware.dispatch(request, lambda _: None)
            self.assertEqual(response.status_code, 413)

        asyncio.run(run())

    def test_security_headers_are_added(self):
        middleware = SecurityMiddleware(lambda scope, receive, send: None)
        request = DummyRequest()

        async def run():
            response = await middleware.dispatch(request, lambda _: DummyResponse())
            self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
            self.assertEqual(response.headers["X-Frame-Options"], "DENY")
            self.assertEqual(response.headers["Referrer-Policy"], "no-referrer")
            self.assertEqual(response.headers["Cache-Control"], "no-store")

        asyncio.run(run())

    def test_request_id_is_stable_when_provided(self):
        middleware = SecurityMiddleware(lambda scope, receive, send: None)
        request = DummyRequest({"X-Request-ID": "abc123"})

        async def run():
            response = await middleware.dispatch(request, lambda _: DummyResponse())
            self.assertEqual(response.headers["X-Request-ID"], "abc123")

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
