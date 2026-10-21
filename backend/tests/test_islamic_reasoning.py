import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.islamic_reasoning import format_sources_for_reflection, select_islamic_sources
from app.responses import build_quranic_reflection


class IslamicReasoningTests(unittest.TestCase):
    def test_verification_question_returns_quran_reference(self):
        sources = select_islamic_sources("Bagaimana memverifikasi berita dan sumber informasi?")
        self.assertTrue(sources)
        self.assertEqual(sources[0]["reference"], "QS. Al-Hujurat 49:6")
        self.assertIn("تَفَيَّنُوا", sources[0]["arabic"])

    def test_truthful_speech_returns_sahih_hadith_reference(self):
        sources = select_islamic_sources("Bagaimana menjaga kejujuran dalam ucapan?")
        self.assertTrue(any(source["kind"] == "hadith" for source in sources))
        self.assertTrue(any("Sahih al-Bukhari" in source["reference"] for source in sources))

    def test_unmatched_question_does_not_invent_a_dalil(self):
        self.assertEqual(select_islamic_sources("Berapa suhu hari ini?"), [])
        result = format_sources_for_reflection("Berapa suhu hari ini?")
        self.assertIn("Jangan mengarang kutipan", result)

    def test_limit_is_respected(self):
        sources = select_islamic_sources(
            "Bagaimana memverifikasi berita dengan jujur, adil, dan penuh amanah?",
            limit=1,
        )
        self.assertLessEqual(len(sources), 1)

    def test_reflection_marks_dalil_as_not_a_fatwa(self):
        reflection = build_quranic_reflection("Bagaimana memverifikasi berita?")
        self.assertIn("QS. Al-Hujurat 49:6", reflection["dalil"])
        self.assertIn("bukan fatwa", reflection["method"])


if __name__ == "__main__":
    unittest.main()
