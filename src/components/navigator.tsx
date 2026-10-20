import { useState } from "react";
import { SourceShelf } from "@/components/source-shelf";
import { askNavigator, type Guide } from "@/lib/nusa/navigate";
import { aboutOptions, rooms, type AboutId, type RoomId } from "@/lib/nusa/rooms";

export function Navigator() {
  const [room, setRoom] = useState<RoomId | null>(null);
  const [about, setAbout] = useState<AboutId>("diri");
  const [question, setQuestion] = useState("");
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [guide, setGuide] = useState<Guide | null>(null);

  async function submit() {
    if (!room || pending) return;
    setPending(true);
    setError("");
    try {
      const result = await askNavigator({ data: { room, about, question, consent } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setGuide(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Navigator tidak selesai. Coba sekali lagi.");
    } finally {
      setPending(false);
    }
  }

  if (guide) {
    return (
      <article className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 md:px-8">
        <p className="text-sm tracking-wide text-leaf">{guide.blocked ? "Navigator berhenti" : "Navigator"}</p>
        <h1 className="font-display text-4xl leading-tight">{guide.title}</h1>
        {guide.warnings.map((warning) => (
          <p key={warning} className="rounded-2xl bg-alert-soft px-4 py-3 text-sm text-alert">
            {warning}
          </p>
        ))}
        <p className={guide.blocked ? "rounded-3xl bg-alert-soft px-5 py-4 whitespace-pre-wrap text-alert" : "whitespace-pre-wrap"}>
          {guide.known}
        </p>
        {!guide.blocked && (
          <>
            <section>
              <h2 className="font-display text-2xl">Langkah yang aman</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {guide.steps.map((step) => (
                  <li key={step} className="rounded-2xl border border-line bg-sheet px-4 py-3">
                    {step}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="font-display text-2xl">Pertanyaan untuk tenaga kesehatan</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {guide.questions.map((item) => (
                  <li key={item} className="rounded-2xl border border-line bg-sheet px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
            <aside className="rounded-3xl bg-leaf-soft px-5 py-4">
              <h2 className="font-display text-xl">Kapan mencari bantuan</h2>
              <p className="mt-2">{guide.seek}</p>
            </aside>
            <p className="text-sm text-muted">
              {guide.fromModel
                ? "Catatan disusun model di dalam pagar ruang ini. Tautan di rak tidak dipilih oleh model."
                : "Ini catatan tetap ruang, bukan jawaban model. Tautan di rak tidak dipilih oleh model."}
            </p>
          </>
        )}
        <SourceShelf sources={guide.sources} />
        <button
          type="button"
          onClick={() => setGuide(null)}
          className="h-12 w-fit rounded-full bg-leaf px-6 text-sheet"
        >
          Pertanyaan lain
        </button>
      </article>
    );
  }

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 md:px-8">
      <div>
        <p className="text-sm tracking-wide text-leaf">Navigator</p>
        <h1 className="mt-2 font-display text-4xl leading-tight md:text-5xl">Pahami dulu, periksa kalau perlu</h1>
        <p className="mt-4 max-w-xl text-muted">
          Pilih ruang edukasi, lalu tulis apa yang ingin dipahami. Navigator menyusun langkah aman dan pertanyaan
          untuk tenaga kesehatan. Ia bukan dokter spesialis dan tidak menjual apa pun.
        </p>
      </div>

      <div className="grid gap-2">
        {rooms.map((item) => {
          const on = room === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setRoom(item.id)}
              className={`rounded-3xl border px-4 py-3 text-left transition-colors ${on ? "border-leaf bg-leaf-soft" : "border-line bg-sheet hover:border-leaf"}`}
            >
              <span className="block font-display text-xl">{item.title}</span>
              <span className="mt-1 block text-sm text-muted">{item.blurb}</span>
            </button>
          );
        })}
      </div>

      {room && (
        <form
          className="flex flex-col gap-4 rounded-3xl border border-line bg-sheet p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm text-muted">Untuk siapa</legend>
            {aboutOptions.map((option) => (
              <label key={option.id} className="flex min-h-12 items-center gap-3">
                <input
                  type="radio"
                  name="about"
                  checked={about === option.id}
                  onChange={() => setAbout(option.id)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-muted">Apa yang ingin dipahami</span>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={700}
              rows={4}
              required
              placeholder="Satu kalimat biasa, bukan daftar gejala untuk didiagnosis."
              className="resize-none rounded-2xl border border-line bg-paper px-4 py-3 outline-none focus:border-leaf"
            />
          </label>
          <label className="flex min-h-12 items-start gap-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-1"
            />
            <span>Saya paham ini edukasi umum, bukan pemeriksaan, resep, atau fatwa.</span>
          </label>
          {error && <p className="rounded-2xl bg-alert-soft px-3 py-2 text-sm text-alert">{error}</p>}
          <button
            type="submit"
            disabled={pending || !consent || question.trim().length < 8}
            className="h-12 rounded-full bg-leaf px-6 text-sheet disabled:opacity-40"
          >
            {pending ? "Menyusun catatan…" : "Susun catatan"}
          </button>
        </form>
      )}
    </section>
  );
}
