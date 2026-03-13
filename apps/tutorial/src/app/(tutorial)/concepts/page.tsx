import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { source } from "@/lib/source";
import { conceptDefinitions } from "@/lib/concepts";
import { HashScroll } from "@/components/hash-scroll";

interface ConceptEntry {
  concept: string;
  description?: string;
  url?: string;
  articles: { title: string; url: string }[];
}

function getConceptIndex(): ConceptEntry[] {
  const map = new Map<string, { title: string; url: string }[]>();

  for (const page of source.getPages()) {
    const concepts = (page.data as { concepts?: string[] }).concepts;
    if (!concepts) continue;

    for (const concept of concepts) {
      const key = concept.toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ title: page.data.title, url: page.url });
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, articles]) => {
      const def = conceptDefinitions[key];
      return {
        concept: key,
        description: def?.description,
        url: def?.url,
        articles,
      };
    });
}

export default function ConceptsPage() {
  const concepts = getConceptIndex();

  return (
    <DocsPage>
      <HashScroll />
      <DocsTitle>Concept Index</DocsTitle>
      <DocsDescription>
        Every concept covered in the series, with definitions and links to the
        articles where each appears.
      </DocsDescription>
      <DocsBody>
        <div className="not-prose flex flex-col gap-3">
          {concepts.map(({ concept, description, url, articles }) => (
            <div
              key={concept}
              id={concept.replace(/\s+/g, "-")}
              className="scroll-mt-20 rounded-lg border border-fd-border bg-fd-card p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-sm font-semibold text-fd-foreground capitalize">
                  {concept}
                </h2>
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-fd-muted-foreground hover:text-fd-primary transition-colors"
                    aria-label={`${concept} documentation`}
                  >
                    <ExternalLinkIcon className="size-3.5" />
                  </a>
                )}
              </div>
              {description && (
                <p className="mt-1 text-sm text-fd-muted-foreground leading-relaxed">
                  {description}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-x-1 gap-y-1">
                {articles.map((article, i) => (
                  <span key={article.url} className="inline-flex items-center">
                    <Link
                      href={article.url}
                      className="text-xs text-fd-primary/80 hover:text-fd-primary transition-colors"
                    >
                      {article.title.replace(/^Part \d+:\s*/, "")}
                    </Link>
                    {i < articles.length - 1 && (
                      <span className="text-fd-border mx-1">&middot;</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DocsBody>
    </DocsPage>
  );
}

export function generateMetadata() {
  return {
    title: "Concept Index — The Eigen Series",
    description:
      "Browse every concept covered in the Eigen tutorial series with definitions and external documentation links.",
  };
}
