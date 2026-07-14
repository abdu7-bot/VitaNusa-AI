from __future__ import annotations

import asyncio
import unittest

from app.intent_router import detect_intent
from app.main import ask_ai
from app.policy_engine import POLICY_ENGINE
from app.responses import build_answer
from app.schemas import AskRequest


def ask(question: str):
    """Run the same path as the /ask endpoint, without going over HTTP."""
    return asyncio.run(ask_ai(AskRequest(question=question)))


class GreetingIntentTests(unittest.TestCase):
    def test_pure_greeting_is_not_health_general(self) -> None:
        for question in ("Assalamualaikum", "assalamu'alaikum", "Halo", "Hai", "Selamat pagi"):
            with self.subTest(question=question):
                result = detect_intent(question)
                self.assertEqual(result["intent"], "greeting")
                self.assertNotEqual(result["intent"], "health_general")

    def test_assalamualaikum_does_not_trigger_mual_keyword(self) -> None:
        # Regression test for the "mual" substring hiding inside
        # "assalamualaikum" (as-sala-MUAL-aikum).
        result = detect_intent("Assalamualaikum")
        self.assertEqual(result["intent"], "greeting")
        self.assertEqual(result["safetyLevel"], "low")

    def test_greeting_answer_has_no_medical_template(self) -> None:
        response = ask("Assalamualaikum")
        self.assertEqual(response.intent, "greeting")
        self.assertNotIn("istirahat cukup", response.answer.lower())
        self.assertNotIn("makan ringan", response.answer.lower())
        self.assertNotIn("air secara wajar", response.answer.lower())

    def test_greeting_plus_complaint_still_classifies_the_complaint(self) -> None:
        # "mual" here is a real, standalone word (a genuine complaint), not a
        # substring collision, so it must still be classified normally.
        result = detect_intent("Assalamualaikum, perut saya mual sejak pagi.")
        self.assertEqual(result["intent"], "health_general")
        self.assertTrue(result["greetingPrefix"])

    def test_greeting_plus_complaint_answer_greets_then_answers_complaint(self) -> None:
        response = ask("Assalamualaikum, perut saya mual sejak pagi.")
        self.assertEqual(response.intent, "health_general")
        self.assertTrue(response.answer.lower().startswith("waalaikumsalam warahmatullahi"))
        self.assertIn("istirahat cukup", response.answer.lower())

    def test_greeting_does_not_leak_into_medication_or_product_flows(self) -> None:
        result = detect_intent("Halo, tolong kasih tahu dosis obat untuk saya.")
        self.assertEqual(result["intent"], "medication_request")
        self.assertTrue(result["greetingPrefix"])


class ConversationCorrectionTests(unittest.TestCase):
    def test_correction_phrases_are_recognized(self) -> None:
        for question in ("Gak nyambung", "bukan itu maksud saya", "jawabanmu salah"):
            with self.subTest(question=question):
                result = detect_intent(question)
                self.assertEqual(result["intent"], "conversation_correction")

    def test_correction_answer_apologizes_and_asks_to_clarify(self) -> None:
        response = ask("Gak nyambung jawabannya")
        self.assertEqual(response.intent, "conversation_correction")
        answer = response.answer.lower()
        self.assertIn("maaf", answer)
        self.assertIn("perjelas", answer)
        self.assertNotIn("istirahat cukup", answer)
        self.assertNotIn("dosis", answer)


class HealthAndMedicationIntentsRemainDistinctTests(unittest.TestCase):
    def test_general_health_complaint_still_uses_health_template(self) -> None:
        result = detect_intent("Perut saya sakit dan mual sejak tadi malam.")
        self.assertEqual(result["intent"], "health_general")
        answer = build_answer(result["intent"], result["safetyLevel"])
        self.assertIn("istirahat cukup", answer.lower())

    def test_medication_request_is_not_confused_with_greeting_or_health(self) -> None:
        result = detect_intent("Dosis obat untuk anak berapa ya?")
        self.assertEqual(result["intent"], "medication_request")
        self.assertNotEqual(result["intent"], "greeting")
        self.assertNotEqual(result["intent"], "health_general")


