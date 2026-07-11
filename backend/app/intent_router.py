import re
import unicodedata

from .safety import EMERGENCY_KEYWORDS, classify_risk, contains_any


INTENT_KEYWORDS = {
    "identity": (
        "aplikasi apa ini",
        "ini aplikasi apa",
        "vitanusa ai itu apa",
        "nusa ai itu apa",
        "nusa ai untuk apa",
        "fungsi vitanusa",
        "website ini untuk apa",
    ),
    "vitacheck": (
        "vitacheck",
        "vita check",
        "cek kesehatan",
        "cek kebiasaan",
        "skor sehat",
    ),
    "article_search": (
        "artikel",
        "edukasi",
        "baca",
        "info kesehatan",
    ),
    "health_general": (
        "sakit perut",
        "pusing",
        "sakit kepala",
        "mual",
        "batuk",
        "pilek",
        "tidur",
        "lelah",
        "capek",
        "makan",
        "pencernaan",
    ),
    "medication_request": (
        "dosis",
        "dosis obat",
        "resep obat",
        "obat resep",
        "berikan obat",
        "obat apa",
        "minum obat apa",
    ),
    "product_claim": (
        "produk",
        "herbal",
        "suplemen",
        "propolis",
        "langfit",
        "deto",
        "klaim",
        "menyembuhkan",
        "obat",
    ),
    "quranic_reflection": (
        "ayat",
        "al quran",
        "alquran",
        "quran",
        "refleksi",
        "hikmah sakit",
        "tawakal",
        "ikhtiar",
    ),
    "contact_admin": (
        "kontak",
        "whatsapp",
        "wa",
        "admin",
        "konsultasi admin",
    ),
}


def normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFKD", value.lower())
    text = text.replace("qur'an", "quran").replace("qur’an", "quran")
    text = text.replace("'", " ").replace("`", " ").replace("’", " ")
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def detect_intent(question: str) -> dict:
    text = normalize_text(question)

    if contains_any(text, EMERGENCY_KEYWORDS):
        intent = "danger_sign"
    else:
        intent = "fallback"
        for candidate, keywords in INTENT_KEYWORDS.items():
            if contains_any(text, keywords):
                intent = candidate
                break

    safety = classify_risk(text, intent)

    return {
        "intent": intent,
        "safetyLevel": safety.safetyLevel,
        "recommendedAction": safety.recommendedAction,
    }
