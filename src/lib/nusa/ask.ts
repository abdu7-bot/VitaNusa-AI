import { createServerFn } from "@tanstack/react-start";
import { classify, type PolicyId } from "@/lib/nusa/policy";

type Turn = { role: "user" | "assistant"; content: string };

const SYSTEM = `Kamu adalah Nusa, pendamping edukasi VitaNusa AI. Bahasa Indonesia yang hangat, jelas, dan tidak menggurui.

Kamu bukan dokter, bukan alat diagnosis, bukan pemberi resep, bukan mufti.

Aturan:
- Jangan mendiagnosis. Jangan menyebut penyakit yang "kemungkinan" diderita pengguna.
- Jangan memberi dosis, nama obat yang harus diminum, atau saran berhenti/mulai obat.
- Jangan menebak status halal. Arahkan ke sertifikat BPJPH pada kemasan.
- Jangan membenarkan klaim sembuh. Edukasi cara membaca klaim. Jangan mempromosikan produk.
- Pisahkan fakta umum, satu kebiasaan yang bisa dicoba, dan kapan menemui tenaga kesehatan.
- Jangan mengarang nomor jurnal, ayat, atau hadits. Jika tidak yakin sumber pastinya, katakan itu edukasi umum.
- Refleksi islami hanya sebatas amanah dan tidak berlebihan. Bukan fatwa.
- Jawaban ringkas: paling banyak 3 paragraf pendek.
- Jangan memakai markdown, tanda bintang, pagar, atau heading. Tulis teks biasa.
- Tutup dengan satu kalimat bahwa ini edukasi umum, bukan pemeriksaan.`;

function asTurns(input: unknown): Turn[] {
  if (!input || typeof input !== "object" || !Array.isArray((input as { messages?: unknown }).messages)) {
    throw new Error("Pertanyaan tidak valid.");
  }
  const messages = (input as { messages: unknown[] }).messages.slice(-6);
  if (messages.length === 0) throw new Error("Pertanyaan kosong.");
  return messages.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Pesan tidak valid.");
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") throw new Error("Peran pesan tidak valid.");
    if (typeof content !== "string" || !content.trim()) throw new Error("Isi pesan kosong.");
    return { role, content: content.trim().slice(0, 700) };
  });
}

function toPlain(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

async function complete(apiKey: string, messages: { role: string; content: string }[]) {
  return fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0.3,
      max_tokens: 420,
      messages,
    }),
  });
}

export const askNusa = createServerFn({ method: "POST" })
  .validator((input: unknown) => ({ messages: asTurns(input) }))
  .handler(async ({ data }) => {
    const lastUser = [...data.messages].reverse().find((message) => message.role === "user");
    const decision = classify(lastUser?.content ?? "");

    if (decision.blockModel) {
      return {
        ok: true as const,
        source: "policy" as const,
        policy: decision.id,
        title: decision.title,
        text: decision.text,
        warnings: decision.warnings,
      };
    }

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return {
        ok: false as const,
        error: "Nusa belum terhubung di lingkungan ini. Kamu tetap bisa membaca Edukasi dan memakai VitaCheck.",
        policy: decision.id,
        warnings: decision.warnings,
      };
    }

    const boundary =
      decision.warnings.length > 0
        ? `\n\nBatas khusus pertanyaan terakhir:\n- ${decision.warnings.join("\n- ")}`
        : "";

    let response = await complete(apiKey, [{ role: "system", content: SYSTEM + boundary }, ...data.messages]);
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      response = await complete(apiKey, [{ role: "system", content: SYSTEM + boundary }, ...data.messages]);
    }

    if (!response.ok) {
      return {
        ok: false as const,
        error: "Nusa tidak bisa menjawab saat ini. Coba lagi sebentar, atau baca artikel di Edukasi.",
        policy: decision.id satisfies PolicyId,
        warnings: decision.warnings,
      };
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? toPlain(content) : "";
    if (!text) {
      return {
        ok: false as const,
        error: "Jawaban datang kosong. Coba ajukan dengan kalimat yang lebih singkat.",
        policy: decision.id,
        warnings: decision.warnings,
      };
    }

    return {
      ok: true as const,
      source: "model" as const,
      policy: decision.id,
      title: "",
      text,
      warnings: decision.warnings,
    };
  });
