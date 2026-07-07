DISCLAIMER = (
    "VitaNusa AI bukan dokter, bukan tenaga medis, dan bukan alat diagnosis. "
    "Informasi ini hanya edukasi umum, bukan pengganti konsultasi profesional. "
    "Untuk keluhan berat, memburuk, atau tanda bahaya, segera hubungi dokter, "
    "fasilitas kesehatan, atau layanan darurat setempat."
)


RESPONSE_TEMPLATES = {
    "serious_complaint": (
        "Keluhan seperti sesak napas, nyeri dada, penurunan kesadaran, perdarahan berat, "
        "atau gejala yang cepat memburuk perlu ditangani sebagai tanda bahaya. "
        "Saya tidak akan merekomendasikan produk untuk kondisi seperti ini. "
        "Mohon segera hubungi tenaga kesehatan atau layanan darurat setempat."
    ),
    "diagnosis_request": (
        "Saya tidak bisa memastikan diagnosis atau menyebut penyakit tertentu dari percakapan ini. "
        "Gejala perlu dinilai dengan pemeriksaan yang sesuai. Catat keluhan, durasi, pemicu, "
        "dan tanda yang menyertai, lalu konsultasikan ke tenaga kesehatan bila menetap, memburuk, "
        "atau mengganggu aktivitas."
    ),
    "product_healing_claim": (
        "Produk tidak boleh diposisikan sebagai obat, pengganti terapi medis, atau jaminan sembuh. "
        "Informasi produk di VitaNusa hanya untuk edukasi reseller dan perlu disampaikan tanpa klaim medis. "
        "Untuk kondisi kesehatan, keputusan perawatan tetap perlu mengikuti arahan tenaga kesehatan."
    ),
    "product_personal_recommendation": (
        "Saya tidak bisa merekomendasikan produk untuk keluhan pribadi. Pilihan produk atau suplemen "
        "perlu mempertimbangkan kondisi tubuh, riwayat penyakit, obat yang sedang digunakan, alergi, "
        "dan arahan tenaga kesehatan. Untuk keluhan yang terasa berat atau menetap, utamakan konsultasi medis."
    ),
    "fatwa_request": (
        "Saya tidak bisa memberi fatwa final atau keputusan halal-haram yang mengikat. "
        "Saya hanya bisa mengingatkan prinsip tabayyun dan amanah: periksa sumber, komposisi, "
        "sertifikasi bila ada, lalu tanyakan kepada ustadz, ulama, atau otoritas yang kompeten."
    ),
    "general_health": (
        "Mulai hidup sehat bisa pelan-pelan: perbaiki tidur, minum cukup, makan lebih seimbang, "
        "bergerak ringan secara rutin, dan kurangi kebiasaan yang terasa membebani tubuh. "
        "Pilih langkah kecil yang realistis agar lebih mudah istiqamah."
    ),
    "general": (
        "Terima kasih sudah bertanya. Saya akan menjawab dengan prinsip edukasi amanah: "
        "memberi informasi umum, menghindari klaim diagnosis, tidak menjanjikan kesembuhan, "
        "dan mendorong ikhtiar yang aman."
    ),
}


def build_answer(intent: str) -> str:
    return RESPONSE_TEMPLATES.get(intent, RESPONSE_TEMPLATES["general"])
