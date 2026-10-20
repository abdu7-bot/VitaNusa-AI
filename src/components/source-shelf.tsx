import { ExternalLink } from "lucide-react";
import type { SourceLink } from "@/lib/nusa/sources";

export function SourceShelf({ sources }: { sources: SourceLink[] }) {
  if (sources.length === 0) return null;
  return (
    <section>
      <h2 className="font-display text-xl">Rak sumber</h2>
      <p className="mt-1 text-sm text-muted">Laman lembaga publik. Bukan sitasi jurnal dan bukan diagnosis.</p>
      <ul className="mt-3 flex flex-col gap-2">
        {sources.map((source) => (
          <li key={source.href} className="rounded-2xl border border-line bg-sheet px-4 py-3">
            <a
              href={source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-leaf underline-offset-2 hover:underline"
            >
              {source.title}
              <ExternalLink className="size-4" aria-hidden="true" />
              <span className="sr-only">, terbuka di tab baru</span>
            </a>
            <p className="text-sm text-muted">{source.publisher}</p>
            <p className="mt-1 text-sm">{source.note}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
