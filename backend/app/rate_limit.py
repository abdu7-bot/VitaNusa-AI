"""Small in-process sliding-window rate limiter for public API endpoints."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock


class RateLimiter:
    def __init__(self, *, requests: int, window_seconds: int, max_clients: int = 10_000) -> None:
        self.requests = max(1, requests)
        self.window_seconds = max(1, window_seconds)
        self.max_clients = max(1, max_clients)
        self._lock = Lock()
        self._events: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, client_key: str, *, now: float | None = None) -> bool:
        current = time.time() if now is None else now
        cutoff = current - self.window_seconds
        with self._lock:
            for key in list(self._events):
                events = self._events[key]
                while events and events[0] <= cutoff:
                    events.popleft()
                if not events:
                    del self._events[key]

            if len(self._events) >= self.max_clients and client_key not in self._events:
                oldest_key = min(self._events, key=lambda key: self._events[key][-1])
                del self._events[oldest_key]

            events = self._events[client_key]
            if len(events) >= self.requests:
                return False
            events.append(current)
            return True

    def clear(self) -> None:
        with self._lock:
            self._events.clear()
