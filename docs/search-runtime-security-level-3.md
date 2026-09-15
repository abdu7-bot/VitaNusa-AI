# Search Runtime Security — Level 3

Level 3 mengubah fondasi search provider live dari sekadar konfigurasi aman menjadi outbound request yang dibatasi.

## Proteksi

1. **Runtime DNS/IP validation**
   - Host provider di-resolve tepat sebelum request.
   - Alamat private, loopback, link-local, multicast, unspecified, dan reserved ditolak.
   - Ini defense-in-depth; belum menggantikan egress firewall atau transport yang benar-benar melakukan IP pinning.

2. **Redirect tidak diikuti**
   - `httpx` memakai `follow_redirects=False`.
   - Redirect 3xx dari provider ditolak agar provider tidak dapat memindahkan request ke host lain secara diam-diam.

3. **Timeout**
   - Request outbound memiliki timeout yang berasal dari `WEB_SEARCH_TIMEOUT_SECONDS`.
   - Router juga memiliki timeout per provider sebagai lapisan kedua.

4. **Response size limit**
   - `WEB_SEARCH_MAX_RESPONSE_BYTES` default 1 MiB.
   - Nilai yang diterima dibatasi 16 KiB sampai 5 MiB.
   - Batas diterapkan baik dari `Content-Length` maupun saat streaming body.

5. **Third-party response validation**
   - JSON harus valid.
   - Hasil hanya menerima URL `http`/`https` tanpa credential atau fragment.
   - Judul dan snippet dipotong ke panjang maksimum sebelum masuk ke model internal.
   - Error provider tidak mengembalikan body mentah atau credential.

6. **Provider adapters**
   - Brave, DuckDuckGo, dan SearXNG mempunyai adapter live yang memakai guard yang sama.
   - Mode `mock` tetap tidak melakukan koneksi jaringan.
   - Provider live harus diaktifkan dan dikonfigurasi secara eksplisit.

## Batas keamanan yang disengaja

DNS preflight mengurangi risiko DNS rebinding, tetapi koneksi HTTP client masih dapat melakukan resolusi DNS sendiri. Untuk deployment produksi dengan threat model tinggi, lapisan berikutnya sebaiknya berupa **egress allowlist/firewall** atau HTTP transport dengan DNS/IP pinning yang benar-benar mengikat koneksi ke alamat yang sudah divalidasi.

Pendekatan ini mengikuti prinsip OWASP untuk tidak mengikuti redirect secara buta, memvalidasi data dari API pihak ketiga, dan membatasi timeout serta resource saat mengonsumsi layanan eksternal.
