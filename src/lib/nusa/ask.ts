import { createServerFn } from "@tanstack/react-start";
import { classify, screenModelText, stricter, type PolicyDecision } from "@/lib/nusa/policy";
import { takeSlot } from "@/lib/nusa/limit";
import { readUserTurns, toModelMessages } from "@/lib/nusa/conversation";

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
    signal: AbortSignal.timeout(20_000),
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

function policyReply(decision: PolicyDecision) {
  return {
    ok: true as const,
    source: "policy" as const,
    policy: decision.id,
    title: decision.title,
    text: decision.text,
    warnings: decision.warnings,
  };
}

export const askNusa = createServerFn({ method: "POST" })
  .validator((input: unknown) => ({ messages: readUserTurns(input) }))
  .handler(async ({ data }) => {
    const users = data.messages.filter((message) => message.role === "user");
    if (users.length === 0) {
      return { ok: false as const, error: "Pertanyaan kosong.", policy: "educate" as const, warnings: [] };
    }

    let decision: PolicyDecision | null = null;
    for (const message of users) decision = stricter(decision, classify(message.content));
    decision ??= classify(users[users.length - 1].content);

    if (decision.blockModel) return policyReply(decision);

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return {
        ok: false as const,
        error: "Nusa belum terhubung di lingkungan ini. Kamu tetap bisa membaca Edukasi dan memakai VitaCheck.",
        policy: decision.id,
        warnings: decision.warnings,
      };
    }

    if (!takeSlot("nusa")) {
      return {
        ok: false as const,
        error: "Nusa sedang banyak diminta. Coba lagi sebentar, atau baca Edukasi.",
        policy: decision.id,
        warnings: decision.warnings,
      };
    }

    const boundary =
      decision.warnings.length > 0
        ? `\n\nBatas khusus pertanyaan terakhir:\n- ${decision.warnings.join("\n- ")}`
        : "";
    const messages = toModelMessages(users, SYSTEM + boundary);

    let response: Response;
    try {
      response = await complete(apiKey, messages);
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        response = await complete(apiKey, messages);
      }
    } catch {
      return {
        ok: false as const,
        error: "Nusa tidak bisa menjawab saat ini. Coba lagi sebentar, atau baca artikel di Edukasi.",
        policy: decision.id,
        warnings: decision.warnings,
      };
    }

    if (!response.ok) {
      return {
        ok: false as const,
        error: "Nusa tidak bisa menjawab saat ini. Coba lagi sebentar, atau baca artikel di Edukasi.",
        policy: decision.id,
        warnings: decision.warnings,
      };
    }

    let body: { choices?: { message?: { content?: unknown } }[] };
    try {
      body = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
    } catch {
      return {
        ok: false as const,
        error: "Nusa tidak bisa membaca jawaban saat ini. Coba lagi sebentar, atau baca artikel di Edukasi.",
        policy: decision.id,
        warnings: decision.warnings,
      };
    }
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

    const screened = screenModelText(text);
    if (!screened.pass) return policyReply(screened.decision);

    return {
      ok: true as const,
      source: "model" as const,
      policy: decision.id,
      title: "",
      text,
      warnings: decision.warnings,
    };
  });
