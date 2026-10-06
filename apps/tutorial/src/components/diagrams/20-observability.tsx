import { Box, Diagram, Label, type Tone } from "./kit";

// A trace waterfall for one request: name column on the left, bars on a time axis.
const X0 = 222; // x of t = 0ms
const SCALE = 1.34; // px per ms → 350ms ends at ~691
const ROW0 = 52;
const STEP = 34;
const BAR_H = 22;
const INDENT = 14;

interface SpanRow {
  name: string;
  depth: number;
  start: number;
  end: number;
  tone: Tone;
}

const spans: SpanRow[] = [
  { name: "GET /posts/:id", depth: 0, start: 0, end: 350, tone: "muted" },
  { name: "eigen.route.match", depth: 1, start: 0, end: 0.2, tone: "default" },
  { name: "eigen.middleware", depth: 1, start: 1, end: 16, tone: "default" },
  { name: "pg.query", depth: 2, start: 3, end: 15, tone: "default" },
  { name: "eigen.loader", depth: 1, start: 16, end: 296, tone: "accent" },
  { name: "pg.query", depth: 2, start: 19, end: 294, tone: "accent" },
  { name: "eigen.render.ssr", depth: 1, start: 296, end: 341, tone: "default" },
];

const fmt = (ms: number) => (ms < 1 ? `${ms}ms` : `${Math.round(ms)}ms`);

export function RequestSpanTreeDiagram() {
  const ticks = [0, 100, 200, 300];
  const lastRow = ROW0 + (spans.length - 1) * STEP + BAR_H;
  return (
    <Diagram
      width={720}
      height={lastRow + 20}
      caption="One request's trace: because each phase span is active, the database spans nest under the middleware and loader that issued them, so the 275ms query is attributed to the loader."
    >
      {ticks.map((t) => {
        const x = X0 + t * SCALE;
        return (
          <g key={t}>
            <line
              x1={x}
              x2={x}
              y1={34}
              y2={lastRow + 6}
              strokeDasharray="2 4"
              className="stroke-fd-muted-foreground/30"
            />
            <Label x={x} y={22} size={11} muted>
              {`${t}ms`}
            </Label>
          </g>
        );
      })}

      {spans.map((s, i) => {
        const y = ROW0 + i * STEP;
        const w = Math.max(4, (s.end - s.start) * SCALE);
        return (
          <g key={i}>
            <Label x={16 + s.depth * INDENT} y={y + BAR_H / 2} anchor="start" size={11} accent={s.tone === "accent"}>
              {s.name}
            </Label>
            <Label x={X0 - 14} y={y + BAR_H / 2} anchor="end" size={11} muted>
              {fmt(s.end - s.start)}
            </Label>
            <Box x={X0 + s.start * SCALE} y={y} w={w} h={BAR_H} tone={s.tone} radius={4} />
          </g>
        );
      })}
    </Diagram>
  );
}
