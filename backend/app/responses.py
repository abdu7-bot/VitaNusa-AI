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
            "Saya ikut prihatin. Keluhan seperti ini termasuk tanda bahaya. "
            "Segera hubungi layanan darurat setempat atau datang ke IGD/fasilitas kesehatan terdekat. "
            "Jangan menunda untuk mencari bantuan langsung. VitaNusa AI tidak dapat menangani keadaan darurat."
        )

    if intent == "identity":
        return (
            "VitaNusa AI adalah asisten edukasi kesehatan dan wellness yang membantu pengguna "
            "memahami kebiasaan sehat, membaca artikel edukatif, mencoba VitaCheck, dan mengenal "
            "prinsip amanah dalam menjaga kesehatan. VitaNusa AI bukan dokter dan tidak menggantikan "
            "konsultasi tenaga kesehatan. Untuk keluhan serius atau tanda bahaya, pengguna tetap perlu "
            "mencari bantuan medis."
        )

    if intent == "vitacheck":
        return (
            "VitaCheck adalah alat refleksi kebiasaan sehat, bukan alat diagnosis. "
            "Kamu bisa memakainya untuk melihat pola tidur, minum, makan, gerak ringan, energi, "
            "pencernaan, stres ringan, dan literasi produk. Tingkat urgensinya rendah bila hanya untuk "
            "refleksi kebiasaan. Langkah aman: isi dengan jujur, pilih satu kebiasaan kecil untuk diperbaiki, "
            "lalu evaluasi lagi beberapa hari kemudian. Jika ada keluhan berat atau menetap, tetap konsultasikan "
            "ke tenaga kesehatan. Catatan amanah: hasil VitaCheck bukan penentu kondisi tubuh."
        )

    if intent == "article_search":
        return (
            "Bisa. Artikel VitaNusa AI disiapkan sebagai bacaan edukatif agar pengguna memahami kesehatan, "
            "kebiasaan harian, VitaCheck, dan literasi produk dengan lebih aman. Tingkat urgensinya rendah "
            "untuk pencarian bacaan umum. Langkah aman: pilih artikel yang sesuai kebutuhan, baca Catatan Amanah, "
            "dan jangan memakai artikel sebagai diagnosis pribadi. Jika pertanyaanmu terkait gejala berat, "
            "memburuk, atau kondisi khusus, sebaiknya cari bantuan tenaga kesehatan."
        )

    if intent == "health_general":
        return (
            "Saya mengerti, keluhan seperti ini bisa membuat tidak nyaman. Informasi berikut bersifat edukasi umum, "
            "bukan diagnosis. Tingkat urgensi biasanya sedang bila keluhan ringan dan tidak disertai tanda bahaya. "
            "Langkah aman: istirahat cukup, minum air, makan yang ringan dan sesuai toleransi tubuh, amati durasi "
            "serta pemicunya, dan hindari mencoba obat resep tanpa arahan tenaga kesehatan. Segera periksa ke dokter "
            "atau fasilitas kesehatan bila keluhan berat, makin memburuk, disertai demam tinggi, muntah terus, "
            "perdarahan, dehidrasi, sulit bernapas, nyeri dada, pingsan, atau tidak membaik. Edukasi singkat: tubuh "
            "sering memberi sinyal lewat pola tidur, makan, cairan, stres, dan aktivitas, tetapi penyebab personal "
            "tetap perlu dinilai oleh tenaga kesehatan bila mengkhawatirkan. "
            f"{COMMON_HEALTH_DISCLAIMER}"
        )

    if intent == "product_claim":
        return (
            "Terima kasih sudah bertanya dengan hati-hati. Produk herbal atau suplemen tidak dapat dipastikan sebagai "
            "terapi penyakit, pengganti obat dokter, atau jaminan hasil. Tingkat urgensi menjadi tinggi bila terkait "
            "penyakit kronis, obat dokter, alergi, ibu hamil, anak kecil, lansia, atau klaim hasil mutlak. Langkah aman: "
            "verifikasi label, izin edar, komposisi, aturan penggunaan, potensi alergi, dan kemungkinan interaksi dengan "
            "obat yang sedang digunakan. Untuk kondisi seperti diabetes atau penyakit lain, keputusan perawatan tetap "
            "perlu mengikuti dokter atau tenaga kesehatan. Edukasi amanah: produk hanya boleh dibahas sebagai informasi "
            "reseller atau dukungan menjaga kebiasaan sehat, bukan sebagai janji hasil. "
            f"{COMMON_HEALTH_DISCLAIMER}"
        )

    if intent == "quranic_reflection":
        return (
            "Saya bisa membantu sebagai refleksi umum, bukan tafsir baru dan bukan fatwa. Dalam kesehatan, prinsip amanah "
            "mendorong kita menjaga kehidupan, mencari informasi yang benar, berikhtiar dengan cara yang aman, dan tetap "
            "bertawakal setelah berusaha. Tingkat urgensi bergantung pada kondisi kesehatan yang menyertai pertanyaan. "
            "Jika ada keluhan berat, jangan cukup berhenti pada refleksi; cari bantuan tenaga kesehatan. Catatan amanah: "
            "VitaNusa AI tidak menilai sebab spiritual kondisi seseorang dan tidak mencocokkan ayat dengan teori medis."
        )

    if intent == "contact_admin":
        return (
            "Kamu bisa menghubungi admin VitaNusa AI untuk pertanyaan umum seputar website, artikel, VitaCheck, atau katalog "
            "reseller. Tingkat urgensinya rendah untuk administrasi biasa. Namun untuk keluhan medis pribadi, kondisi berat, "
            "atau kebutuhan resep/dosis, admin bukan pengganti dokter, apoteker, ahli gizi, atau tenaga kesehatan. Jika ada "
            "tanda bahaya, utamakan fasilitas kesehatan atau layanan darurat."
        )

    return (
        "Terima kasih sudah bertanya. Saya akan menjawab dengan prinsip edukasi amanah: informasi umum, tidak mendiagnosis, "
        "tidak memberi dosis obat resep, tidak memberi fatwa final, dan tidak menjanjikan hasil produk. Kamu bisa menulis "
        "lebih spesifik apakah ingin membahas kebiasaan sehat, VitaCheck, artikel edukasi, klaim produk, refleksi amanah, "
        "atau kontak admin. Jika pertanyaanmu memuat gejala berat atau tanda bahaya, segera cari bantuan tenaga kesehatan."
    )


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
