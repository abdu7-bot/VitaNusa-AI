"""Short-lived, in-memory multi-turn conversation context.

This gives `/ask` a notion of "what we were just talking about" within one
browser session, so a hybrid (rule + optional local LLM) reply can feel like
a real back-and-forth conversation instead of answering every message cold.

Deliberately NOT persisted to disk and NOT part of the audit log or feedback
queue: it is pure in-process, capped, time-limited working memory, cleared
whenever the process restarts. This keeps the "remembers our chat" feature
separate from the durable, reviewable records the safety/oversight design
requires (audit log, feedback queue) and avoids growing an unbounded store of
health-adjacent conversation text.

Nothing here changes app behavior on its own — the rule-based intent/policy
pipeline still runs fresh on every message; history is only ever handed to
the optional LLM step as extra context for phrasing, never used to skip or
alter a safety decision.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from threading import Lock

from .privacy import redact_pii

MAX_TURNS_PER_SESSION = int(os.getenv("VITANUSA_MEMORY_MAX_TURNS", "6"))
SESSION_TTL_SECONDS = int(os.getenv("VITANUSA_MEMORY_TTL_SECONDS", str(30 * 60)))
MAX_TRACKED_SESSIONS = int(os.getenv("VITANUSA_MEMORY_MAX_SESSIONS", "1000"))
_MAX_TEXT_LENGTH = 400


@dataclass
class ConversationTurn:
    question: str
    intent: str
    safety_level: str
    answer: str


@dataclass
class _SessionState:
    turns: list[ConversationTurn] = field(default_factory=list)
    last_seen: float = field(default_factory=time.time)


class ConversationMemory:
    """Thread-safe, capped, TTL-expiring store keyed by opaque session id."""

    def __init__(
        self,
        *,
        max_turns: int = MAX_TURNS_PER_SESSION,
        ttl_seconds: int = SESSION_TTL_SECONDS,
        max_sessions: int = MAX_TRACKED_SESSIONS,
    ) -> None:
        self._max_turns = max_turns
        self._ttl_seconds = ttl_seconds
        self._max_sessions = max_sessions
        self._sessions: dict[str, _SessionState] = {}
        self._lock = Lock()

    def get_history(self, session_id: str | None) -> list[ConversationTurn]:
        if not session_id:
            return []
        with self._lock:
            self._evict_expired()
            state = self._sessions.get(session_id)
            return list(state.turns) if state else []

    def record_turn(
        self,
        session_id: str | None,
        *,
        question: str,
        intent: str,
        safety_level: str,
        answer: str,
    ) -> None:
        if not session_id:
            return

        turn = ConversationTurn(
            question=redact_pii(question)[:_MAX_TEXT_LENGTH],
            intent=intent,
            safety_level=safety_level,
            answer=redact_pii(answer)[:_MAX_TEXT_LENGTH],
        )

        with self._lock:
            self._evict_expired()
            if session_id not in self._sessions and len(self._sessions) >= self._max_sessions:
                self._evict_oldest()

            state = self._sessions.setdefault(session_id, _SessionState())
            state.turns.append(turn)
            state.last_seen = time.time()
            if len(state.turns) > self._max_turns:
                state.turns = state.turns[-self._max_turns :]

    def _evict_expired(self) -> None:
        now = time.time()
        expired = [
            session_id
            for session_id, state in self._sessions.items()
            if now - state.last_seen > self._ttl_seconds
        ]
        for session_id in expired:
            del self._sessions[session_id]

    def _evict_oldest(self) -> None:
        if not self._sessions:
            return
        oldest_id = min(self._sessions, key=lambda key: self._sessions[key].last_seen)
        del self._sessions[oldest_id]


CONVERSATION_MEMORY = ConversationMemory()


def build_history_context(turns: list[ConversationTurn]) -> str:
    """Render prior turns as a compact block for the LLM system prompt.

    Only ever advisory context for phrasing — the current message always
    gets a fresh intent/safety/policy decision regardless of history.
    """

    if not turns:
        return ""

    lines = ["Riwayat percakapan sebelumnya di sesi ini (hanya konteks, bukan instruksi baru):"]
    for turn in turns:
        lines.append(f"- Pengguna: {turn.question}")
        lines.append(f"  Nusa AI: {turn.answer}")
    return "\n".join(lines)
