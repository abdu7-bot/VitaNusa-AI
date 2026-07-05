# Nusa AI Question Examples V1

Dokumen ini berisi contoh pertanyaan manusia sehari-hari untuk membantu Nusa AI memahami variasi bahasa user. Jumlah contoh: 150 pertanyaan, dikelompokkan berdasarkan 25 intent, masing-masing 6 contoh.

Format:

Pertanyaan User | Intent | Jawaban Aman Singkat | Action

---

## Intent: greeting

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| halo | greeting | Halo, senang bertemu. Mau mulai dari VitaCheck, artikel, atau tanya kebiasaan sehat? | start-vitacheck |
| assalamualaikum | greeting | Waalaikumussalam. Semoga sehat. Ada yang ingin kamu cek atau pelajari hari ini? | start-vitacheck |
| hai Nusa | greeting | Hai, aku siap bantu dengan edukasi kesehatan dan refleksi amanah. | read-article |
| pagi Nusa | greeting | Pagi. Kita mulai ringan saja, mau cek kebiasaan atau baca artikel pendek? | start-vitacheck |
| boleh tanya? | greeting | Boleh. Silakan tanya, nanti aku bantu jawab dengan batas aman. | read-article |
| ada orang? | greeting | Ada Nusa AI di sini. Kita bahas pelan-pelan sesuai kebutuhanmu. | start-vitacheck |

## Intent: start

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| mulai dari mana ya | start | Mulai dari hal paling dekat: cek kebiasaan lewat VitaCheck atau pilih artikel ringan. | start-vitacheck |
| Nusa AI bisa bantu apa | start | Aku bisa bantu edukasi kesehatan, VitaCheck, artikel, refleksi Islami umum, dan info produk secara amanah. | start-vitacheck |
| aku baru masuk harus ngapain | start | Kita mulai dari VitaCheck agar kamu tahu kebiasaan mana yang perlu diperbaiki dulu. | start-vitacheck |
| menu apa yang paling penting di sini | start | Untuk awal, VitaCheck dan artikel edukasi biasanya paling membantu. | start-vitacheck |
| aku cuma mau lihat-lihat | start | Boleh. Kamu bisa mulai dari artikel edukasi dulu tanpa harus membeli apa pun. | read-article |
| apa yang harus aku klik dulu | start | Klik VitaCheck kalau ingin cek kebiasaan, atau artikel kalau ingin membaca topik tertentu. | start-vitacheck |

## Intent: habit

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| aku mau hidup sehat tapi bingung mulai dari mana | habit | Mulai dari satu kebiasaan kecil dulu, misalnya tidur sedikit lebih teratur malam ini. | start-vitacheck |
| aku bingung mau mulai hidup sehat | habit | Tidak perlu langsung sempurna. Pilih satu kebiasaan yang paling mungkin kamu ulangi. | start-vitacheck |
| aku ingin berubah tapi susah konsisten | habit | Konsisten biasanya lahir dari langkah kecil, bukan target besar yang berat. | read-article |
| gimana biar rajin minum air | habit | Letakkan air dekat tempat aktivitas dan mulai dari target kecil yang realistis. | read-article |
| susah banget olahraga rutin | habit | Mulai dari 5 sampai 10 menit jalan ringan, lalu naikkan pelan-pelan. | read-article |
| aku selalu gagal jaga pola makan | habit | Jangan mulai dari larangan besar. Mulai dari menambah satu pilihan makan yang lebih baik. | start-vitacheck |

## Intent: general-health

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| kenapa tidur itu penting | general-health | Tidur membantu tubuh pulih, menjaga fokus, dan mendukung keseimbangan energi. | read-article |
| minum air putih itu harus berapa banyak | general-health | Kebutuhan tiap orang bisa berbeda, tapi cukup minum dan perhatikan rasa haus serta warna urine secara umum. | read-article |
| makanan sehat harus mahal ya | general-health | Tidak harus. Makanan sederhana, cukup protein, serat, dan tidak berlebihan sudah membantu. | read-article |
| badan rasanya berat terus | general-health | Bisa terkait banyak faktor kebiasaan. Kalau menetap atau berat, sebaiknya cek ke tenaga kesehatan. | start-vitacheck |
| aku sering capek kenapa ya | general-health | Banyak kemungkinan seperti tidur, makan, stres, atau kondisi medis. Aku tidak bisa diagnosis, tapi kita bisa cek kebiasaan dulu. | start-vitacheck |
| boleh makan malam gak kalau mau sehat | general-health | Boleh, yang penting porsi, pilihan makanan, dan waktunya tidak mengganggu tubuhmu. | read-article |

