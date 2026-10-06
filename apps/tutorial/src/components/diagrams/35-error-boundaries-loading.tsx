import { Arrow, bottom, Box, Diagram, left, Region, right, type Tone, top } from "./kit";

/* ------------------------------------------------------ boundary nesting */

const levels: Array<{ label: string; tone: Tone }> = [
  { label: "framework global error boundary", tone: "accent" },
  { label: "layout.tsx (root)", tone: "default" },
  { label: "error.tsx (root)", tone: "accent" },
  { label: "dashboard/layout.tsx", tone: "default" },
  { label: "dashboard/error.tsx", tone: "accent" },
  { label: "Suspense · dashboard/loading.tsx", tone: "ghost" },
  { label: "analytics/error.tsx", tone: "accent" },
  { label: "Suspense · analytics/loading.tsx", tone: "ghost" },
];
const INSET_X = 18;
const INSET_TOP = 30;
const INSET_BOTTOM = 10;
const OUTER = { x: 4, y: 8, w: 712, h: 380 };

export function BoundaryNestingDiagram() {
  const n = levels.length;
  const page = {
    x: OUTER.x + n * INSET_X,
    y: OUTER.y + n * INSET_TOP + 6,
    w: OUTER.w - 2 * n * INSET_X,
    h: 48,
  };
  return (
    <Diagram
      width={720}
      height={396}
      caption="Each segment nests as layout › error boundary › loading boundary › children, so a segment's error.tsx catches errors below its layout but never in it, and only the framework's outermost boundary can catch the root layout."
    >
      {levels.map((level, i) => (
        <Region
          key={level.label}
          x={OUTER.x + i * INSET_X}
          y={OUTER.y + i * INSET_TOP}
          w={OUTER.w - 2 * i * INSET_X}
          h={OUTER.h - i * (INSET_TOP + INSET_BOTTOM)}
          label={level.label}
          tone={level.tone === "muted" ? "default" : level.tone}
        />
      ))}
      <Box {...page} label="analytics/index.tsx" sub="the page" mono />
    </Diagram>
  );
}

/* ---------------------------------------------------- SSR error paths */

const W = 150;
const H = 64;
const ROW1 = 24;
const request = { x: 4, y: ROW1, w: W, h: H };
const runRoute = { x: 190, y: ROW1, w: W, h: H };
const render = { x: 378, y: ROW1, w: W, h: H };
const ok = { x: 566, y: ROW1, w: W, h: H };
const serialize = { x: 193, y: 164, w: 332, h: H };
const rerender = { x: 193, y: 284, w: 332, h: H };
const failed = { x: 566, y: 276, w: W, h: 80 };

export function SsrErrorPathsDiagram() {
  return (
    <Diagram
      width={720}
      height={372}
      caption="On the server a loader error and a render error both become a sanitized error object, and the page is rendered again with that error handed to the nearest boundary as initialError."
    >
      <Box {...request} label="Request" />
      <Box {...runRoute} label="runRoute()" sub="middleware, loaders" mono />
      <Box {...render} label="renderToString" sub="the route tree" mono />
      <Box {...ok} label="200 HTML" tone="muted" />

      <Box
        {...serialize}
        label="toSerializedError()"
        sub="digest + safe message; full error logged"
        mono
        tone="accent"
      />
      <Box {...rerender} label="renderToString(App)" sub="initialError → boundary fallback" mono />
      <Box {...failed} label="500 HTML" sub={"error UI +\n__EIGEN_ERROR__"} />

      <Arrow from={right(request)} to={left(runRoute)} />
      <Arrow from={right(runRoute)} to={left(render)} label="data" />
      <Arrow from={right(render)} to={left(ok)} />

      <Arrow from={bottom(runRoute)} to={top(serialize, -94)} label="throws (loader)" />
      <Arrow from={bottom(render)} to={top(serialize, 94)} label="throws (render)" />
      <Arrow from={bottom(serialize)} to={top(rerender)} label="initialError" mono />
      <Arrow from={right(rerender)} to={left(failed)} />
    </Diagram>
  );
}
