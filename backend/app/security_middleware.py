from __future__ import annotations

import asyncio
import os

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


def _positive_env_int(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return value if value > 0 else default


class SecurityMiddleware(BaseHTTPMiddleware):
    """Apply bounded request resources and baseline security headers."""

    def __init__(self, app) -> None:
        super().__init__(app)
        self.max_request_bytes = _positive_env_int("VITANUSA_MAX_REQUEST_BYTES", 1_000_000)
        self.max_concurrent_requests = _positive_env_int("VITANUSA_MAX_CONCURRENT_REQUESTS", 50)
        self._semaphore = asyncio.Semaphore(self.max_concurrent_requests)

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                declared_size = int(content_length)
            except ValueError:
                return JSONResponse(status_code=400, content={"detail": "Content-Length tidak valid."})
            if declared_size < 0 or declared_size > self.max_request_bytes:
                return JSONResponse(status_code=413, content={"detail": "Ukuran request terlalu besar."})

        try:
            await asyncio.wait_for(self._semaphore.acquire(), timeout=0.25)
        except asyncio.TimeoutError:
            return JSONResponse(status_code=503, content={"detail": "Server sedang sibuk. Coba lagi nanti."})

        try:
            response = await call_next(request)
            response.headers.setdefault("X-Content-Type-Options", "nosniff")
            response.headers.setdefault("X-Frame-Options", "DENY")
            response.headers.setdefault("Referrer-Policy", "no-referrer")
            response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
            response.headers.setdefault("Cache-Control", "no-store")
            return response
        finally:
            self._semaphore.release()
