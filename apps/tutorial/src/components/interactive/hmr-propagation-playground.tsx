"use client";

import { Pencil, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/cn";

import { Arrow, type Point, type Rect, bottom, left, right, top } from "../diagrams/kit";
import { Output, Playground, buttonClass, primaryButtonClass } from "./frame";

/* ------------------------------------------------------------------ graph */

type Accept = "self" | "invalidate" | "none";

interface ModuleDef {
  id: string;
  rect: Rect;
  /** Modules this one imports. */
  imports: string[];
  kind: "entry" | "component" | "util" | "css";
  initial: Accept;
}

const MODULES: ModuleDef[] = [
  {
    id: "main.tsx",
    rect: { x: 170, y: 8, w: 140, h: 44 },
    imports: ["App.tsx", "config.ts", "styles.css"],
    kind: "entry",
    initial: "none",
  },
  {
    id: "App.tsx",
    rect: { x: 12, y: 96, w: 136, h: 44 },
    imports: ["Header.tsx", "PostList.tsx", "config.ts"],
    kind: "component",
    initial: "self",
  },
  { id: "config.ts", rect: { x: 172, y: 96, w: 136, h: 44 }, imports: [], kind: "util", initial: "none" },
  { id: "styles.css", rect: { x: 332, y: 96, w: 136, h: 44 }, imports: [], kind: "css", initial: "self" },
  {
    id: "Header.tsx",
    rect: { x: 12, y: 184, w: 136, h: 44 },
    imports: ["format.ts"],
    kind: "component",
    initial: "self",
  },
  {
    id: "PostList.tsx",
    rect: { x: 172, y: 184, w: 136, h: 44 },
    imports: ["format.ts"],
    kind: "component",
    initial: "self",
  },
  { id: "format.ts", rect: { x: 92, y: 272, w: 136, h: 44 }, imports: [], kind: "util", initial: "none" },
];

const byId = Object.fromEntries(MODULES.map((m) => [m.id, m]));
const importersOf = (id: string) => MODULES.filter((m) => m.imports.includes(id)).map((m) => m.id);

/** Edge geometry from importer (above) down to the imported module. */
function edge(fromId: string, toId: string): { from: Point; to: Point; via?: Point[] } {
  const a = byId[fromId].rect;
  const b = byId[toId].rect;
  if (Math.abs(a.y - b.y) < 1) return a.x < b.x ? { from: right(a), to: left(b) } : { from: left(a), to: right(b) };
  if (fromId === "main.tsx" && toId === "styles.css")
    return { from: right(a), to: top(b), via: [[top(b)[0], right(a)[1]]] };
  if (fromId === "main.tsx" && toId === "App.tsx") return { from: left(a), to: top(b), via: [[top(b)[0], left(a)[1]]] };
  const dx = toId === "format.ts" ? (fromId === "Header.tsx" ? -24 : 24) : 0;
  const sx = fromId === "App.tsx" && toId === "PostList.tsx" ? 30 : 0;
  const from = bottom(a, sx);
  const to = top(b, dx);
  if (Math.abs(from[0] - to[0]) < 1) return { from, to };
  const midY = (from[1] + to[1]) / 2;
  return {
    from,
    to,
    via: [
      [from[0], midY],
      [to[0], midY],
    ],
  };
}

/* ------------------------------------------------- propagation (Vite model) */

type Event =
  | { kind: "changed"; id: string }
  | { kind: "climb"; from: string; to: string; afterInvalidate?: boolean }
  | { kind: "boundary"; id: string }
  | { kind: "dead-end"; id: string }
  | { kind: "invalidate"; id: string };

/**
 * A simplified port of Vite's `propagateUpdate` (packages/vite/src/node/server/hmr.ts):
 * a self-accepting module is a boundary; otherwise every importer is visited,
 * and reaching a module with no importers means a full reload.
 * (Partial `accept(deps)` and the CSS-importer special cases are left out.)
 */
function propagate(
  id: string,
  accept: Record<string, Accept>,
  traversed: Set<string>,
  boundaries: string[],
  events: Event[],
  chain: string[],
): boolean {
  if (traversed.has(id)) return false;
  traversed.add(id);

  if (accept[id] !== "none") {
    boundaries.push(id);
    events.push({ kind: "boundary", id });
    return false;
  }
  const importers = importersOf(id);
  if (importers.length === 0) {
    events.push({ kind: "dead-end", id });
    return true;
  }
  for (const imp of importers) {
    if (chain.includes(imp)) continue;
    events.push({ kind: "climb", from: id, to: imp });
    if (propagate(imp, accept, traversed, boundaries, events, [...chain, imp])) return true;
  }
  return false;
}

interface Outcome {
  events: Event[];
  boundaries: string[];
  reload: boolean;
}

function simulate(changed: string, accept: Record<string, Accept>): Outcome {
  const events: Event[] = [{ kind: "changed", id: changed }];
  const boundaries: string[] = [];
  if (propagate(changed, accept, new Set(), boundaries, events, [changed])) return { events, boundaries, reload: true };

  // A boundary whose accept handler calls import.meta.hot.invalidate() (Fast Refresh
  // with non-component exports) sends the update on to its own importers.
  const final: string[] = [];
  let queue = boundaries;
  const seen = new Set<string>();
  while (queue.length) {
    const next: string[] = [];
    for (const b of queue) {
      if (accept[b] !== "invalidate" || seen.has(b)) {
        if (!final.includes(b)) final.push(b);
        continue;
      }
      seen.add(b);
      events.push({ kind: "invalidate", id: b });
      for (const imp of importersOf(b)) {
        events.push({ kind: "climb", from: b, to: imp, afterInvalidate: true });
        const found: string[] = [];
        if (propagate(imp, accept, new Set(), found, events, [imp])) return { events, boundaries: [], reload: true };
        next.push(...found);
      }
      if (importersOf(b).length === 0) {
        events.push({ kind: "dead-end", id: b });
        return { events, boundaries: [], reload: true };
      }
    }
    queue = next;
  }
  return { events, boundaries: final, reload: false };
}

/* ------------------------------------------------------------- narration */

function acceptLabel(m: ModuleDef, a: Accept) {
  if (a === "invalidate") return "Fast Refresh, but exports a non-component — accept handler calls invalidate()";
  if (a === "none") return "no accept handler";
  if (m.kind === "css") return "self-accepting (Vite swaps the <style>)";
  if (m.kind === "component") return "Fast Refresh boundary (every export is a component)";
  return "calls import.meta.hot.accept()";
}

function describe(e: Event, accept: Record<string, Accept>): string {
  switch (e.kind) {
    case "changed":
      return `You saved ${e.id}. Vite finds it in the client module graph.`;
    case "climb":
      return e.afterInvalidate
        ? `Vite propagates the invalidation to ${e.to}, as if ${e.to} had changed.`
        : `${e.from} has no accept handler, so Vite checks its importer ${e.to}.`;
    case "boundary": {
      const m = byId[e.id];
      if (accept[e.id] === "invalidate")
        return `${e.id} registered an accept handler, so Vite treats it as the boundary and sends the update.`;
      return `${e.id} is an HMR boundary: ${acceptLabel(m, accept[e.id])}. Propagation stops on this branch.`;
    }
    case "invalidate":
      return `${e.id} is re-imported, but Fast Refresh rejects it: not every export is a component. Its handler calls import.meta.hot.invalidate(), so the update continues to its importers.`;
    case "dead-end":
      return `${e.id} has no importers and no accept handler: the root was reached without a boundary.`;
  }
}

function summary(o: Outcome, changed: string) {
  if (o.reload)
    return "Full page reload. One branch reached the root without an accept handler, so there's no safe way to apply the update in place.";
  const list = o.boundaries.join(" and ");
  if (o.boundaries.length === 1 && o.boundaries[0] === changed && byId[changed].kind === "css")
    return "Hot update: Vite swaps the stylesheet in place. No JavaScript re-runs, nothing reloads.";
  const via = o.boundaries.includes(changed)
    ? ""
    : ` (${o.boundaries.length > 1 ? "which pull" : "which pulls"} in the new ${changed})`;
  const handlers = o.boundaries.length > 1 ? "their accept handlers" : "its accept handler";
  const allComponents = o.boundaries.every((b) => byId[b].kind === "component");
  const tail = allComponents
    ? "Fast Refresh re-renders without losing state."
    : "What happens next is up to the accept handler's code.";
  return `Hot update: the browser re-imports ${list}${via} and runs ${handlers}. ${tail}`;
}

/* ------------------------------------------------------------- component */

const REDUCED = "(prefers-reduced-motion: reduce)";

function useReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(REDUCED);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

const initialAccept = Object.fromEntries(MODULES.map((m) => [m.id, m.initial])) as Record<string, Accept>;

export function HmrPropagationPlayground() {
  const [accept, setAccept] = useState(initialAccept);
  const [selected, setSelected] = useState("format.ts");
  const [run, setRun] = useState<{ changed: string; outcome: Outcome } | null>(null);
  const [shown, setShown] = useState(0);
  const reduced = useReducedMotion();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const id = useId();

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  const edit = (target: string) => {
    if (timer.current) clearInterval(timer.current);
    const outcome = simulate(target, accept);
    setRun({ changed: target, outcome });
    const total = outcome.events.length;
    if (reduced) {
      setShown(total);
      return;
    }
    setShown(1);
    let n = 1;
    timer.current = setInterval(() => {
      n++;
      setShown(n);
      if (n >= total && timer.current) clearInterval(timer.current);
    }, 700);
  };

  const clear = () => {
    if (timer.current) clearInterval(timer.current);
    setRun(null);
    setShown(0);
  };

  const visible = run ? run.outcome.events.slice(0, shown) : [];
  const done = run !== null && shown >= run.outcome.events.length;

  const state = (() => {
    const climbed = new Set<string>();
    const boundaries = new Set<string>();
    const visited = new Set<string>();
    const invalidated = new Set<string>();
    let deadEnd: string | null = null;
    for (const e of visible) {
      if (e.kind === "climb") {
        climbed.add(`${e.from}>${e.to}`);
        visited.add(e.to);
      } else if (e.kind === "boundary") boundaries.add(e.id);
      else if (e.kind === "dead-end") deadEnd = e.id;
      else if (e.kind === "invalidate") invalidated.add(e.id);
    }
    return { climbed, boundaries, visited, invalidated, deadEnd };
  })();

  const sel = byId[selected];
  const options: Accept[] =
    sel.kind === "component" ? ["self", "invalidate", "none"] : sel.kind === "css" ? ["self"] : ["none", "self"];

  return (
    <Playground
      title="HMR propagation"
      prompt="Select a module and edit it. Try format.ts, then config.ts, then make PostList.tsx export a loader."
      caption="Vite walks up from the changed module through every importer; each branch must reach a module that accepts the update, or the page fully reloads."
    >
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <svg
            viewBox="0 0 480 324"
            className="mx-auto block h-auto w-full max-w-[560px] text-fd-foreground"
            fontSize={13}
            role="group"
            aria-label="Client module graph. Arrows point from importer to imported module."
          >
            {MODULES.flatMap((m) =>
              m.imports.map((to) => {
                const g = edge(m.id, to);
                return <Arrow key={`${m.id}-${to}`} from={g.from} to={g.to} via={g.via} />;
              }),
            )}
            {/* Propagation: drawn upward, from the changed module to its importer. */}
            {MODULES.flatMap((m) =>
              m.imports.map((to) => {
                if (!state.climbed.has(`${to}>${m.id}`)) return null;
                const g = edge(m.id, to);
                return (
                  <g key={`up-${m.id}-${to}`} className="hmr-climb">
                    <Arrow from={g.to} to={g.from} via={g.via ? [...g.via].reverse() : undefined} tone="accent" />
                  </g>
                );
              }),
            )}
            {MODULES.map((m) => {
              const r = m.rect;
              const a = accept[m.id];
              const isChanged = run?.changed === m.id;
              const isBoundary = state.boundaries.has(m.id) && !state.invalidated.has(m.id);
              const isDead = state.deadEnd === m.id;
              const isVisited = state.visited.has(m.id) || isChanged;
              const isSelected = selected === m.id;
              return (
                <g
                  key={m.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${m.id}: ${acceptLabel(m, a)}`}
                  onClick={() => setSelected(m.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(m.id);
                    }
                  }}
                  className="cursor-pointer outline-none [&:focus-visible>rect:first-child]:stroke-fd-ring [&:focus-visible>rect:first-child]:stroke-[3]"
                >
                  <rect
                    x={r.x - 3}
                    y={r.y - 3}
                    width={r.w + 6}
                    height={r.h + 6}
                    rx={10}
                    fill="none"
                    strokeWidth={isSelected ? 2 : 0}
                    className={isSelected ? "stroke-fd-foreground/60" : "stroke-transparent"}
                  />
                  <rect
                    x={r.x}
                    y={r.y}
                    width={r.w}
                    height={r.h}
                    rx={8}
                    strokeWidth={isBoundary || isDead ? 1.75 : 1}
                    className={cn(
                      "transition-colors motion-reduce:transition-none",
                      isBoundary
                        ? "fill-fd-primary/15 stroke-fd-primary"
                        : isDead
                          ? "fill-fd-warning/15 stroke-fd-warning"
                          : isVisited
                            ? "fill-fd-muted stroke-fd-muted-foreground/70"
                            : "fill-fd-background stroke-fd-muted-foreground/45",
                    )}
                  />
                  <text
                    x={r.x + r.w / 2}
                    y={r.y + 18}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontWeight={600}
                    className="fill-fd-foreground font-mono"
                  >
                    {m.id}
                  </text>
                  <text
                    x={r.x + r.w / 2}
                    y={r.y + 33}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={10.5}
                    className={
                      a === "none"
                        ? "fill-fd-muted-foreground"
                        : a === "invalidate"
                          ? "fill-fd-warning"
                          : "fill-fd-primary"
                    }
                  >
                    {isChanged
                      ? "✎ edited"
                      : a === "none"
                        ? m.kind === "entry"
                          ? "entry · no accept"
                          : "no accept"
                        : a === "invalidate"
                          ? "accept → invalidate"
                          : "accepts"}
                  </text>
                </g>
              );
            })}
            <style>{`.hmr-climb{animation:hmr-in .35s ease-out}@keyframes hmr-in{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion:reduce){.hmr-climb{animation:none}}`}</style>
          </svg>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="min-w-0 self-start rounded-lg border border-fd-border bg-fd-background p-3">
            <p className="m-0 font-mono text-sm font-semibold text-fd-foreground">{selected}</p>
            <label htmlFor={`${id}-accept`} className="mt-2 mb-1 block text-xs text-fd-muted-foreground">
              HMR behaviour
            </label>
            <select
              id={`${id}-accept`}
              value={accept[selected]}
              disabled={options.length === 1}
              onChange={(e) => {
                setAccept({ ...accept, [selected]: e.target.value as Accept });
                clear();
              }}
              className="w-full rounded-lg border border-fd-border bg-fd-background px-2 py-1.5 text-sm text-fd-foreground outline-none focus-visible:border-fd-primary focus-visible:ring-2 focus-visible:ring-fd-primary/25 disabled:opacity-70"
            >
              {options.map((o) => (
                <option key={o} value={o}>
                  {acceptLabel(sel, o)}
                </option>
              ))}
            </select>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={primaryButtonClass} onClick={() => edit(selected)}>
                <Pencil className="size-3.5" aria-hidden />
                Edit {selected}
              </button>
              <button
                type="button"
                className={buttonClass}
                onClick={() => {
                  setAccept(initialAccept);
                  clear();
                }}
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Reset
              </button>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <ol
              className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm leading-6 text-fd-foreground/90"
              aria-label="Propagation steps"
            >
              {visible.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 font-mono text-xs text-fd-primary">{i + 1}</span>
                  <span>{describe(e, accept)}</span>
                </li>
              ))}
              {!run && <li className="text-fd-muted-foreground">Nothing edited yet.</li>}
            </ol>

            <div aria-live="polite">
              {run && done && (
                <Output
                  label={run.outcome.reload ? "Result: full reload" : "Result: hot update"}
                  tone={run.outcome.reload ? "warning" : "accent"}
                >
                  <span className="font-sans">{summary(run.outcome, run.changed)}</span>
                </Output>
              )}
            </div>
          </div>
        </div>
      </div>
    </Playground>
  );
}
