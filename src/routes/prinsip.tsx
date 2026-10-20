import { createFileRoute } from "@tanstack/react-router";

const principles = [
  {
    title: "Keselamatan lebih dahulu",
    body: "Tanda bahaya mengalahkan rasa ingin tahu. Chat berhenti, 119 atau IGD yang jalan.",
  },
  {
    title: "Edukasi sebelum promosi",
    body: "Tidak ada katalog jualan di ruang ini. Produk tidak dijadikan jalan pintas.",
  },
  {
    title: "Bukan diagnosis, dosis, atau fatwa",
    body: "Nusa menjelaskan secara umum. Ia tidak menetapkan penyakit, resep, atau hukum.",
  },
  {
    title: "Halal tidak ditebak",
    body: "Status halal dibaca dari sertifikat BPJPH pada kemasan, bukan dari keyakinan model.",
  },
  {
    title: "Thayyib bukan cap universal",
    body: "Kelayakan dan kebaikan dibahas sebagai refleksi. Bukan sertifikat yang ditempel ke semua merek.",
  },
  {
    title: "Data tetap di perangkatmu",
    body: "Percakapan dan cermin VitaCheck disimpan di peramban ini. Hapus percakapan kapan saja dari layar Nusa.",
  },
];

const faq = [
  {
    q: "Apakah VitaNusa menggantikan dokter?",
    a: "Tidak. Ia membantu menyusun pertanyaan dan memahami kebiasaan. Keputusan medis tetap pada tenaga kesehatan yang memeriksaimu.",
  },
  {
    q: "Bolehkah saya minta dosis?",
    a: "Tidak. Dosis personal ditolak, termasuk saat dikemas sebagai 'kira-kira saja'.",
  },
  {
    q: "Kalau saya sedang dalam krisis?",
    a: "Hubungi orang terdekat atau 119. Dukungan jiwa Healing119 dari Kemenkes dapat dihubungi lewat 119 ekstensi 8 atau healing119.id. Jangan menunggu jawaban chat.",
  },
];

export const Route = createFileRoute("/prinsip")({
  head: () => ({ meta: [{ title: "Prinsip — VitaNusa AI" }] }),
  component: Prinsip,
});

function Prinsip() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 md:px-8">
      <div>
        <p className="text-sm tracking-wide text-leaf">Prinsip</p>
        <h1 className="mt-2 font-display text-4xl leading-tight md:text-5xl">Batas yang tidak dilewati</h1>
        <p className="mt-4 max-w-xl text-muted">
          VitaNusa AI adalah ruang edukasi. Ia bukan dokter, bukan alat periksa, bukan pemberi resep, dan bukan mufti.
        </p>
      </div>
      <ul className="grid gap-3">
        {principles.map((item) => (
          <li key={item.title} className="rounded-3xl border border-line bg-sheet px-5 py-4">
            <h2 className="font-display text-xl">{item.title}</h2>
            <p className="mt-1 text-muted">{item.body}</p>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Pertanyaan yang sering muncul</h2>
        {faq.map((item) => (
          <details key={item.q} className="rounded-3xl border border-line bg-sheet px-5 py-4">
            <summary className="cursor-pointer font-medium">{item.q}</summary>
            <p className="mt-2 text-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