## Intent: vitacheck-start

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| mulai VitaCheck | vitacheck-start | Baik, mulai VitaCheck untuk melihat kebiasaan sehat secara edukatif, bukan diagnosis. | start-vitacheck |
| aku mau cek kebiasaan sehat | vitacheck-start | Silakan mulai VitaCheck. Jawab jujur agar hasil refleksinya lebih berguna. | start-vitacheck |
| tes kebiasaan aku dong | vitacheck-start | Bisa. Kita cek kebiasaan dasar seperti tidur, air, makan, gerak, dan energi. | start-vitacheck |
| VitaCheck itu apa | vitacheck-start | VitaCheck adalah cek kebiasaan sederhana untuk refleksi, bukan alat diagnosis medis. | start-vitacheck |
| aku mau mulai tes sehat | vitacheck-start | Mulai dari VitaCheck dulu. Nanti hasilnya bisa jadi arah langkah kecil. | start-vitacheck |
| cek kesehatan bisa dari sini? | vitacheck-start | Yang bisa dicek di sini adalah kebiasaan sehat, bukan diagnosis penyakit. | start-vitacheck |

## Intent: vitacheck-result

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| skor VitaCheck aku rendah | vitacheck-result | Anggap ini sebagai tanda untuk memilih satu kebiasaan yang paling perlu dibantu dulu. | read-article |
| hasil aku 45 artinya apa | vitacheck-result | Itu bukan diagnosis. Gunakan sebagai refleksi kebiasaan dan mulai dari satu perbaikan kecil. | read-article |
| setelah VitaCheck harus ngapain | vitacheck-result | Pilih satu fokus minggu ini, misalnya tidur, air, makan, atau gerak ringan. | read-article |
| hasilku jelek ya | vitacheck-result | Bukan jelek, itu peta awal. Yang penting langkah kecil berikutnya. | read-article |
| kalau skor bagus berarti sehat total? | vitacheck-result | Belum tentu. Skor hanya membaca kebiasaan, bukan memastikan kondisi medis. | read-article |
| hasil VitaCheck bikin aku takut | vitacheck-result | Tidak perlu panik. Kita pakai hasilnya untuk memperbaiki satu kebiasaan, bukan menakuti diri. | read-article |

## Intent: testimonial

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| testimoni produk itu bisa dipercaya gak | testimonial | Testimoni bisa jadi pengalaman orang, tapi bukan bukti final untuk semua orang. | read-article |
| banyak yang bilang sembuh berarti benar? | testimonial | Belum tentu. Klaim sembuh perlu bukti kuat, bukan hanya cerita pengguna. | read-prinsip-amanah |
| review bagus berarti aman ya | testimonial | Belum tentu. Tetap cek komposisi, izin edar, dan kondisi tubuh sendiri. | read-article |
| aku gampang percaya iklan | testimonial | Bagus kalau kamu mau hati-hati. Biasakan cek bukti, bukan hanya cerita yang emosional. | read-article |
| kalau artis pakai produk itu aman? | testimonial | Figur publik bukan bukti keamanan medis. Tetap perlu cek informasi resmi. | read-prinsip-amanah |
| testimoni before after itu valid gak | testimonial | Bisa menarik, tapi tetap bukan bukti ilmiah final dan bisa dipengaruhi banyak faktor. | read-article |

## Intent: product-claim

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| produk ini bisa menyembuhkan gak | product-claim | Aku tidak boleh menyebut produk menyembuhkan. Klaim medis perlu bukti dan tenaga kesehatan. | read-prinsip-amanah |
| katanya bisa obati penyakit benar gak | product-claim | Jangan jadikan klaim itu sebagai kepastian. Cek bukti, izin, dan konsultasikan bila terkait penyakit. | read-article |
| produk ini bikin badan sehat pasti? | product-claim | Tidak ada jaminan pasti untuk semua orang. Produk hanya informasi umum, bukan pengganti pola hidup dan saran medis. | read-prinsip-amanah |
| boleh tulis klaim sembuh di iklan? | product-claim | Hindari klaim sembuh jika tidak punya dasar yang sah. Itu berisiko tidak amanah. | read-prinsip-amanah |
| kalau banyak yang cocok berarti pasti bagus? | product-claim | Pengalaman orang bisa berbeda. Tetap gunakan tabayyun dan cek kondisi masing-masing. | read-article |
| produk herbal pasti aman kan | product-claim | Tidak selalu. Bahan alami pun bisa punya risiko untuk kondisi tertentu. | read-article |

