# VitaNusa AI Content Library Metadata Schema V1

## 1. Tujuan

Metadata dipakai agar artikel yang dibuat admin dan disimpan di Firestore collection `articles` bisa dibaca lebih cerdas oleh Nusa AI sebagai perpustakaan edukasi.

Tujuan metadata bukan menjadikan Nusa AI sebagai dokter, ustadz, mufti, ahli fatwa, atau sales produk. Metadata hanya membantu Nusa AI memilih bacaan yang lebih relevan, menahan konten berisiko, dan menjaga arah edukasi tetap amanah.

Dengan metadata ini, artikel bisa dikelompokkan berdasarkan kategori, intent, tingkat risiko, sensitivitas medis, sensitivitas produk, sensitivitas Islam, kedalaman konten, dan action yang paling aman untuk pengguna.

## 2. Prinsip Utama

- Edukasi dulu, produk belakangan.
- Artikel bukan diagnosis.
- Artikel bukan fatwa.
- Artikel bukan klaim sembuh.
- Artikel harus membantu user memahami, bukan menakut-nakuti.
- Artikel harus menjaga amanah, tabayyun, ikhtiar, tawakal, dan safety first.

Metadata harus dipakai untuk memperjelas batas, bukan untuk memperkeras klaim. Kalau artikel menyentuh kesehatan, produk, atau agama, maka sikapnya harus lebih hati-hati. Ilmu itu pelita, bukan lampu sorot untuk membuat orang silau.

## 3. Field Metadata Wajib

### `title`

- Jenis: `string`
- Wajib: ya
- Fungsi: judul artikel.

### `slug`

- Jenis: `string`
- Wajib: ya
- Fungsi: URL artikel.
- Catatan: harus unik.

### `status`

- Jenis: `string`
- Nilai: `draft` | `published` | `archived`
- Wajib: ya
- Catatan: hanya `published` yang boleh dibaca Nusa AI.

### `category`

- Jenis: `string`
- Wajib: ya
- Fungsi: mengelompokkan artikel agar mudah dicari dan diarahkan.
- Contoh nilai:
  - Kebiasaan Sehat
  - VitaCheck
  - Literasi Produk
  - Prinsip Amanah
  - Kapan Harus ke Tenaga Kesehatan
  - Tubuh sebagai Amanah
  - Ikhtiar dan Tawakal
  - Tidur dan Energi
  - Pencernaan dan Pola Makan
  - Klaim dan Testimoni

### `summary`

- Jenis: `string`
- Wajib: ya
- Fungsi: ringkasan pendek untuk artikel dan scoring Nusa AI.

### `tags`

- Jenis: `array string` atau `comma-separated string`
- Wajib: ya
- Contoh:

```json
["kesehatan", "amanah tubuh", "tidur", "kebiasaan sehat"]
```

### `intentTarget`

- Jenis: `string`
- Wajib: disarankan
- Nilai:
  - `general-health`
  - `habit`
  - `vitacheck`
  - `testimonial`
  - `product-claim`
  - `product-safety`
  - `product-general`
  - `serious-complaint-education`
  - `islamic-reflection`
  - `amanah`
  - `article-general`

Fungsi: membantu Nusa AI memahami maksud utama artikel dan mencocokkannya dengan pertanyaan user.

### `riskLevel`

- Jenis: `string`
- Wajib: disarankan
- Nilai:
  - `low`
  - `medium`
  - `high`

Penjelasan:

- `low`: edukasi umum ringan.
- `medium`: membahas kesehatan/produk dengan kehati-hatian.
- `high`: membahas keluhan berat, klaim penyakit, fatwa, atau topik sensitif.

### `isMedicalSensitive`

- Jenis: `boolean`
- Default: `false`
- Fungsi: menandai artikel yang berkaitan dengan gejala, penyakit, obat, dosis, tenaga kesehatan, atau keluhan berat.

### `isProductSensitive`

- Jenis: `boolean`
- Default: `false`
- Fungsi: menandai artikel yang berkaitan dengan produk, klaim produk, testimoni, label, atau promosi.

### `isIslamicSensitive`

- Jenis: `boolean`
- Default: `false`
- Fungsi: menandai artikel yang menyentuh hukum agama, dalil, adab, amanah, ikhtiar, tawakal, atau prinsip Islam.

### `relatedArticles`

- Jenis: `array string`
- Isi: slug artikel terkait
- Contoh:

```json
["produk-bukan-jalan-pintas", "testimoni-bukan-bukti"]
```

### `contentDepth`

- Jenis: `string`
- Nilai:
  - `basic`
  - `intermediate`
  - `deep`

Fungsi: memberi tanda kedalaman artikel. Artikel `basic` cocok untuk pemula. Artikel `deep` perlu bahasa yang lebih hati-hati dan tidak boleh membuat user merasa digurui.

### `primaryAction`

- Jenis: `string`
- Nilai:
  - `read-article`
  - `start-vitacheck`
  - `read-prinsip-amanah`
  - `contact-admin`
  - `seek-professional-help`
  - `view-products`

Catatan:

Untuk `riskLevel` high atau `isMedicalSensitive` true, `primaryAction` tidak boleh langsung `view-products`.

### `reviewerNote`

- Jenis: `string`
- Opsional
- Fungsi: catatan editor/admin.

## 4. Contoh Dokumen Firestore

```json
{
  "title": "Cara Menjaga Kesehatan sebagai Amanah",
  "slug": "cara-menjaga-kesehatan-sebagai-amanah",
  "status": "published",
  "category": "Tubuh sebagai Amanah",
  "summary": "Panduan sederhana menjaga tubuh dengan tidur, makan, minum, gerak, tabayyun, dan ikhtiar yang seimbang.",
  "tags": ["kesehatan", "amanah tubuh", "ikhtiar", "kebiasaan sehat"],
  "intentTarget": "general-health",
  "riskLevel": "low",
  "isMedicalSensitive": false,
  "isProductSensitive": false,
  "isIslamicSensitive": true,
  "relatedArticles": ["kebiasaan-sehat-7-hari", "sehat-itu-amanah"],
  "contentDepth": "basic",
  "primaryAction": "start-vitacheck",
  "reviewerNote": "Artikel edukasi umum, bukan diagnosis."
}
```

## 5. Aturan Aman untuk Nusa AI

- Nusa AI hanya boleh memakai artikel `published`.
- Draft dan archived tidak boleh muncul.
- Artikel high risk tidak boleh membuat Nusa AI memberi diagnosis, fatwa, atau rekomendasi produk.
- Artikel product sensitive harus mengarah ke Prinsip Amanah atau literasi produk.
- Artikel medical sensitive harus tetap mengingatkan batas edukasi dan tenaga kesehatan.
- Artikel Islamic sensitive tidak boleh membuat Nusa AI memberi fatwa.

## 6. Catatan Implementasi

Metadata membantu scoring artikel, tetapi tidak boleh mengalahkan safety priority. Kalau user bertanya “Saya sakit apa?”, maka diagnosis boundary tetap menang. Kalau user berkata “Saya sesak napas dan makin parah”, maka serious complaint tetap menang. Kalau user bertanya “Nusa AI bisa memberi fatwa?”, maka fatwa boundary tetap menang.

Nusa AI boleh mengarahkan user membaca artikel, tetapi tidak boleh memakai artikel untuk menyimpulkan penyakit, memberi hukum agama final, atau menggiring pembelian produk.
