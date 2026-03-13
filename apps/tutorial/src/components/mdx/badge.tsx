import Link from "next/link";

export function ConceptBadge({ concept }: { concept: string }) {
  return (
    <Link
      href={`/concepts#${concept.toLowerCase().replace(/\s+/g, "-")}`}
      className="inline-flex items-center rounded-md bg-fd-primary/10 px-2 py-0.5 text-xs font-medium text-fd-primary ring-1 ring-inset ring-fd-primary/20 no-underline hover:bg-fd-primary/20 transition-colors"
    >
      {concept}
    </Link>
  );
}

export function ConceptBadges({ concepts }: { concepts: string[] }) {
  return (
    <div className="not-prose flex flex-wrap gap-2">
      {concepts.map((concept) => (
        <ConceptBadge key={concept} concept={concept} />
      ))}
    </div>
  );
}
