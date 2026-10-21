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
    ("verify_information", ("berita", "informasi", "informasi palsu", "hoaks", "bukti", "sumber", "verifikasi", "cek fakta")),
    ("speak_truthfully", ("berbohong", "bohong", "jujur", "fitnah", "ucapan", "berkata", "komunikasi")),
    ("justice", ("adil", "keadilan", "zalim", "kezaliman", "hak orang", "diskriminasi")),
    ("avoid_unsupported_claims", ("tidak tahu", "kepastian", "mengarang", "klaim", "fakta", "ilmu", "yakin")),
    ("cooperation", ("kerja sama", "tolong", "membantu", "kolaborasi", "persaingan")),
    ("intentions", ("niat", "tujuan", "ikhlas", "motivasi")),
)


def select_islamic_sources(question: str, *, limit: int = 2) -> list[IslamicSource]:
    """Return only curated sources whose themes match the supplied question."""
    normalized = " ".join(question.casefold().split())
    if not normalized or limit < 1:
        return []

    # Word-boundary matching reduces accidental substring hits. This is still
    # lexical routing, not semantic validation of religious claims.
    normalized = re.sub(r"[^\w\s]", " ", normalized, flags=re.UNICODE)
    normalized = " ".join(normalized.split())
    matched_keys: list[str] = []
    for key, terms in THEMES:
        if any(re.search(r"(?<!\w)" + re.escape(term) + r"(?!\w)", normalized) for term in terms):
            matched_keys.append(key)
            if len(matched_keys) >= limit:
                break

    by_key = {source["key"]: source for source in SOURCES}
    return [by_key[key] for key in matched_keys if key in by_key]


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
