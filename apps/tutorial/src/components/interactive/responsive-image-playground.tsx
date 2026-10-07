"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/cn";

import { buttonClass, inputClass, Output, Playground } from "./frame";

/*
 * What the browser does with <img srcset sizes>:
 * 1. Evaluate `sizes`: the first entry whose media condition matches gives the
 *    slot width (no match, or no valid entry: 100vw).
 * 2. Each `Nw` candidate gets a density of N / slot.
 * 3. Pick a candidate for the device pixel ratio. The spec leaves this to the
 *    browser; we show the simple "smallest density >= DPR" rule and Chromium's
 *    SelectionLogic (html_srcset_parser.cc), which can round down on high-DPR screens.
 */

// Part 31's variantWidths(): every breakpoint below the source width, plus the
// source width itself (capped at 2048). The build plugin and the CDN provider
// branch of <Image> share it, so these presets apply to both.
const LARGE_SOURCE_WIDTHS = "640w, 750w, 828w, 1080w, 1200w, 1920w, 2048w";
const MEDIUM_SOURCE_WIDTHS = "640w, 750w, 828w, 1080w, 1200w, 1500w";
const DEFAULT_SIZES = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw";
const DPRS = [1, 1.5, 2, 2.625, 3];
const FONT_PX = 16; // em/rem in media queries and sizes use the initial font size

/* ------------------------------------------------------------- length math */

/** Evaluates a CSS length (px, vw, em, rem, or a simple calc()) in px. Returns null if unsupported. */
function length(src: string, vw: number): number | null {
  const tokens = src.trim().match(/calc\(|\(|\)|[+\-*/]|-?\d*\.?\d+(?:px|vw|em|rem)?/g);
  if (!tokens || tokens.join("").replace(/\s/g, "") !== src.replace(/\s/g, "")) return null;
  let i = 0;
  type V = { n: number; unit: boolean };
  const atom = (): V | null => {
    const t = tokens[i++];
    if (t === "calc(" || t === "(") {
      const v = sum();
      if (tokens[i++] !== ")") return null;
      return v;
    }
    const m = t?.match(/^(-?\d*\.?\d+)(px|vw|em|rem)?$/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    if (!m[2]) return { n, unit: n === 0 };
    const f = m[2] === "px" ? 1 : m[2] === "vw" ? vw / 100 : FONT_PX;
    return { n: n * f, unit: true };
  };
  const product = (): V | null => {
    let v = atom();
    while (v && (tokens[i] === "*" || tokens[i] === "/")) {
      const op = tokens[i++];
      const r = atom();
      if (!r) return null;
      v = op === "*" ? { n: v.n * r.n, unit: v.unit || r.unit } : { n: v.n / r.n, unit: v.unit };
    }
    return v;
  };
  const sum = (): V | null => {
    let v = product();
    while (v && (tokens[i] === "+" || tokens[i] === "-")) {
      const op = tokens[i++];
      const r = product();
      if (!r) return null;
      v = { n: op === "+" ? v.n + r.n : v.n - r.n, unit: v.unit || r.unit };
    }
    return v;
  };
  const v = sum();
  if (!v || i !== tokens.length || !v.unit || v.n < 0) return null;
  return v.n;
}

/** Evaluates a media condition made of (min-width|max-width: L) features joined by "and". */
function media(cond: string, vw: number): boolean | null {
  const parts = cond.split(/\s+and\s+/i);
  for (const p of parts) {
    const m = p.trim().match(/^\(\s*(min|max)-width\s*:\s*([^)]+)\)$/i);
    if (!m) return null;
    const px = length(m[2], vw);
    if (px === null) return null;
    if (m[1].toLowerCase() === "min" ? vw < px : vw > px) return false;
  }
  return true;
}

interface SizesResult {
  slot: number;
  matched: string | null; // the entry used, or null for the 100vw default
  skipped: string[]; // invalid entries
}

function evaluateSizes(sizes: string, vw: number): SizesResult {
  // Split on top-level commas only (calc() can't contain commas, but be safe)
  const entries: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of sizes) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      entries.push(cur);
      cur = "";
    } else cur += ch;
  }
  entries.push(cur);

  const skipped: string[] = [];
  for (const raw of entries) {
    const entry = raw.trim();
    if (!entry) continue;
    const m = entry.match(/^(.*?)\s*((?:calc)?\([^()]*(?:\([^()]*\)[^()]*)*\)|[-\d.]+[a-z]*)$/i);
    if (!m) {
      skipped.push(entry);
      continue;
    }
    const [, cond, size] = m;
    const px = /^\(/.test(size) ? null : length(size, vw);
    if (px === null) {
      skipped.push(entry);
      continue;
    }
    if (cond) {
      const ok = media(cond, vw);
      if (ok === null) {
        skipped.push(entry);
        continue;
      }
      if (!ok) continue;
    }
    return { slot: px, matched: entry, skipped };
  }
  return { slot: vw, matched: null, skipped };
}

