"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/cn";

import { Output, Playground } from "./frame";

/*
 * Three loaders for /dashboard/settings, awaited one after another versus
 * started together and awaited with Promise.all. With the dependency toggle,
 * the page loader needs the dashboard layout's result, so even the parallel
 * version has to wait for that one.
 */

const LOADERS = [
  { id: "root", name: "root layout", call: "getUser()", initial: 200 },
  { id: "dash", name: "dashboard layout", call: "getMetrics()", initial: 300 },
  { id: "page", name: "settings page", call: "getSettings()", initial: 150 },
] as const;
type Id = (typeof LOADERS)[number]["id"];

interface Bar {
  id: Id;
  start: number;
  end: number;
}

function sequential(ms: Record<Id, number>): Bar[] {
  let t = 0;
  return LOADERS.map((l) => {
    const bar = { id: l.id, start: t, end: t + ms[l.id] };
    t = bar.end;
    return bar;
  });
}

function parallel(ms: Record<Id, number>, pageNeedsDash: boolean): Bar[] {
  return LOADERS.map((l) => {
    const start = l.id === "page" && pageNeedsDash ? ms.dash : 0;
    return { id: l.id, start, end: start + ms[l.id] };
  });
}

const total = (bars: Bar[]) => Math.max(...bars.map((b) => b.end));

export function LoaderTimingPlayground() {
  const uid = useId();
  const [ms, setMs] = useState<Record<Id, number>>(
    () => Object.fromEntries(LOADERS.map((l) => [l.id, l.initial])) as Record<Id, number>,
  );
  const [dep, setDep] = useState(false);

  const seq = sequential(ms);
  const par = parallel(ms, dep);
  const seqTotal = total(seq);
  const parTotal = total(par);
  const scale = seqTotal;

  return (
    <Playground
      title="Awaiting in sequence vs. in parallel"
      prompt="Drag the latencies. Then make the page loader depend on the dashboard layout's data."
      caption="Awaiting each loader in turn costs the sum of their latencies; starting them together and awaiting Promise.all costs only the longest chain of loaders that genuinely depend on each other."
    >
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {LOADERS.map((l) => (
            <label key={l.id} htmlFor={`${uid}-${l.id}`} className="grid gap-1 text-sm text-fd-foreground">
              <span className="flex justify-between gap-2">
                <span>{l.name}</span>
                <span className="font-mono text-fd-muted-foreground">{ms[l.id]}ms</span>
              </span>
              <input
                id={`${uid}-${l.id}`}
                type="range"
                min={50}
                max={800}
                step={10}
                value={ms[l.id]}
                onChange={(e) => setMs((m) => ({ ...m, [l.id]: Number(e.target.value) }))}
                className="w-full accent-fd-primary"
                aria-valuetext={`${ms[l.id]} milliseconds`}
              />
            </label>
          ))}
        </div>

        <label className="flex items-start gap-2 text-sm text-fd-foreground">
          <input
            type="checkbox"
            checked={dep}
            onChange={(e) => setDep(e.target.checked)}
            className="mt-1 size-4 accent-fd-primary"
          />
          <span>
            The page loader needs the dashboard layout&apos;s result{" "}
            <span className="text-fd-muted-foreground">
              (e.g. it reads <code className="font-mono text-[0.85em]">metrics.teamId</code>)
            </span>
          </span>
        </label>

        <Timeline
          title="Awaited in sequence"
          code={`const user = await root(…)\nconst metrics = await dashboard(…)\nconst settings = await page(…)`}
          bars={seq}
          scale={scale}
          totalMs={seqTotal}
        />
        <Timeline
          title="Started together, awaited with Promise.all"
          code={
            dep
              ? `const [user, settings] = await Promise.all([\n  root(…),\n  dashboard(…).then((metrics) => page(metrics)),\n])`
              : `const [user, metrics, settings] = await Promise.all([\n  root(…), dashboard(…), page(…),\n])`
          }
          bars={par}
          scale={scale}
          totalMs={parTotal}
          dependent={dep}
          accent
        />

        <div aria-live="polite" aria-atomic="true">
          <Output label="Total" tone="accent">
            {`in sequence: ${seqTotal}ms  (sum of all three)\nin parallel: ${parTotal}ms  (${
              dep ? "dashboard → page chain vs. root, whichever is longer" : "the slowest loader"
            })\nsaved: ${seqTotal - parTotal}ms${
              dep
                ? "\n\nA dependency puts loaders back in a chain. Part 13's fix: move the shared query into a helper both loaders call, or into middleware."
                : ""
            }`}
          </Output>
        </div>
      </div>
    </Playground>
  );
}

function Timeline({
  title,
  code,
  bars,
  scale,
  totalMs,
  dependent = false,
  accent = false,
}: {
  title: string;
  code: string;
  bars: Bar[];
  scale: number;
  totalMs: number;
  dependent?: boolean;
  accent?: boolean;
}) {
  return (
    <section
      className="grid gap-2 rounded-lg border border-fd-border bg-fd-background p-3"
      aria-label={`${title}: ${totalMs}ms`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="m-0 text-sm font-semibold text-fd-foreground">{title}</p>
        <p className={cn("m-0 font-mono text-sm", accent ? "text-fd-primary" : "text-fd-foreground")}>{totalMs}ms</p>
      </div>
      <pre className="m-0 overflow-x-auto font-mono text-xs leading-5 text-fd-muted-foreground">{code}</pre>
      <ul className="m-0 grid list-none gap-1.5 p-0">
        {bars.map((b) => {
          const l = LOADERS.find((x) => x.id === b.id)!;
          return (
            <li key={b.id} className="grid grid-cols-[6.5rem_1fr] items-center gap-2 text-xs sm:grid-cols-[8rem_1fr]">
              <span className="truncate text-fd-muted-foreground" title={l.name}>
                {l.name}
              </span>
              <span className="relative block h-5 rounded bg-fd-muted/70">
                <span
                  className={cn(
                    "absolute inset-y-0 flex items-center justify-end rounded px-1.5 font-mono text-[0.65rem] transition-[left,width] duration-200 motion-reduce:transition-none",
                    accent
                      ? "bg-fd-primary text-fd-primary-foreground"
                      : "bg-fd-muted-foreground/45 text-fd-foreground",
                    dependent && b.id === "page" && "bg-fd-warning text-fd-background",
                  )}
                  style={{ left: `${(b.start / scale) * 100}%`, width: `${((b.end - b.start) / scale) * 100}%` }}
                >
                  <span className="sr-only">
                    {l.name}: starts at {b.start}ms, ends at {b.end}ms
                  </span>
                  <span aria-hidden className="truncate">
                    {b.end - b.start}
                  </span>
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <div
        className="grid grid-cols-[6.5rem_1fr] gap-2 text-[0.65rem] text-fd-muted-foreground sm:grid-cols-[8rem_1fr]"
        aria-hidden
      >
        <span />
        <span className="flex justify-between font-mono">
          <span>0</span>
          <span>{scale}ms</span>
        </span>
      </div>
    </section>
  );
}