## Intent: product-safety

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| produk ini aman gak | product-safety | Aku tidak bisa menjamin untuk semua orang. Cek komposisi, izin edar, alergi, dan kondisi pribadi. | contact-admin |
| apa yang harus dicek sebelum beli | product-safety | Cek label, komposisi, izin edar, aturan pakai, alergi, dan klaim yang digunakan. | read-article |
| aku takut salah memilih produk | product-safety | Wajar hati-hati. Jadikan katalog sebagai info umum dan konsultasikan bila punya kondisi medis. | contact-admin |
| kalau sedang minum obat boleh pakai produk ini? | product-safety | Jangan diputuskan sendiri. Tanyakan ke tenaga kesehatan karena bisa ada interaksi. | seek-professional-help |
| ibu hamil boleh pakai ini? | product-safety | Untuk hamil atau menyusui, sebaiknya konsultasi tenaga kesehatan dulu. | seek-professional-help |
| aku punya alergi, aman gak | product-safety | Perlu cek komposisi dan konsultasi bila alerginya serius. Jangan coba-coba tanpa yakin. | seek-professional-help |

## Intent: product-general

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| ada produk apa aja | product-general | Kamu bisa lihat katalog produk sebagai informasi umum, bukan klaim pengobatan. | view-products jika aman |
| boleh lihat katalog | product-general | Boleh, silakan lihat katalog. Tetap utamakan edukasi dan cek kebutuhanmu dulu. | view-products jika aman |
| produk ini untuk apa secara umum | product-general | Bisa dijelaskan secara umum sesuai label, tanpa klaim menyembuhkan penyakit. | contact-admin |
| ada promo gak | product-general | Untuk info promo, hubungi admin atau lihat katalog resmi yang tersedia. | contact-admin |
| aku mau tahu produk pilihan | product-general | Boleh lihat produk pilihan, tapi jangan jadikan sebagai pengganti saran medis. | view-products jika aman |
| produk reseller itu maksudnya apa | product-general | Artinya produk ditampilkan sebagai katalog/reseller, bukan produksi sendiri dan bukan klaim medis. | read-prinsip-amanah |

## Intent: product-suitability

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| produk ini cocok gak buat penyakitku | product-suitability | Aku tidak bisa mencocokkan produk dengan penyakit. Untuk kondisi medis, tanya tenaga kesehatan. | seek-professional-help |
| aku punya maag cocok minum ini gak | product-suitability | Jangan diputuskan dari chat ini. Cek label dan konsultasi tenaga kesehatan bila punya maag. | seek-professional-help |
| yang cocok untuk darah tinggi apa | product-suitability | Aku tidak merekomendasikan produk untuk penyakit. Diskusikan dengan tenaga kesehatan. | seek-professional-help |
| produk mana untuk diabetes | product-suitability | Aku tidak bisa memilihkan produk untuk diabetes. Utamakan arahan dokter atau tenaga kesehatan. | seek-professional-help |
| kalau sering pusing cocok produk apa | product-suitability | Pusing bisa banyak sebab. Jangan pilih produk sebelum memahami penyebabnya dengan tenaga kesehatan. | seek-professional-help |
| aku sakit lambung produk apa yang bagus | product-suitability | Untuk penyakit lambung, jangan jadikan katalog sebagai terapi. Konsultasikan dulu. | seek-professional-help |

## Intent: diagnosis

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| aku sakit apa | diagnosis | Aku tidak bisa mendiagnosis. Catat gejala dan periksa ke tenaga kesehatan bila menetap atau memburuk. | seek-professional-help |
| gejala ini penyakit apa | diagnosis | Gejala yang sama bisa punya banyak sebab. Perlu pemeriksaan langsung untuk memastikan. | seek-professional-help |
| diagnosa dong | diagnosis | Aku tidak bisa memberi diagnosis. Aku bisa bantu susun pertanyaan untuk dibawa ke tenaga kesehatan. | seek-professional-help |
| sering mual berarti sakit apa | diagnosis | Mual bisa banyak penyebab. Jika sering terjadi, sebaiknya diperiksa. | seek-professional-help |
| kepala sering sakit itu kenapa | diagnosis | Penyebabnya bisa ringan sampai serius. Aku bisa bantu cek kebiasaan, tapi bukan diagnosis. | start-vitacheck |
| badan panas dingin aku sakit apa | diagnosis | Jangan menebak diagnosis dari chat. Pantau gejala dan cari bantuan medis bila berat. | seek-professional-help |

