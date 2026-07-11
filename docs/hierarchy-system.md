# Sistem Hierarki dan Policy Engine VitaNusa AI

Dokumen ini menjelaskan cara menambah prinsip atau hierarki baru tanpa menyebarkan cabang `if/elif` ke backend, prompt, halaman HTML, dan frontend.

## 1. Arsitektur

```text
Konstitusi Nilai
        ↓
Policy Registry
        ↓
Policy Engine
        ↓
Specialized Policies
        ↓
PolicyDecision
        ↓
Response Router
        ↓
Frontend / Artikel / VitaCheck / Produk
```

Prinsip utama: **satu aturan memiliki satu pemilik teknis utama**.

## 2. Empat jenis hierarki

1. **Nilai** — konsep stabil seperti amanah, kebenaran, dan maslahat.
2. **Keselamatan/keputusan** — urutan saat beberapa aturan aktif bersamaan.
3. **Konten** — urutan peringatan, edukasi, artikel, VitaCheck, lalu produk.
4. **Domain** — kepemilikan policy seperti `medical_safety` atau `halal_thayyib`.

Jangan memasukkan semuanya ke satu daftar raksasa.

## 3. Kontrak hasil

Setiap policy mengembalikan `PolicyResult` atau `None`.

Field wajib:

- `policy_id`: unik dan stabil;
- `domain`: salah satu domain resmi;
- `status`: `allow`, `inform`, `caution`, `restrict`, `block`, atau `critical`;
- `priority`: mengikuti rentang resmi.

Field opsional:

- `blocks_response`;
- `message`;
- `recommended_action`;
- `reasons`;
- `metadata`, termasuk `allowed_actions` dan `prohibited_actions`.

Warning biasa tidak boleh otomatis menjadi blocker.

## 4. Rentang prioritas

| Rentang | Makna |
|---|---|
| 1000–1099 | Critical emergency |
| 900–999 | Serious medical risk |
| 800–899 | Authority boundary |
| 700–799 | Islamic/halal boundary |
| 600–699 | Product claim restriction |
| 500–599 | Content integrity |
| 300–499 | Educational guidance |
| 100–299 | Recommendation/navigation |

Gunakan angka yang bermakna di dalam band. Jangan mengambil angka acak hanya agar policy “menang”.

## 5. Cara menambah policy

1. **Tentukan domain.** Jangan membuat domain baru bila domain resmi sudah cukup.
2. **Tentukan jenis aturan.** Nilai, syarat, warning, restriction, blocker, atau critical.
3. **Tentukan pemilik aturan.** Satu class policy menjadi sumber keputusan.
4. **Tentukan data yang dibutuhkan.** Jangan menebak data yang tidak tersedia.
5. **Buat hasil policy.** Sertakan alasan dan action yang diizinkan/dilarang.
6. **Daftarkan secara eksplisit.** Tambahkan instance ke `POLICY_REGISTRY`.
7. **Tambahkan test.** Uji positif, negatif, konflik, urutan, dan fallback gagal.
8. **Jangan salin logika ke frontend.** Frontend hanya merender keputusan dan menjaga fallback kompatibel.
9. **Perbarui dokumentasi publik bila relevan.** Detail internal tidak perlu dipajang kepada pengguna.

## 6. Registry

Registry sengaja eksplisit:

```python
POLICY_REGISTRY = (
    MedicalSafetyPolicy(),
    AuthorityBoundaryPolicy(),
    IslamicBoundaryPolicy(),
    HalalThayyibPolicy(),
    ProductClaimsPolicy(),
    ContentIntegrityPolicy(),
)
```

Tidak digunakan auto-discovery karena jumlah policy masih kecil dan audit manual lebih penting daripada “sihir” impor otomatis.

`validate_registry` menolak:

- `policy_id` kosong;
- `policy_id` duplikat;
- domain tidak resmi;
- objek tanpa method `evaluate`.

## 7. Conflict resolution

Policy engine:

1. menjalankan semua policy;
2. menangkap kegagalan policy secara terisolasi;
3. memvalidasi hasil;
4. mengurutkan hasil dari prioritas tertinggi;
5. menggabungkan warning dan action;
6. menentukan `response_blocked` tanpa membuang hasil lain.

`dominant_policy` adalah hasil prioritas tertinggi, bukan satu-satunya hasil.

## 8. Fallback gagal

Bila satu policy melempar exception atau mengembalikan hasil tidak valid, engine menghasilkan warning konservatif `policy_engine_failure.<policy_id>`. Policy lain tetap berjalan.

Jangan menangkap error lalu diam-diam menganggap policy lolos.

## 9. Backward compatibility `/ask`

Field lama tetap ada:

- `answer`
- `intent`
- `safetyLevel`
- `recommendedAction`
- `actions`
- `sources`
- `quranicReflection`

Field baru:

```json
{
  "policyDecision": {
    "dominantPolicy": "medical_safety",
    "responseBlocked": true,
    "warnings": [],
    "allowedActions": [],
    "prohibitedActions": [],
    "recommendedAction": null,
    "results": []
  }
}
```

Frontend lama dapat mengabaikan field baru dan tetap memakai `answer`, `actions`, serta field lama lainnya.

## 10. Checklist review policy baru

- Apakah policy menduplikasi policy lain?
- Apakah priority berada pada band yang benar?
- Apakah warning benar-benar perlu memblokir?
- Apakah data berasal dari bukti atau dugaan?
- Apakah emergency tetap menang?
- Apakah produk dapat muncul terlalu cepat?
- Apakah policy berpotensi memberi diagnosis atau fatwa?
- Apakah test konflik sudah ada?
- Apakah kegagalan policy aman?
- Apakah dokumentasi sesuai implementasi?

## 11. Perintah test

```bash
cd backend
python -m unittest discover -s tests -v
python -m compileall -q app tests
```

Untuk smoke test HTTP:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000
python tests/ci_smoke_test.py
```
