/**
 * Diagram kit — hand-drawn, theme-aware SVG primitives for the tutorial.
 *
 * Every colour comes from the fumadocs theme tokens (via Tailwind `fd-*`
 * utilities), so diagrams follow light/dark mode and the brand palette.
 * Coordinates are in viewBox units; diagrams are drawn at ~1 unit = 1px for a
 * 720-wide prose column and scale down from there.
 *
 * Conventions:
 * - `tone="accent"` marks the one thing the figure is about (brand primary).
 * - `tone="muted"` de-emphasises context; `tone="ghost"` is a dashed outline
 *   for things that are absent, virtual or optional.
 * - Labels are short; the sentence-length explanation goes in `caption`.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { StepperFrame } from "./stepper";

export type Tone = "default" | "accent" | "muted" | "ghost";
export type Point = readonly [number, number];
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/* ------------------------------------------------------------------ geometry */

export const top = (r: Rect, dx = 0): Point => [r.x + r.w / 2 + dx, r.y];
export const bottom = (r: Rect, dx = 0): Point => [r.x + r.w / 2 + dx, r.y + r.h];
export const left = (r: Rect, dy = 0): Point => [r.x, r.y + r.h / 2 + dy];
export const right = (r: Rect, dy = 0): Point => [r.x + r.w, r.y + r.h / 2 + dy];
export const center = (r: Rect): Point => [r.x + r.w / 2, r.y + r.h / 2];

/* --------------------------------------------------------------------- frame */

const FONT = 13;
const SMALL = 11;
// Average glyph advance in em: Lilex is monospaced at 0.6; Nebula Sans averages
// about 0.55 (generous, so label backgrounds never clip).
const MONO_EM = 0.6;
const SANS_EM = 0.55;

export function Diagram({
  width,
  height,
  caption,
  minWidth = 560,
  steps,
  children,
}: {
  width: number;
  height: number;
  /** One sentence stating what the figure shows. Also used as the aria-label. */
  caption: string;
  /** Below this rendered width the figure scrolls horizontally instead of shrinking. */
  minWidth?: number;
  /**
   * Narration for a stepped diagram, one sentence per step. Wrap the parts of
   * the figure that belong to step n in `<At step={n}>`.
   */
  steps?: string[];
  children: ReactNode;
}) {
  const svg = (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={caption}
        className="mx-auto block h-auto w-full text-fd-foreground"
        style={{ minWidth: Math.min(minWidth, width), maxWidth: width * 1.15 }}
        fontFamily="inherit"
        fontSize={FONT}
      >
        {children}
      </svg>
    </div>
  );
  return (
    <figure className="not-prose my-8">
      <div className="rounded-xl border border-fd-border bg-fd-card/60 p-4 sm:p-6">
        {steps ? <StepperFrame steps={steps}>{svg}</StepperFrame> : svg}
      </div>
      <figcaption className="mt-3 text-center text-sm text-fd-muted-foreground">{caption}</figcaption>
    </figure>
  );
}

/**
 * Marks part of a stepped diagram: hidden before `step`, highlighted at it,
 * dimmed after it. With `until`, it disappears once that step has passed
 * (for transient states such as a fallback that gets replaced).
 */
export function At({ step, until, children }: { step: number; until?: number; children: ReactNode }) {
  return (
    <g data-from={step} data-until={until}>
      {children}
    </g>
  );
}

/** A filled arrowhead whose tip sits at `tip`, pointing away from `prev`. */
function Head({ tip, prev, className }: { tip: Point; prev: Point; className: string }) {
  const a = Math.atan2(tip[1] - prev[1], tip[0] - prev[0]);
  const len = 9;
  const half = 4.5;
  const bx = tip[0] - Math.cos(a) * len;
  const by = tip[1] - Math.sin(a) * len;
  const px = -Math.sin(a) * half;
  const py = Math.cos(a) * half;
  return <polygon points={`${tip[0]},${tip[1]} ${bx + px},${by + py} ${bx - px},${by - py}`} className={className} />;
}

/* --------------------------------------------------------------------- text */

function lines(text: string) {
  return text.split("\n");
}

