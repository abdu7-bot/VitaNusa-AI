# Validasi CI VitaNusa AI

## Tujuan

Workflow CI menjaga repository dari marker konflik, karakter Unicode tersembunyi yang berisiko, gitlink tidak sengaja, nama file sensitif yang tercatat, kegagalan build frontend, kesalahan sintaks, kegagalan import backend, dan perubahan respons aman pada endpoint utama.

## Kapan workflow berjalan

Workflow berjalan ketika:

- ada pull request menuju branch main;
- ada push ke branch main;
- dijalankan manual melalui workflow_dispatch.

Run lama pada branch atau ref yang sama dibatalkan ketika commit baru dikirim.

## Job yang dijalankan

1. **Repository safety** — memeriksa karakter bidi/zero-width mencurigakan, marker konflik pada kode/config tracked, gitlink atau deklarasi submodule, serta nama file sensitif. File .env.example tetap diperbolehkan.
2. **Frontend** — menjalankan npm ci, build Vite melalui npm run check, dan pemeriksaan sintaks empat modul JavaScript penting.
3. **Backend** — memasang requirements, mengompilasi dan mengimpor aplikasi FastAPI, menjalankan Uvicorn sementara, lalu menguji endpoint dan guardrail respons menggunakan standard library Python.

Workflow memakai major version 6 dari action resmi `actions/checkout`, `actions/setup-node`, dan `actions/setup-python`. Runtime aplikasi tetap Node.js 20 dan Python 3.12.

## Pemeriksaan Unicode mencurigakan

Karakter bidirectional control dapat mengubah urutan visual teks, sedangkan karakter zero-width dapat menyembunyikan perbedaan di dalam kode atau konfigurasi. Keduanya diblokir pada file teks tracked yang relevan agar perubahan semacam itu selalu terlihat dan ditinjau sebelum merge.

Kegagalan pemeriksaan tidak selalu berarti serangan. Temuan tetap wajib ditinjau karena karakter tersebut dapat berasal dari salin-tempel yang tidak disengaja atau dari perubahan yang berisiko.

## Menjalankan pemeriksaan secara lokal

Dari root repository:

    git grep -n -E '^(<<<<<<<|=======|>>>>>>>)' -- \
      '*.js' '*.py' '*.html' '*.css' '*.json' '*.yml' '*.yaml'
    git ls-files --stage | awk '$1 == "160000" { print }'
    python scripts/check_suspicious_unicode.py
    npm ci
    npm run check
    node --check assets/js/modules/nusa-chat.js
    node --check assets/js/modules/nusa-knowledge.js
    node --check assets/js/modules/nusa-ui-shell.js
    node --check assets/js/modules/vitacheck.js

Dari folder backend:

    python -m pip install -r requirements.txt
    python -m compileall app
    python -c "from app.main import app; print(app.title)"
    python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

Saat Uvicorn hidup, jalankan pada terminal lain dari folder backend:

    python tests/ci_smoke_test.py

Hentikan Uvicorn setelah pengujian.

## Arti kegagalan

- **Build frontend gagal:** perubahan tidak dapat dibundel atau terdapat kesalahan yang menghentikan build.
- **Pemeriksaan sintaks gagal:** salah satu modul JavaScript atau Python tidak dapat diparse.
- **Smoke test gagal:** aplikasi tidak dapat hidup, endpoint dasar berubah, schema respons tidak lengkap, atau guardrail intent penting tidak lagi memenuhi batas aman.
- **Repository safety gagal:** ditemukan karakter Unicode mencurigakan, marker konflik, gitlink tanpa deklarasi yang valid, atau nama file sensitif yang tercatat.

Warning CSS lama yang tidak mengubah exit code build dicatat sebagai pekerjaan terpisah dan tidak disembunyikan oleh workflow ini.

Jangan merge pull request selama salah satu job wajib masih merah.
