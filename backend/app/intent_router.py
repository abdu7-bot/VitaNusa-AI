import re
import unicodedata

from .safety import EMERGENCY_KEYWORDS, classify_risk, contains_any


INTENT_KEYWORDS = {
    "identity": (
        "aplikasi apa ini", "ini aplikasi apa", "vitanusa ai itu apa", "nusa ai itu apa",
        "nusa ai untuk apa", "fungsi vitanusa", "website ini untuk apa",
    ),
    "vitacheck": ("vitacheck", "vita check", "cek kesehatan", "cek kebiasaan", "skor sehat"),
    "article_search": ("artikel", "edukasi", "baca", "info kesehatan"),
    "health_navigator": ("demam", "batuk", "sakit kepala", "pusing", "sakit perut", "diare"),
    "health_general": (
        "sakit perut", "pusing", "sakit kepala", "mual", "batuk", "pilek", "tidur",
        "lelah", "capek", "makan", "pencernaan",
    ),
    "medication_request": (
        "dosis", "dosis obat", "resep obat", "obat resep", "berikan obat", "obat apa", "minum obat apa",
    ),
    "product_claim": (
        "klaim produk", "produk menyembuhkan", "produk mengobati", "janji sembuh", "testimoni produk",
        "produk ini obat", "klaim kesehatan", "apakah klaim ini benar", "menilai klaim", "cek klaim",
        "periksa klaim", "memeriksa klaim", "bisa menyembuhkan", "herbal", "suplemen", "propolis",
        "langfit", "deto", "klaim", "menyembuhkan", "obat", "halal", "haram", "thayyib", "thoyyib",
    ),
    "quranic_reflection": (
        "ayat", "al quran", "alquran", "quran", "refleksi", "hikmah sakit", "tawakal", "ikhtiar",
        "fatwa", "hukum agama",
    ),
    "contact_admin": ("kontak", "whatsapp", "wa", "admin", "konsultasi admin"),
}

NAVIGATOR_TOPIC_KEYWORDS = {
    "demam": ("demam",),
    "batuk": ("batuk",),
    "sakit_kepala": ("sakit kepala", "pusing"),
    "sakit_perut": ("sakit perut",),
    "diare": ("diare",),
}

ISLAMIC_GREETING_KEYWORDS = (
    "assalamualaikum", "assalamu alaikum", "waalaikumsalam", "wa alaikumsalam", "alaikumsalam",
)
GENERAL_GREETING_KEYWORDS = (
    "salam sejahtera", "syalom", "halo", "hallo", "hai", "hi", "hey", "permisi",
    "selamat pagi", "selamat siang", "selamat sore", "selamat malam",
)
GREETING_KEYWORDS = ISLAMIC_GREETING_KEYWORDS + GENERAL_GREETING_KEYWORDS
CORRECTION_KEYWORDS = (
    "gak nyambung", "ga nyambung", "gk nyambung", "tidak nyambung", "kurang nyambung", "enggak nyambung",
    "bukan itu maksud saya", "bukan itu maksudku", "bukan itu yang saya maksud", "bukan itu",
    "jawabanmu salah", "jawaban kamu salah", "jawaban salah", "salah jawab", "itu salah", "gak sesuai",
    "ga sesuai", "tidak sesuai", "gak nyambung sama pertanyaan", "ngawur",
)


def normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFKD", value.lower())
    text = text.replace("qur'an", "quran").replace("qur’an", "quran")
    text = text.replace("assalamu'alaikum", "assalamu alaikum").replace("assalamu’alaikum", "assalamu alaikum")
    text = text.replace("wa'alaikumsalam", "wa alaikumsalam").replace("wa’alaikumsalam", "wa alaikumsalam")
    text = text.replace("'", " ").replace("`", " ").replace("’", " ")
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def detect_navigator_topic(text: str) -> str | None:
    for topic, keywords in NAVIGATOR_TOPIC_KEYWORDS.items():
        if contains_any(text, keywords):
            return topic
    return None


def detect_intent(question: str) -> dict:
    text = normalize_text(question)
    is_emergency = contains_any(text, EMERGENCY_KEYWORDS)
    has_correction = False
    has_greeting = False
    is_islamic_greeting = False
    navigator_topic = None

    if is_emergency:
        intent = "danger_sign"
    else:
        has_correction = contains_any(text, CORRECTION_KEYWORDS)
        is_islamic_greeting = contains_any(text, ISLAMIC_GREETING_KEYWORDS)
        has_greeting = is_islamic_greeting or contains_any(text, GENERAL_GREETING_KEYWORDS)

        intent = "general_chat"
        for candidate, keywords in INTENT_KEYWORDS.items():
            if contains_any(text, keywords):
                intent = candidate
                break

        # A symptom may appear together with a request for medicine, a product
        # claim, or a religious ruling. Those intents must keep precedence over
        # Navigator so that Navigator never becomes an accidental prescribing,
        # product, or fatwa route.
        if intent == "health_navigator":
            if contains_any(text, INTENT_KEYWORDS["medication_request"]):
                intent = "medication_request"
            elif contains_any(text, INTENT_KEYWORDS["product_claim"]):
                intent = "product_claim"
            elif contains_any(text, INTENT_KEYWORDS["quranic_reflection"]):
                intent = "quranic_reflection"
            else:
                navigator_topic = detect_navigator_topic(text)

        if has_correction:
            intent = "conversation_correction"
        elif intent == "general_chat" and has_greeting:
            intent = "greeting"

    safety = classify_risk(text, intent)
    greeting_prefix = has_greeting and intent not in ("greeting", "danger_sign")
    return {
        "intent": intent,
        "safetyLevel": safety.safetyLevel,
        "recommendedAction": safety.recommendedAction,
        "greetingPrefix": greeting_prefix,
        "isIslamicGreeting": is_islamic_greeting,
        "navigatorTopic": navigator_topic,
    }
