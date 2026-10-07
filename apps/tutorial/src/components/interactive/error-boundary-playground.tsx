"use client";

import { RotateCcw } from "lucide-react";
import { type ReactNode, useState } from "react";

import { cn } from "@/lib/cn";

import { buttonClass, Output, Playground } from "./frame";

/*
 * Models the element tree Part 35's RouteTree builds for /dashboard/analytics:
 *
 *   GlobalErrorBoundary > RootLayout > RootError > RootLoading
 *     > DashboardLayout > DashboardError > DashboardLoading
 *       > AnalyticsError > AnalyticsLoading > AnalyticsPage
 *
 * A thrown error is caught by the nearest error boundary *above* the component
 * that threw; a suspended component shows the nearest Suspense (loading.tsx)
 * fallback above it. A loader error is attributed to the segment whose loader
 * failed (Part 35's LoaderError + loaderErrorBoundary), so it lands exactly
 * where a render error from that segment would: a layout loader's error goes
 * to the boundary above the layout, a page loader's error to its own segment's.
 * "Suspend" models a component reading a deferred value (useDeferred/use()):
 * awaited loader values are ready before rendering, so only suspending shows
 * a loading.tsx fallback. Above RootLayout only the Router's own Suspense sits.
 */

type SegId = "root" | "dashboard" | "analytics";
type FaultKind = "render" | "loader" | "pending";
interface Fault {
  seg: SegId;
  kind: FaultKind;
}
type Files = Record<SegId, { error: boolean; loading: boolean }>;

const SEGMENTS: {
  id: SegId;
  dir: string;
  component: string;
  file: string;
  Name: string;
}[] = [
  {
    id: "root",
    dir: "pages/",
    component: "RootLayout",
    file: "layout.tsx",
    Name: "Root",
  },
  {
    id: "dashboard",
    dir: "pages/dashboard/",
    component: "DashboardLayout",
    file: "layout.tsx",
    Name: "Dashboard",
  },
  {
    id: "analytics",
    dir: "pages/dashboard/analytics/",
    component: "AnalyticsPage",
    file: "index.tsx",
    Name: "Analytics",
  },
];
const seg = (id: SegId) => SEGMENTS.find((s) => s.id === id)!;

type Node =
  | { type: "global" }
  | { type: "layout"; seg: SegId }
  | { type: "page"; seg: SegId }
  | { type: "error"; seg: SegId }
  | { type: "loading"; seg: SegId };

/** The full tree, outermost first. Boundaries whose file is missing are kept but marked absent. */
const TREE: Node[] = [
  { type: "global" },
  { type: "layout", seg: "root" },
  { type: "error", seg: "root" },
  { type: "loading", seg: "root" },
  { type: "layout", seg: "dashboard" },
  { type: "error", seg: "dashboard" },
  { type: "loading", seg: "dashboard" },
  { type: "error", seg: "analytics" },
  { type: "loading", seg: "analytics" },
  { type: "page", seg: "analytics" },
];

function present(node: Node, files: Files) {
  if (node.type === "error") return files[node.seg].error;
  if (node.type === "loading") return files[node.seg].loading;
  return true;
}

function nodeLabel(node: Node) {
  switch (node.type) {
    case "global":
      return "GlobalErrorBoundary";
    case "layout":
    case "page":
      return seg(node.seg).component;
    case "error":
      return `${seg(node.seg).Name}ErrorBoundary`;
    case "loading":
      return `Suspense ${seg(node.seg).Name}Loading`;
  }
}

function nodeNote(node: Node) {
  switch (node.type) {
    case "global":
      return "framework default";
    case "layout":
    case "page":
      return seg(node.seg).dir + seg(node.seg).file;
    case "error":
      return seg(node.seg).dir + "error.tsx";
    case "loading":
      return seg(node.seg).dir + "loading.tsx";
  }
}

/** "analytics/loading.tsx" — the last folder and the file, for the cramped preview. */
function shortNote(node: Node) {
  return nodeNote(node).split("/").slice(-2).join("/");
}

interface Outcome {
  thrower: number;
  /** Index of the boundary that handles the fault, or -1 (pending with no Suspense above). */
  handler: number;
  kind: FaultKind;
}

