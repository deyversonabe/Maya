import Image from "next/image";
import Link from "next/link";

type LegalSection = {
  title: string;
  paragraphs: string[];
};

export function LegalPage({
  title,
  description,
  updatedAt,
  sections
}: {
  title: string;
  description: string;
  updatedAt: string;
  sections: LegalSection[];
}) {
  return (
    <main className="app-container">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-3 rounded-xl border border-bronze/20 bg-moss-950/80 px-4 py-3 text-bronze shadow-soft transition hover:border-bronze/40"
          aria-label="Voltar para o inicio"
        >
          <Image src="/brand/maya-logo.png" alt="Maya" width={72} height={72} className="size-12 rounded-full object-cover" />
          <span className="font-serif text-2xl font-bold">Maya</span>
        </Link>

        <section className="rounded-card border border-bronze/20 bg-moss-900/80 p-5 shadow-soft md:p-8">
          <p className="eyebrow">Informacoes legais</p>
          <h1 className="mt-2 font-serif text-4xl font-bold leading-tight text-bronze md:text-5xl">{title}</h1>
          <p className="mt-4 text-base leading-7 text-muted">{description}</p>
          <p className="mt-4 rounded-lg border border-bronze/20 bg-bronze/10 px-4 py-3 text-sm font-bold text-cream">
            Ultima atualizacao: {updatedAt}
          </p>

          <div className="mt-8 grid gap-6">
            {sections.map((section) => (
              <article key={section.title} className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4">
                <h2 className="font-serif text-2xl font-bold text-bronze">{section.title}</h2>
                <div className="mt-3 grid gap-3">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-6 text-muted">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
