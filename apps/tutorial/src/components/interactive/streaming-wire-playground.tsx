"use client";

import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/cn";

import { Playground, buttonClass, primaryButtonClass } from "./frame";

/*
 * The response for Part 12's Dashboard page, chunk by chunk, as renderStream
 * assembles it: template head from the TransformStream's start(), React's shell,
 * the resolved Suspense boundary, then flush() with the data script and the rest
 * of the template. React's markers are representative, not byte-exact.
 */
interface Chunk {
  /** Simulated arrival time in ms since the request. */
  t: number;
  source: string;
  html: string;
  /** What the browser does with it. */
  effect: string;
}

const CHUNKS: Chunk[] = [
  {
    t: 50,
    source: "start(): htmlBefore",
    html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <script type="module" src="/@vite/client"></script>
    <title>Eigen Framework</title>
  </head>
  <body>
    <div id="root">`,
    effect:
      "The loader awaited fetchStats (~50 ms), renderToReadableStream resolved with the shell, and the TransformStream's start() enqueues the template head. The browser parses <head> and requests /@vite/client; the page is still blank.",
  },
  {
    t: 50,
    source: "React: the shell",
    html: `<div><nav>…</nav><div><h1>Dashboard</h1><div><h2>Stats</h2><p>Users: 1042</p><p>Revenue: $54300</p></div><!--$?--><template id="B:0"></template><div>Loading orders...</div><!--/$--></div></div>`,
    effect:
      'Everything outside the Suspense boundary, in the same tick. <!--$?--> and the empty <template id="B:0"> mark a pending boundary; the fallback is ordinary visible HTML. First paint. #root, <body> and <html> stay open: their closing tags are in htmlAfter.',
  },
  {
    t: 850,
    source: "React: boundary B:0 resolved",
    html: `<div hidden id="S:0"><div><h2>Recent Orders</h2><ul><li>#001: $120</li><li>#002: $87</li></ul></div></div><script>$RC=function(b,s){/* swap the fallback after B:0 for the children of S:0 */};$RC("B:0","S:0")</script>`,
    effect:
      "fetchRecentOrders settles 800 ms later. The content arrives in a hidden <div>, so it is parsed but not shown; the inline script runs as soon as it is parsed and moves it into place of the fallback. Plain DOM work — nothing is hydrated yet.",
  },
  {
    t: 851,
    source: "flush(): data + htmlAfter",
    html: `<script>window.__EIGEN_DATA__ = {"stats":{"users":1042,"revenue":54300},"recentOrders":[{"id":"001","total":120},{"id":"002","total":87}]}</script></div>
    <script type="module" src="/src/entry-client.tsx"></script>
  </body>
</html>`,
    effect:
      "React closed its stream, so flush() runs once: the serialized data (orders included), still inside #root, then htmlAfter, which closes #root and carries the client entry. The document finishes parsing, the module script runs, and hydrateRoot makes the page interactive.",
  },
];

const SPEEDS = [
  { label: "1× (real time)", value: 1 },
  { label: "½×", value: 0.5 },
  { label: "¼×", value: 0.25 },
  { label: "⅒×", value: 0.1 },
];

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

function BrowserView({ received }: { received: number }) {
  const shell = received >= 2;
  const orders = received >= 3;
  const hydrated = received >= 4;
  return (
    <div className="overflow-hidden rounded-lg border border-fd-border bg-fd-background">
      <div className="flex items-center gap-2 border-b border-fd-border bg-fd-muted px-3 py-1.5">
        <span className="flex gap-1" aria-hidden>
          <span className="size-2 rounded-full bg-fd-muted-foreground/30" />
          <span className="size-2 rounded-full bg-fd-muted-foreground/30" />
          <span className="size-2 rounded-full bg-fd-muted-foreground/30" />
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-fd-muted-foreground">
          {received >= 1 ? "Eigen Framework — " : ""}localhost:3000/dashboard
        </span>
        <span
          className={cn(
            "size-3 shrink-0 rounded-full border-2",
            hydrated
              ? "border-fd-primary"
              : "animate-spin border-fd-muted-foreground/40 border-t-fd-primary motion-reduce:animate-none",
          )}
          aria-hidden
        />
      </div>
      <div className="min-h-56 p-4 text-sm text-fd-foreground">
        {!shell ? (
          <p className="m-0 text-fd-muted-foreground">
            {received === 0 ? "Waiting for the first byte…" : "(blank — <body> has no content yet)"}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-xs text-fd-primary underline underline-offset-2">Home · Dashboard</p>
            <p className="m-0 text-lg font-semibold">Dashboard</p>
            <div>
              <p className="m-0 font-semibold">Stats</p>
              <p className="m-0">Users: 1042</p>
              <p className="m-0">Revenue: $54300</p>
            </div>
            {orders ? (
              <div className="stream-in rounded-md bg-fd-primary/8 p-2 ring-1 ring-fd-primary/30">
                <p className="m-0 font-semibold">Recent Orders</p>
                <ul className="m-0 list-disc pl-5">
                  <li>#001: $120</li>
                  <li>#002: $87</li>
                </ul>
              </div>
            ) : (
              <p className="m-0 rounded-md border border-dashed border-fd-muted-foreground/40 p-2 text-fd-muted-foreground">
                Loading orders...
              </p>
            )}
          </div>
        )}
      </div>
      <p className="m-0 border-t border-fd-border px-3 py-1.5 text-xs text-fd-muted-foreground">
        {hydrated
          ? "Parsed · hydrated · interactive"
          : received === 0
            ? "Request sent"
            : "Document still loading · not hydrated"}
      </p>
    </div>
  );
}

