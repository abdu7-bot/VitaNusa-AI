import { useEffect, useRef, useState } from "react";
import { askNusa } from "@/lib/nusa/ask";
import { useVita, useVitaReady, type ChatMessage } from "@/lib/nusa/store";

const prompts = [
  "Bagaimana pola tidur yang umumnya disebut cukup untuk orang dewasa?",
  "Apa bedanya membaca klaim produk dan mempercayai testimoni?",
  "Kapan keluhan sebaiknya dibawa ke tenaga kesehatan, bukan ke chat?",
  "Apa arti thayyib, dan mengapa ia bukan cap untuk semua merek?",
];

function id() {
  return crypto.randomUUID();
}

export function NusaChat() {
  const ready = useVitaReady();
  const messages = useVita((state) => state.messages);
  const pushMessage = useVita((state) => state.pushMessage);
  const clearMessages = useVita((state) => state.clearMessages);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, pending, ready, error]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setDraft("");
    setError("");
    const user: ChatMessage = { id: id(), role: "user", text: trimmed };
    pushMessage(user);
    setPending(true);
    const history = useVita
      .getState()
      .messages.slice(-6)
      .map((message) => ({
        role: message.role === "user" ? ("user" as const) : ("assistant" as const),
        content: message.text,
      }));
    try {
      const result = await askNusa({ data: { messages: history } });
      if (!result.ok) {
        setError(result.error);
        if (result.warnings.length > 0) {
          pushMessage({
            id: id(),
            role: "nusa",
            text: "Nusa tidak jadi menjawab modelnya. Batas pertanyaan ini tetap berlaku.",
            warnings: result.warnings,
            policy: result.policy,
          });
        }
        return;
      }
      pushMessage({
        id: id(),
        role: "nusa",
        text: result.text,
        warnings: result.warnings,
        policy: result.policy,
      });
    } catch {
      setError("Jaringan terputus sebelum Nusa selesai. Coba kirim sekali lagi.");
    } finally {
      setPending(false);
      field.current?.focus();
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 md:px-8">
      <div className="flex flex-1 flex-col gap-6 py-6">
        {ready && messages.length > 0 && (
          <div className="flex justify-end">
            <button type="button" onClick={clearMessages} className="text-sm text-muted underline-offset-2 hover:underline">
              Hapus percakapan di perangkat ini
            </button>
          </div>
        )}

        {(!ready || messages.length === 0) && (
          <div className="max-w-xl">
            <p className="text-sm tracking-wide text-leaf">Nusa</p>
            <h1 className="mt-2 font-display text-4xl leading-tight text-ink md:text-5xl">Mau memahami apa hari ini?</h1>
            <p className="mt-4 text-muted">
              Tanya soal kebiasaan, cara membaca klaim, atau kapan sebaiknya menemui tenaga kesehatan. Nusa tidak
              mendiagnosis, tidak meresepkan, dan tidak menebak status halal.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={!ready || pending}
                  onClick={() => void send(prompt)}
                  className="rounded-2xl border border-line bg-sheet px-4 py-3 text-left transition-colors hover:border-leaf disabled:opacity-60"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {ready &&
          messages.map((message) =>
            message.role === "user" ? (
              <p
                key={message.id}
                className="ml-auto max-w-[32rem] rounded-3xl bg-ink px-4 py-3 text-paper"
              >
                {message.text}
              </p>
            ) : (
              <article key={message.id} className="max-w-[40rem]">
                <p className="font-display text-sm text-leaf">Nusa</p>
                {message.warnings?.map((warning) => (
                  <p key={warning} className="mt-2 rounded-2xl bg-alert-soft px-3 py-2 text-sm text-alert">
                    {warning}
                  </p>
                ))}
                <p className="mt-2 whitespace-pre-wrap leading-relaxed">{message.text}</p>
              </article>
            ),
          )}

        {pending && <p className="font-display text-sm text-leaf">Nusa sedang menyusun jawaban edukasi…</p>}
        {error && <p className="rounded-2xl bg-alert-soft px-3 py-2 text-sm text-alert">{error}</p>}
        <div ref={end} />
      </div>

      <form
        className="sticky bottom-0 bg-paper pb-4 pt-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="nusa-draft">
            Tulis pertanyaan untuk Nusa
          </label>
          <textarea
            id="nusa-draft"
            ref={field}
            rows={2}
            maxLength={700}
            value={draft}
            disabled={!ready || pending}
            placeholder="Tulis dengan kalimat biasa…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(draft);
              }
            }}
            suppressHydrationWarning
            className="min-h-14 flex-1 resize-none rounded-3xl border border-line bg-sheet px-4 py-3 outline-none focus:border-leaf"
          />
          <button
            type="submit"
            disabled={!ready || pending || !draft.trim()}
            className="h-14 rounded-full bg-leaf px-5 font-medium text-sheet transition-opacity disabled:opacity-40"
          >
            Kirim
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">Edukasi umum. Bukan pemeriksaan, resep, fatwa, atau sertifikat halal.</p>
      </form>
    </div>
  );
}
