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


def build_answer(intent: str, safety_level: str) -> str:
    if intent == "danger_sign" or safety_level == "emergency":
        return (
            "Keluhan seperti ini termasuk tanda bahaya.\n\n"
            "Segera hubungi layanan darurat setempat atau datang ke IGD/fasilitas kesehatan terdekat sekarang. "
            "Jika ada orang di dekatmu, minta ditemani dan jangan menyetir sendiri.\n\n"
            "Catatan amanah: VitaNusa AI tidak dapat menangani keadaan darurat."
        )

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
            "VitaCheck adalah alat refleksi kebiasaan sehat, bukan alat diagnosis.\n\n"
            "Poin penting:\n\n"
            "- melihat pola tidur, minum, makan, gerak ringan, energi, pencernaan, stres ringan, dan literasi produk\n"
            "- membantu memilih satu kebiasaan kecil untuk diperbaiki\n"
            "- hasilnya tidak menentukan kondisi tubuh\n\n"
            "Yang bisa dilakukan:\n\n"
            "- isi dengan jujur\n"
            "- pilih satu fokus kecil untuk beberapa hari\n"
            "- konsultasikan ke tenaga kesehatan bila keluhan berat, menetap, atau memburuk"
        )

    if intent == "article_search":
        return (
            "Bisa. Artikel VitaNusa AI disiapkan sebagai bacaan edukatif tentang kesehatan, kebiasaan harian, "
            "VitaCheck, dan literasi produk.\n\n"
            "Yang bisa dilakukan:\n\n"
            "- pilih artikel yang paling dekat dengan kebutuhanmu\n"
            "- baca Catatan Amanah di artikel\n"
            "- jangan memakai artikel sebagai diagnosis pribadi\n\n"
            "Catatan amanah: bila ada gejala berat, memburuk, atau kondisi khusus, utamakan tenaga kesehatan."
        )

    if intent == "health_general":
        return (
            "Saya paham, keluhan seperti ini bisa membuat tidak nyaman. Saya tidak bisa memastikan penyebabnya "
            "dari chat, jadi gunakan ini sebagai edukasi umum.\n\n"
            "Yang bisa dilakukan:\n\n"
            "- istirahat cukup dan minum air secara wajar\n"
            "- makan ringan sesuai toleransi tubuh\n"
            "- amati durasi, pemicu, dan apakah keluhan memburuk\n"
            "- hindari obat resep tanpa arahan tenaga kesehatan\n\n"
            "Segera cari bantuan medis bila muncul nyeri dada berat, sesak napas berat, pingsan, kejang, "
            "lemah separuh tubuh, perdarahan hebat, alergi berat, pikiran menyakiti diri, atau keluhan makin berat.\n\n"
            f"{COMMON_HEALTH_DISCLAIMER}"
        )

    if intent == "product_claim":
        return (
            "Terima kasih sudah bertanya dengan hati-hati. Produk herbal atau suplemen tidak boleh dipastikan "
            "menyembuhkan penyakit tertentu, dan bukan pengganti obat atau kontrol dokter.\n\n"
            "Yang bisa dilakukan:\n\n"
            "- cek label, komposisi, aturan penggunaan, dan izin edar yang tercantum\n"
            "- perhatikan potensi alergi atau interaksi dengan obat yang sedang digunakan\n"
            "- konsultasikan dulu bila punya penyakit kronis, sedang minum obat dokter, hamil, menyusui, lansia, atau untuk anak\n\n"
            "Catatan amanah: produk hanya boleh dibahas sebagai informasi reseller atau dukungan kebiasaan sehat, "
            "bukan janji hasil. Jangan menghentikan obat dokter tanpa arahan tenaga kesehatan."
        )

    if intent == "quranic_reflection":
        return (
            "Saya bisa membantu sebagai refleksi umum, bukan tafsir baru dan bukan fatwa.\n\n"
            "Poin penting:\n\n"
            "- menjaga kesehatan adalah bagian dari amanah\n"
            "- ikhtiar bisa berupa mencari informasi yang benar dan langkah hidup sehat\n"
            "- tawakal tetap berjalan bersama usaha yang aman\n\n"
            "Catatan amanah: VitaNusa AI tidak menilai sebab spiritual kondisi seseorang dan tidak mencocokkan ayat "
            "dengan teori medis. Bila ada keluhan berat, cari bantuan tenaga kesehatan."
        )

    if intent == "contact_admin":
        return (
            "Kamu bisa menghubungi admin VitaNusa AI untuk pertanyaan umum seputar website, artikel, VitaCheck, "
            "atau katalog reseller.\n\n"
            "Poin penting:\n\n"
            "- admin membantu urusan informasi umum dan kontak\n"
            "- admin bukan pengganti dokter, apoteker, ahli gizi, atau tenaga kesehatan\n"
            "- untuk tanda bahaya, utamakan fasilitas kesehatan atau layanan darurat"
        )

    return SAFE_FALLBACK_ANSWER


def build_actions(intent: str) -> list[dict[str, str]]:
    if intent == "identity":
        return IDENTITY_ACTIONS
    if intent == "vitacheck":
        return [
            {"label": "Mulai VitaCheck", "href": "vitacheck.html"},
            {"label": "Baca Cara Memakai VitaCheck", "href": "articles/cara-memakai-vitacheck.html"},
        ]
    if intent == "article_search":
        return [{"label": "Baca Artikel", "href": "articles/"}]
    if intent == "product_claim":
        return [
            {"label": "Prinsip Amanah", "href": "prinsip-amanah.html"},
            {"label": "Baca Produk Bukan Jalan Pintas", "href": "articles/produk-bukan-jalan-pintas.html"},
        ]
    if intent == "quranic_reflection":
        return [{"label": "Prinsip Amanah", "href": "prinsip-amanah.html"}]
    if intent == "contact_admin":
        return [{"label": "Hubungi Admin", "href": "contact.html"}]
    return []


def build_quranic_reflection() -> dict[str, str]:
    return QURANIC_REFLECTION.copy()
