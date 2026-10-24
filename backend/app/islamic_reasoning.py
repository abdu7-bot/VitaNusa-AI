"""Bounded source registry for Islamic reflection.

Registry membership means only that an entry exists in this repository. It does
not establish scholarly review, hadith authentication, translation equivalence,
or that a source applies to the user's situation.
"""
from __future__ import annotations

import re
from typing import TypedDict


class IslamicSource(TypedDict):
    key: str
    kind: str
    reference: str
    arabic: str
    translation: str
    relevance: str
    source_status: str
    provenance_status: str
    scholarly_review_status: str
    locator: str | None
    primary_source_url: str | None
    edition: str | None
    translator: str | None
    text_form: str


# Metadata is intentionally unknown where it has not been independently
# recorded. "registry_only" is not a religious-authenticity verdict.
SOURCES: tuple[IslamicSource, ...] = (
    {
        "key": "verify_information",
        "kind": "quran",
        "reference": "QS. Al-Hujurat 49:6",
        "arabic": "يَا أَيُّهَا الَّذِينَ آمَنُوا إِنْ جَاءَكُمْ فَاسِقٌ بِنَبَإٍ فَتَبَيَّنُوا",
        "translation": "Wahai orang-orang yang beriman, jika seseorang yang fasik datang kepadamu membawa suatu berita, maka telitilah kebenarannya.",
        "relevance": "Verifikasi informasi; jangan menyebarkan klaim tanpa pemeriksaan.",
        "source_status": "registry_only",
        "provenance_status": "partially_checked_excerpt_context_incomplete",
        "scholarly_review_status": "pending",
        "locator": "49:6",
        "primary_source_url": None,
        "edition": None,
        "translator": None,
        "text_form": "arabic_excerpt_and_indonesian_summary",
    },
    {
        "key": "speak_truthfully",
        "kind": "hadith",
        "reference": "Sahih al-Bukhari 6018; Sahih Muslim 47",
        "arabic": "مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ",
        "translation": "Barang siapa beriman kepada Allah dan hari akhir, hendaklah berkata baik atau diam.",
        "relevance": "Komunikasi yang jujur, bermanfaat, dan tidak merugikan.",
        "source_status": "registry_only",
        "provenance_status": "reference_and_excerpt_partially_checked",
        "scholarly_review_status": "pending",
        "locator": "al-Bukhari 6018; Muslim 47 (numbering convention unknown)",
        "primary_source_url": None,
        "edition": None,
        "translator": None,
        "text_form": "arabic_excerpt_and_indonesian_summary",
    },
    {
        "key": "justice",
        "kind": "quran",
        "reference": "QS. An-Nahl 16:90",
        "arabic": "إِنَّ اللَّهَ يَأْمُرُ بِالْعَدْلِ وَالْإِحْسَانِ",
        "translation": "Sesungguhnya Allah menyuruh berlaku adil dan berbuat kebajikan.",
        "relevance": "Keadilan, ihsan, dan perlakuan yang tidak zalim.",
        "source_status": "registry_only",
        "provenance_status": "partially_checked_excerpt_context_incomplete",
        "scholarly_review_status": "pending",
        "locator": "16:90",
        "primary_source_url": None,
        "edition": None,
        "translator": None,
        "text_form": "arabic_excerpt_and_indonesian_summary",
    },
    {
        "key": "avoid_unsupported_claims",
        "kind": "quran",
        "reference": "QS. Al-Isra' 17:36",
        "arabic": "وَلَا تَقْفُ مَا لَيْسَ لَكَ بِهِ عِلْمٌ",
        "translation": "Janganlah engkau mengikuti sesuatu yang tidak engkau ketahui.",
        "relevance": "Mengakui keterbatasan pengetahuan dan tidak mengarang kepastian.",
        "source_status": "registry_only",
        "provenance_status": "partially_checked_excerpt_context_incomplete",
        "scholarly_review_status": "pending",
        "locator": "17:36",
        "primary_source_url": None,
        "edition": None,
        "translator": None,
        "text_form": "arabic_excerpt_and_indonesian_summary",
    },
    {
        "key": "cooperation",
        "kind": "quran",
        "reference": "QS. Al-Ma'idah 5:2",
        "arabic": "وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَى",
        "translation": "Tolong-menolonglah kamu dalam (mengerjakan) kebajikan dan takwa.",
        "relevance": "Kerja sama dalam kebaikan, bukan dalam dosa atau permusuhan.",
        "source_status": "registry_only",
        "provenance_status": "partially_checked_excerpt_context_incomplete",
        "scholarly_review_status": "pending",
        "locator": "5:2",
        "primary_source_url": None,
        "edition": None,
        "translator": None,
        "text_form": "arabic_excerpt_and_indonesian_summary",
    },
    {
        "key": "intentions",
        "kind": "hadith",
        "reference": "Sahih al-Bukhari 1; Sahih Muslim 1907",
        "arabic": "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ",
        "translation": "Sesungguhnya amal-amal itu bergantung pada niatnya.",
        "relevance": "Memeriksa tujuan dan niat tanpa mengklaim mengetahui isi hati seseorang.",
        "source_status": "registry_only",
        "provenance_status": "reference_and_excerpt_partially_checked",
        "scholarly_review_status": "pending",
        "locator": "al-Bukhari 1; Muslim 1907 (numbering convention unknown)",
        "primary_source_url": None,
        "edition": None,
        "translator": None,
        "text_form": "arabic_excerpt_and_indonesian_summary",
    },
)