## Intent: serious-complaint

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| aku sesak napas | serious-complaint | Sesak napas perlu ditangani serius. Segera cari bantuan medis atau minta orang sekitar membantu. | seek-professional-help |
| dada aku sakit banget | serious-complaint | Jangan ditunda. Segera cari bantuan medis, terutama jika nyeri berat atau menjalar. | seek-professional-help |
| aku hampir pingsan | serious-complaint | Minta bantuan orang sekitar dan segera cari pertolongan medis. | seek-professional-help |
| muntah terus gak berhenti | serious-complaint | Kalau muntah terus atau lemas, segera cari bantuan medis agar tidak terlambat. | seek-professional-help |
| perut sakit parah | serious-complaint | Nyeri perut parah perlu evaluasi langsung. Segera ke fasilitas kesehatan. | seek-professional-help |
| demam tinggi sekali | serious-complaint | Demam tinggi perlu perhatian medis, apalagi jika disertai lemas berat atau sesak. | seek-professional-help |

## Intent: emergency

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| aku tidak bisa bernapas | emergency | Ini darurat. Segera hubungi layanan darurat atau minta orang sekitar membawa ke IGD. | seek-professional-help |
| nyeri dada sampai lengan | emergency | Segera cari pertolongan darurat. Jangan menunggu jawaban chat. | seek-professional-help |
| bibir bengkak dan susah napas | emergency | Bisa darurat. Segera cari bantuan medis sekarang. | seek-professional-help |
| orang rumah pingsan | emergency | Segera hubungi layanan darurat dan minta bantuan orang sekitar. | seek-professional-help |
| perdarahan banyak | emergency | Segera cari pertolongan medis darurat. Jangan ditunda. | seek-professional-help |
| kejang harus gimana | emergency | Cari bantuan darurat segera dan jauhkan benda berbahaya di sekitar. | seek-professional-help |

## Intent: islamic-reflection

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| bagaimana Islam memandang menjaga tubuh | islamic-reflection | Menjaga tubuh termasuk amanah. Kita berikhtiar tanpa berlebihan dan tetap tawakal. | read-article |
| aku ingin refleksi tentang nikmat sehat | islamic-reflection | Nikmat sehat patut disyukuri dengan ibadah, adab makan, istirahat, dan tidak merusak diri. | read-article |
| apa hikmah sakit menurut Islam | islamic-reflection | Secara umum sakit bisa menjadi pengingat, tetapi jangan memastikan hikmah khusus tanpa dalil. | read-article |
| menjaga pola makan itu ibadah gak | islamic-reflection | Bisa bernilai baik bila diniatkan menjaga amanah tubuh dan tidak melampaui batas. | read-prinsip-amanah |
| aku ingin nasihat Islami soal kesehatan | islamic-reflection | Jaga tubuh sebagai amanah, ikhtiar dengan sebab yang benar, lalu bertawakal kepada Allah. | read-article |
| kenapa tubuh harus dijaga | islamic-reflection | Karena tubuh adalah amanah yang dipakai untuk ibadah, kerja, keluarga, dan kebaikan. | read-article |

## Intent: fatwa

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| apakah ini halal atau haram | fatwa | Aku bisa beri prinsip umum, tapi keputusan rinci perlu ustadz atau ulama kompeten. | read-prinsip-amanah |
| hukum produk ini menurut agama apa | fatwa | Perlu cek komposisi, sertifikasi, dan detailnya. Untuk kepastian hukum, tanya pihak berilmu. | contact-admin |
| boleh gak pakai produk yang belum jelas sertifikatnya | fatwa | Sebaiknya tabayyun dulu. Untuk keputusan hukum rinci, rujuk ulama kompeten. | read-prinsip-amanah |
| transaksi reseller ini halal gak | fatwa | Detail akad penting. Aku tidak memberi fatwa final, sebaiknya tanya ahli fikih muamalah. | read-prinsip-amanah |
| kalau ragu halal gimana | fatwa | Secara umum, sikap hati-hati baik. Untuk kasus tertentu, tanya ustadz yang kompeten. | read-prinsip-amanah |
| apakah ini termasuk haram | fatwa | Aku tidak bisa memutuskan final tanpa detail dan otoritas ilmu. Mari pahami prinsipnya dulu. | read-prinsip-amanah |

