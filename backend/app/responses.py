from __future__ import annotations

from .policy_engine import PolicyDecision

DISCLAIMER = (
    "VitaNusa AI bersifat edukasi umum, bukan diagnosis, resep, fatwa, "
    "atau pengganti dokter, apoteker, ahli gizi, tenaga kesehatan, maupun ulama. "
    "Untuk keluhan berat, memburuk, atau tanda bahaya, segera cari bantuan profesional."
)

IDENTITY_ACTIONS = [
    {"label": "Mulai VitaCheck", "href": "vitacheck.html"},
    {"label": "Baca Artikel", "href": "articles/"},
    {"label": "Prinsip Amanah", "href": "prinsip-amanah.html"},
    {"label": "Hubungi Admin", "href": "contact.html"},
]

COMMON_HEALTH_DISCLAIMER = (
    "Catatan amanah: jawaban ini edukasi umum, bukan diagnosis, bukan dosis obat resep, "
    "tidak menyuruh menghentikan obat dokter, dan tidak menjanjikan kesembuhan."
)

SAFE_FALLBACK_ANSWER = (
    "Saya belum mempunyai informasi yang cukup untuk menjawab pertanyaan itu secara aman.\n\n"
    "Yang bisa dilakukan:\n\n"
    "- tulis pertanyaan lebih spesifik\n"
    "- berikan konteks umum tanpa data pribadi sensitif\n"
    "- pilih topik VitaCheck, artikel, produk amanah, atau kebiasaan sehat\n\n"
    "Untuk keluhan berat atau darurat, segera cari bantuan medis."
)

QURANIC_REFLECTION = {
    "type": "reflection",
    "text": (
        "Sebagai refleksi kehidupan, Islam mengajarkan pentingnya ikhtiar dan tawakal. "
        "Dalam konteks kesehatan, ikhtiar dapat berupa menjaga pola hidup, mencari informasi "
        "yang benar, dan berkonsultasi dengan tenaga kesehatan saat diperlukan. Refleksi ini "
        "bukan tafsir medis dan bukan pengganti nasihat ulama atau tenaga kesehatan."
    ),
    "note": "Refleksi ini bukan tafsir, bukan fatwa, dan bukan analisis medis.",
}


def _policy(decision: PolicyDecision | None, policy_id: str):
    return decision.get_policy(policy_id) if decision else None


def _append_policy_notes(
    answer: str,
    decision: PolicyDecision | None,
    *,
    skip: tuple[str, ...] = (),
) -> str:
    if not decision:
        return answer

    notes: list[str] = []
    for result in decision.results:
        if result.policy_id in skip or not result.message:
            continue
        if result.message in answer or result.message in notes:
            continue
        if result.policy_id.startswith("policy_engine_failure.") or result.status in {
            "caution",
            "restrict",
            "block",
        }:
            notes.append(result.message)
        if len(notes) == 3:
            break

    if not notes:
        return answer

    return f"{answer}\n\nCatatan kebijakan:\n" + "\n".join(f"- {note}" for note in notes)