export function StreamingWirePlayground() {
  const [received, setReceived] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.25);
  const reduced = useReducedMotion();
  const wire = useRef<HTMLDivElement>(null);
  const id = useId();

  const total = CHUNKS.length;
  const clock = received === 0 ? 0 : CHUNKS[received - 1].t;

  // Playback: wait the (scaled) gap until the next chunk, then deliver it.
  useEffect(() => {
    if (!playing || received >= total) return;
    const prev = received === 0 ? 0 : CHUNKS[received - 1].t;
    const delay = Math.max(350, (CHUNKS[received].t - prev) / speed);
    const timer = setTimeout(() => {
      setReceived(received + 1);
      if (received + 1 >= total) setPlaying(false);
    }, delay);
    return () => clearTimeout(timer);
  }, [playing, received, speed, total]);

  // Keep the newest bytes in view inside the wire panel (not the page).
  useEffect(() => {
    const el = wire.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [received, reduced]);

  const step = (n: number) => {
    setPlaying(false);
    setReceived(Math.max(0, Math.min(total, n)));
  };

  return (
    <Playground
      title="A streamed response, chunk by chunk"
      prompt="Play the Dashboard response, or step through it. Left: the bytes as they arrive. Right: what the browser shows at that moment."
      caption="Simplified: React's real markers, attribute names and inline script differ in detail, and chunk boundaries depend on the network. The order is what matters: shell with fallback, then hidden content plus a swap script, then our flush."
    >
      <style>{`.stream-in{animation:stream-in .4s ease-out}@keyframes stream-in{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion:reduce){.stream-in{animation:none}}`}</style>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => {
            if (received >= total) setReceived(0);
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
          {playing ? "Pause" : received >= total ? "Replay" : "Play"}
        </button>
        <div className="flex gap-1">
          <button
            type="button"
            className={buttonClass}
            aria-label="Previous chunk"
            title="Previous chunk"
            disabled={received === 0}
            onClick={() => step(received - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className={buttonClass}
            aria-label="Next chunk"
            title="Next chunk"
            disabled={received === total}
            onClick={() => step(received + 1)}
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className={buttonClass}
            aria-label="Reset"
            title="Reset"
            disabled={received === 0 && !playing}
            onClick={() => step(0)}
          >
            <RotateCcw className="size-3.5" aria-hidden />
          </button>
        </div>
        <label htmlFor={`${id}-speed`} className="ml-auto text-sm text-fd-muted-foreground">
          Speed
        </label>
        <select
          id={`${id}-speed`}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="rounded-lg border border-fd-border bg-fd-background px-2 py-1.5 text-sm text-fd-foreground outline-none focus-visible:border-fd-primary focus-visible:ring-2 focus-visible:ring-fd-primary/25"
        >
          {SPEEDS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Timeline: one tick per chunk, to scale. */}
      <div className="mb-4" aria-hidden>
        <div className="relative h-1.5 rounded-full bg-fd-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-fd-primary/50"
            style={{ width: `${(clock / 900) * 100}%` }}
          />
          {CHUNKS.map((c, i) => (
            <span
              key={i}
              className={cn(
                "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-fd-card",
                i < received ? "bg-fd-primary" : "bg-fd-muted-foreground/40",
              )}
              style={{ left: `${(c.t / 900) * 100}%` }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[0.7rem] text-fd-muted-foreground">
          <span>0 ms</span>
          <span>t = {clock} ms</span>
          <span>900 ms</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <p className="m-0 mb-1.5 text-[0.7rem] font-semibold tracking-[0.06em] text-fd-muted-foreground uppercase">
            On the wire
          </p>
          <div
            ref={wire}
            tabIndex={0}
            role="region"
            aria-label="Response bytes received so far"
            className="h-72 overflow-y-auto rounded-lg border border-fd-border bg-fd-background p-3 outline-none focus-visible:ring-2 focus-visible:ring-fd-primary/25"
          >
            {received === 0 && (
              <p className="m-0 text-sm text-fd-muted-foreground">No bytes yet. Press Play or step forward.</p>
            )}
            {CHUNKS.slice(0, received).map((c, i) => {
              const latest = i === received - 1;
              return (
                <div
                  key={i}
                  className={cn("stream-in mb-2 border-l-2 pl-2", latest ? "border-fd-primary" : "border-fd-border")}
                >
                  <p
                    className={cn(
                      "m-0 text-[0.7rem] font-semibold",
                      latest ? "text-fd-primary" : "text-fd-muted-foreground",
                    )}
                  >
                    chunk {i + 1} · {c.t} ms · {c.source}
                  </p>
                  <pre
                    className={cn(
                      "m-0 font-mono text-xs leading-5 break-all whitespace-pre-wrap",
                      latest ? "text-fd-foreground" : "text-fd-muted-foreground",
                    )}
                  >
                    {c.html}
                  </pre>
                </div>
              );
            })}
          </div>
        </div>
        <div className="min-w-0">
          <p className="m-0 mb-1.5 text-[0.7rem] font-semibold tracking-[0.06em] text-fd-muted-foreground uppercase">
            In the browser
          </p>
          <BrowserView received={received} />
        </div>
      </div>

      <p aria-live="polite" className="m-0 mt-4 min-h-12 text-sm leading-6 text-fd-foreground/85">
        {received === 0 ? (
          <span className="text-fd-muted-foreground">The server is running the loader; nothing has been sent.</span>
        ) : (
          <>
            <span className="mr-2 font-mono text-xs text-fd-primary">
              {received}/{total}
            </span>
            {CHUNKS[received - 1].effect}
          </>
        )}
      </p>
    </Playground>
  );
}
