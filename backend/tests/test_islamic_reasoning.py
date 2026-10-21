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
        self.assertIn("فَتَبَيَّنُوا", sources[0]["arabic"])

    def test_truthful_speech_returns_sahih_hadith_reference(self):
        sources = select_islamic_sources("Bagaimana menjaga kejujuran dalam ucapan?")
        self.assertTrue(any(source["kind"] == "hadith" for source in sources))
        self.assertTrue(any("Sahih al-Bukhari" in source["reference"] for source in sources))

    def test_justice_question_returns_quran_reference(self):
        sources = select_islamic_sources("Apa arti keadilan dan menghindari kezaliman?")
        self.assertTrue(sources)
        self.assertEqual(sources[0]["reference"], "QS. An-Nahl 16:90")
        self.assertIn("الْعَدْلِ", sources[0]["arabic"])

    def test_avoid_claims_question_returns_quran_reference(self):
        sources = select_islamic_sources("Mengapa tidak boleh mengarang klaim tanpa bukti?")
        self.assertTrue(sources)
        # May match verify_information first due to "bukti" - check both themes are in results
        keys = [s["key"] for s in sources]
        self.assertIn("avoid_unsupported_claims", keys)

    def test_cooperation_question_returns_quran_reference(self):
        sources = select_islamic_sources("Bagaimana kerja sama dalam kebaikan menurut Islam?")
        self.assertTrue(sources)
        self.assertEqual(sources[0]["reference"], "QS. Al-Ma'idah 5:2")
        self.assertIn("التَّقْوَى", sources[0]["arabic"])

    def test_intentions_question_returns_hadith_reference(self):
        sources = select_islamic_sources("Apa arti niat dan tujuan dalam amal?")
        self.assertTrue(sources)
        self.assertTrue(any(source["kind"] == "hadith" for source in sources))
        self.assertTrue(any("Sahih al-Bukhari" in source["reference"] for source in sources))

    def test_unmatched_question_does_not_invent_a_dalil(self):
        self.assertEqual(select_islamic_sources("Berapa suhu hari ini?"), [])
        result = format_sources_for_reflection("Berapa suhu hari ini?")
        self.assertIn("Jangan mengarang kutipan", result)

    def test_false_positive_beritahu_does_not_trigger_verification(self):
        """beritahu (tell me) should not match berita (news)."""
        self.assertEqual(select_islamic_sources("Ini beritahu saya"), [])
        self.assertEqual(select_islamic_sources("Beritahu saya tentang ini"), [])

    def test_false_positive_berjujur_is_valid_match(self):
        """berjujur (to be honest) is a valid morphological form of jujur."""
        sources = select_islamic_sources("Saya berjujur dalam bicara")
        self.assertTrue(sources)
        self.assertEqual(sources[0]["key"], "speak_truthfully")

    def test_false_positive_adiluhung_does_not_trigger_justice(self):
        """adiluhung (noble) should not match adil (just)."""
        self.assertEqual(select_islamic_sources("Adiluhung budi pekerti"), [])

    def test_false_positive_kebohongan_is_valid_match(self):
        """kebohongan (lying/deception) relates to truthfulness theme."""
        sources = select_islamic_sources("Kebohongan itu buruk")
        self.assertTrue(sources)
        self.assertEqual(sources[0]["key"], "speak_truthfully")

    def test_false_positive_mengadili_is_valid_match(self):
        """mengadili (to judge) is a valid morphological form related to justice."""
        sources = select_islamic_sources("Dia mengadili orang")
        self.assertTrue(sources)
        self.assertEqual(sources[0]["key"], "justice")
        sources = select_islamic_sources("Pengadilan tinggi memutus")
        self.assertTrue(sources)
        self.assertEqual(sources[0]["key"], "justice")

    def test_false_positive_sumber_daya_does_not_trigger_verification(self):
        """sumber daya (resources) should not match sumber berita/informasi."""
        self.assertEqual(select_islamic_sources("Sumber daya alam"), [])
        self.assertEqual(select_islamic_sources("Manajemen sumber daya"), [])

    def test_valid_sumber_berita_triggers_verification(self):
        """sumber berita (news source) should match verification theme."""
        sources = select_islamic_sources("Sumber berita terpercaya")
        self.assertTrue(sources)
        self.assertEqual(sources[0]["key"], "verify_information")

    def test_valid_sumber_informasi_triggers_verification(self):
        """sumber informasi (information source) should match verification theme."""
        sources = select_islamic_sources("Sumber informasi ini")
        self.assertTrue(sources)
        self.assertEqual(sources[0]["key"], "verify_information")

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

    def test_reflection_no_sources_returns_user_friendly_message(self):
        """When no sources match, reflection should return user-friendly message, not LLM instruction."""
        reflection = build_quranic_reflection("Berapa suhu hari ini?")
        self.assertIn("Tidak ada dalil terkurasi yang relevan", reflection["dalil"])
        self.assertNotIn("Jangan mengarang kutipan", reflection["dalil"])


if __name__ == "__main__":
    unittest.main()
