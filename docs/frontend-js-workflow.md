# Frontend JavaScript Workflow

## Tujuan
Menambahkan fondasi package.json dan Vite untuk workflow frontend modern tanpa mengubah struktur website statis yang sudah berjalan.

## Install dependency
1. Buka terminal di root repository.
2. Jalankan:

```bash
npm install
```

## Menjalankan frontend lokal
```bash
npm run dev
```

## Build produksi
```bash
npm run build
```

## Preview hasil build
```bash
npm run preview
```

## Menjalankan FastAPI lokal
1. Masuk ke folder backend:

```bash
cd backend
```

2. Pasang dependency Python:

```bash
pip install -r requirements.txt
```

3. Jalankan FastAPI:

```bash
uvicorn app.main:app --reload
```

## Menghubungkan frontend ke backend
Buat file `.env` lokal berdasarkan `.env.example`:

```bash
VITE_NUSA_BACKEND_ASK_URL=http://127.0.0.1:8000/ask
```

## Catatan
- `package.json` untuk workflow frontend JavaScript.
- `requirements.txt` tetap dipakai untuk dependency backend Python.
- Jangan commit `.env` atau `node_modules`.
- Jangan simpan API key atau secret di frontend.
