import unittest

from fastapi.testclient import TestClient

from app.health_navigator import check_navigator, list_topics
from app.intent_router import detect_intent
from app.main import app
from app.trusted_sources import EVIDENCE_REFERENCES, SOURCE_MAP, evidence_for_navigator


class HealthNavigatorTests(unittest.TestCase):
    def test_topics_are_explicit_and_small(self) -> None:
        topics = list_topics()
        self.assertEqual(len(topics), 5)
        self.assertEqual(topics[0]["key"], "demam")

    def test_every_public_topic_has_evidence(self) -> None:
        for topic in list_topics():
            evidence = evidence_for_navigator(topic["key"])
            self.assertTrue(evidence, topic["key"])
            for item in evidence:
                self.assertIn(item["sourceKey"], SOURCE_MAP)
                self.assertTrue(item["url"].startswith("https://"))

    def test_evidence_registry_has_no_unknown_sources(self) -> None:
        for evidence in EVIDENCE_REFERENCES:
            self.assertIn(evidence.source_key, SOURCE_MAP)
            self.assertTrue(evidence.url.startswith("https://"))

    def test_emergency_always_wins(self) -> None:
        result = check_navigator("batuk", "Saya batuk dan sesak berat, dada terasa berat.")
        self.assertEqual(result["status"], "red_flag")
        self.assertEqual(result["scope"], "emergency-first")
        self.assertTrue(result["matchedFlags"])

    def test_global_red_flag_stays_emergency_first(self) -> None:
        result = check_navigator("sakit kepala", "saya sakit kepala dan bicara pelo")
        self.assertEqual(result["status"], "red_flag")
        self.assertEqual(result["scope"], "emergency-first")
        self.assertIn("bicara pelo", result["matchedFlags"])
        self.assertIn("darurat", result["action"])

    def test_normal_question_stays_education_only(self) -> None:
        result = check_navigator("demam", "demam ringan sejak pagi")
        self.assertEqual(result["status"], "education")
        self.assertEqual(result["scope"], "education-only")

    def test_high_risk_keyword_routes_to_professional(self) -> None:
        result = check_navigator("", "saya sedang hamil dan ingin tahu apa yang aman")
        self.assertEqual(result["status"], "high_risk")
        self.assertEqual(result["scope"], "high-risk")

    def test_nusa_routes_common_symptom_to_navigator(self) -> None:
        result = detect_intent("Saya demam sejak kemarin")
        self.assertEqual(result["intent"], "health_navigator")
        self.assertEqual(result["navigatorTopic"], "demam")

    def test_emergency_does_not_become_navigator(self) -> None:
        result = detect_intent("Saya batuk darah dan sesak berat")
        self.assertEqual(result["intent"], "danger_sign")
        self.assertIsNone(result["navigatorTopic"])

    def test_high_risk_navigator_keeps_high_risk_classification(self) -> None:
        result = detect_intent("Saya hamil dan demam")
        self.assertEqual(result["intent"], "health_navigator")
        self.assertEqual(result["navigatorTopic"], "demam")
        self.assertEqual(result["safetyLevel"], "high")

    def test_medication_request_is_not_navigator(self) -> None:
        result = detect_intent("Berapa dosis obat untuk demam saya?")
        self.assertEqual(result["intent"], "medication_request")

    def test_ask_uses_navigator_red_flag_result(self) -> None:
        client = TestClient(app)
        response = client.post("/ask", json={"question": "Saya batuk dan sesak berat"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["intent"], "health_navigator")
        self.assertIn("tanda bahaya", payload["answer"].lower())
        self.assertIn("darurat", payload["answer"].lower())
        self.assertTrue(payload["sources"])


if __name__ == "__main__":
    unittest.main()