## Intent: tawakal

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| tawakal itu pasrah aja? | tawakal | Tawakal bukan pasrah malas. Ia berjalan bersama ikhtiar yang benar. | read-article |
| kalau tawakal berarti gak perlu usaha? | tawakal | Tetap perlu usaha. Tawakal adalah menyerahkan hasil kepada Allah setelah ikhtiar. | read-article |
| aku sudah berdoa tapi belum berubah | tawakal | Doa perlu ditemani langkah nyata, sabar, dan evaluasi kebiasaan. | start-vitacheck |
| ikhtiar dan tawakal gimana seimbangnya | tawakal | Ambil sebab yang halal dan benar, lalu serahkan hasilnya kepada Allah. | read-article |
| kalau sakit cukup tawakal? | tawakal | Tawakal tidak menolak berobat. Mencari pertolongan medis bisa bagian dari ikhtiar. | seek-professional-help |
| aku takut usahaku sia-sia | tawakal | Tugas kita ikhtiar dengan amanah. Hasil di tangan Allah, proses tetap bernilai. | read-article |

## Intent: amanah

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| kenapa Nusa AI gak langsung rekomendasi produk | amanah | Karena amanahnya edukasi dulu. Produk tidak boleh dijadikan solusi penyakit tanpa dasar. | read-prinsip-amanah |
| edukasi dulu produk belakangan maksudnya apa | amanah | User perlu paham dulu kebutuhan dan batas aman sebelum melihat produk. | read-prinsip-amanah |
| kenapa klaim harus hati-hati | amanah | Klaim berlebihan bisa menyesatkan. Amanah lebih penting daripada menarik perhatian cepat. | read-article |
| tabayyun produk itu gimana | amanah | Cek sumber, label, izin, komposisi, klaim, dan jangan hanya ikut testimoni. | read-article |
| kenapa tidak boleh janji sembuh | amanah | Karena kesembuhan bukan wilayah klaim sembarangan dan butuh bukti serta otoritas medis. | read-prinsip-amanah |
| amanah dalam jualan produk kesehatan apa | amanah | Jujur pada manfaat, risiko, batas klaim, dan tidak memanfaatkan kecemasan orang. | read-prinsip-amanah |

## Intent: article-search

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| artikel apa yang cocok buat aku | article-search | Sebutkan topikmu dulu, misalnya tidur, capek, testimoni, atau produk amanah. | read-article |
| ada artikel tentang tidur gak | article-search | Ada, cari artikel terkait tidur dan kebiasaan istirahat. | read-article |
| carikan artikel testimoni | article-search | Baik, cari artikel tentang cara bijak menilai testimoni. | read-article |
| aku mau baca yang ringan | article-search | Mulai dari artikel pengantar kebiasaan sehat atau prinsip amanah. | read-article |
| ada bacaan Islami tentang sehat | article-search | Cari artikel refleksi Islami umum tentang menjaga tubuh sebagai amanah. | read-article |
| artikel tentang iklan produk ada? | article-search | Cari artikel tentang klaim produk, testimoni, dan tabayyun sebelum membeli. | read-article |

## Intent: contact-admin

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| mau tanya admin | contact-admin | Silakan hubungi admin melalui kontak resmi yang tersedia. | contact-admin |
| gimana cara hubungi orangnya | contact-admin | Buka halaman kontak untuk WhatsApp atau email resmi. | contact-admin |
| aku mau tanya produk lebih detail | contact-admin | Untuk detail katalog, admin bisa membantu menjelaskan info label umum. | contact-admin |
| admin bisa bantu pesanan? | contact-admin | Hubungi admin untuk urusan pesanan atau informasi katalog. | contact-admin |
| aku mau tanya stok | contact-admin | Silakan kontak admin untuk info stok terbaru. | contact-admin |
| bisa chat manusia gak | contact-admin | Bisa, gunakan kontak admin resmi yang tersedia di halaman kontak. | contact-admin |

## Intent: confused-user

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| aku bingung | confused-user | Tidak apa-apa. Kita mulai dari satu hal: cek kebiasaan atau baca artikel pendek. | start-vitacheck |
| aku gak tahu harus mulai dari mana | confused-user | Mulai dari VitaCheck agar langkahmu lebih jelas. | start-vitacheck |
| terlalu banyak informasi jadi pusing | confused-user | Kita sederhanakan. Pilih satu topik saja untuk hari ini. | read-article |
| aku bingung pilih produk | confused-user | Jangan buru-buru beli. Pahami kebutuhan dan batas aman dulu. | read-prinsip-amanah |
| aku bingung baca hasil | confused-user | Hasil itu peta awal, bukan hukuman. Pilih satu kebiasaan untuk diperbaiki. | read-article |
| aku harus ngapain sekarang | confused-user | Ambil satu langkah kecil: minum air, tarik napas, lalu pilih VitaCheck atau artikel. | start-vitacheck |