THEMES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("verify_information", ("berita", "informasi", "hoaks", "bukti", "sumber berita", "sumber informasi", "verifikasi", "memverifikasi", "cek fakta")),
    ("speak_truthfully", ("berbohong", "bohong", "membohongi", "kebohongan", "jujur", "berjujur", "kejujuran", "fitnah", "ucapan", "berkata", "mengucapkan", "komunikasi", "berkomunikasi")),
    ("justice", ("adil", "keadilan", "zalim", "menzalimi", "kezaliman", "hak orang", "diskriminasi", "mendiskriminasi", "mengadili", "pengadilan")),
    ("avoid_unsupported_claims", ("tidak tahu", "kepastian", "mengarang", "klaim", "mengklaim", "fakta", "ilmu", "yakin", "meyakini")),
    ("cooperation", ("kerja sama", "bekerja sama", "tolong", "menolong", "membantu", "kolaborasi", "persaingan", "bersaing")),
    ("intentions", ("niat", "berniat", "tujuan", "bertujuan", "ikhlas", "motivasi", "termotivasi")),
)
_SOURCE_BY_ID = {source["key"]: source for source in SOURCES}
_SOURCE_BY_ID_DUPLICATES = len(_SOURCE_BY_ID) != len(SOURCES)


class SourceValidationError(ValueError):
    """Raised when a citation cannot be supported by the authorized registry."""


def validate_source_registry() -> None:
    """Fail closed when IDs are duplicated or source metadata is malformed."""
    if _SOURCE_BY_ID_DUPLICATES:
        raise SourceValidationError("duplicate_source_id")
    for source in SOURCES:
        if not source["key"].strip() or source["kind"] not in {"quran", "hadith"}:
            raise SourceValidationError("invalid_source_entry")
        if source["scholarly_review_status"] not in {"pending", "reviewed"}:
            raise SourceValidationError("invalid_review_status")
        if source["source_status"] != "registry_only":
            raise SourceValidationError("unsupported_source_status")


def get_islamic_source(source_id: str) -> IslamicSource:
    """Resolve an internal ID; existence is not proof of religious correctness."""
    validate_source_registry()
    if not isinstance(source_id, str) or source_id not in _SOURCE_BY_ID:
        raise SourceValidationError("unknown_source_id")
    return _SOURCE_BY_ID[source_id]


def validate_citation(source_id: str, *, quote: str | None = None) -> dict[str, object]:
    """Validate registry membership and an optional exact canonical excerpt.

    The registry currently stores excerpts, not complete editions. A passing
    exact match means only that the supplied string exactly matches this local
    entry; it does not certify attribution, authenticity, translation, context,
    or applicability.
    """
    source = get_islamic_source(source_id)
    if quote is not None and quote != source["arabic"]:
        raise SourceValidationError("quote_not_exact_registry_text")
    return {
        "source_id": source["key"],
        "kind": source["kind"],
        "reference": source["reference"],
        "canonical_quote": source["arabic"] if quote is not None else None,
        "source_status": source["source_status"],
        "provenance_status": source["provenance_status"],
        "scholarly_review_status": source["scholarly_review_status"],
        "claim_limit": "Registry membership and exact local text match do not establish authenticity, interpretation, or applicability.",
    }


