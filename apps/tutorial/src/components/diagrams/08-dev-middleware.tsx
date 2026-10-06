import { Arrow, bottom, Box, Diagram, Label, left, Region, right, top, type Tone } from "./kit";

/* ------------------------------------------------------ middleware stack */

const X = 150;
const W = 300;
const NOTE_X = 506;

const http = { x: X + 50, y: 10, w: 200, h: 40 };
const hmr = { x: 530, y: 10, w: 170, h: 40 };

const stack: Array<{ key: string; label: string; sub?: string; y: number; h: number; tone: Tone; note?: string }> = [
  { key: "pre", label: "pre-middlewares", y: 84, h: 40, tone: "accent", note: "configureServer() body" },
  { key: "cors", label: "CORS, host, proxy", y: 176, h: 40, tone: "muted" },
  { key: "public", label: "public/ files", y: 232, h: 40, tone: "muted" },
  { key: "transform", label: "transform", sub: "/src/*.tsx, /@vite/client", y: 288, h: 56, tone: "default" },
  { key: "static", label: "root static files", y: 360, h: 40, tone: "muted" },
  { key: "fallback", label: "SPA HTML fallback", y: 416, h: 40, tone: "ghost", note: "spa / mpa only" },
  {
    key: "post",
    label: "post-middlewares",
    y: 492,
    h: 40,
    tone: "accent",
    note: "returned function:\nSSR, /api, /_eigen/data",
  },
  { key: "html", label: "index.html + 404", y: 548, h: 40, tone: "ghost", note: "spa / mpa only" },
];

export function ViteMiddlewareStackDiagram() {
  return (
    <Diagram
      width={720}
      height={600}
      caption="A request walks Vite's Connect stack top to bottom; framework post-middleware runs after Vite has served modules and files but before its index.html handling, while HMR bypasses the stack entirely."
    >
      <Region x={X - 20} y={140} w={W + 40} h={332} label="Vite internals" />

      <Box {...http} label="HTTP server" />
      <Box {...hmr} label="HMR WebSocket" tone="muted" />
      <Arrow from={right(http)} to={left(hmr)} label="upgrade" />

      {stack.map((s) => (
        <Box key={s.key} x={X} y={s.y} w={W} h={s.h} label={s.label} sub={s.sub} tone={s.tone} />
      ))}
      {stack.map((s) =>
        s.note ? (
          <Label key={`${s.key}-note`} x={NOTE_X} y={s.y + s.h / 2} anchor="start" size={11} muted>
            {s.note}
          </Label>
        ) : null,
      )}

      <Arrow from={bottom(http)} to={top({ x: X, y: stack[0].y, w: W, h: 0 })} label="request" />
      {stack.slice(0, -1).map((s, i) => (
        <Arrow
          key={`${s.key}-next`}
          from={bottom({ x: X, y: s.y, w: W, h: s.h })}
          to={top({ x: X, y: stack[i + 1].y, w: W, h: 0 })}
        />
      ))}
    </Diagram>
  );
}

/* --------------------------------------------- API routes: dev vs production */

const C1 = { x: 20, w: 130 };
const C2 = { x: 186, w: 170 };
const C3 = { x: 392, w: 160 };
const DEV = 48;
const PROD = 164;
const H = 56;
const handler = { x: 600, y: DEV, w: 112, h: PROD + H - DEV };

export function ApiRouteDevProdDiagram() {
  const d1 = { ...C1, y: DEV, h: H };
  const d2 = { ...C2, y: DEV, h: H };
  const d3 = { ...C3, y: DEV, h: H };
  const p1 = { ...C1, y: PROD, h: H };
  const p2 = { ...C2, y: PROD, h: H };
  return (
    <Diagram
      width={720}
      height={240}
      caption="Dev and production find the API handler differently, but both call the same runtime-agnostic handler(ctx) and serialize its result as JSON."
    >
      <Region x={4} y={8} w={566} h={108} label="Dev: eigen-api plugin" />
      <Region x={4} y={124} w={566} h={108} label="Prod: server.prod.ts" tone="accent" />

      <Box {...d1} label="Connect" sub="vite.middlewares" />
      <Box {...d2} label="eigen-api" sub="file exists?" mono />
      <Box {...d3} label="runner.import()" sub="/src/api/hello.ts" mono />

      <Box {...p1} label="H3 route" sub="/api/**" mono />
      <Box {...p2} label="getApiHandler()" sub="entry-server.js" mono tone="accent" />

      <Box {...handler} label="handler" sub={"(ctx) →\nJSON"} mono tone="accent" />

      <Arrow from={right(d1)} to={left(d2)} />
      <Arrow from={right(d2)} to={left(d3)} />
      <Arrow from={right(d3)} to={[handler.x, DEV + H / 2]} />
      <Arrow from={right(p1)} to={left(p2)} />
      <Arrow from={right(p2)} to={[handler.x, PROD + H / 2]} label="glob map lookup" />
    </Diagram>
  );
}
