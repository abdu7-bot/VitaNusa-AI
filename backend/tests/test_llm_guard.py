from __future__ import annotations

import unittest

from app.intent_router import detect_intent
from app.llm.guard import (
    LlmGuardContext,
    build_guard_context,
    evaluate_llm_guard,
    validate_llm_response,
)
from app.llm.models import LlmRequest, LlmResponse
from app.llm.prompts import build_system_prompt
from app.policy_engine import POLICY_ENGINE


def safe_request() -> LlmRequest:
    return LlmRequest(
        system_prompt="Patuhi seluruh keputusan policy aplikasi.",
        user_message="Jelaskan VitaCheck.",
    )


def safe_context(**updates) -> LlmGuardContext:
    values = {
        "response_blocked": False,
        "intent": "vitacheck",
        "safety_level": "low",
    }
    values.update(updates)
    return LlmGuardContext(**values)


class LlmGuardTests(unittest.TestCase):
    def test_response_blocked_prevents_llm_execution(self) -> None:
        result = evaluate_llm_guard(
            safe_context(response_blocked=True),
            safe_request(),
        )
        self.assertFalse(result.allowed)
        self.assertEqual(result.reason, "policy_response_blocked")

    def test_emergency_intent_prevents_llm_execution(self) -> None:
        result = evaluate_llm_guard(
            safe_context(intent="danger_sign"),
            safe_request(),
        )
        self.assertFalse(result.allowed)
        self.assertEqual(result.reason, "emergency_response_required")

    def test_emergency_safety_level_prevents_llm_execution(self) -> None:
        result = evaluate_llm_guard(
            safe_context(safety_level="emergency"),
            safe_request(),
        )
        self.assertFalse(result.allowed)
        self.assertEqual(result.reason, "emergency_response_required")

    def test_policy_can_prohibit_generative_response(self) -> None:
        result = evaluate_llm_guard(
            safe_context(prohibited_actions=["use_generative_response"]),
            safe_request(),
        )
        self.assertFalse(result.allowed)
        self.assertEqual(result.reason, "generative_response_prohibited")

    def test_empty_request_prevents_llm_execution(self) -> None:
        empty = LlmRequest.model_construct(system_prompt="", user_message="")
        result = evaluate_llm_guard(safe_context(), empty)
        self.assertFalse(result.allowed)
        self.assertEqual(result.reason, "empty_llm_request")

    def test_guard_preserves_policy_context(self) -> None:
        context = safe_context(
            allowed_actions=["provide_general_education"],
            prohibited_actions=["give_diagnosis", "give_personal_dose"],
            warnings=["Peringatan policy harus tetap tersedia."],
            recommended_action="Cari bantuan profesional bila diperlukan.",
        )
        result = evaluate_llm_guard(context, safe_request())

        self.assertTrue(result.allowed)
        self.assertEqual(result.context, context)
        self.assertEqual(result.context.warnings, context.warnings)
        self.assertEqual(result.context.prohibited_actions, context.prohibited_actions)
        self.assertEqual(result.context.recommended_action, context.recommended_action)

    def test_guard_context_uses_existing_policy_decision(self) -> None:
        question = "Berikan dosis obat resep untuk saya."
        intent = detect_intent(question)
        decision = POLICY_ENGINE.evaluate_question(
            question,
            intent=intent["intent"],
            safety_level=intent["safetyLevel"],
        )
        context = build_guard_context(
            decision,
            intent=intent["intent"],
            safety_level=intent["safetyLevel"],
        )

        self.assertTrue(context.response_blocked)
        self.assertEqual(context.dominant_policy, "medical_safety")
        self.assertIn("give_personal_dose", context.prohibited_actions)
        self.assertEqual(context.warnings, list(decision.warnings))

    def test_system_prompt_keeps_policy_restrictions_and_warnings(self) -> None:
        context = safe_context(
            prohibited_actions=["give_diagnosis", "give_final_fatwa"],
            warnings=["Jangan menghapus warning aplikasi."],
            recommended_action="Ikuti tindakan aman dari aplikasi.",
        )
        prompt = build_system_prompt(context)

        self.assertIn("give_diagnosis", prompt)
        self.assertIn("give_final_fatwa", prompt)
        self.assertIn("Jangan menghapus warning aplikasi.", prompt)
        self.assertIn("Ikuti tindakan aman dari aplikasi.", prompt)
        self.assertIn("tidak boleh diubah", prompt)


