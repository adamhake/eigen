import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import Link from "next/link";

import { cn } from "@/lib/cn";

/**
 * "Where this part fits": every part of the series placed on a map of Eigen's
 * architecture, by the layer it mostly builds. Parts before the current one are
 * solid, the current one is highlighted, later ones are outlined.
 */

interface Piece {
  part: number;
  slug: string;
  label: string;
}

const lanes: { name: string; blurb: string; pieces: Piece[] }[] = [
  {
    name: "Vite itself",
    blurb: "The platform underneath",
    pieces: [
      { part: 0, slug: "00-the-mental-model", label: "Mental model" },
      { part: 1, slug: "01-bare-vite-spa", label: "Bare SPA" },
    ],
  },
  {
    name: "Plugin layer",
    blurb: "Runs in Vite at dev and build time",
    pieces: [
      { part: 2, slug: "02-route-discovery-plugin", label: "Route discovery" },
      { part: 7, slug: "07-transform-hook", label: "Loader stripping" },
      { part: 8, slug: "08-dev-middleware", label: "Dev middleware" },
      { part: 9, slug: "09-hmr", label: "HMR + type regen" },
      { part: 10, slug: "10-dev-overlay", label: "Dev overlay" },
      { part: 11, slug: "11-framework-plugin", label: "eigen() plugin" },
      { part: 25, slug: "25-use-cache", label: '"use cache"' },
      { part: 30, slug: "30-route-metadata-seo", label: "Metadata + sitemap" },
      { part: 31, slug: "31-image-optimization", label: "Image pipeline" },
      { part: 32, slug: "32-platform-integrations", label: "Integrations" },
      { part: 37, slug: "37-css-styling-pipeline", label: "CSS pipeline" },
    ],
  },
  {
    name: "Server runtime",
    blurb: "Runs per request",
    pieces: [
      { part: 3, slug: "03-server-side-rendering", label: "SSR" },
      { part: 5, slug: "05-typed-loaders", label: "Typed loaders" },
      { part: 12, slug: "12-streaming-ssr", label: "Streaming" },
      { part: 13, slug: "13-nested-layouts", label: "Nested layouts" },
      { part: 14, slug: "14-framework-middleware", label: "Middleware" },
      { part: 15, slug: "15-server-functions", label: "Server functions" },
      { part: 18, slug: "18-runtime-validation", label: "Validation" },
      { part: 20, slug: "20-observability", label: "Observability" },
      { part: 21, slug: "21-react-server-components", label: "Server components" },
      { part: 26, slug: "26-partial-prerendering", label: "Partial prerendering" },
      { part: 27, slug: "27-ai-streaming", label: "AI streaming" },
      { part: 28, slug: "28-realtime-websockets", label: "Real-time" },
      { part: 33, slug: "33-authentication-authorization", label: "Auth" },
      { part: 34, slug: "34-data-fetching", label: "Data fetching" },
    ],
  },
  {
    name: "Browser runtime",
    blurb: "Runs after the HTML arrives",
    pieces: [
      { part: 4, slug: "04-hydration", label: "Hydration" },
      { part: 22, slug: "22-navigation-api", label: "Navigation API" },
      { part: 23, slug: "23-advanced-router", label: "Advanced router" },
      { part: 24, slug: "24-view-transitions-speculation", label: "View transitions" },
      { part: 29, slug: "29-module-federation", label: "Module federation" },
      { part: 35, slug: "35-error-boundaries-loading", label: "Errors + loading" },
      { part: 38, slug: "38-forms-mutations", label: "Forms" },
    ],
  },
  {
    name: "Build output",
    blurb: "What ships, and where",
    pieces: [
      { part: 6, slug: "06-production-builds", label: "Production builds" },
      { part: 16, slug: "16-static-site-generation", label: "Static generation" },
      { part: 17, slug: "17-deployment-adapters", label: "Adapters" },
      { part: 19, slug: "19-edge-runtimes", label: "Edge runtimes" },
    ],
  },
  {
    name: "Tooling",
    blurb: "Around the framework",
    pieces: [
      { part: 36, slug: "36-testing-your-framework", label: "Testing" },
      { part: 39, slug: "39-developer-experience-cli", label: "CLI + DX" },
      { part: 40, slug: "40-monorepo-publishing", label: "Publishing" },
    ],
  },
];

