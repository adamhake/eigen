import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Shared chrome for interactive playgrounds: the same card as a diagram, a
 * small "Try it" eyebrow and title, an optional one-line prompt, and a caption.
 * Playground bodies are client components; this wrapper is server-safe.
 */
export function Playground({
  title,
  prompt,
  caption,
  className,
  children,
}: {
  title: string;
  /** What to try, e.g. "Add a catch-all route and see which one wins." */
  prompt?: ReactNode;
  /** One sentence on what the playground demonstrates. */
  caption?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className="not-prose my-8">
      <div className={cn("rounded-xl border border-fd-border bg-fd-card/60 p-4 sm:p-6", className)}>
        <div className="mb-4">
          <p className="m-0 text-xs font-semibold tracking-[0.06em] text-fd-primary uppercase">Try it</p>
          <p className="m-0 mt-1 font-semibold text-fd-foreground">{title}</p>
          {prompt && <p className="m-0 mt-1 text-sm leading-6 text-fd-muted-foreground">{prompt}</p>}
        </div>
        {children}
      </div>
      {caption && <figcaption className="mt-3 text-center text-sm text-fd-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}

/* Small shared controls so every playground looks like one family. */

export const inputClass =
  "w-full rounded-lg border border-fd-border bg-fd-background px-3 py-2 font-mono text-sm text-fd-foreground outline-none [font-variant-ligatures:none] focus-visible:border-fd-primary focus-visible:ring-2 focus-visible:ring-fd-primary/25";

export const buttonClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-fd-border bg-fd-background px-3 py-1.5 text-sm text-fd-foreground transition-colors hover:bg-fd-accent disabled:opacity-40";

export const primaryButtonClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-fd-primary bg-fd-primary px-3 py-1.5 text-sm text-fd-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40";

/** A labelled read-only output panel (code-ish). */
export function Output({
  label,
  tone = "default",
  children,
}: {
  label: string;
  tone?: "default" | "accent" | "warning";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        tone === "accent" && "border-fd-primary/40 bg-fd-primary/6",
        tone === "warning" && "border-fd-warning/40 bg-fd-warning/6",
        tone === "default" && "border-fd-border bg-fd-background",
      )}
    >
      <p className="m-0 mb-1.5 text-[0.7rem] font-semibold tracking-[0.06em] text-fd-muted-foreground uppercase">
        {label}
      </p>
      <div className="font-mono text-sm leading-6 [font-variant-ligatures:none] break-words whitespace-pre-wrap text-fd-foreground">
        {children}
      </div>
    </div>
  );
}
