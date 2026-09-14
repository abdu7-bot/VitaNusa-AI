import unittest

from app.health_navigator import check_navigator, list_topics


class HealthNavigatorTests(unittest.TestCase):
    def test_topics_are_explicit_and_small(self) -> None:
        topics = list_topics()
        self.assertEqual(len(topics), 5)
        self.assertEqual(topics[0]["key"], "demam")

    def test_emergency_always_wins(self) -> None:
        result = check_navigator("batuk", "Saya batuk dan sesak berat, dada terasa berat.")
        self.assertEqual(result["status"], "red_flag")
        self.assertEqual(result["scope"], "emergency-first")
        self.assertTrue(result["matchedFlags"])

    def test_topic_red_flag_is_not_diagnosis(self) -> None:
        result = check_navigator("sakit kepala", "saya sakit kepala dan bicara pelo")
        self.assertEqual(result["status"], "red_flag")
        self.assertEqual(result["scope"], "topic-red-flag")
        self.assertIn("bicara pelo", result["matchedFlags"])
        self.assertIn("bukan diagnosis", result["action"])

    def test_normal_question_stays_education_only(self) -> None:
        result = check_navigator("demam", "demam ringan sejak pagi")
        self.assertEqual(result["status"], "education")
        self.assertEqual(result["scope"], "education-only")

    def test_high_risk_keyword_routes_to_professional(self) -> None:
        result = check_navigator("", "saya sedang hamil dan ingin tahu apa yang aman")
        self.assertEqual(result["status"], "high_risk")
        self.assertEqual(result["scope"], "high-risk")


if __name__ == "__main__":
    unittest.main()