def build_answer(
    intent: str,
    safety_level: str,
    decision: PolicyDecision | None = None,
) -> str:
    medical = _policy(decision, "medical_safety")
    authority = _policy(decision, "authority_boundary")
    islamic = _policy(decision, "islamic_boundary")
    halal = _policy(decision, "halal_thayyib")
    product_claim = _policy(decision, "product_claims")

    if intent == "danger_sign" or safety_level == "emergency" or (
        medical and medical.status == "critical"
    ):
        answer = (
            "Keluhan seperti ini termasuk tanda bahaya.\n\n"
            "Segera hubungi layanan darurat setempat atau datang ke IGD/fasilitas kesehatan terdekat sekarang. "
            "Jika ada orang di dekatmu, minta ditemani dan jangan menyetir sendiri.\n\n"
            "VitaNusa AI tidak dapat menangani keadaan darurat, memberi diagnosis, atau mengarahkan ke produk."
        )
        if halal or product_claim:
            answer += (
                " Pembahasan status halal, klaim, atau evaluasi produk dapat dilakukan setelah kondisi aman."
            )
        return answer

    if authority and authority.blocks_response:
        boundary_type = authority.metadata.get("boundary_type")
        if boundary_type == "dose":
            answer = (
                "Saya tidak dapat memberikan dosis, resep, atau memilihkan obat untuk kondisi pribadi melalui chat.\n\n"
                "Tanyakan kepada dokter atau apoteker yang berwenang, ikuti label resmi untuk obat bebas, "
                "dan jangan menghentikan obat dokter tanpa arahan."
            )
        elif boundary_type == "diagnosis":
            answer = (
                "Saya tidak dapat memastikan diagnosis atau menyatakan kamu terkena penyakit tertentu dari chat.\n\n"
                "Saya hanya dapat membantu edukasi umum dan menyiapkan hal yang perlu ditanyakan kepada tenaga kesehatan."
            )
        else:
            answer = (
                "Saya tidak dapat menentukan produk yang cocok atau aman untuk kondisi pribadi.\n\n"
                "Baca label resmi dan konsultasikan dengan tenaga kesehatan bila ada penyakit, kehamilan, alergi, "
                "usia khusus, atau obat rutin. Produk bukan pengganti pemeriksaan maupun pengobatan."
            )
        return _append_policy_notes(
            answer,
            decision,
            skip=("authority_boundary", "medical_safety"),
        )

    if product_claim and product_claim.blocks_response:
        answer = (
            "Produk herbal atau suplemen tidak boleh dipastikan menyembuhkan penyakit, menggantikan obat dokter, "
            "atau pasti aman untuk semua orang.\n\n"
            "Yang aman dilakukan adalah memeriksa label, komposisi, peringatan, izin yang tercantum, kualitas bukti, "
            "dan berkonsultasi untuk kondisi pribadi. Produk hanya opsi pendukung, bukan solusi utama."
        )
        if "universal_safety_claim_detected" in product_claim.reasons:
            answer += (
                "\n\nAlami tidak otomatis halal, dan halal tidak otomatis cocok atau aman "
                "untuk setiap orang."
            )
        return _append_policy_notes(
            answer,
            decision,
            skip=("product_claims", "medical_safety"),
        )

    if islamic and islamic.blocks_response:
        answer = (
            "Saya tidak dapat memberi fatwa halal-haram final. Saya dapat membantu membedakan bukti resmi, "
            "pernyataan produsen, data yang belum diketahui, dan prinsip kehati-hatian."
        )
        if halal and halal.message:
            answer += f"\n\n{halal.message}"
        answer += (
            "\n\nUntuk keputusan hukum rinci, periksa lembaga halal yang berwenang atau tanyakan kepada ulama yang kompeten."
        )
        return _append_policy_notes(
            answer,
            decision,
            skip=("islamic_boundary", "halal_thayyib"),
        )

    if halal:
        answer = (
            "Dalam VitaNusa AI, status halal tidak boleh ditebak dan thayyib tidak diperlakukan sebagai sertifikat universal.\n\n"
            f"{halal.message or ''}"
        )
        return _append_policy_notes(answer, decision, skip=("halal_thayyib",))

    if intent == "identity":
        return (
            "VitaNusa AI adalah ruang edukasi kesehatan, VitaCheck, artikel, refleksi amanah, "
            "dan informasi reseller produk secara hati-hati.\n\n"
            "Poin penting:\n\n"
            "- membantu memahami kebiasaan sehat\n"
            "- mengarahkan ke artikel edukasi\n"
            "- menjaga batas klaim produk dan kesehatan\n\n"
            "Catatan amanah: VitaNusa AI bukan dokter dan tidak menggantikan tenaga kesehatan."
        )

    if intent == "vitacheck":
        return (
            "VitaCheck adalah alat refleksi kebiasaan sehat, bukan alat diagnosis dan bukan penilai kadar iman.\n\n"
            "Poin penting:\n\n"
            "- melihat pola tidur, minum, makan, gerak ringan, energi, pencernaan, stres ringan, dan literasi produk\n"
            "- membantu memilih satu kebiasaan kecil untuk diperbaiki\n"
            "- hasilnya tidak menentukan kondisi tubuh atau hukum agama\n\n"
            "Konsultasikan ke tenaga kesehatan bila keluhan berat, menetap, atau memburuk."
        )

    if intent == "article_search":
        return (
            "Bisa. Artikel VitaNusa AI disiapkan sebagai bacaan edukatif tentang kesehatan, kebiasaan harian, "
            "VitaCheck, dan literasi produk.\n\n"
            "Pilih artikel yang paling dekat dengan kebutuhanmu dan jangan memakainya sebagai diagnosis pribadi. "
            "Bila ada gejala berat, memburuk, atau kondisi khusus, utamakan tenaga kesehatan."
        )

    if intent == "health_general":
        answer = (
            "Saya paham, keluhan seperti ini bisa membuat tidak nyaman. Saya tidak bisa memastikan penyebabnya "
            "dari chat, jadi gunakan ini sebagai edukasi umum.\n\n"
            "Yang bisa dilakukan:\n\n"
            "- istirahat cukup dan minum air secara wajar\n"
            "- makan ringan sesuai toleransi tubuh\n"
            "- amati durasi, pemicu, dan apakah keluhan memburuk\n"
            "- hindari obat resep tanpa arahan tenaga kesehatan\n\n"
            f"{COMMON_HEALTH_DISCLAIMER}"
        )
        return _append_policy_notes(answer, decision, skip=("medical_safety",))

    if intent == "medication_request":
        return (
            "Saya tidak dapat memberikan dosis, resep, atau memilihkan obat untuk kondisi pribadi melalui chat.\n\n"
            "Tanyakan dosis dan pilihan obat kepada dokter atau apoteker yang berwenang. Jangan memakai obat resep "
            "milik orang lain atau menghentikan obat dokter tanpa arahan."
        )

    if intent == "product_claim":
        answer = (
            "Terima kasih sudah bertanya dengan hati-hati. Produk herbal atau suplemen tidak boleh dipastikan "
            "menyembuhkan penyakit tertentu, dan bukan pengganti obat atau kontrol dokter.\n\n"
            "Cek label, komposisi, aturan penggunaan, peringatan, serta bukti yang tersedia. "
            "Untuk kondisi khusus atau obat rutin, konsultasikan lebih dahulu."
        )
        return _append_policy_notes(answer, decision)

    if intent == "quranic_reflection":
        return (
            "Saya bisa membantu sebagai refleksi umum, bukan tafsir baru dan bukan fatwa.\n\n"
            "Menjaga kesehatan adalah bagian dari amanah; ikhtiar berjalan bersama tawakal. "
            "VitaNusa AI tidak menilai sebab spiritual penyakit dan tidak menggantikan ulama atau tenaga kesehatan."
        )

    if intent == "contact_admin":
        return (
            "Kamu bisa menghubungi admin VitaNusa AI untuk pertanyaan umum seputar website, artikel, VitaCheck, "
            "atau katalog reseller. Admin bukan pengganti dokter, apoteker, ahli gizi, atau tenaga kesehatan."
        )

    return _append_policy_notes(SAFE_FALLBACK_ANSWER, decision)