function resolve(fault: Fault, files: Files): Outcome {
  const thrower = TREE.findIndex((n) => (n.type === "layout" || n.type === "page") && n.seg === fault.seg);
  const wanted = fault.kind === "pending" ? ["loading"] : ["error", "global"];
  let handler = -1;
  for (let i = thrower - 1; i >= 0; i--) {
    const n = TREE[i];
    if (wanted.includes(n.type) && present(n, files)) {
      handler = i;
      break;
    }
  }
  return { thrower, handler, kind: fault.kind };
}

/* ------------------------------------------------------------------ explain */

function explain(fault: Fault, files: Files, o: Outcome): { lines: string[]; gotcha?: string } {
  const s = seg(fault.seg);
  const what =
    fault.kind === "render"
      ? `${s.component} threw while rendering`
      : fault.kind === "loader"
        ? `The loader in ${s.dir}${s.file} threw`
        : `${s.component} suspends on a deferred value from its loader`;
  const kept = TREE.slice(0, o.handler)
    .filter((n) => n.type === "layout")
    .map((n) => nodeLabel(n));
  const keptText = kept.length ? `Kept: ${kept.join(" › ")}.` : "Nothing is kept — not even RootLayout.";
  const isLayout = fault.seg !== "analytics";
  const gotcha =
    isLayout && fault.kind !== "pending" && files[fault.seg].error
      ? `${s.dir}error.tsx exists but can't help: it renders inside ${s.component} (it wraps the layout's children, not the layout), so the error passes straight by it to the boundary above.`
      : isLayout && fault.kind === "pending" && files[fault.seg].loading
        ? `${s.dir}loading.tsx sits inside ${s.component}, so it can't stand in for the layout itself — the loading UI above it is used instead.`
        : undefined;

  if (fault.kind === "pending") {
    if (o.handler < 0) {
      return {
        lines: [
          `${what}.`,
          "No loading.tsx sits above RootLayout; only the Router's own top-level <Suspense> does, so its generic Loading… fallback replaces the whole page until the value resolves.",
        ],
        gotcha,
      };
    }
    const h = TREE[o.handler];
    return {
      lines: [
        `${what}.`,
        `${nodeNote(h)} shows its skeleton in place of everything below it until the value resolves.`,
        keptText,
      ],
      gotcha,
    };
  }

  const h = TREE[o.handler];
  const caughtBy =
    h.type === "global"
      ? "GlobalErrorBoundary (the framework's last resort) catches it. Its fallback replaces the root layout, so it can't rely on anything the layout provides."
      : `${nodeNote(h)} catches it.`;
  return {
    lines: [
      `${what}.`,
      caughtBy,
      `Fallback props: phase: '${fault.kind}'${fault.kind === "loader" ? ", retryLoader available" : ", reset() to try again"}.`,
      keptText,
    ],
    gotcha,
  };
}

/* ------------------------------------------------------------------ preview */

function Region({
  label,
  tone = "default",
  className,
  children,
}: {
  label: string;
  tone?: "default" | "error" | "loading";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md border p-2",
        tone === "default" && "border-fd-border bg-fd-background",
        tone === "error" && "border-fd-warning/60 bg-fd-warning/8",
        tone === "loading" && "border-dashed border-fd-primary/50 bg-fd-primary/6",
        className,
      )}
    >
      <p
        className={cn(
          "m-0 mb-1.5 truncate font-mono text-[0.68rem] leading-4",
          tone === "error" ? "text-fd-warning" : tone === "loading" ? "text-fd-primary" : "text-fd-muted-foreground",
        )}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-1.5 motion-safe:animate-pulse" aria-hidden>
      <div className="h-2 w-2/3 rounded bg-fd-primary/20" />
      <div className="h-2 w-full rounded bg-fd-primary/15" />
      <div className="h-2 w-5/6 rounded bg-fd-primary/15" />
    </div>
  );
}

