from __future__ import annotations

import unittest

from app.intent_router import detect_intent
from app.main import ask_ai
from app.policies.base import BasePolicy, PolicyContext, PolicyResult
from app.policies.halal_thayyib import HalalThayyibPolicy
from app.policies.medical_safety import MedicalSafetyPolicy
from app.policies.registry import validate_registry
from app.policy_engine import POLICY_ENGINE, PolicyEngine
from app.responses import build_actions, build_answer
from app.schemas import AskRequest


def evaluate(question: str, metadata: dict | None = None):
    intent_result = detect_intent(question)
    return POLICY_ENGINE.evaluate_question(
        question,
        intent=intent_result["intent"],
        safety_level=intent_result["safetyLevel"],
        metadata=metadata,
    ), intent_result


class PolicyEngineTests(unittest.TestCase):
    def test_emergency_dominates_product_intent(self) -> None:
        decision, intent = evaluate(
            "Saya sesak berat setelah minum produk ini. Apakah produknya halal?"
        )
        self.assertEqual(intent["intent"], "danger_sign")
        self.assertEqual(decision.dominant_policy.policy_id, "medical_safety")
        self.assertEqual(decision.dominant_policy.status, "critical")
        self.assertIn("show_products", decision.prohibited_actions)

    def test_diagnosis_boundary_is_active(self) -> None:
        decision, _ = evaluate("Gejala saya apa, apakah saya kena diabetes?")
        result = decision.get_policy("authority_boundary")
        self.assertIsNotNone(result)
        self.assertTrue(result.blocks_response)
        self.assertIn("give_diagnosis", decision.prohibited_actions)

    def test_fatwa_boundary_is_active(self) -> None:
        decision, _ = evaluate("Apakah produk ini haram? Beri fatwa final.")
        result = decision.get_policy("islamic_boundary")
        self.assertIsNotNone(result)
        self.assertTrue(result.blocks_response)
        self.assertIn("give_final_fatwa", decision.prohibited_actions)

    def test_unknown_halal_is_not_converted_to_halal_or_haram(self) -> None:
        decision, _ = evaluate("Apakah produk ini halal?")
        result = decision.get_policy("halal_thayyib")
        self.assertEqual(result.metadata["halal_status"], "unknown")
        self.assertIn("tidak berarti halal", result.message.lower())
        self.assertIn("tidak pula berarti haram", result.message.lower())
        self.assertIn("assert_halal", decision.prohibited_actions)
        self.assertIn("assert_haram", decision.prohibited_actions)

    def test_self_declared_differs_from_verified(self) -> None:
        policy = HalalThayyibPolicy()
        base = {
            "question": "Apakah halal?",
            "normalized_question": "apakah halal",
            "intent": "product_claim",
            "safety_level": "medium",
        }
        self_declared = policy.evaluate(
            PolicyContext(**base, metadata={"halalStatus": "self_declared"})
        )
        verified = policy.evaluate(
            PolicyContext(
                **base,
                metadata={
                    "halalStatus": "verified",
                    "halalAuthority": "Lembaga resmi",
                    "halalCertificateNumber": "CERT-1",
                },
            )
        )
        self.assertEqual(self_declared.metadata["halal_status"], "self_declared")
        self.assertEqual(verified.metadata["halal_status"], "verified")
        self.assertNotEqual(self_declared.message, verified.message)

    def test_verified_without_evidence_degrades_to_unknown(self) -> None:
        decision, _ = evaluate(
            "Apakah produk ini halal?",
            metadata={"halalStatus": "verified"},
        )
        result = decision.get_policy("halal_thayyib")
        self.assertEqual(result.metadata["halal_status"], "unknown")
        self.assertIn("verified_status_missing_checkable_evidence", result.reasons)

    def test_healing_claim_is_blocked(self) -> None:
        decision, _ = evaluate("Herbal ini pasti menyembuhkan hipertensi.")
        result = decision.get_policy("product_claims")
        self.assertIsNotNone(result)
        self.assertTrue(result.blocks_response)
        self.assertIn("claim_cure", decision.prohibited_actions)

    def test_safe_education_intent_can_show_article(self) -> None:
        decision, intent = evaluate("Saya ingin baca artikel edukasi kesehatan.")
        actions = build_actions(intent["intent"], decision)
        self.assertEqual(intent["intent"], "article_search")
        self.assertTrue(any("articles" in action["href"] for action in actions))

    def test_vitacheck_remains_low_risk_and_non_diagnostic(self) -> None:
        decision, intent = evaluate("Bagaimana cara memakai VitaCheck?")
        answer = build_answer(intent["intent"], intent["safetyLevel"], decision)
        self.assertEqual(intent["safetyLevel"], "low")
        self.assertIn("bukan alat diagnosis", answer.lower())
        self.assertIn("bukan penilai kadar iman", answer.lower())

    def test_multiple_policies_can_be_active(self) -> None:
        decision, _ = evaluate(
            "Saya hamil. Apakah herbal ini halal dan bisa menyembuhkan hipertensi?"
        )
        ids = {result.policy_id for result in decision.results}
        self.assertIn("medical_safety", ids)
        self.assertIn("halal_thayyib", ids)
        self.assertIn("product_claims", ids)
        self.assertGreaterEqual(len(ids), 3)

    def test_results_are_sorted_by_priority(self) -> None:
        decision, _ = evaluate(
            "Saya hamil. Apakah herbal ini halal dan bisa menyembuhkan hipertensi?"
        )
        priorities = [result.priority for result in decision.results]
        self.assertEqual(priorities, sorted(priorities, reverse=True))

    def test_blocker_does_not_remove_other_warnings(self) -> None:
        decision, _ = evaluate(
            "Apakah produk alami ini halal dan pasti menyembuhkan diabetes?"
        )
        self.assertTrue(decision.response_blocked)
        self.assertGreaterEqual(len(decision.warnings), 2)
        self.assertIsNotNone(decision.get_policy("halal_thayyib"))
        self.assertIsNotNone(decision.get_policy("product_claims"))

    def test_products_do_not_appear_during_emergency(self) -> None:
        decision, intent = evaluate("Saya nyeri dada. Produk mana yang cocok?")
        actions = build_actions(intent["intent"], decision)
        self.assertEqual(actions, [])
        self.assertIn("show_products", decision.prohibited_actions)

    def test_policy_failure_uses_safe_fallback(self) -> None:
        class BrokenPolicy(BasePolicy):
            policy_id = "broken_policy"
            domain = "content_integrity"

            def evaluate(self, context: PolicyContext):
                raise RuntimeError("boom")

        engine = PolicyEngine((BrokenPolicy(), MedicalSafetyPolicy()))
        decision = engine.evaluate(
            PolicyContext(
                question="Baca artikel",
                normalized_question="baca artikel",
                intent="article_search",
                safety_level="low",
            )
        )
        self.assertTrue(
            any(
                result.policy_id == "policy_engine_failure.broken_policy"
                for result in decision.results
            )
        )
        self.assertIn("use_safe_fallback", decision.allowed_actions)

    def test_invalid_policy_result_is_rejected_safely(self) -> None:
        class InvalidPolicy(BasePolicy):
            policy_id = "valid_registry_id"
            domain = "content_integrity"

            def evaluate(self, context: PolicyContext):
                return PolicyResult(
                    policy_id="wrong_result_id",
                    domain="content_integrity",
                    status="inform",
                    priority=520,
                )

        decision = PolicyEngine((InvalidPolicy(),)).evaluate(
            PolicyContext(
                question="test",
                normalized_question="test",
                intent="fallback",
                safety_level="low",
            )
        )
        self.assertEqual(
            decision.results[0].policy_id,
            "policy_engine_failure.valid_registry_id",
        )
        self.assertIn("assume_policy_passed", decision.prohibited_actions)

    def test_registry_rejects_duplicate_policy_ids(self) -> None:
        with self.assertRaises(ValueError):
            validate_registry((MedicalSafetyPolicy(), MedicalSafetyPolicy()))

    def test_ask_endpoint_contract_is_backward_compatible(self) -> None:
        response = ask_ai(
            AskRequest(
                question="Saya sesak berat setelah minum produk ini. Apakah halal?"
            )
        )
        payload = response.model_dump()
        for old_field in (
            "question",
            "intent",
            "safetyLevel",
            "answer",
            "disclaimer",
            "recommendedAction",
            "actions",
            "sources",
            "quranicReflection",
        ):
            self.assertIn(old_field, payload)
        self.assertIn("policyDecision", payload)
        self.assertEqual(
            payload["policyDecision"]["dominantPolicy"],
            "medical_safety",
        )
        self.assertEqual(payload["actions"], [])


if __name__ == "__main__":
    unittest.main()
