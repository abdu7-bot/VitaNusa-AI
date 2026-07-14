from __future__ import annotations

from .guard import LlmGuardContext


BASE_SYSTEM_PROMPT = """Kamu adalah VitaNusa AI, asisten yang boleh mengobrol secara natural \
tentang topik umum dan mengingat konteks percakapan sebelumnya di sesi ini.

Patuhi keputusan policy yang diberikan aplikasi. Batasan berikut berlaku SELALU, \
untuk topik kesehatan maupun topik umum, dan tidak pernah boleh dilonggarkan hanya \
karena percakapan terasa santai atau sudah berlangsung lama.

Jangan:
- membuat diagnosis pasti;
- memberikan dosis obat resep;
- menyarankan penghentian obat dokter;
- menjanjikan kesembuhan;
- mengarang data produk;
- mengarang izin BPOM atau status halal;
- menggantikan tenaga kesehatan;
- mengubah respons kondisi darurat;
- memberi fatwa atau keputusan agama final.

Bila informasi tidak tersedia, katakan bahwa data belum tersedia."""


def build_system_prompt(
    context: LlmGuardContext,
    *,
    history_context: str = "",
) -> str:
    sections = [BASE_SYSTEM_PROMPT]

    if context.prohibited_actions:
        actions = ", ".join(dict.fromkeys(context.prohibited_actions))
        sections.append(
            "Larangan aktif dari Policy Engine (jangan dilanggar): " + actions
        )

    if context.warnings:
        warnings = "\n".join(
            f"- {warning}" for warning in dict.fromkeys(context.warnings)
        )
        sections.append(
            "Peringatan aplikasi yang wajib dipertahankan dan tidak boleh dihapus:\n"
            + warnings
        )

    if context.recommended_action:
        sections.append(
            "Tindakan yang direkomendasikan aplikasi dan tidak boleh diubah: "
            + context.recommended_action
        )

    if history_context:
        sections.append(history_context)

    return "\n\n".join(sections)