function ErrorFallback({ node, kind }: { node: Node; kind: FaultKind }) {
  const global = node.type === "global";
  return (
    <Region
      label={global ? "GlobalErrorBoundary fallback" : `${shortNote(node)} fallback`}
      tone="error"
      className={global ? "min-h-40" : undefined}
    >
      <p className="m-0 text-xs leading-5 text-fd-foreground">
        {global ? "Something went wrong (no root layout)" : "Something went wrong"}
      </p>
      <span className="mt-1.5 inline-block rounded border border-fd-warning/50 px-1.5 py-0.5 text-[0.68rem] text-fd-foreground">
        {kind === "loader" ? "Retry loading" : "Try again"}
      </span>
    </Region>
  );
}

function Preview({ outcome }: { outcome: Outcome | null }) {
  const render = (i: number): ReactNode => {
    const node = TREE[i];
    if (outcome && outcome.handler === i) {
      if (outcome.kind === "pending") {
        return (
          <Region label={shortNote(node)} tone="loading">
            <Skeleton />
          </Region>
        );
      }
      return <ErrorFallback node={node} kind={outcome.kind} />;
    }
    switch (node.type) {
      case "layout":
        if (node.seg === "root") {
          return (
            <Region label="RootLayout">
              <div className="mb-2 flex items-center gap-2 rounded bg-fd-muted px-2 py-1 text-[0.7rem] text-fd-muted-foreground">
                <span className="font-semibold text-fd-foreground">Eigen</span>
                <span>Home</span>
                <span>Dashboard</span>
              </div>
              {render(i + 1)}
            </Region>
          );
        }
        return (
          <Region label="DashboardLayout">
            <div className="flex gap-2">
              <div className="w-16 shrink-0 space-y-1 rounded bg-fd-muted p-1.5 text-[0.65rem] leading-4 text-fd-muted-foreground sm:w-20">
                <div>Overview</div>
                <div className="font-semibold text-fd-foreground">Analytics</div>
                <div>Settings</div>
              </div>
              <div className="min-w-0 flex-1">{render(i + 1)}</div>
            </div>
          </Region>
        );
      case "page":
        return (
          <Region label="AnalyticsPage">
            <div className="flex h-10 items-end gap-1" aria-hidden>
              {[40, 70, 55, 90, 65, 80].map((h, k) => (
                <div key={k} className="flex-1 rounded-sm bg-fd-muted-foreground/30" style={{ height: `${h}%` }} />
              ))}
            </div>
          </Region>
        );
      default:
        return render(i + 1);
    }
  };

  if (outcome && outcome.kind === "pending" && outcome.handler < 0) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-fd-border p-4 text-center text-xs text-fd-muted-foreground">
        Loading… — the Router&rsquo;s own Suspense fallback stands in for the whole page.
      </div>
    );
  }
  return <>{render(0)}</>;
}

/* --------------------------------------------------------------------- tree */

function Tree({ files, outcome }: { files: Files; outcome: Outcome | null }) {
  return (
    <ol className="m-0 list-none p-0 font-mono text-[0.72rem] leading-5" aria-label="Generated component tree">
      {TREE.map((node, i) => {
        const has = present(node, files);
        const isThrower = outcome?.thrower === i;
        const isHandler = outcome?.handler === i;
        const below = outcome && outcome.handler >= 0 && i > outcome.handler;
        return (
          <li
            key={i}
            style={{ paddingLeft: `${i * 0.6}rem` }}
            className={cn("whitespace-nowrap", !has && "opacity-45", below && !isThrower && "opacity-55")}
          >
            <span
              className={cn(
                "rounded px-1",
                isThrower && "bg-fd-warning/15 text-fd-warning",
                isHandler && "bg-fd-primary/15 text-fd-primary",
                !isThrower &&
                  !isHandler &&
                  (node.type === "layout" || node.type === "page" ? "text-fd-foreground" : "text-fd-muted-foreground"),
                !has && "line-through",
              )}
            >
              {node.type === "loading" ? `<${nodeLabel(node).replace(" ", " fallback=")}>` : `<${nodeLabel(node)}>`}
            </span>
            {isThrower && (
              <span className="ml-1 text-fd-warning">← {outcome?.kind === "pending" ? "suspends" : "throws"}</span>
            )}
            {isHandler && (
              <span className="ml-1 text-fd-primary">
                ← {outcome?.kind === "pending" ? "shows fallback" : "catches"}
              </span>
            )}
            {!has && <span className="ml-1 not-italic">(no file)</span>}
          </li>
        );
      })}
    </ol>
  );
}