export function Label({
  x,
  y,
  children,
  anchor = "middle",
  size = FONT,
  mono = false,
  muted = false,
  accent = false,
  weight,
}: {
  x: number;
  y: number;
  children: string;
  anchor?: "start" | "middle" | "end";
  size?: number;
  mono?: boolean;
  muted?: boolean;
  accent?: boolean;
  weight?: number;
}) {
  const ls = lines(children);
  const lh = size * 1.3;
  const y0 = y - ((ls.length - 1) * lh) / 2;
  return (
    <text
      x={x}
      y={y0}
      textAnchor={anchor}
      dominantBaseline="central"
      fontSize={size}
      fontWeight={weight}
      className={cn(
        mono && "font-mono",
        accent ? "fill-fd-primary" : muted ? "fill-fd-muted-foreground" : "fill-fd-foreground",
      )}
    >
      {ls.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : lh}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

/* --------------------------------------------------------------------- nodes */

const boxTone: Record<Tone, string> = {
  default: "fill-fd-background stroke-fd-muted-foreground/45",
  accent: "fill-fd-primary/12 stroke-fd-primary",
  muted: "fill-fd-muted stroke-fd-muted-foreground/25",
  ghost: "fill-transparent stroke-fd-muted-foreground/60",
};

/**
 * A component, step or file. `label` is the name (use `mono` for code
 * identifiers); `sub` is an optional one-line detail under it.
 */
export function Box({
  x,
  y,
  w,
  h,
  label,
  sub,
  tone = "default",
  mono = false,
  radius = 8,
}: Rect & {
  label?: string;
  sub?: string;
  tone?: Tone;
  mono?: boolean;
  radius?: number;
}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const subLines = sub ? lines(sub).length : 0;
  const shift = sub ? (subLines * SMALL * 1.3) / 2 : 0;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={radius}
        strokeWidth={tone === "accent" ? 1.5 : 1}
        strokeDasharray={tone === "ghost" ? "5 4" : undefined}
        className={boxTone[tone]}
      />
      {label && (
        <Label x={cx} y={cy - shift} mono={mono} weight={600} accent={false}>
          {label}
        </Label>
      )}
      {sub && (
        <Label x={cx} y={cy + (label ? (lines(label).length * FONT * 1.3) / 2 : 0) + 1} size={SMALL} muted>
          {sub}
        </Label>
      )}
    </g>
  );
}

/** A labelled container for related boxes (a subgraph, an environment, a process). */
export function Region({
  x,
  y,
  w,
  h,
  label,
  tone = "default",
}: Rect & { label: string; tone?: Exclude<Tone, "ghost"> | "ghost" }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={12}
        strokeDasharray={tone === "ghost" ? "6 5" : undefined}
        className={cn(
          tone === "accent"
            ? "fill-fd-primary/6 stroke-fd-primary/60"
            : tone === "ghost"
              ? "fill-transparent stroke-fd-muted-foreground/40"
              : "fill-fd-muted/50 stroke-fd-muted-foreground/20",
        )}
      />
      <text
        x={x + 14}
        y={y + 20}
        fontSize={SMALL}
        fontWeight={600}
        letterSpacing="0.06em"
        className={tone === "accent" ? "fill-fd-primary" : "fill-fd-muted-foreground"}
      >
        {label.toUpperCase()}
      </text>
    </g>
  );
}

/** A small rounded tag, e.g. a step number or a status. */
export function Pill({ x, y, label, tone = "default" }: { x: number; y: number; label: string; tone?: Tone }) {
  const w = label.length * SMALL * SANS_EM + 16;
  return (
    <g>
      <rect
        x={x - w / 2}
        y={y - 10}
        width={w}
        height={20}
        rx={10}
        className={tone === "accent" ? "fill-fd-primary" : "fill-fd-muted stroke-fd-muted-foreground/30"}
        strokeWidth={1}
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={SMALL}
        fontWeight={600}
        className={tone === "accent" ? "fill-fd-primary-foreground" : "fill-fd-foreground"}
      >
        {label}
      </text>
    </g>
  );
}

/* -------------------------------------------------------------------- edges */

function pathFor(points: Point[], corner = 8) {
  if (points.length === 2) return `M${points[0][0]} ${points[0][1]} L${points[1][0]} ${points[1][1]}`;
  // Orthogonal-ish polyline with rounded corners.
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    const d1 = Math.hypot(x - px, y - py);
    const d2 = Math.hypot(nx - x, ny - y);
    const r = Math.min(corner, d1 / 2, d2 / 2);
    const ax = x - ((x - px) / d1) * r;
    const ay = y - ((y - py) / d1) * r;
    const bx = x + ((nx - x) / d2) * r;
    const by = y + ((ny - y) / d2) * r;
    d += ` L${ax} ${ay} Q${x} ${y} ${bx} ${by}`;
  }
  const last = points[points.length - 1];
  return `${d} L${last[0]} ${last[1]}`;
}

function labelSegment(points: Point[], at?: number): [Point, Point] {
  let best = at ?? 0;
  if (at === undefined) {
    let len = -1;
    for (let i = 0; i < points.length - 1; i++) {
      const l = Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
      if (l > len) {
        len = l;
        best = i;
      }
    }
  }
  return [points[best], points[best + 1]];
}