def citation_audit_report() -> dict[str, object]:
    """Machine-readable inventory of provenance and scholarly-review gaps."""
    validate_source_registry()
    return {
        "registry_status": "engineering_metadata_only",
        "scholarly_review_status": "pending",
        "source_count": len(SOURCES),
        "sources": [
            {
                "source_id": source["key"],
                "kind": source["kind"],
                "reference": source["reference"],
                "source_status": source["source_status"],
                "provenance_status": source["provenance_status"],
                "scholarly_review_status": source["scholarly_review_status"],
                "locator": source["locator"],
                "primary_source_url": source["primary_source_url"],
                "edition": source["edition"],
                "translator": source["translator"],
                "text_form": source["text_form"],
            }
            for source in SOURCES
        ],
    }


def select_islamic_sources(question: str, *, limit: int = 2) -> list[IslamicSource]:
    """Return lexical candidates only; this does not infer intent or rulings."""
    if not isinstance(question, str) or not question.strip() or limit < 1:
        return []
    normalized = " ".join(question.casefold().split())
    matched_keys: list[str] = []
    for key, terms in THEMES:
        if any(_term_matches(normalized, term) for term in terms):
            matched_keys.append(key)
            if len(matched_keys) >= limit:
                break
    return [_SOURCE_BY_ID[key] for key in matched_keys if key in _SOURCE_BY_ID]


def _term_matches(text: str, term: str) -> bool:
    """Word-boundary substring matching; not semantic, negation-aware NLP."""
    pattern = r"(?<!\w)" + re.escape(term) + r"(?!\w)"
    return re.search(pattern, text) is not None



_UNVERIFIED_QURAN_REFERENCE = re.compile(
    r"(?i)\b(?:qs\.?\s*)?(?:al[- ]?[a-z'’]+\s*)?(?:\d{1,3}\s*[:.]\s*\d{1,3}|ayat\s*\d{1,3})\b"
)
_UNVERIFIED_HADITH_REFERENCE = re.compile(
    r"(?i)\b(?:sahih\s+)?(?:al[- ]?)?(?:bukhari|bukha?ri|muslim|tirmidhi|abu\s+dawud|nasai|nasa'i|ibn\s+majah)\s*(?:no\.?\s*)?\d{1,7}\b"
)


def validate_llm_religious_claims(text: str) -> bool:
    """Reject citation-like tokens in free-form generated text.

    Canonical citations must be rendered from source IDs in the server registry.
    This guard only detects common reference-shaped strings; it cannot verify
    paraphrase meaning, translation, attribution, authenticity, or applicability.
    """
    if not isinstance(text, str):
        return False
    return not (
        _UNVERIFIED_QURAN_REFERENCE.search(text)
        or _UNVERIFIED_HADITH_REFERENCE.search(text)
    )

def format_sources_for_reflection(question: str) -> str:
    """Render server-owned source text and status, never model-supplied citations."""
    sources = select_islamic_sources(question)
    if not sources:
        return (
            "Dalil spesifik belum dipilih dari korpus terkurasi untuk pertanyaan ini. "
            "Jangan mengarang kutipan atau menisbatkan perkataan kepada Allah atau Rasul-Nya."
        )
    lines: list[str] = []
    for source in sources:
        lines.append(
            f'{source["reference"]} ({source["kind"]}; ID: {source["key"]}; '
            f'status sumber: {source["source_status"]}; tinjauan ulama: {source["scholarly_review_status"]})\n'
            f'{source["arabic"]}\n'
            f'Terjemah ringkas: {source["translation"]}\n'
            f'Relevansi umum: {source["relevance"]}\n'
            'Catatan: pencocokan kata dan keberadaan entri tidak membuktikan konteks atau penetapan hukum.'
        )
    return "\n\n".join(lines)
