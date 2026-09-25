# Food AI Knowledge Standard

## Purpose

Standar untuk semua pengetahuan yang masuk ke Food AI agar dapat dibaca manusia, dicari AI, dibandingkan, diaudit, dan diperbarui tanpa kehilangan konteks.

## Required fields

```yaml
id:
title:
summary:
domain:
tags:
knowledge_type: fact | formula | procedure | standard | case | opinion | hypothesis
source:
source_date:
applicable_from:
applicable_until:
confidence: high | medium | low
assumptions: []
inputs: []
outputs: []
related_kpi: []
related_sop: []
related_entities: []
last_reviewed:
review_cycle:
owner:
status: draft | reviewed | approved | deprecated
```

## Evidence hierarchy

1. Primary records/data.
2. Official standards or regulations.
3. Manufacturer documentation.
4. Peer-reviewed or professional references.
5. Expert practice.
6. Internal experience.
7. Hypothesis.

A lower-level source can still be useful, tetapi jangan diperlakukan seolah-olah setara dengan sumber primer.

## AI rules

AI harus:

- memisahkan fakta dari asumsi;
- menunjukkan sumber bila tersedia;
- tidak mengarang angka;
- menyatakan ketidakpastian;
- meminta data tambahan bila keputusan bergantung pada data yang belum ada;
- mempertahankan unit, periode, mata uang, dan definisi metrik;
- tidak mengubah estimasi menjadi fakta;
- menyimpan alasan dan asumsi di balik rekomendasi.

## Update rule

Pengetahuan lama tidak otomatis dihapus. Tandai sebagai `deprecated` bila tidak lagi berlaku dan simpan alasan perubahan agar sistem memiliki sejarah pengetahuan.
