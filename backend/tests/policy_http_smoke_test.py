#!/usr/bin/env python3
"""Dependency-free HTTP checks for the hierarchy policy payload.

Uses FastAPI's in-process TestClient so the suite does not require a
running uvicorn server on port 8000.
"""

import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app.main import ASK_RATE_LIMITER, app


def post_ask(question: str) -> dict[str, Any]:
    ASK_RATE_LIMITER.clear()
    with TestClient(app) as client:
        response = client.post("/ask", json={"question": question})
    if response.status_code != 200:
        raise AssertionError(f"HTTP {response.status_code} for question: {question}")
    payload = response.json()
    if not isinstance(payload, dict):
        raise AssertionError("response must be a JSON object")
    return payload


def result_ids(payload: dict[str, Any]) -> list[str]:
    decision = payload.get("policyDecision") or {}
    return [
        item.get("policyId", "")
        for item in decision.get("results", [])
        if isinstance(item, dict)
    ]


def test_emergency_suppresses_products() -> None:
    payload = post_ask("Saya nyeri dada. Produk mana yang cocok?")
    decision = payload["policyDecision"]
    assert decision["dominantPolicy"] == "medical_safety"
    assert "show_products" in decision["prohibitedActions"]
    assert not any("product" in action.get("href", "") for action in payload["actions"])


def test_halal_unknown_stays_unknown() -> None:
    payload = post_ask("Apakah produk ini halal?")
    halal = next(
        result
        for result in payload["policyDecision"]["results"]
        if result["policyId"] == "halal_thayyib"
    )
    assert halal["metadata"]["halal_status"] == "unknown"
    assert "belum dapat dipastikan" in halal["message"].lower()


def test_multiple_policies_remain_visible() -> None:
    payload = post_ask(
        "Saya hamil. Apakah herbal ini halal dan bisa menyembuhkan hipertensi?"
    )
    ids = result_ids(payload)
    assert "medical_safety" in ids
    assert "halal_thayyib" in ids
    assert "product_claims" in ids
    priorities = [
        item["priority"] for item in payload["policyDecision"]["results"]
    ]
    assert priorities == sorted(priorities, reverse=True)


TESTS = (
    test_emergency_suppresses_products,
    test_halal_unknown_stays_unknown,
    test_multiple_policies_remain_visible,
)


def main() -> int:
    failures: list[str] = []
    for test in TESTS:
        try:
            test()
        except (AssertionError, KeyError, StopIteration) as error:
            failures.append(f"{test.__name__}: {error}")
            print(f"[FAIL] {test.__name__}: {error}", file=sys.stderr)
        else:
            print(f"[PASS] {test.__name__}")

    if failures:
        print(f"Hierarchy HTTP smoke failed: {len(failures)} case(s).", file=sys.stderr)
        return 1
    print(f"Hierarchy HTTP smoke passed: {len(TESTS)} cases.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
