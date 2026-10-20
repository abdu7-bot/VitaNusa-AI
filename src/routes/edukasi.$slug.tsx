import { createFileRoute, Link } from "@tanstack/react-router";
import { SourceShelf } from "@/components/source-shelf";
import { getArticle } from "@/lib/nusa/articles";
import { articleShelves } from "@/lib/nusa/sources";

export const Route = createFileRoute("/edukasi/$slug")({
  head: ({ params }) => ({
    meta: [{ title: `${getArticle(params.slug)?.title ?? "Tidak ditemukan"} — VitaNusa AI` }],
  }),
  component: ArticlePage,
});

function ArticlePage() {
  const { slug } = Route.useParams();
  const article = getArticle(slug);

  if (!article) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <h1 className="font-display text-3xl">Bacaan ini tidak ada</h1>
        <Link to="/edukasi" className="mt-4 inline-block text-leaf">
          Kembali ke daftar
        </Link>
      </section>
    );
  }

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 md:px-8">
      <Link to="/edukasi" className="text-sm text-muted">
        Semua bacaan
      </Link>
      <p className="text-sm tracking-wide text-leaf">
        {article.topic} · {article.minutes} menit
      </p>
      <h1 className="font-display text-4xl leading-tight">{article.title}</h1>
      <p className="text-lg text-muted">{article.dek}</p>
      {article.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-3">
          <h2 className="font-display text-2xl">{section.heading}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
      <aside className="rounded-3xl bg-leaf-soft px-5 py-4 text-ink">
        <h2 className="font-display text-xl">Catatan amanah</h2>
        <p className="mt-2">{article.amanah}</p>
      </aside>
      <aside className="rounded-3xl border border-line bg-sheet px-5 py-4">
        <h2 className="font-display text-xl">Kapan mencari bantuan</h2>
        <p className="mt-2">{article.seekHelp}</p>
      </aside>
      <SourceShelf sources={articleShelves[article.slug] ?? []} />
    </article>
  );
}
