import { createFileRoute, Link } from "@tanstack/react-router";
import { articles } from "@/lib/nusa/articles";

export const Route = createFileRoute("/edukasi/")({
  head: () => ({ meta: [{ title: "Edukasi — VitaNusa AI" }] }),
  component: Edukasi,
});

function Edukasi() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 md:px-8">
      <p className="text-sm tracking-wide text-leaf">Edukasi</p>
      <h1 className="font-display text-4xl leading-tight md:text-5xl">Bacaan pendek, sebelum klaim</h1>
      <p className="max-w-xl text-muted">
        Enam catatan untuk memahami kebiasaan, tanda bahaya, dan cara membaca produk. Semuanya edukasi umum.
      </p>
      <ul className="flex flex-col gap-3">
        {articles.map((article) => (
          <li key={article.slug}>
            <Link
              to="/edukasi/$slug"
              params={{ slug: article.slug }}
              className="block rounded-3xl border border-line bg-sheet px-5 py-4 transition-colors hover:border-leaf"
            >
              <p className="text-xs tracking-wide text-leaf">
                {article.topic} · {article.minutes} menit
              </p>
              <h2 className="mt-1 font-display text-2xl">{article.title}</h2>
              <p className="mt-2 text-muted">{article.dek}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