def _is_product_catalog_route(href: str) -> bool:
    normalized = href.strip().lower().split("?", 1)[0].split("#", 1)[0]
    return (
        normalized in {"products", "products/", "products/index.html"}
        or "/products/" in normalized
    )


def build_actions(
    intent: str,
    decision: PolicyDecision | None = None,
) -> list[dict[str, str]]:
    prohibited = set(decision.prohibited_actions if decision else ())

    if "show_articles" in prohibited or "seek_emergency_help" in (
        decision.allowed_actions if decision else ()
    ):
        return []

    if intent == "identity":
        actions = IDENTITY_ACTIONS
    elif intent == "vitacheck":
        actions = [
            {"label": "Mulai VitaCheck", "href": "vitacheck.html"},
            {"label": "Baca Cara Memakai VitaCheck", "href": "articles/cara-memakai-vitacheck.html"},
        ]
    elif intent == "article_search":
        actions = [{"label": "Baca Artikel", "href": "articles/"}]
    elif intent == "product_claim":
        actions = [
            {"label": "Prinsip Amanah", "href": "prinsip-amanah.html"},
            {"label": "Baca Produk Bukan Jalan Pintas", "href": "articles/produk-bukan-jalan-pintas.html"},
        ]
    elif intent == "quranic_reflection":
        actions = [{"label": "Prinsip Amanah", "href": "prinsip-amanah.html"}]
    elif intent == "contact_admin":
        actions = [{"label": "Hubungi Admin", "href": "contact.html"}]
    else:
        actions = []

    if "run_vitacheck" in prohibited:
        actions = [action for action in actions if "vitacheck" not in action["href"].lower()]
    if "show_products" in prohibited:
        actions = [
            action
            for action in actions
            if not _is_product_catalog_route(action["href"])
        ]

    return actions


def build_quranic_reflection() -> dict[str, str]:
    return QURANIC_REFLECTION.copy()
