# JavaScript VitaNusa AI

Folder ini menyimpan JavaScript terpisah agar kode website lebih rapi, mudah dirawat, dan siap dikembangkan bertahap.

## Struktur

```text
assets/js/
  main.js
  modules/
    nav.js
    premium-ui.js
    nusa-chat.js
    nusa-knowledge.js
    nusa-articles-map.js
    vitacheck.js
```

## Catatan pengembangan

- `main.js` adalah pintu masuk utama dan memanggil modul-modul kecil.
- `modules/nav.js` menangani navigasi mobile.
- `modules/premium-ui.js` menangani sentuhan UI ringan/premium yang aman untuk halaman.
- `modules/nusa-chat.js` menangani UI percakapan Nusa AI: form, bubble, quick replies, dan tombol aksi.
- `modules/nusa-knowledge.js` menangani intent, jawaban, batas keamanan kesehatan, dan tombol arahan chatbot.
- `modules/nusa-articles-map.js` memetakan topik pertanyaan ke artikel VitaNusa AI yang relevan.
- `modules/vitacheck.js` menangani logika VitaCheck.
- Jangan menumpuk logic chatbot di `index.html`. Letakkan logika percakapan di modul agar struktur website tetap bersih dan mudah dirawat.
- Untuk tahap frontend rule-based, jangan menaruh API key di file JavaScript, HTML, atau CSS.
