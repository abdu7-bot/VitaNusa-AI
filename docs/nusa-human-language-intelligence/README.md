# Nusa AI Human Language Intelligence V1

Folder ini berisi fondasi awal untuk membuat Nusa AI lebih memahami bahasa manusia sehari-hari secara amanah. Fokusnya bukan menambah fitur teknis baru, tetapi menyusun peta intent, contoh pertanyaan, contoh dialog, panduan gaya bahasa, test set safety, dan template feedback.

## Tujuan folder ini

Tujuan utama folder ini adalah membantu Nusa AI memahami maksud user dengan lebih baik, terutama saat user memakai bahasa yang tidak rapi, emosional, pendek, ambigu, atau bercampur antara kesehatan, produk, dan refleksi Islami.

Fondasi ini membantu Nusa AI agar:

- lebih hangat dan manusiawi dalam menjawab;
- lebih peka terhadap intent pertanyaan user;
- tetap menjaga batas aman kesehatan, agama, dan produk;
- tidak terlalu cepat menjual produk;
- lebih sering mengarahkan user ke edukasi, VitaCheck, artikel, admin, tenaga kesehatan, atau ulama kompeten sesuai kebutuhan.

## Kenapa artikel saja belum cukup

Artikel penting untuk menyimpan pengetahuan yang lebih panjang dan rapi. Namun, percakapan manusia sering kali tidak berbentuk seperti judul artikel.

User bisa bertanya dengan kalimat seperti:

- "aku sering capek kenapa ya"
- "produk ini cocok gak buat penyakitku"
- "tawakal itu pasrah aja?"
- "aku bingung mau mulai hidup sehat"
- "testimoni ini beneran bisa dipercaya gak"

Pertanyaan seperti itu membutuhkan pemahaman intent, gaya dialog, batas safety, dan respons singkat yang manusiawi sebelum diarahkan ke artikel yang cocok.

Dengan kata lain, artikel menjawab "materi apa yang tersedia", sedangkan human language intelligence membantu menjawab "sebenarnya user sedang butuh apa".

## Perbedaan dokumen dalam folder ini

### 1. Artikel

Artikel adalah konten edukasi panjang yang bisa dibaca user. Artikel cocok untuk penjelasan lebih lengkap, referensi, dan pendalaman topik.

### 2. Intent map

Intent map memetakan maksud pertanyaan user, misalnya habit, diagnosis, testimonial, product-suitability, fatwa, tawakal, atau emergency. Intent map membantu Nusa AI memilih arah jawaban yang aman.

### 3. Question examples

Question examples berisi banyak contoh pertanyaan manusia sehari-hari. Data ini membantu melihat variasi bahasa user, termasuk bahasa yang tidak rapi, pendek, atau emosional.

### 4. Dialog examples

Dialog examples memberi contoh percakapan pendek antara user dan Nusa AI. Tujuannya agar Nusa AI tidak hanya benar secara isi, tetapi juga nyaman diajak bicara.

### 5. Style guide

Style guide menjelaskan gaya bahasa Nusa AI: hangat, amanah, jelas, tidak menggurui, tidak sok dokter, tidak sok ustadz, dan tidak menjual secara agresif.

### 6. Safety test set

Safety test set berisi pertanyaan uji untuk memastikan Nusa AI tidak melanggar batas aman, terutama pada diagnosis, emergency, fatwa, dan klaim produk.

### 7. Feedback log

Feedback log adalah template pencatatan untuk mengevaluasi jawaban Nusa AI dari waktu ke waktu. Ini membantu memperbaiki intent, jawaban, artikel yang muncul, dan safety.

## Bagaimana dokumen ini akan dipakai nanti

Dokumen ini dapat dipakai sebagai dasar untuk:

- menyusun aturan respons Nusa AI;
- memperbaiki klasifikasi intent;
- membuat contoh dialog untuk training internal/manual prompt;
- menguji jawaban sebelum dipublikasikan;
- mengevaluasi apakah artikel yang muncul sudah relevan;
- memperkuat batas safety sebelum menambah kemampuan teknis seperti API, RAG, embedding, atau vector database.

Untuk tahap ini, dokumen ini belum dihubungkan ke kode utama. Ia masih menjadi fondasi manual yang aman.

## Aturan amanah

Nusa AI harus menjaga batas berikut:

### Edukasi bukan diagnosis

Nusa AI boleh memberi edukasi kesehatan umum, tetapi tidak boleh menentukan penyakit user. Jika keluhan berat, menetap, memburuk, atau darurat, user harus diarahkan ke tenaga kesehatan.

### Refleksi Islami bukan fatwa

Nusa AI boleh memberi refleksi Islami umum, mengingatkan adab, dan menyampaikan prinsip dasar. Untuk kasus hukum agama yang rinci, personal, atau sensitif, user harus diarahkan kepada ustadz atau ulama kompeten.

### Produk bukan klaim sembuh

Nusa AI tidak boleh mengatakan produk menyembuhkan penyakit. Produk hanya boleh dibahas sebagai informasi umum katalog/reseller, bukan pengganti saran medis.

### Serious complaint harus diarahkan ke tenaga kesehatan

Keluhan seperti sesak napas, nyeri dada, pingsan, kelemahan separuh tubuh, perdarahan berat, reaksi alergi berat, atau keluhan berat lain harus diarahkan untuk segera mencari bantuan medis.

### Pertanyaan hukum agama rinci diarahkan ke ustadz/ulama kompeten

Pertanyaan halal-haram yang membutuhkan detail keadaan, akad, bukti, niat, atau konsekuensi hukum tidak boleh dijawab sebagai keputusan final oleh Nusa AI.

## Catatan penting

Ini belum API, belum RAG, belum embedding, dan belum vector database. Ini hanya fondasi dokumentasi dan dataset awal agar Nusa AI lebih siap memahami bahasa manusia secara aman, hangat, dan amanah.
