"""Emergency Gate v3: Centralized safety decision pipeline.

This module provides comprehensive text-context handling (negation, temporal,
subject, severity) and a unified safety decision pipeline that drives both
/navigator/check and /ask endpoints.

Safety levels (ordered by severity):
  - EMERGENCY: Immediate danger signals requiring urgent medical attention
  - HIGH_RISK: Contexts requiring professional evaluation (pregnancy, medication, chronic)
  - AMBIGUOUS: Unclear but potentially safety-relevant (needs clarification)
  - EDUCATION: Safe for educational response
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .schemas import HealthIntake


class SafetyLevel(str, Enum):
    """Safety classification level."""
    EMERGENCY = "emergency"
    HIGH_RISK = "high"
    AMBIGUOUS = "ambiguous"
    EDUCATION = "low"


class SubjectContext(str, Enum):
    """Who the health question is about."""
    SELF = "self"
    OTHER_PERSON = "other_person"
    HYPOTHETICAL = "hypothetical"
    UNKNOWN = "unknown"


class TemporalContext(str, Enum):
    """When the symptom/condition is occurring."""
    NOW = "now"
    TODAY = "today"
    RECENT = "recent"
    PAST = "past"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class SafetyDecision:
    """Structured safety decision with full audit trail.
    
    This replaces the minimal SafetyResult and provides complete context
    for understanding why a decision was made.
    """
    
    level: SafetyLevel
    reason_codes: tuple[str, ...] = ()
    matched_signals: tuple[str, ...] = ()
    subject_context: SubjectContext = SubjectContext.UNKNOWN
    temporal_context: TemporalContext = TemporalContext.UNKNOWN
    requires_clarification: bool = False
    clarification_questions: tuple[str, ...] = ()
    recommended_action: str | None = None
    explanation: str = ""
    
    def to_safety_level_string(self) -> str:
        """Return safetyLevel string for backward compatibility."""
        return self.level.value


# ============================================================================
# EMERGENCY SIGNAL KEYWORDS AND PATTERNS
# ============================================================================

EMERGENCY_KEYWORDS = (
    "nyeri dada berat",
    "dada terasa berat",
    "nyeri dada",
    "dada sakit sekali",
    "dada sakit berat",
    "sakit dada",
    "dada sakit",
    "sesak berat",
    "sesak napas",
    "sesak nafas",
    "sesek napas",
    "sesek nafas",
    "sesak napas berat",
    "sesak nafas berat",
    "susah napas berat",
    "susah nafas berat",
    "susah napas",
    "susah nafas",
    "sulit napas",
    "sulit nafas",
    "sulit bernapas",
    "sulit bernafas",
    "tidak bisa bernapas",
    "tidak bisa bernafas",
    "gak bisa napas",
    "gak bisa nafas",
    "ga bisa napas",
    "ga bisa nafas",
    "nggak bisa napas",
    "nggak bisa nafas",
    "enggak bisa napas",
    "enggak bisa nafas",
    "nafas berat",
    "napas berat",
    "tidak sadar",
    "hilang kesadaran",
    "pingsan",
    "pingsang",
    "kejang",
    "lemah separuh tubuh",
    "separuh badan lemah",
    "kelemahan satu sisi",
    "wajah mencong",
    "bicara pelo",
    "gejala stroke",
    "perdarahan hebat",
    "perdarahan berat",
    "keluar darah banyak",
    "muntah darah",
    "batuk darah",
    "bab darah",
    "alergi berat",
    "reaksi alergi berat",
    "bengkak wajah",
    "bibir bengkak",
    "tenggorokan bengkak",
    "keracunan",
    "overdosis",
    "minum obat terlalu banyak",
    "tertelan racun",
    "cedera berat",
    "kecelakaan berat",
    "kepala terbentur keras",
    "perdarahan setelah kecelakaan",
    "hamil dan perdarahan",
    "hamil dan nyeri hebat",
    "hamil dan kejang",
    "bayi sulit bernapas",
    "bayi tidak sadar",
    "anak sulit bernapas",
    "anak tidak sadar",
    "ingin bunuh diri",
    "ingin mengakhiri hidup",
    "bunuh diri",
    "menyakiti diri",
    "mengakhiri hidup",
)

EMERGENCY_COMBINATION_PATTERNS = (
    r"\bhamil\b.{0,60}\b(?:perdarahan|pendarahan|keluar darah)\b",
    r"\b(?:perdarahan|pendarahan|keluar darah)\b.{0,60}\bhamil\b",
)

EMERGENCY_FLEXIBLE_PATTERNS = (
    r"\bdada\b(?:\s+\w+){0,3}\s+\b(?:sakit|nyeri)\b(?:\s+\w+){0,3}\s+\b(?:sekali|banget|parah|berat)\b",
    r"\bdada\b(?:\s+\w+){0,3}\s+\b(?:sangat)\b(?:\s+\w+){0,2}\s+\b(?:sakit|nyeri)\b",
    r"\b(?:sakit|nyeri)\b(?:\s+\w+){0,3}\s+\b(?:sekali|banget|parah|berat)\b(?:\s+\w+){0,3}\s+\bdada\b",
    r"\b(?:sakit|nyeri)\b(?:\s+\w+){0,3}\s+\bdi\s+\bdada\b(?:\s+\w+){0,3}\s+\b(?:sangat|sekali|banget|parah|berat)\b",
    r"\bseparuh\b\s+\bbadan\b(?:\s+\w+){0,3}\s+\blemah\b",
)

NEGATION_WORDS = (
    "tidak",
    "tak",
    "bukan",
    "belum",
    "tanpa",
)

HIGH_RISK_KEYWORDS = (
    "penyakit kronis",
    "diabetes",
    "kanker",
    "hipertensi",
    "stroke",
    "jantung",
    "ginjal",
    "asma",
    "anak kecil",
    "bayi",
    "balita",
    "ibu hamil",
    "hamil",
    "menyusui",
    "lansia",
    "alergi",
    "obat dokter",
    "obat resep",
    "resep dokter",
    "dosis",
    "antibiotik",
    "insulin",
    "menghentikan obat",
    "berhenti obat",
    "menyembuhkan diabetes",
    "menyembuhkan kanker",
    "obat segala penyakit",
    "pasti sembuh",
    "sembuh total",
)

# Ambiguous patterns: unclear but potentially safety-relevant
AMBIGUOUS_PATTERNS = (
    r"badan\s+\w*aneh",
    r"badan\b.*\baneh\b",
    r"rasanya\s+mau\s+(?:jatuh|pingsan)",
    r"mau\s+(?:jatuh|pingsan)",
    r"tidak\s+\w*jelas\b.*\bsakit",
    r"tidak\s+pasti.*gejala",
    r"merasa.*tidak\s+normal",
    r"aneh\b.*\bbadan",
    r"tidak\s+normal",
)

# ============================================================================
# HELPER FUNCTIONS FOR CONTEXT DETECTION
# ============================================================================


def _normalize_text(value: str) -> str:
    """Normalize text for matching."""
    if not isinstance(value, str):
        return ""
    text = unicodedata.normalize("NFKD", value.casefold())
    text = "".join(character for character in text if not unicodedata.combining(character))
    text = text.replace("qur'an", "quran").replace("qur'an", "quran")
    text = text.replace("assalamu'alaikum", "assalamu alaikum")
    text = text.replace("wa'alaikumsalam", "wa alaikumsalam")
    text = text.replace("'", " ").replace("`", " ").replace("'", " ")
    # Preserve clause boundaries for negation scope before removing punctuation.
    text = re.sub(r"[,.;:!?\r\n]+", " | ", text)
    text = re.sub(r"[^a-z0-9\s|]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    """Whole-word/phrase match that avoids substring false positives."""
    for keyword in keywords:
        pattern = r"(?<!\w)" + re.escape(keyword) + r"(?!\w)"
        if re.search(pattern, text):
            return True
    return False


def _is_locally_negated(text: str, signal_start: int) -> bool:
    """Check if a signal at signal_start is negated by nearby negation word.
    
    Returns True if negation word appears within ~4 words before signal
    in the same clause. Clause boundaries are marked by:
    - Punctuation: comma, period, semicolon, colon
    - Contrast words: tetapi, namun, tapi
    - Temporal markers: sekarang, saat ini (these invalidate earlier negation)
    
    This handles cases like:
    - "tidak pingsan, tapi sekarang pingsan" (contrast word resets)
    - "tadi tidak sesak, sekarang sesak berat" (comma + temporal resets)
    - "tidak sesak, sekarang sesak berat" (comma + temporal resets)
    """
    prefix = text[:signal_start]
    clause_start = max(
        prefix.rfind("|"),
        prefix.rfind(","),
        prefix.rfind("."),
        prefix.rfind(";"),
        prefix.rfind(":"),
    ) + 1
    clause = prefix[clause_start:]
    
    # Check for temporal/contrast words that reset negation scope
    reset_pattern = r"\b(?:tetapi|namun|tapi|sekarang|saat ini)\b"
    reset_match = re.search(reset_pattern, clause)
    if reset_match:
        # Reset clause to after the temporal/contrast word
        clause = clause[reset_match.end():]

    # "tidak hanya sesak napas" affirms the symptom; it is not a denial.
    clause = re.sub(r"\b(?:tidak|tak|bukan)\s+(?:hanya|sekadar|cuma)\b", "", clause)
    
    words = re.findall(r"\b[\wÀ-ÿ]+\b", clause)
    return any(word in NEGATION_WORDS for word in words[-4:])


def _contains_non_negated(text: str, keywords: tuple[str, ...]) -> bool:
    """Match keywords unless explicitly negated."""
    for keyword in keywords:
        pattern = r"(?<!\w)" + re.escape(keyword) + r"(?!\w)"
        for match in re.finditer(pattern, text):
            if not _is_locally_negated(text, match.start()):
                return True
    return False


def _contains_non_negated_combination(text: str) -> bool:
    """Match combination patterns with negation check."""
    for pattern in EMERGENCY_COMBINATION_PATTERNS:
        for match in re.finditer(pattern, text):
            matched = match.group(0)
            symptom_match = re.search(
                r"\b(?:perdarahan|pendarahan|keluar darah)\b", matched
            )
            if symptom_match is None:
                continue
            symptom_start = match.start() + symptom_match.start()
            if not _is_locally_negated(text, symptom_start):
                return True
    return False


def _contains_non_negated_flexible_pattern(text: str) -> bool:
    """Match flexible patterns with negation check."""
    for pattern in EMERGENCY_FLEXIBLE_PATTERNS:
        for match in re.finditer(pattern, text):
            symptom_match = re.search(r"\b(?:sakit|nyeri)\b", match.group(0))
            signal_start = match.start() + (
                symptom_match.start() if symptom_match else 0
            )
            if not _is_locally_negated(text, signal_start):
                return True
    return False


def detect_subject_context(text: str) -> SubjectContext:
    """Detect who the health question is about: self, other, or hypothetical.
    
    Returns:
      - SELF: "saya", "aku", "diri saya"
      - OTHER_PERSON: "teman saya", "anak saya", "dia", "dia", "orang"
      - HYPOTHETICAL: "kalau", "jika", "bagaimana jika", "misal"
      - UNKNOWN: no clear subject indicator
    """
    self_keywords = (
        "saya", "aku", "diri saya", "diri aku", "saya sendiri", 
        "aku sendiri", "gejala saya", "keluhan saya", "yang saya", "ku alami"
    )
    
    other_keywords = (
        "teman", "anak", "istri", "suami", "ibu", "ayah", "orang tua",
        "kakak", "adik", "nenek", "kakek", "tetangga", "rekan", "pasien",
        "bayi", "bayi saya", "anak saya", "teman saya", "dia", "orangnya"
    )
    
    hypothetical_keywords = (
        "kalau", "jika", "bila", "bagaimana jika", "kalau saja",
        "andai", "misal", "misalnya", "seumpama", "bagaimana dengan",
        "pertanyaan umum", "soal", "soalan"
    )
    
    normalized = _normalize_text(text)
    
    if _contains_any(normalized, hypothetical_keywords):
        return SubjectContext.HYPOTHETICAL
    
    if _contains_any(normalized, other_keywords):
        return SubjectContext.OTHER_PERSON
    
    if _contains_any(normalized, self_keywords):
        return SubjectContext.SELF
    
    return SubjectContext.UNKNOWN


def detect_temporal_context(text: str) -> TemporalContext:
    """Detect when the symptom/condition is occurring.
    
    Returns:
      - NOW: "sekarang", "saat ini", "detik ini"
      - TODAY: "hari ini", "pagi ini", "tadi pagi", "sejak pagi"
      - RECENT: "kemarin", "beberapa hari", "minggu lalu", "bulan lalu"
      - PAST: "dulu", "sebelumnya", "sudah pernah", "pernah mengalami"
      - UNKNOWN: no temporal indicator
    """
    now_keywords = (
        "sekarang", "saat ini", "detik ini", "sedang", "lagi", "menjadi",
        "tiba tiba", "tiba-tiba", "tibatiba", "baru saja"
    )
    
    today_keywords = (
        "hari ini", "pagi ini", "siang ini", "sore ini", "malam ini",
        "tadi pagi", "tadi siang", "sejak pagi", "sejak tadi",
        "sejak bangun", "mulai pagi"
    )
    
    recent_keywords = (
        "kemarin", "2 hari", "tiga hari", "beberapa hari", "seminggu",
        "minggu lalu", "2 minggu", "tiga minggu", "sebulan", "bulan lalu",
        "baru-baru", "belakangan", "akhir-akhir"
    )
    
    past_keywords = (
        "dulu", "sebelumnya", "pernah", "sudah", "sebelum ini",
        "tahun lalu", "lama", "sudah pernah", "sudah berapa kali",
        "pengalaman", "riwayat"
    )
    
    normalized = _normalize_text(text)
    
    if _contains_any(normalized, now_keywords):
        return TemporalContext.NOW
    
    if _contains_any(normalized, today_keywords):
        return TemporalContext.TODAY
    
    if _contains_any(normalized, recent_keywords):
        return TemporalContext.RECENT
    
    if _contains_any(normalized, past_keywords):
        return TemporalContext.PAST
    
    return TemporalContext.UNKNOWN


def detect_emergency_signal(text: str) -> bool:
    """Comprehensive emergency signal detection with negation handling."""
    normalized = _normalize_text(text)
    return (
        _contains_non_negated(normalized, EMERGENCY_KEYWORDS)
        or _contains_non_negated_combination(normalized)
        or _contains_non_negated_flexible_pattern(normalized)
    )


def detect_ambiguous(text: str) -> bool:
    """Detect potentially safety-relevant but unclear input."""
    normalized = _normalize_text(text)
    for pattern in AMBIGUOUS_PATTERNS:
        if re.search(pattern, normalized):
            return True
    return False


def _is_explicit_educational_reference(normalized: str) -> bool:
    """Return True only for clear references to information, not symptoms.

    This is intentionally narrow. Phrases such as "anggap ini cerita" or
    prompt-injection instructions are not educational context and must not
    downgrade a signal that may describe a real emergency.
    """
    return normalized.startswith((
        "artikel ", "edukasi ", "apa itu ", "jelaskan ",
        "informasi tentang ", "contoh ", "berita tentang ",
        "laporan tentang ", "kisah tentang ",
    ))


def _is_leading_hypothetical_reference(normalized: str) -> bool:
    """Recognize a hypothetical framing only when it governs the question."""
    return normalized.startswith((
        "kalau ", "jika ", "bila ", "andai ", "misal ",
        "misalnya ", "seumpama ", "bagaimana jika ",
    ))


# ============================================================================
# CENTRALIZED SAFETY DECISION PIPELINE
# ============================================================================


def evaluate_safety(
    question: str,
    intent: str = "",
    health_intake: HealthIntake | None = None,
) -> SafetyDecision:
    """Centralized safety pipeline: normalize → detect → decide.
    
    Args:
      - question: Raw user input
      - intent: Detected intent (e.g., "danger_sign", "health_navigator")
      - health_intake: Reserved compatibility argument. Public endpoints
        currently evaluate their validated text input only.
    
    Returns:
      SafetyDecision with level, matched_signals, subject/temporal context,
      clarification flag, and recommended action.
    """
    
    if not isinstance(question, str):
        return SafetyDecision(
            level=SafetyLevel.EDUCATION,
            reason_codes=("invalid_input",),
            explanation="Input bukan teks dan tidak dapat dievaluasi sebagai emergency.",
        )

    if not question.strip():
        return SafetyDecision(
            level=SafetyLevel.EDUCATION,
            reason_codes=("empty_input",),
            explanation="Input kosong tidak dievaluasi sebagai emergency."
        )
    
    normalized = _normalize_text(question)
    reason_codes: list[str] = []
    matched_signals: list[str] = []
    
    # Priority 1: Intent-based emergency override
    if intent == "danger_sign":
        return SafetyDecision(
            level=SafetyLevel.EMERGENCY,
            reason_codes=("intent_danger_sign",),
            subject_context=detect_subject_context(question),
            temporal_context=detect_temporal_context(question),
            recommended_action=(
                "Segera hubungi layanan darurat setempat atau datang ke IGD "
                "fasilitas kesehatan terdekat."
            ),
            explanation="Intent router mendeteksi tanda bahaya."
        )
    
    # Priority 2: Emergency signal detection
    if detect_emergency_signal(normalized):
        subject_context = detect_subject_context(question)
        temporal_context = detect_temporal_context(question)
        if _is_explicit_educational_reference(normalized):
            return SafetyDecision(
                level=SafetyLevel.EDUCATION,
                reason_codes=("emergency_signal_educational_reference",),
                subject_context=subject_context,
                temporal_context=temporal_context,
                recommended_action="Gunakan informasi ini sebagai edukasi umum.",
                explanation="Sinyal dibahas sebagai materi edukasi, bukan keluhan langsung.",
            )
        if (
            subject_context == SubjectContext.HYPOTHETICAL
            and _is_leading_hypothetical_reference(normalized)
        ):
            return SafetyDecision(
                level=SafetyLevel.AMBIGUOUS,
                reason_codes=("emergency_signal_hypothetical_context",),
                subject_context=subject_context,
                temporal_context=temporal_context,
                requires_clarification=True,
                clarification_questions=("Apakah ini sedang terjadi pada seseorang sekarang?",),
                recommended_action="Jika ini sedang terjadi, segera hubungi layanan darurat setempat atau datang ke IGD.",
                explanation="Pertanyaan bersifat hipotetis; keadaan saat ini perlu dipastikan.",
            )
        reason_codes.append("emergency_signal_detected")
        matched_signals.extend(
            [kw for kw in EMERGENCY_KEYWORDS if _contains_non_negated(normalized, (kw,))][:5]
        )
        
        return SafetyDecision(
            level=SafetyLevel.EMERGENCY,
            reason_codes=tuple(reason_codes),
            matched_signals=tuple(matched_signals),
            subject_context=subject_context,
            temporal_context=temporal_context,
            recommended_action=(
                "Segera hubungi layanan darurat setempat atau datang ke IGD "
                "fasilitas kesehatan terdekat."
            ),
            explanation=f"Terdeteksi sinyal gejala serius: {', '.join(matched_signals[:3])}."
        )
    
    # Priority 3: Ambiguous (potentially safety-relevant but unclear)
    if detect_ambiguous(normalized):
        reason_codes.append("ambiguous_unclear_input")
        return SafetyDecision(
            level=SafetyLevel.AMBIGUOUS,
            reason_codes=tuple(reason_codes),
            subject_context=detect_subject_context(question),
            temporal_context=detect_temporal_context(question),
            requires_clarification=True,
            clarification_questions=(
                "Apa gejala spesifik yang Anda alami?",
                "Berapa lama gejala ini berlangsung?",
            ),
            recommended_action=(
                "Jelaskan lebih detail untuk membantu mengarahkan ke bantuan yang tepat."
            ),
            explanation="Input tidak cukup jelas namun berpotensi safety-relevant."
        )
    
    # Priority 4: High-risk keywords (chronic, pregnancy, medication context)
    if _contains_any(normalized, HIGH_RISK_KEYWORDS):
        reason_codes.append("high_risk_keyword_matched")
        matched_signals.extend(
            [kw for kw in HIGH_RISK_KEYWORDS if _contains_any(normalized, (kw,))][:3]
        )
        
        return SafetyDecision(
            level=SafetyLevel.HIGH_RISK,
            reason_codes=tuple(reason_codes),
            matched_signals=tuple(matched_signals),
            subject_context=detect_subject_context(question),
            temporal_context=detect_temporal_context(question),
            recommended_action=(
                "Konsultasikan dengan dokter, apoteker, atau tenaga kesehatan "
                "yang berwenang sebelum mengambil keputusan."
            ),
            explanation=f"Konteks high-risk: {', '.join(matched_signals[:2])}."
        )
    
    # Priority 5: Intent-based medium risk
    medium_risk_intents = {
        "health_general",
        "medication_request",
        "product_claim",
    }
    
    if intent in medium_risk_intents:
        reason_codes.append(f"intent_{intent}_medium_risk")
        return SafetyDecision(
            level=SafetyLevel.EDUCATION,
            reason_codes=tuple(reason_codes),
            subject_context=detect_subject_context(question),
            temporal_context=detect_temporal_context(question),
            recommended_action=(
                "Gunakan informasi ini sebagai edukasi umum dan cari bantuan "
                "tenaga kesehatan bila keluhan menetap, memburuk, atau "
                "terasa mengkhawatirkan."
            ),
            explanation=f"Intent {intent} memerlukan kehati-hatian tinggi."
        )
    
    # Default: Safe for education
    reason_codes.append("default_safe")
    return SafetyDecision(
        level=SafetyLevel.EDUCATION,
        reason_codes=tuple(reason_codes),
        subject_context=detect_subject_context(question),
        temporal_context=detect_temporal_context(question),
        recommended_action="Gunakan sebagai edukasi awal.",
        explanation="Input dievaluasi aman untuk respons edukatif."
    )


# ============================================================================
# BACKWARD COMPATIBILITY WRAPPERS
# ============================================================================


from dataclasses import dataclass as old_dataclass


@old_dataclass(frozen=True)
class SafetyResult:
    """Backward compatibility wrapper for legacy SafetyResult."""
    safetyLevel: str
    recommendedAction: str | None = None


def classify_risk(question: str, intent: str) -> SafetyResult:
    """Backward-compatible wrapper around new safety pipeline.
    
    Used by legacy code. New code should use evaluate_safety() directly.
    """
    decision = evaluate_safety(question, intent)
    safety_level = decision.to_safety_level_string()
    if safety_level == SafetyLevel.EDUCATION.value and intent in {
        "health_general",
        "medication_request",
        "product_claim",
    }:
        safety_level = "medium"
    return SafetyResult(
        safetyLevel=safety_level,
        recommendedAction=decision.recommended_action
    )


def contains_emergency_signal(text: str) -> bool:
    """Backward-compatible wrapper for emergency detection."""
    return detect_emergency_signal(_normalize_text(text))


def contains_non_negated_signal(text: str, keywords: tuple[str, ...]) -> bool:
    """Apply the centralized local-negation semantics to a signal list."""
    return _contains_non_negated(_normalize_text(text), keywords)


def contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    """Backward-compatible wrapper for keyword matching."""
    return _contains_any(_normalize_text(text), keywords)
