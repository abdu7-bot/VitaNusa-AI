# VitaNusa Health Navigator MVP

**Status:** Implemented MVP — 14 September 2026

Navigator Kesehatan sekarang memiliki lapisan backend kecil yang nyata, tetapi tetap sengaja dibatasi agar tidak berubah menjadi mesin diagnosis atau pemberi resep.

## Endpoint

### `GET /navigator/topics`

Mengembalikan registry topik eksplisit yang saat ini didukung:

- demam
- batuk
- sakit kepala
- sakit perut
- diare

Respons menandai scope sebagai `education-only`.

### `POST /navigator/check`

Input:

```json
{
  "topic": "sakit kepala",
  "text": "saya sakit kepala dan bicara pelo"
}
```

Output dapat berupa:

- `education` — edukasi umum saja.
- `high_risk` — arahkan ke tenaga kesehatan karena konteks berisiko tinggi.
- `red_flag` — tanda bahaya ditemukan; tindakan medis diprioritaskan.

## Aturan keselamatan

1. Emergency keyword selalu diperiksa lebih dahulu.
2. Red flag khusus topik tidak dianggap sebagai diagnosis.
3. Keyword risiko tinggi mengarah ke tenaga kesehatan.
4. Navigator tidak menghitung probabilitas penyakit.
5. Navigator tidak memberikan resep atau dosis obat.
6. Registry topik sengaja kecil dan eksplisit agar dapat diuji.

## Hubungan dengan `/ask`

Navigator MVP berdiri sebagai endpoint eksplisit dan tidak mengubah kontrak `/ask`. Ini menjaga kompatibilitas klien lama sambil memberi jalur yang jelas untuk UI Navigator di tahap berikutnya.

## Pengujian

Coverage awal mencakup:

- daftar topik eksplisit;
- emergency-first;
- red flag topik;
- jalur edukasi;
- high-risk routing.

Tes backend menggunakan pola `unittest` yang sudah dipakai repository.