class EmergencyPriorityTests(unittest.TestCase):
    def test_emergency_wins_even_with_greeting_and_correction_wording(self) -> None:
        result = detect_intent(
            "Assalamualaikum, ini gak nyambung tapi saya sesak napas berat dan nyeri dada."
        )
        self.assertEqual(result["intent"], "danger_sign")
        self.assertEqual(result["safetyLevel"], "emergency")
        self.assertFalse(result["greetingPrefix"])

    def test_emergency_answer_has_no_greeting_or_correction_prefix(self) -> None:
        response = ask("Sesak napas berat dan nyeri dada, tolong.")
        self.assertEqual(response.intent, "danger_sign")
        self.assertEqual(response.safetyLevel, "emergency")
        self.assertTrue(response.answer.startswith("Keluhan seperti ini termasuk tanda bahaya."))

    def test_emergency_dominant_policy_is_unaffected_by_fix(self) -> None:
        intent_result = detect_intent("Saya pingsan mendadak.")
        decision = POLICY_ENGINE.evaluate_question(
            "Saya pingsan mendadak.",
            intent=intent_result["intent"],
            safety_level=intent_result["safetyLevel"],
        )
        self.assertEqual(decision.dominant_policy.policy_id, "medical_safety")
        self.assertEqual(decision.dominant_policy.status, "critical")


class AskEndpointContractTests(unittest.TestCase):
    def test_ask_response_contract_unchanged_for_greeting(self) -> None:
        response = ask("Halo")
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
            "policyDecision",
        ):
            self.assertIn(old_field, payload)


class GeneralChatIntentTests(unittest.TestCase):
    def test_unmatched_question_becomes_general_chat_not_defensive_fallback(self) -> None:
        result = detect_intent("Mengapa langit pagi terasa tenang?")
        self.assertEqual(result["intent"], "general_chat")
        self.assertEqual(result["safetyLevel"], "low")

    def test_general_chat_answer_is_warm_and_still_safe(self) -> None:
        response = ask("Ceritakan tentang sejarah nusantara ya.")
        self.assertEqual(response.intent, "general_chat")
        answer = response.answer.lower()
        self.assertIn("senang mengobrol", answer)
        # Must still steer risky follow-ups toward the safety-reviewed paths.
        self.assertIn("hati-hati", answer)

    def test_health_keywords_still_bypass_general_chat(self) -> None:
        # A general-sounding question that contains a real safety-relevant
        # keyword must still be routed by its specific intent, never
        # swallowed by the new general_chat catch-all.
        result = detect_intent("Kenapa ya saya pusing terus dari kemarin?")
        self.assertEqual(result["intent"], "health_general")


class ConversationMemoryTests(unittest.TestCase):
    def test_ask_without_session_id_still_returns_one(self) -> None:
        response = ask("Halo")
        self.assertTrue(response.sessionId)

    def test_same_session_id_is_echoed_back(self) -> None:
        response = asyncio.run(
            ask_ai(AskRequest(question="Halo", sessionId="test-session-abc"))
        )
        self.assertEqual(response.sessionId, "test-session-abc")

    def test_history_is_recorded_and_scoped_per_session(self) -> None:
        from app.conversation_memory import CONVERSATION_MEMORY

        session_a = "memory-test-session-a"
        session_b = "memory-test-session-b"

        asyncio.run(ask_ai(AskRequest(question="Halo", sessionId=session_a)))
        asyncio.run(
            ask_ai(AskRequest(question="Apa itu VitaCheck?", sessionId=session_a))
        )

        history_a = CONVERSATION_MEMORY.get_history(session_a)
        history_b = CONVERSATION_MEMORY.get_history(session_b)

        self.assertEqual(len(history_a), 2)
        self.assertEqual(history_a[0].question, "Halo")
        self.assertEqual(history_a[1].intent, "vitacheck")
        self.assertEqual(history_b, [])

    def test_history_never_overrides_a_fresh_safety_decision(self) -> None:
        # Even if a prior turn in the same session was a low-risk greeting,
        # a later emergency message in the same session must still be
        # classified as an emergency on its own merits.
        session_id = "memory-test-session-safety"
        asyncio.run(ask_ai(AskRequest(question="Halo", sessionId=session_id)))
        response = asyncio.run(
            ask_ai(
                AskRequest(
                    question="Sesak napas berat dan nyeri dada, tolong.",
                    sessionId=session_id,
                )
            )
        )
        self.assertEqual(response.intent, "danger_sign")
        self.assertEqual(response.safetyLevel, "emergency")


if __name__ == "__main__":
    unittest.main()