## Intent: motivation

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| aku gagal terus | motivation | Gagal bukan akhir. Kecilkan target agar lebih mudah diulang. | read-article |
| aku malas berubah | motivation | Mulai dari tindakan yang terlalu kecil untuk ditolak, misalnya jalan 5 menit. | start-vitacheck |
| aku ingin sehat tapi berat | motivation | Wajar terasa berat. Jangan ubah semua sekaligus, mulai dari satu kebiasaan. | start-vitacheck |
| aku butuh semangat | motivation | Semangat yang kuat sering lahir dari langkah kecil yang konsisten. | read-article |
| aku capek memperbaiki diri | motivation | Istirahat dulu, lalu mulai lagi dengan target yang lebih manusiawi. | read-article |
| aku gak percaya bisa konsisten | motivation | Jangan percaya dulu pun tidak apa-apa. Buktikan dengan satu langkah kecil hari ini. | start-vitacheck |

## Intent: overthinking

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| aku takut salah memilih produk | overthinking | Wajar takut. Jangan beli karena panik, cek informasi dasar dulu. | read-prinsip-amanah |
| aku cemas lihat iklan kesehatan | overthinking | Iklan memang sering dibuat meyakinkan. Beri jeda dan cek klaimnya pelan-pelan. | read-article |
| aku kepikiran terus soal testimoni | overthinking | Testimoni jangan dijadikan kepastian. Fokus pada bukti, label, dan kondisi pribadi. | read-article |
| aku takut salah langkah | overthinking | Pilih langkah paling aman: edukasi dulu, jangan buru-buru membeli. | read-prinsip-amanah |
| iklan bikin aku merasa sakit | overthinking | Jangan langsung menyimpulkan. Jika ada gejala nyata, periksa ke tenaga kesehatan. | seek-professional-help |
| aku overthinking soal tubuhku | overthinking | Tenangkan diri dulu. Kita cek kebiasaan yang bisa diperbaiki tanpa menghakimi tubuh. | start-vitacheck |

## Intent: complaint-about-body

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| aku merasa tubuhku gagal | complaint-about-body | Tubuhmu bukan musuh. Kita bantu pelan-pelan dengan kebiasaan yang lebih baik. | start-vitacheck |
| badanku rasanya berat terus | complaint-about-body | Bisa terkait kebiasaan atau kondisi medis. Mulai cek kebiasaan, dan periksa bila menetap. | start-vitacheck |
| aku malu sama badanku | complaint-about-body | Jangan menghina diri. Fokus pada merawat tubuh, bukan mengejar standar orang lain. | read-article |
| aku pengen cepat kurus | complaint-about-body | Hindari cara ekstrem. Pilih langkah sehat yang aman dan bertahap. | read-article |
| badan aku gak enak dilihat | complaint-about-body | Nilai dirimu tidak ditentukan bentuk tubuh. Kita mulai dari perawatan yang sehat. | start-vitacheck |
| aku sering nyalahin tubuhku | complaint-about-body | Coba ubah bahasa: tubuh ini amanah yang perlu dibantu, bukan dimaki. | read-article |

## Intent: ask-next-step

| Pertanyaan User | Intent | Jawaban Aman Singkat | Action |
|---|---|---|---|
| apa langkah saya hari ini | ask-next-step | Pilih satu: tidur 30 menit lebih awal, minum cukup, atau jalan ringan 10 menit. | start-vitacheck |
| setelah ini harus ngapain | ask-next-step | Ambil satu langkah kecil dulu, lalu baca artikel yang sesuai dengan fokusmu. | read-article |
| kasih satu langkah paling sederhana | ask-next-step | Minum air putih sekarang dan pilih satu kebiasaan yang ingin diperbaiki hari ini. | start-vitacheck |
| hari ini fokus apa | ask-next-step | Fokus pada satu kebiasaan yang paling mungkin kamu ulangi sampai malam. | start-vitacheck |
| aku mau mulai tapi takut berat | ask-next-step | Mulai dari versi paling ringan, bukan versi paling ideal. | read-article |
| setelah baca artikel aku harus apa | ask-next-step | Tulis satu tindakan kecil dari artikel itu, lalu praktikkan hari ini. | read-article |