function labelAnchor(points: Point[], at?: number): Point {
  // Midpoint of the longest segment unless an explicit segment index is given.
  let best = at ?? 0;
  if (at === undefined) {
    let len = -1;
    for (let i = 0; i < points.length - 1; i++) {
      const l = Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
      if (l > len) {
        len = l;
        best = i;
      }
    }
  }
  const [a, b] = [points[best], points[best + 1]];
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/**
 * A directed connection. Pass `via` points for an elbowed route. `label`
 * says what moves along the edge (`writes`, `HTML shell`, `import()`).
 */
export function Arrow({
  from,
  to,
  via = [],
  label,
  labelAt,
  labelOffset = [0, 0],
  tone = "default",
  dashed = false,
  both = false,
  mono = false,
}: {
  from: Point;
  to: Point;
  via?: Point[];
  label?: string;
  /** Segment index to place the label on (defaults to the longest). */
  labelAt?: number;
  labelOffset?: Point;
  tone?: "default" | "accent";
  dashed?: boolean;
  both?: boolean;
  mono?: boolean;
}) {
  const pts = [from, ...via, to];
  // Stop the line short of the tip so the stroke doesn't poke through the head.
  const trim = (tip: Point, prev: Point): Point => {
    const d = Math.hypot(tip[0] - prev[0], tip[1] - prev[1]) || 1;
    return [tip[0] - ((tip[0] - prev[0]) / d) * 6, tip[1] - ((tip[1] - prev[1]) / d) * 6];
  };
  const linePts = [...pts];
  linePts[linePts.length - 1] = trim(pts[pts.length - 1], pts[pts.length - 2]);
  if (both) linePts[0] = trim(pts[0], pts[1]);
  const headClass = tone === "accent" ? "fill-fd-primary" : "fill-fd-muted-foreground";
  const [lx, ly] = labelAnchor(pts, labelAt);
  const ls = label ? lines(label) : [];
  const bw = Math.max(0, ...ls.map((l) => l.length)) * SMALL * (mono ? MONO_EM : SANS_EM) + 12;
  const bh = ls.length * SMALL * 1.3 + 6;
  // A label wider than its segment would hide the arrowhead: lift it above
  // (horizontal segments) or beside (vertical ones) the line instead.
  const seg = labelSegment(pts, labelAt);
  const segLen = Math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]);
  const horizontal = Math.abs(seg[1][0] - seg[0][0]) >= Math.abs(seg[1][1] - seg[0][1]);
  const crowded = segLen < (horizontal ? bw : bh) + 28;
  const auto: Point = crowded ? (horizontal ? [0, -(bh / 2 + 4)] : [bw / 2 + 6, 0]) : [0, 0];
  const tx = lx + labelOffset[0] + auto[0];
  const ty = ly + labelOffset[1] + auto[1];
  return (
    <g>
      <path
        d={pathFor(linePts)}
        fill="none"
        strokeWidth={tone === "accent" ? 1.75 : 1.25}
        strokeDasharray={dashed ? "5 4" : undefined}
        className={tone === "accent" ? "stroke-fd-primary" : "stroke-fd-muted-foreground"}
      />
      <Head tip={pts[pts.length - 1]} prev={pts[pts.length - 2]} className={headClass} />
      {both && <Head tip={pts[0]} prev={pts[1]} className={headClass} />}
      {label && (
        <g>
          <rect x={tx - bw / 2} y={ty - bh / 2} width={bw} height={bh} rx={4} className="fill-fd-card" />
          <Label x={tx} y={ty} size={SMALL} mono={mono} muted={tone !== "accent"} accent={tone === "accent"}>
            {label}
          </Label>
        </g>
      )}
    </g>
  );
}

/* ---------------------------------------------------------------- sequences */

/** A participant column for sequence diagrams: header box plus a dashed lifeline. */
export function Lifeline({
  x,
  y = 0,
  bottom: y2,
  label,
  w = 132,
  tone = "default",
  mono = false,
}: {
  x: number;
  y?: number;
  bottom: number;
  label: string;
  w?: number;
  tone?: Tone;
  mono?: boolean;
}) {
  return (
    <g>
      <line x1={x} x2={x} y1={y + 36} y2={y2} strokeDasharray="3 5" className="stroke-fd-muted-foreground/50" />
      <Box x={x - w / 2} y={y} w={w} h={36} label={label} tone={tone} mono={mono} />
    </g>
  );
}

/** A horizontal message between two lifelines at height `y`. */
export function Message({
  from,
  to,
  y,
  label,
  tone = "default",
  dashed = false,
  mono = false,
}: {
  from: number;
  to: number;
  y: number;
  label: string;
  tone?: "default" | "accent";
  dashed?: boolean;
  mono?: boolean;
}) {
  const dir = to > from ? 1 : -1;
  return (
    <Arrow
      from={[from + dir * 2, y]}
      to={[to - dir * 2, y]}
      label={label}
      labelOffset={[0, -11]}
      tone={tone}
      dashed={dashed}
      mono={mono}
    />
  );
}

/** A side note, e.g. what the browser shows at this moment. */
export function Note({
  x,
  y,
  w,
  h,
  text,
  tone = "muted",
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  text: string;
  tone?: Tone;
}) {
  const height = h ?? lines(text).length * SMALL * 1.3 + 16;
  return <Box x={x} y={y} w={w} h={height} label={undefined} sub={text} tone={tone} radius={6} />;
}