/* -------------------------------------------------------------- selection */

interface Candidate {
  w: number;
  density: number;
}

function parseCandidates(srcset: string): number[] {
  const ws = srcset
    .split(",")
    .map((c) => c.trim().split(/\s+/).pop() ?? "")
    .map((d) => d.match(/^(\d+)w$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => Number(m[1]))
    .filter((w) => w > 0);
  return [...new Set(ws)].sort((a, b) => a - b);
}

function simplePick(c: Candidate[], dpr: number) {
  const i = c.findIndex((x) => x.density >= dpr);
  return i === -1 ? c.length - 1 : i;
}

/** Chromium's SelectionLogic: geometric mean between the candidates around the DPR. */
function chromiumPick(c: Candidate[], dpr: number) {
  let i = 0;
  for (; i < c.length - 1; i++) {
    const next = c[i + 1].density;
    if (next < dpr) continue;
    const cur = c[i].density;
    const mean = Math.sqrt(cur * next);
    if ((dpr <= 1 && dpr > cur) || dpr >= mean) return i + 1;
    break;
  }
  return i;
}

const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });

export function ResponsiveImagePlayground() {
  const id = useId();
  const [srcset, setSrcset] = useState(LARGE_SOURCE_WIDTHS);
  const [sizes, setSizes] = useState(DEFAULT_SIZES);
  const [vw, setVw] = useState(390);
  const [dpr, setDpr] = useState(3);

  const widths = parseCandidates(srcset);
  const sz = evaluateSizes(sizes, vw);
  const slot = sz.slot;
  const needed = slot * dpr;
  const cands: Candidate[] = widths.map((w) => ({
    w,
    density: slot > 0 ? w / slot : Infinity,
  }));
  const simple = cands.length ? simplePick(cands, dpr) : -1;
  const chromium = cands.length ? chromiumPick(cands, dpr) : -1;
  const max = Math.max(needed, ...widths, 1);

  return (
    <Playground
      title="Which srcset candidate does the browser pick?"
      prompt="Drag the viewport, change the pixel ratio or the sizes attribute, and watch the slot width and the chosen file change."
      caption="sizes tells the browser how wide the image will be before layout; slot width × device pixel ratio is the width it needs, and srcset offers the files to choose from."
    >
      <div className="space-y-3">
        <div>
          <label htmlFor={`${id}-srcset`} className="mb-1 block text-xs font-semibold text-fd-muted-foreground">
            srcset widths
          </label>
          <input
            id={`${id}-srcset`}
            className={inputClass}
            value={srcset}
            onChange={(e) => setSrcset(e.target.value)}
            spellCheck={false}
          />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              className={cn(buttonClass, "py-1 text-xs")}
              onClick={() => setSrcset(LARGE_SOURCE_WIDTHS)}
            >
              2048px+ source
            </button>
            <button
              type="button"
              className={cn(buttonClass, "py-1 text-xs")}
              onClick={() => setSrcset(MEDIUM_SOURCE_WIDTHS)}
            >
              1500px source
            </button>
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-sizes`} className="mb-1 block text-xs font-semibold text-fd-muted-foreground">
            sizes
          </label>
          <input
            id={`${id}-sizes`}
            className={inputClass}
            value={sizes}
            onChange={(e) => setSizes(e.target.value)}
            spellCheck={false}
          />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button type="button" className={cn(buttonClass, "py-1 text-xs")} onClick={() => setSizes(DEFAULT_SIZES)}>
              &lt;Image&gt; default
            </button>
            <button type="button" className={cn(buttonClass, "py-1 text-xs")} onClick={() => setSizes("100vw")}>
              100vw (hero)
            </button>
            <button
              type="button"
              className={cn(buttonClass, "py-1 text-xs")}
              onClick={() => setSizes("(min-width: 1024px) 720px, calc(100vw - 32px)")}
            >
              Fixed column
            </button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor={`${id}-vw`} className="mb-1 block text-xs font-semibold text-fd-muted-foreground">
              Viewport width: <span className="font-mono text-fd-foreground">{vw}px</span>
            </label>
            <input
              id={`${id}-vw`}
              type="range"
              min={320}
              max={2560}
              step={10}
              value={vw}
              onChange={(e) => setVw(Number(e.target.value))}
              className="w-full accent-[var(--color-fd-primary)]"
            />
          </div>
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="mb-1 text-xs font-semibold text-fd-muted-foreground">Device pixel ratio</legend>
            <div className="flex flex-wrap gap-1">
              {DPRS.map((d) => (
                <label
                  key={d}
                  className={cn(
                    "cursor-pointer rounded-md border px-2 py-1 font-mono text-xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-fd-primary/40",
                    dpr === d
                      ? "border-fd-primary bg-fd-primary/12 text-fd-foreground"
                      : "border-fd-border bg-fd-background text-fd-muted-foreground",
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-dpr`}
                    className="sr-only"
                    checked={dpr === d}
                    onChange={() => setDpr(d)}
                  />
                  {d}x
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3" aria-live="polite">
        <Output label="Slot width (from sizes)">
          {fmt(slot)}px
          <span className="block font-sans text-xs leading-5 text-fd-muted-foreground">
            {sz.matched ? `matched “${sz.matched}”` : "no entry matched: 100vw"}
          </span>
        </Output>
        <Output label="Needed width">
          {fmt(slot)} × {dpr} = {fmt(needed)}px
        </Output>
        <Output label="Chosen candidate" tone="accent">
          {simple >= 0 ? `${cands[simple].w}w` : "—"}
          {simple >= 0 && (
            <span className="block font-sans text-xs leading-5 text-fd-muted-foreground">
              {cands[simple].w >= needed ? `smallest ≥ ${fmt(needed)}px` : "none is wide enough, so the largest"}
            </span>
          )}
        </Output>
      </div>

      {sz.skipped.length > 0 && (
        <p className="m-0 mt-2 text-xs leading-5 text-fd-warning">
          Ignored (invalid or unsupported here): {sz.skipped.map((s) => `“${s}”`).join(", ")}
        </p>
      )}

      {cands.length > 0 ? (
        <div className="mt-4 rounded-lg border border-fd-border bg-fd-background p-3">
          <p className="m-0 mb-2 text-[0.7rem] font-semibold tracking-[0.06em] text-fd-muted-foreground uppercase">
            Candidates vs. needed width
          </p>
          <ul className="m-0 list-none space-y-1.5 p-0" aria-label="Candidates">
            {cands.map((c, i) => (
              <li key={c.w} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-right font-mono text-xs text-fd-foreground">{c.w}w</span>
                <div className="relative h-5 min-w-0 flex-1">
                  <div
                    className={cn(
                      "h-full rounded-sm motion-safe:transition-[width] motion-safe:duration-200",
                      i === simple ? "bg-fd-primary" : c.w >= needed ? "bg-fd-primary/25" : "bg-fd-muted-foreground/25",
                    )}
                    style={{ width: `${(c.w / max) * 100}%` }}
                  />
                  <div
                    className="absolute inset-y-[-3px] w-0.5 bg-fd-warning"
                    style={{ left: `calc(${(needed / max) * 100}% - 1px)` }}
                    aria-hidden
                  />
                </div>
                <span className="w-16 shrink-0 font-mono text-[0.7rem] text-fd-muted-foreground">
                  {c.density.toFixed(2)}x{i === simple && <span className="sr-only"> (chosen)</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="m-0 mt-2 flex items-center gap-1.5 text-xs text-fd-muted-foreground">
            <span className="inline-block h-3 w-0.5 bg-fd-warning" aria-hidden /> needed width ({fmt(needed)}px) · right
            column: candidate width ÷ slot
          </p>
        </div>
      ) : (
        <p className="m-0 mt-4 text-sm text-fd-warning">No valid “Nw” descriptors in srcset.</p>
      )}

      <p className="m-0 mt-3 text-sm leading-6 text-fd-muted-foreground" aria-live="polite">
        The spec leaves the final choice to the browser. This shows the common rule: the smallest candidate whose
        density reaches the pixel ratio.{" "}
        {chromium >= 0 && chromium !== simple ? (
          <span className="text-fd-foreground">
            Chromium would pick {cands[chromium].w}w here: when the needed density falls between two candidates, it
            rounds down if the ratio is below their geometric mean.
          </span>
        ) : (
          "Chromium's heuristic agrees here."
        )}{" "}
        Browsers also reuse a larger candidate already in the cache, so widening and then narrowing the window
        won&rsquo;t download the smaller file.
      </p>
    </Playground>
  );
}