const TOTAL = 41;

/** The part number for a page slug like `13-nested-layouts`, or null for non-part pages. */
export function partFromSlug(slug: string[] | undefined): number | null {
  const m = slug?.length === 1 ? /^(\d{2})-/.exec(slug[0]) : null;
  return m ? Number(m[1]) : null;
}

export function SeriesMap({ current }: { current: number }) {
  const lane = lanes.find((l) => l.pieces.some((p) => p.part === current));
  const piece = lane?.pieces.find((p) => p.part === current);
  if (!lane || !piece) return null;

  return (
    <Accordions
      type="single"
      collapsible
      className="not-prose my-0 rounded-xl border-fd-border bg-fd-card/60 shadow-none"
    >
      <Accordion
        title={
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
            <span>
              Where this part fits: <span className="text-fd-primary">{lane.name}</span>
            </span>
            <ProgressBar current={current} />
          </span>
        }
        className="border-none px-1 [&>h3]:text-[0.9rem] [&>h3]:font-medium"
      >
        <div className="space-y-3 pb-1">
          {lanes.map((l) => (
            <div key={l.name} className="grid gap-2 sm:grid-cols-[9.5rem_1fr]">
              <div className="pt-1">
                <p
                  className={cn(
                    "m-0 text-xs font-semibold tracking-[0.06em] uppercase",
                    l === lane ? "text-fd-primary" : "text-fd-muted-foreground",
                  )}
                >
                  {l.name}
                </p>
                <p className="m-0 text-xs text-fd-muted-foreground">{l.blurb}</p>
              </div>
              <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                {l.pieces.map((p) => (
                  <li key={p.part}>
                    <Chip piece={p} state={p.part === current ? "current" : p.part < current ? "done" : "later"} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="m-0 pt-1 text-xs text-fd-muted-foreground">
            Solid: covered in earlier parts. Outlined: still to come. Deep dives (30–40) can be read in any order after
            Phase I.
          </p>
        </div>
      </Accordion>
    </Accordions>
  );
}

function Chip({ piece, state }: { piece: Piece; state: "done" | "current" | "later" }) {
  return (
    <Link
      href={`/${piece.slug}`}
      aria-current={state === "current" ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs no-underline transition-colors",
        state === "current" && "border-fd-primary bg-fd-primary text-fd-primary-foreground",
        state === "done" && "border-fd-border bg-fd-muted text-fd-foreground hover:border-fd-primary/50",
        state === "later" &&
          "border-dashed border-fd-muted-foreground/40 text-fd-muted-foreground hover:border-fd-primary/50 hover:text-fd-foreground",
      )}
    >
      <span className={cn("font-mono", state === "current" ? "opacity-80" : "text-fd-muted-foreground")}>
        {String(piece.part).padStart(2, "0")}
      </span>
      {piece.label}
    </Link>
  );
}

/** One tick per part; the phases are separated by small gaps. */
function ProgressBar({ current }: { current: number }) {
  const phaseStarts = new Set([12, 21, 30]);
  return (
    <span className="flex items-center gap-[2px]" role="img" aria-label={`Part ${current} of ${TOTAL - 1}`}>
      {Array.from({ length: TOTAL }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-1 rounded-full sm:w-1.5",
            phaseStarts.has(i) && "ml-1",
            i === current ? "bg-fd-primary" : i < current ? "bg-fd-primary/35" : "bg-fd-muted-foreground/20",
          )}
        />
      ))}
    </span>
  );
}