/* --------------------------------------------------------------- playground */

const KINDS: { kind: FaultKind; label: string }[] = [
  { kind: "render", label: "Throw in render" },
  { kind: "loader", label: "Throw in loader" },
  { kind: "pending", label: "Suspend" },
];

const ALL_FILES: Files = {
  root: { error: true, loading: true },
  dashboard: { error: true, loading: true },
  analytics: { error: true, loading: true },
};

export function ErrorBoundaryPlayground() {
  const [files, setFiles] = useState<Files>(ALL_FILES);
  const [fault, setFault] = useState<Fault | null>({
    seg: "dashboard",
    kind: "render",
  });
  const outcome = fault ? resolve(fault, files) : null;
  const text = fault && outcome ? explain(fault, files, outcome) : null;

  const toggleFile = (s: SegId, f: "error" | "loading") =>
    setFiles((prev) => ({ ...prev, [s]: { ...prev[s], [f]: !prev[s][f] } }));

  return (
    <Playground
      title="Which boundary catches it?"
      prompt="Make one part of /dashboard/analytics fail, then add or remove error.tsx and loading.tsx files and watch the error move up the tree."
      caption="Error boundaries catch errors from their children only. A segment's error.tsx sits inside that segment's layout, so it handles the page and nested segments, never the layout itself."
    >
      <div className="space-y-3">
        {SEGMENTS.map((s) => (
          <fieldset key={s.id} className="m-0 min-w-0 rounded-lg border border-fd-border bg-fd-background p-3">
            <legend className="px-1 font-mono text-xs text-fd-muted-foreground">{s.dir}</legend>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="font-mono text-sm text-fd-foreground">{s.file}</span>
              {(["error", "loading"] as const).map((f) => (
                <label
                  key={f}
                  className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-sm text-fd-foreground"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--color-fd-primary)]"
                    checked={files[s.id][f]}
                    onChange={() => toggleFile(s.id, f)}
                  />
                  {f}.tsx
                </label>
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label={`Make ${s.component} fail`}>
              {KINDS.map((k) => {
                const on = fault?.seg === s.id && fault.kind === k.kind;
                return (
                  <button
                    key={k.kind}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFault(on ? null : { seg: s.id, kind: k.kind })}
                    className={cn(
                      buttonClass,
                      "px-2.5 py-1 text-xs",
                      on &&
                        k.kind !== "pending" &&
                        "border-fd-warning bg-fd-warning/12 text-fd-foreground hover:bg-fd-warning/18",
                      on && k.kind === "pending" && "border-fd-primary bg-fd-primary/12 hover:bg-fd-primary/18",
                    )}
                  >
                    {k.label}
                    <span className="sr-only"> in {s.component}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            setFiles(ALL_FILES);
            setFault(null);
          }}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Reset
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="min-w-0 rounded-lg border border-fd-border bg-fd-background p-3">
          <p className="m-0 mb-1.5 text-[0.7rem] font-semibold tracking-[0.06em] text-fd-muted-foreground uppercase">
            Generated tree
          </p>
          <div className="overflow-x-auto">
            <Tree files={files} outcome={outcome} />
          </div>
        </div>
        <div className="min-w-0 rounded-lg border border-fd-border bg-fd-background p-3">
          <p className="m-0 mb-1.5 text-[0.7rem] font-semibold tracking-[0.06em] text-fd-muted-foreground uppercase">
            What the user sees
          </p>
          <div aria-hidden>
            <Preview outcome={outcome} />
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-3" aria-live="polite">
        <Output label="What happened" tone={fault ? (fault.kind === "pending" ? "accent" : "warning") : "default"}>
          <span className="font-sans">
            {text ? text.lines.join(" ") : "Everything rendered. Pick a failure above."}
          </span>
        </Output>
        {text?.gotcha && (
          <Output label={`Why not its own ${fault?.kind === "pending" ? "loading" : "error"}.tsx?`} tone="accent">
            <span className="font-sans">{text.gotcha}</span>
          </Output>
        )}
      </div>
    </Playground>
  );
}
