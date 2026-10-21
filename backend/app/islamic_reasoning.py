"""Curated, source-attributed Islamic principles for backend response grounding.

This is a small reviewed starter corpus, not a tafsir or fatwa engine.
Only return a dalil when the user asks for Islamic reflection or a relevant
theme is clearly detected. Never synthesize Arabic text or source metadata.
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


SOURCES: tuple[IslamicSource, ...] = (
    {
        "key": "verify_information",
        "kind": "quran",
        "reference": "QS. Al-Hujurat 49:6",
        "arabic": "يَا أَيُّهَا الَّذِينَ آمَنُوا إِنْ جَاءَكُمْ فَاسِقٌ بِنَبَإٍ فَتَبَيَّنُوا",
        "translation": "Wahai orang-orang yang beriman, jika seseorang yang fasik datang kepadamu membawa suatu berita, maka telitilah kebenarannya.",
        "relevance": "Verifikasi informasi; jangan menyebarkan klaim tanpa pemeriksaan.",
    },
    {
        "key": "speak_truthfully",
        "kind": "hadith",
        "reference": "Sahih al-Bukhari 6018; Sahih Muslim 47",
        "arabic": "مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ",
        "translation": "Barang siapa beriman kepada Allah dan hari akhir, hendaklah berkata baik atau diam.",
        "relevance": "Komunikasi yang jujur, bermanfaat, dan tidak merugikan.",
    },
    {
        "key": "justice",
        "kind": "quran",
        "reference": "QS. An-Nahl 16:90",
        "arabic": "إِنَّ اللَّهَ يَأْمُرُ بِالْعَدْلِ وَالْإِحْسَانِ",
        "translation": "Sesungguhnya Allah menyuruh berlaku adil dan berbuat kebajikan.",
        "relevance": "Keadilan, ihsan, dan perlakuan yang tidak zalim.",
    },
    {
        "key": "avoid_unsupported_claims",
        "kind": "quran",
        "reference": "QS. Al-Isra' 17:36",
        "arabic": "وَلَا تَقْفُ مَا لَيْسَ لَكَ بِهِ عِلْمٌ",
        "translation": "Janganlah engkau mengikuti sesuatu yang tidak engkau ketahui.",
        "relevance": "Mengakui keterbatasan pengetahuan dan tidak mengarang kepastian.",
    },
    {
        "key": "cooperation",
        "kind": "quran",
        "reference": "QS. Al-Ma'idah 5:2",
        "arabic": "وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَى",
        "translation": "Tolong-menolonglah kamu dalam (mengerjakan) kebajikan dan takwa.",
        "relevance": "Kerja sama dalam kebaikan, bukan dalam dosa atau permusuhan.",
    },
    {
        "key": "intentions",
        "kind": "hadith",
        "reference": "Sahih al-Bukhari 1; Sahih Muslim 1907",
        "arabic": "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ",
        "translation": "Sesungguhnya amal-amal itu bergantung pada niatnya.",
        "relevance": "Memeriksa tujuan dan niat tanpa mengklaim mengetahui isi hati seseorang.",
    },
)


THEMES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("verify_information", ("berita", "memberitahu", "informasi", "informasi palsu", "hoaks", "bukti", "sumber berita", "sumber informasi", "verifikasi", "memverifikasi", "cek fakta")),
    ("speak_truthfully", ("berbohong", "bohong", "membohongi", "kebohongan", "jujur", "berjujur", "kejujuran", "fitnah", "ucapan", "berkata", "mengucapkan", "komunikasi", "berkomunikasi")),
    ("justice", ("adil", "keadilan", "zalim", "menzalimi", "kezaliman", "hak orang", "diskriminasi", "mendiskriminasi", "mengadili", "pengadilan")),
    ("avoid_unsupported_claims", ("tidak tahu", "kepastian", "mengarang", "klaim", "mengklaim", "fakta", "ilmu", "yakin", "meyakini")),
    ("cooperation", ("kerja sama", "bekerja sama", "tolong", "menolong", "membantu", "kolaborasi", "bekerja sama", "persaingan", "bersaing")),
    ("intentions", ("niat", "berniat", "tujuan", "bertujuan", "ikhlas", "motivasi", "termotivasi")),
)


def select_islamic_sources(question: str, *, limit: int = 2) -> list[IslamicSource]:
    """Return only curated sources whose themes match the supplied question.

    Uses whole-word/phrase matching to avoid false positives from substrings.
    """
    normalized = " ".join(question.casefold().split())
    if not normalized or limit < 1:
        return []

    matched_keys: list[str] = []
    for key, terms in THEMES:
        if any(_term_matches(normalized, term) for term in terms):
            matched_keys.append(key)
            if len(matched_keys) >= limit:
                break

    by_key = {source["key"]: source for source in SOURCES}
    return [by_key[key] for key in matched_keys if key in by_key]


def _term_matches(text: str, term: str) -> bool:
    """Check if term appears as a whole word/phrase in text."""
    # Escape special regex characters in the term
    escaped = re.escape(term)
    # Use word boundaries for whole-word matching
    # For multi-word terms, this ensures each word is bounded
    pattern = r"(?<!\w)" + escaped + r"(?!\w)"
    return re.search(pattern, text) is not None


def format_sources_for_reflection(question: str) -> str:
    """Format a bounded set of curated dalil with explicit source references."""
    sources = select_islamic_sources(question)
    if not sources:
        return (
            "Dalil spesifik belum dipilih dari korpus terkurasi untuk pertanyaan ini. "
            "Jangan mengarang kutipan atau menisbatkan perkataan kepada Allah atau Rasul-Nya."
        )

    lines: list[str] = []
    for source in sources:
        lines.append(
            f'{source["reference"]} ({source["kind"]})\n'
            f'{source["arabic"]}\n'
            f'Terjemah ringkas: {source["translation"]}\n'
            f'Relevansi umum: {source["relevance"]}'
        )
    return "\n\n".join(lines)
