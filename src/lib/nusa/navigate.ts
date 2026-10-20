import { createServerFn } from "@tanstack/react-start";
import { classify, screenModelText, type PolicyId } from "@/lib/nusa/policy";
import { reserveModelSlot } from "@/lib/nusa/limit";
import { getRoom, isConservative, type AboutId, type Room } from "@/lib/nusa/rooms";
import { linksForBlock, type SourceLink } from "@/lib/nusa/sources";
import { postChatCompletion } from "@/lib/nusa/upstream";

const ABOUTS = new Set<AboutId>(["diri", "dewasa-lain", "anak", "hamil"]);

export type Guide = {
  ok: true;
  blocked: boolean;
  policy: PolicyId;
  title: string;
  roomTitle: string;
  warnings: string[];
  known: string;
  steps: string[];
  questions: string[];
  seek: string;
  sources: SourceLink[];
  fromModel: boolean;
};

function toPlain(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

function clip(text: string, max: number) {
  const plain = toPlain(text);
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max - 1).trimEnd()}…`;
}

function asList(value: unknown, max: number) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, 3)
    .map((item) => clip(item, max));
}

function readInput(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("Permintaan tidak valid.");
  const body = input as { room?: unknown; about?: unknown; question?: unknown; consent?: unknown };
  const room = getRoom(typeof body.room === "string" ? body.room : "");
  if (!room) throw new Error("Ruang edukasi tidak dikenal.");
  if (typeof body.about !== "string" || !ABOUTS.has(body.about as AboutId)) {
    throw new Error("Pilih untuk siapa catatan ini.");
  }
  if (body.consent !== true) throw new Error("Centang dulu bahwa ini edukasi, bukan pemeriksaan.");
  if (typeof body.question !== "string" || body.question.trim().length < 8) {
    throw new Error("Tuliskan apa yang ingin dipahami, minimal satu kalimat.");
  }
  return {
    room,
    about: body.about as AboutId,
    question: body.question.trim().slice(0, 700),
  };
}

function curated(room: Room, extra: { title?: string; known?: string; policy?: PolicyId; warnings?: string[]; fromModel?: boolean; blocked?: boolean }): Guide {
  return {
    ok: true,
    blocked: extra.blocked ?? false,
    policy: extra.policy ?? "educate",
    title: extra.title ?? room.title,
    roomTitle: room.title,
    warnings: extra.warnings ?? [],
    known: extra.known ?? room.fallbackKnown,
    steps: extra.blocked ? [] : room.steps,
    questions: extra.blocked ? [] : room.questions,
    seek: extra.blocked ? "" : room.seek,
    sources: extra.blocked ? linksForBlock(extra.policy ?? "educate") : room.sources,
    fromModel: extra.fromModel ?? false,
  };
}

function parseModel(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const body = JSON.parse(text.slice(start, end + 1)) as {
      known?: unknown;
      steps?: unknown;
      questions?: unknown;
      seek?: unknown;
    };
    if (typeof body.known !== "string" || !body.known.trim()) return null;
    return {
      known: clip(body.known, 700),
      steps: asList(body.steps, 180),
      questions: asList(body.questions, 180),
      seek: typeof body.seek === "string" ? clip(body.seek, 320) : "",
    };
  } catch {
    return null;
  }
}

const NAVIGATOR_SYSTEM =
  "Kamu menyusun catatan Navigator VitaNusa. Kamu bukan dokter. Jangan mendiagnosis, jangan menyebut penyakit yang mungkin diderita, jangan memberi dosis atau nama obat, jangan merekomendasikan produk, suplemen, atau ramuan, jangan mengarang sitasi. Balas hanya JSON dengan kunci known, steps, questions, seek. steps dan questions masing-masing paling banyak 3 kalimat pendek. known paling banyak 3 kalimat. Bahasa Indonesia biasa, tanpa markdown.";

function roomFallback(
  room: Room,
  decisionId: PolicyId,
  warnings: string[],
  known: string,
): Guide {
  return curated(room, {
    policy: decisionId,
    warnings,
    title: "Catatan tetap ruang ini",
    known,
  });
}

export const askNavigator = createServerFn({ method: "POST" })
  .validator((input: unknown) => readInput(input))
  .handler(async ({ data }): Promise<Guide | { ok: false; error: string }> => {
    const decision = classify(data.question);
    if (decision.blockModel) {
      return curated(data.room, {
        blocked: true,
        policy: decision.id,
        title: decision.title,
        known: decision.text,
        warnings: decision.warnings,
      });
    }

    const conservative = isConservative(data.about) || data.room.id === "rentan";
    const warnings = [...decision.warnings];
    if (conservative) {
      warnings.push("Anak, kehamilan, dan menyusui memakai batas lebih ketat. Ini tetap bukan pemeriksaan.");
    }

    const apiKey = process.env.XAI_API_KEY;
    if (!reserveModelSlot(apiKey, "navigator")) {
      return curated(data.room, {
        policy: decision.id,
        warnings,
        title: "Catatan tetap ruang ini",
        known: data.room.fallbackKnown,
      });
    }

    const prompt = [
      `Ruang edukasi: ${data.room.title}.`,
      `Untuk: ${data.about}.`,
      conservative ? "Mode konservatif: jangan menenangkan, jangan sarankan obat atau ramuan, tekankan pemeriksaan." : "",
      warnings.length ? `Batas: ${warnings.join(" ")}` : "",
      `Pertanyaan: ${data.question}`,
      "Jangan mengarang sumber. Sumber dilampirkan oleh sistem, bukan olehmu.",
    ]
      .filter(Boolean)
      .join("\n");

    const upstream = await postChatCompletion({
      apiKey,
      body: {
        model: "grok-4.5",
        temperature: 0.2,
        max_tokens: 500,
        messages: [
          { role: "system", content: NAVIGATOR_SYSTEM },
          { role: "user", content: prompt },
        ],
      },
    });
    if (!upstream.ok) {
      return roomFallback(
        data.room,
        decision.id,
        warnings,
        upstream.reason === "http"
          ? `${data.room.fallbackKnown} Model sedang tidak menjawab, jadi catatan tetap yang dipakai.`
          : data.room.fallbackKnown,
      );
    }
    const response = upstream.response;

    let body: { choices?: { message?: { content?: unknown } }[] };
    try {
      body = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
    } catch {
      return curated(data.room, {
        policy: decision.id,
        warnings,
        title: "Catatan tetap ruang ini",
        known: data.room.fallbackKnown,
      });
    }
    const content = body.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? parseModel(content) : null;
    if (!parsed) {
      return curated(data.room, {
        policy: decision.id,
        warnings,
        title: "Catatan tetap ruang ini",
        known: data.room.fallbackKnown,
      });
    }

    const screened = screenModelText([parsed.known, ...parsed.steps, ...parsed.questions, parsed.seek].join("\n"));
    if (!screened.pass) {
      return curated(data.room, {
        policy: decision.id,
        warnings,
        title: "Catatan tetap ruang ini",
        known: data.room.fallbackKnown,
      });
    }

    return {
      ok: true,
      blocked: false,
      policy: decision.id,
      title: data.room.title,
      roomTitle: data.room.title,
      warnings,
      known: parsed.known,
      steps: parsed.steps.length > 0 ? parsed.steps : data.room.steps,
      questions: parsed.questions.length > 0 ? parsed.questions : data.room.questions,
      seek: parsed.seek || data.room.seek,
      sources: data.room.sources,
      fromModel: true,
    };
  });

