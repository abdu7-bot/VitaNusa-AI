from __future__ import annotations

import unittest

from app.intent_router import detect_intent
from app.policy_engine import POLICY_ENGINE
from app.search.config import WebSearchConfig
from app.search.guard import (
    build_search_guard_context,
    evaluate_search_guard,
)


def evaluate_guard(
    question: str,
    *,
    category: str = "general",
):
    intent_result = detect_intent(question)
    decision = POLICY_ENGINE.evaluate_question(
        question,
        intent=intent_result["intent"],
        safety_level=intent_result["safetyLevel"],
    )
    context = build_search_guard_context(
        decision,
        intent=intent_result["intent"],
        safety_level=intent_result["safetyLevel"],
        query=question,
    )
    guard = evaluate_search_guard(
        context,
        requested_category=category,
        providers=WebSearchConfig().providers,
        strategy="aggregate",
    )
    return guard, context, decision


class SearchGuardTests(unittest.TestCase):
    def test_emergency_is_blocked_and_safety_comes_first(self) -> None:
        guard, context, decision = evaluate_guard(
            "Saya sesak berat dan nyeri dada.",
            category="health",
        )
        self.assertFalse(guard.allowed)
        self.assertTrue(guard.safety_first)
        self.assertEqual(guard.reason, "emergency_response_required")
        self.assertEqual(guard.providers, [])
        self.assertEqual(context.intent, "danger_sign")
        self.assertEqual(decision.dominant_policy.policy_id, "medical_safety")

    def test_personal_prescription_dose_cannot_use_search_as_a_bypass(self) -> None:
        guard, context, decision = evaluate_guard(
            "Berikan dosis obat resep untuk saya.",
            category="health",
        )
        self.assertFalse(guard.allowed)
        self.assertFalse(guard.safety_first)
        self.assertEqual(guard.reason, "personal_medication_search_blocked")
        self.assertIn("give_personal_dose", context.prohibited_actions)
        self.assertIn("give_personal_dose", decision.prohibited_actions)

    def test_product_claim_search_is_conceptually_allowed(self) -> None:
        guard, context, decision = evaluate_guard(
            "Produk ini katanya pasti menyembuhkan diabetes.",
            category="product_claim",
        )
        self.assertTrue(decision.response_blocked)
        self.assertTrue(context.response_blocked)
        self.assertTrue(guard.allowed)
        self.assertEqual(guard.category, "product_claim")
        self.assertEqual(guard.providers, ["brave", "searxng", "duckduckgo"])
        self.assertFalse(guard.safety_first)

    def test_ordinary_greeting_does_not_need_search(self) -> None:
        guard, _, _ = evaluate_guard("Assalamualaikum.")
        self.assertFalse(guard.allowed)
        self.assertEqual(
            guard.reason,
            "local_knowledge_or_conversation_is_sufficient",
        )

    def test_request_category_cannot_bypass_a_blocked_diagnosis_policy(self) -> None:
        guard, context, decision = evaluate_guard(
            "Gejala saya apa, apakah saya kena diabetes?",
            category="product_claim",
        )
        self.assertTrue(decision.response_blocked)
        self.assertTrue(context.response_blocked)
        self.assertFalse(guard.allowed)
        self.assertEqual(guard.reason, "policy_response_blocked")

    def test_local_vitacheck_knowledge_does_not_need_search(self) -> None:
        guard, _, _ = evaluate_guard("Apa itu VitaCheck?")
        self.assertFalse(guard.allowed)
        self.assertEqual(
            guard.reason,
            "local_knowledge_or_conversation_is_sufficient",
        )

    def test_news_preview_can_use_search(self) -> None:
        guard, _, _ = evaluate_guard(
            "Apa informasi teknologi terbaru?",
            category="news",
        )
        self.assertTrue(guard.allowed)
        self.assertEqual(guard.reason, "fresh_information_search_allowed")

    def test_guard_does_not_mutate_policy_context_or_decision(self) -> None:
        question = "Produk ini katanya pasti menyembuhkan diabetes."
        intent_result = detect_intent(question)
        decision = POLICY_ENGINE.evaluate_question(
            question,
            intent=intent_result["intent"],
            safety_level=intent_result["safetyLevel"],
        )
        context = build_search_guard_context(
            decision,
            intent=intent_result["intent"],
            safety_level=intent_result["safetyLevel"],
            query=question,
        )
        before_context = context.model_dump()
        before_prohibitions = decision.prohibited_actions

        evaluate_search_guard(
            context,
            requested_category="product_claim",
            providers=WebSearchConfig().providers,
            strategy="aggregate",
        )

        self.assertEqual(context.model_dump(), before_context)
        self.assertEqual(decision.prohibited_actions, before_prohibitions)
        self.assertIn("claim_cure", decision.prohibited_actions)


if __name__ == "__main__":
    unittest.main()
