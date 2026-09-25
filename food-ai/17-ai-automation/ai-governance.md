# AI Governance for Food AI

## Role of AI

AI digunakan untuk retrieval, summarization, analysis, anomaly detection, forecasting, simulation, drafting SOP, training, dan decision support.

AI bukan otoritas final untuk:

- keselamatan pangan;
- kepatuhan halal;
- perubahan stok yang material;
- pembayaran/kontrak tanpa otorisasi;
- keputusan ketenagakerjaan sensitif;
- klaim fakta tanpa sumber.

## RAG-ready design

Setiap knowledge chunk harus memiliki:

```yaml
source_id:
chunk_id:
title:
domain:
source_type:
source_url:
source_date:
valid_from:
valid_until:
location:
version:
confidence:
content:
```

## AI response contract

Untuk analisis bisnis, AI sebaiknya menghasilkan:

1. Masalah.
2. Data yang digunakan.
3. Temuan.
4. Asumsi.
5. Perhitungan.
6. Alternatif.
7. Risiko.
8. Eksperimen yang disarankan.
9. Cara mengukur hasil.
10. Sumber dan timestamp data.

## Hallucination controls

- Retrieval wajib untuk pertanyaan yang membutuhkan data internal.
- Angka tanpa sumber diberi status unknown/estimate.
- Konflik sumber ditampilkan, bukan diratakan diam-diam.
- Knowledge lama dapat ditandai deprecated.
- Semua automated action yang berdampak finansial harus memiliki audit trail.

## Long-term objective

Food AI harus semakin dapat dipercaya seiring bertambahnya data, bukan semakin percaya diri tanpa bukti.