class LlmPostResponseValidationTests(unittest.TestCase):
    def response(self, content: str, status: str = "success") -> LlmResponse:
        return LlmResponse(
            provider="ollama",
            content=content,
            status=status,
        )

    def test_empty_content_is_rejected(self) -> None:
        result = validate_llm_response(self.response("   "))
        self.assertEqual(result.status, "empty")
        self.assertEqual(result.content, "")

    def test_clear_violations_are_blocked_and_removed(self) -> None:
        unsafe_outputs = (
            "Anda pasti menderita diabetes.",
            "Diagnosisnya adalah hipertensi.",
            "Segera hentikan obat dokter.",
            "Minum obat ini 50 mg setiap hari.",
            "Produk ini pasti sembuh dan menyembuhkan semua penyakit.",
            "Produk ini 100% aman.",
            "Produk ini sudah bersertifikat halal.",
            "Produk ini halal.",
            "Produk ini terdaftar di BPOM.",
            "Dosis resepnya adalah 25 mg.",
            "Berhenti minum obat sekarang.",
            "Produk ini pasti halal.",
            "Produk ini sudah pasti terdaftar BPOM.",
            "Produk ini pasti menyembuhkan diabetes.",
            "Produk ini 100% aman untuk semua orang.",
            "Hentikan obat dokter mulai sekarang.",
            "Minum obat resep ini sebanyak tiga tablet.",
        )

        for content in unsafe_outputs:
            with self.subTest(content=content):
                result = validate_llm_response(self.response(content))
                self.assertEqual(result.status, "blocked")
                self.assertEqual(result.content, "")
                self.assertEqual(result.error_code, "response_validation_blocked")

    def test_clear_safety_negations_are_not_false_positives(self) -> None:
        safe_outputs = (
            "Saya tidak dapat memastikan produk ini halal.",
            "Saya tidak dapat memastikan produk ini terdaftar BPOM.",
            "Jangan percaya klaim bahwa produk pasti sembuh.",
            "Tidak ada produk yang dapat dijamin 100% aman untuk semua orang.",
            "Saya tidak dapat memberikan dosis obat resep.",
        )

        for content in safe_outputs:
            with self.subTest(content=content):
                result = validate_llm_response(self.response(content))
                self.assertEqual(result.status, "success")
                self.assertEqual(result.content, content)

    def test_negation_with_reversal_remains_blocked(self) -> None:
        unsafe_compounds = (
            (
                "Saya tidak dapat memastikan produk ini halal, tetapi sebenarnya "
                "produk ini pasti halal."
            ),
            (
                "Saya tidak dapat memastikan produk ini halal, minum obat resep "
                "ini sebanyak tiga tablet."
            ),
            (
                "Saya tidak dapat memastikan produk ini halal dan produk ini "
                "pasti menyembuhkan diabetes."
            ),
        )

        for content in unsafe_compounds:
            with self.subTest(content=content):
                result = validate_llm_response(self.response(content))
                self.assertEqual(result.status, "blocked")
                self.assertEqual(result.content, "")

    def test_religious_ruling_is_blocked_when_policy_prohibits_it(self) -> None:
        result = validate_llm_response(
            self.response("Hukumnya adalah haram."),
            prohibited_actions=["give_final_fatwa"],
        )
        self.assertEqual(result.status, "blocked")
        self.assertEqual(result.content, "")

    def test_personal_product_recommendation_uses_policy_signal(self) -> None:
        result = validate_llm_response(
            self.response("Produk yang cocok untuk kamu adalah produk X."),
            prohibited_actions=["recommend_personal_product"],
        )
        self.assertEqual(result.status, "blocked")
        self.assertEqual(result.content, "")

    def test_safe_educational_response_passes(self) -> None:
        content = (
            "VitaCheck adalah alat refleksi kebiasaan dan bukan alat untuk memastikan "
            "kondisi kesehatan seseorang."
        )
        result = validate_llm_response(self.response(content, status="mock"))
        self.assertEqual(result.status, "mock")
        self.assertEqual(result.content, content)

    def test_failed_response_never_exposes_content(self) -> None:
        result = validate_llm_response(
            self.response("detail teknis internal", status="failed")
        )
        self.assertEqual(result.status, "failed")
        self.assertEqual(result.content, "")


if __name__ == "__main__":
    unittest.main()
