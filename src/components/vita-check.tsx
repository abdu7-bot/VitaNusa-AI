import { useState } from "react";
import { bandCopy, questions, summarize, type CheckResult } from "@/lib/nusa/check";
import { useVita, useVitaReady } from "@/lib/nusa/store";

export function VitaCheck() {
  const ready = useVitaReady();
  const lastCheck = useVita((state) => state.lastCheck);
  const saveCheck = useVita((state) => state.saveCheck);
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CheckResult | null>(null);

  const question = questions[step];

  function begin() {
    setAnswers({});
    setResult(null);
    setStep(0);
  }

  function choose(optionId: string) {
    if (!question) return;
    const next = { ...answers, [question.id]: optionId };
    setAnswers(next);
    if (step < questions.length - 1) {
      setStep(step + 1);
      return;
    }
    const summary = summarize(next);
    setResult(summary);
    saveCheck(summary);
    setStep(questions.length);
  }

  if (!ready) {
    return <section className="mx-auto max-w-3xl px-4 py-8 md:px-8">Membuka cermin terakhir…</section>;
  }

  if (step < 0) {
    return (
      <section className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 md:px-8">
        <p className="text-sm tracking-wide text-leaf">VitaCheck</p>
        <h1 className="font-display text-4xl leading-tight md:text-5xl">Cermin kebiasaan, bukan nilai kesehatan</h1>
        <p className="max-w-xl text-muted">
          Delapan pertanyaan singkat tentang tidur, minum, gerak, makan, layar, istirahat, beban, dan tanda yang
          sebaiknya tidak ditunda. Hasilnya hanya refleksi dari jawabanmu hari ini.
        </p>
        <button type="button" onClick={begin} className="h-12 w-fit rounded-full bg-leaf px-6 text-sheet">
          Mulai refleksi
        </button>
        {lastCheck && (
          <button
            type="button"
            onClick={() => {
              setResult(lastCheck);
              setStep(questions.length);
            }}
            className="w-fit text-left text-sm text-muted underline-offset-2 hover:underline"
          >
            Lihat cermin terakhir di perangkat ini
          </button>
        )}
      </section>
    );
  }

  if (question && step < questions.length) {
    return (
      <section className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 md:px-8">
        <p className="text-sm tabular-nums text-muted">
          {step + 1} dari {questions.length}
        </p>
        <div className="h-1 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-leaf" style={{ width: `${((step + 1) / questions.length) * 100}%` }} />
        </div>
        <h1 className="font-display text-3xl leading-tight md:text-4xl">{question.prompt}</h1>
        <p className="text-muted">{question.detail}</p>
        <div className="flex flex-col gap-2">
          {question.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => choose(option.id)}
              className="min-h-14 rounded-2xl border border-line bg-sheet px-4 py-3 text-left transition-colors hover:border-leaf"
            >
              {option.label}
            </button>
          ))}
        </div>
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)} className="w-fit text-sm text-muted">
            Kembali
          </button>
        )}
      </section>
    );
  }

  if (!result) return null;
  const copy = bandCopy[result.band];

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 md:px-8">
      <p className="text-sm tracking-wide text-leaf">Hasil refleksi</p>
      <h1 className="font-display text-4xl leading-tight">{result.urgent ? "Jangan lanjut di sini" : copy.title}</h1>
      {result.urgent ? (
        <p className="rounded-3xl bg-alert-soft px-4 py-4 text-alert">
          Kamu menandai keluhan berat. VitaCheck berhenti menilai kebiasaan. Hubungi 119 atau pergi ke IGD, dan minta
          seseorang menemanimu.
        </p>
      ) : (
        <p className="text-muted">{copy.body}</p>
      )}
      {result.urgent ? null : (
        <p className="font-display text-2xl tabular-nums">
          {result.score}
          <span className="text-muted"> / {result.max}</span>
          <span className="ml-2 font-sans text-base text-muted">kebiasaan yang dilaporkan mendukung</span>
        </p>
      )}
      {result.notes.length > 0 && (
        <ul className="flex flex-col gap-3">
          {result.notes.map((note) => (
            <li key={note} className="rounded-2xl border border-line bg-sheet px-4 py-3">
              {note}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted">
        Simpanan ini hanya ada di peramban ini. Ia bukan rekam medis dan tidak dikirim ke siapa pun.
      </p>
      <button type="button" onClick={begin} className="h-12 w-fit rounded-full bg-leaf px-6 text-sheet">
        Ulangi refleksi
      </button>
    </section>
  );
}
