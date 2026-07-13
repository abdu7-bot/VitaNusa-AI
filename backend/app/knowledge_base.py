"""Verified educational knowledge base used to ground LLM answers.

This is intentionally a small, hand-curated, hand-verified set of general
health/education snippets — not a scraped or auto-generated dataset. It is
NOT a vector-search RAG pipeline; it is a lightweight keyword-tagged lookup
that keeps the LLM grounded on content someone has actually checked.

Nothing here is updated automatically. Adding or editing an entry is a code
change reviewed like any other change to the app (see `docs/ml-architecture.md`).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class KnowledgeEntry:
    entry_id: str
    tags: tuple[str, ...]
    intents: tuple[str, ...]
    verified_text: str


KNOWLEDGE_BASE: tuple[KnowledgeEntry, ...] = (
    KnowledgeEntry(
        entry_id="hydration_rest_general",
        tags=("mual", "pusing", "lelah", "demam ringan", "sakit kepala"),
        intents=("health_general",),
        verified_text=(
            "Untuk keluhan ringan dan umum seperti mual, pusing, atau kelelahan, edukasi umum yang "
            "didukung sumber kesehatan publik adalah: istirahat cukup, menjaga cairan tubuh secara wajar, "
            "makan dalam porsi kecil bila nafsu makan menurun, dan memantau apakah gejala memburuk atau "
            "menetap lebih dari beberapa hari."
        ),
    ),
    KnowledgeEntry(
        entry_id="medication_general_caution",
        tags=("obat", "dosis", "resep"),
        intents=("medication_request",),
        verified_text=(
            "Dosis dan pemilihan obat resep harus ditentukan oleh dokter atau apoteker karena bergantung "
            "pada kondisi, usia, berat badan, riwayat penyakit, dan interaksi obat masing-masing individu. "
            "Aplikasi ini tidak berwenang menentukan dosis pribadi."
        ),
    ),
    KnowledgeEntry(
        entry_id="product_claim_caution",
        tags=("herbal", "suplemen", "produk"),
        intents=("product_claim",),
        verified_text=(
            "Klaim bahwa produk herbal atau suplemen pasti menyembuhkan penyakit tertentu tidak boleh "
            "dinyatakan tanpa bukti klinis yang kuat. Pengguna disarankan memeriksa label, komposisi, izin "
            "edar, dan berkonsultasi dengan tenaga kesehatan untuk kondisi khusus."
        ),
    ),
)

LOW_CONFIDENCE_NOTE = (
    "Jika tidak ada catatan terverifikasi yang relevan dengan pertanyaan, sampaikan secara jujur bahwa "
    "kamu belum cukup yakin dengan jawabannya, jangan mengarang informasi, dan sarankan pengguna memeriksa "
    "ke tenaga kesehatan atau sumber resmi yang sesuai."
)


def retrieve_knowledge(intent: str, normalized_question: str) -> tuple[KnowledgeEntry, ...]:
    """Return verified knowledge entries relevant to this intent/question.

    Matching is deliberately simple (tag containment on already-normalized
    text) — the goal is grounding the LLM prompt, not exhaustive retrieval.
    """

    matches = []
    for entry in KNOWLEDGE_BASE:
        if intent not in entry.intents:
            continue
        if any(tag in normalized_question for tag in entry.tags):
            matches.append(entry)

    if not matches:
        # Still ground on intent-level entries even without a tag hit, so the
        # LLM has *something* verified to work from for known intents.
        matches = [entry for entry in KNOWLEDGE_BASE if intent in entry.intents]

    return tuple(matches)


def build_knowledge_context(intent: str, normalized_question: str) -> str | None:
    entries = retrieve_knowledge(intent, normalized_question)
    if not entries:
        return LOW_CONFIDENCE_NOTE

    lines = [
        "Catatan terverifikasi yang boleh kamu jadikan dasar jawaban (jangan bertentangan dengan ini):",
    ]
    lines.extend(f"- {entry.verified_text}" for entry in entries)
    lines.append(LOW_CONFIDENCE_NOTE)
    return "\n".join(lines)
