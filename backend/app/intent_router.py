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
        "klaim produk",
        "produk menyembuhkan",
        "produk mengobati",
        "janji sembuh",
        "testimoni produk",
        "produk ini obat",
        "klaim kesehatan",
        "apakah klaim ini benar",
        "menilai klaim",
        "cek klaim",
        "periksa klaim",
        "memeriksa klaim",
        "bisa menyembuhkan",
        "herbal",
        "suplemen",
        "propolis",
        "langfit",
        "deto",
        "klaim",
        "menyembuhkan",
        "obat",
        "halal",
        "haram",
        "thayyib",
        "thoyyib",
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
        "fatwa",
        "hukum agama",
    ),
    "contact_admin": (
        "kontak",
        "whatsapp",
        "wa",
        "admin",
        "konsultasi admin",
    ),
}


# Salam dan sapaan waktu. Dicocokkan sebagai kata/frasa utuh (lihat
# `contains_any` di `safety.py`) supaya "mual" di dalam "assalamualaikum"
# tidak pernah dianggap cocok dengan keyword lain, dan supaya salam murni
# dikenali sebagai obrolan biasa, bukan keluhan kesehatan.
ISLAMIC_GREETING_KEYWORDS = (
    "assalamualaikum",
    "assalamu alaikum",
    "waalaikumsalam",
    "wa alaikumsalam",
    "alaikumsalam",
)

GENERAL_GREETING_KEYWORDS = (
    "salam sejahtera",
    "syalom",
    "halo",
    "hallo",
    "hai",
    "hi",
    "hey",
    "permisi",
    "selamat pagi",
    "selamat siang",
    "selamat sore",
    "selamat malam",
)

GREETING_KEYWORDS = ISLAMIC_GREETING_KEYWORDS + GENERAL_GREETING_KEYWORDS

# Ungkapan koreksi percakapan: pengguna menyatakan jawaban sebelumnya tidak
# nyambung atau salah. Ini harus ditangani sebagai permintaan klarifikasi,
# bukan diproses ulang sebagai keluhan kesehatan atau fallback generik.
CORRECTION_KEYWORDS = (
    "gak nyambung",
    "ga nyambung",
    "gk nyambung",
    "tidak nyambung",
    "kurang nyambung",
    "enggak nyambung",
    "bukan itu maksud saya",
    "bukan itu maksudku",
    "bukan itu yang saya maksud",
    "bukan itu",
    "jawabanmu salah",
    "jawaban kamu salah",
    "jawaban salah",
    "salah jawab",
    "itu salah",
    "gak sesuai",
    "ga sesuai",
    "tidak sesuai",
    "gak nyambung sama pertanyaan",
    "ngawur",
)


def normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFKD", value.lower())
    text = text.replace("qur'an", "quran").replace("qur’an", "quran")
    text = text.replace("assalamu'alaikum", "assalamu alaikum")
    text = text.replace("assalamu’alaikum", "assalamu alaikum")
    text = text.replace("wa'alaikumsalam", "wa alaikumsalam")
    text = text.replace("wa’alaikumsalam", "wa alaikumsalam")
    text = text.replace("'", " ").replace("`", " ").replace("’", " ")
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def detect_intent(question: str) -> dict:
    text = normalize_text(question)

    is_emergency = contains_any(text, EMERGENCY_KEYWORDS)
    has_correction = False
    has_greeting = False
    is_islamic_greeting = False

    if is_emergency:
        # Keadaan darurat selalu mendapat prioritas tertinggi, tanpa
        # terpengaruh oleh salam atau ungkapan koreksi yang ikut disebutkan.
        intent = "danger_sign"
    else:
        has_correction = contains_any(text, CORRECTION_KEYWORDS)
        is_islamic_greeting = contains_any(text, ISLAMIC_GREETING_KEYWORDS)
        has_greeting = is_islamic_greeting or contains_any(text, GENERAL_GREETING_KEYWORDS)

        intent = "fallback"
        for candidate, keywords in INTENT_KEYWORDS.items():
            if contains_any(text, keywords):
                intent = candidate
                break

        if has_correction:
            intent = "conversation_correction"
        elif intent == "fallback" and has_greeting:
            intent = "greeting"

    safety = classify_risk(text, intent)

    # Salam yang menyertai keluhan/pertanyaan lain (mis. "Assalamualaikum,
    # perut saya mual") tetap harus diproses sesuai isi utamanya (intent,
    # klasifikasi risiko, dan kebijakan keselamatan tidak berubah), tapi
    # jawabannya perlu membuka dengan sapaan singkat. `greetingPrefix`
    # menandai kasus itu tanpa mengubah kontrak field lama.
    greeting_prefix = has_greeting and intent not in ("greeting", "danger_sign")

    return {
        "intent": intent,
        "safetyLevel": safety.safetyLevel,
        "recommendedAction": safety.recommendedAction,
        "greetingPrefix": greeting_prefix,
        "isIslamicGreeting": is_islamic_greeting,
    }
