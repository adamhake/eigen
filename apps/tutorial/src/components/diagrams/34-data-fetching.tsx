import { Arrow, bottom, Box, Diagram, Label, left, Pill, Region, right, top } from "./kit";

/* --------------------------------------------------- waterfall vs parallel */

const T0 = 190; // x of t = 0
const PX_PER_MS = 0.66;
const BAR_H = 30;
const ROW_GAP = 38;
const rows = ["root layout", "dashboard layout", "page"];

function Bars({ y0, parallel }: { y0: number; parallel: boolean }) {
  return (
    <>
      {rows.map((name, i) => {
        const cy = y0 + i * ROW_GAP;
        const start = parallel ? 0 : i * 200;
        return (
          <g key={name}>
            <Label x={24} y={cy} anchor="start" muted>
              {name}
            </Label>
            <Box
              x={T0 + start * PX_PER_MS}
              y={cy - BAR_H / 2}
              w={200 * PX_PER_MS}
              h={BAR_H}
              label="200 ms"
              tone={parallel ? "accent" : "default"}
              radius={6}
            />
          </g>
        );
      })}
    </>
  );
}

export function LoaderWaterfallDiagram() {
  return (
    <Diagram
      width={720}
      height={352}
      caption="Run one after another, three 200 ms loaders take 600 ms; started together, the whole stack is ready in about 200 ms."
    >
      <Region x={4} y={8} w={712} h={160} label="Sequential (await each)" />
      <Bars y0={56} parallel={false} />
      <Pill x={T0 + 600 * PX_PER_MS + 56} y={132} label="total 600 ms" />

      <Region x={4} y={184} w={712} h={160} label="Parallel (Promise.all)" tone="accent" />
      <Bars y0={232} parallel />
      <Pill x={T0 + 200 * PX_PER_MS + 56} y={308} label="total 200 ms" />
    </Diagram>
  );
}

/* ---------------------------------------------------------- fetch dedupe */

const layoutLoader = { x: 4, y: 24, w: 180, h: 64 };
const pageLoader = { x: 4, y: 136, w: 180, h: 64 };
const ctxFetch = { x: 252, y: 72, w: 200, h: 80 };
const api = { x: 520, y: 24, w: 196, h: 64 };
const thirdParty = { x: 520, y: 136, w: 196, h: 64 };
const MID_L = 218;
const MID_R = 486;

export function FetchDedupeDiagram() {
  return (
    <Diagram
      width={720}
      height={216}
      caption="Within one incoming request, loaders share ctx.fetch: identical GETs collapse into one network call, and credentials are forwarded only to trusted origins."
    >
      <Box {...layoutLoader} label="layout loader" sub="fetch('/user')" />
      <Box {...pageLoader} label="page loader" sub="fetch('/user')" />
      <Box {...ctxFetch} label="ctx.fetch" sub={"per-request Map\none GET per URL"} mono tone="accent" />
      <Box {...api} label="api.example.com" sub="1 request + cookie" />
      <Box {...thirdParty} label="third-party API" sub="sent without cookie" tone="muted" />

      <Arrow
        from={right(layoutLoader)}
        via={[
          [MID_L, 56],
          [MID_L, 102],
        ]}
        to={left(ctxFetch, -10)}
      />
      <Arrow
        from={right(pageLoader)}
        via={[
          [MID_L, 168],
          [MID_L, 122],
        ]}
        to={left(ctxFetch, 10)}
      />
      <Arrow
        from={right(ctxFetch, -10)}
        via={[
          [MID_R, 102],
          [MID_R, 56],
        ]}
        to={left(api)}
      />
      <Arrow
        from={right(ctxFetch, 10)}
        via={[
          [MID_R, 122],
          [MID_R, 168],
        ]}
        to={left(thirdParty)}
        dashed
      />
    </Diagram>
  );
}

/* ------------------------------------------------------- query handoff */

const BW = 190;
const BH = 56;
const X = [24, 265, 506];
const loaderBox = { x: X[0], y: 44, w: BW, h: BH };
const qc = { x: X[1], y: 44, w: BW, h: BH };
const dehydrate = { x: X[2], y: 44, w: BW, h: BH };
const state = { x: X[2], y: 208, w: BW, h: BH };
const boundary = { x: X[1], y: 208, w: BW, h: BH };
const useQ = { x: X[0], y: 208, w: BW, h: BH };

export function QueryHandoffDiagram() {
  return (
    <Diagram
      width={720}
      height={300}
      caption="The loader fills a per-request QueryClient on the server; its dehydrated state rides along in the HTML and HydrationBoundary restores it, so the first useQuery on the client is a cache hit."
    >
      <Region x={4} y={8} w={712} h={112} label="Server · one request" />
      <Region x={4} y={172} w={712} h={112} label="Browser" tone="accent" />

      <Box {...loaderBox} label="loader" sub="queryClient.query()" />
      <Box {...qc} label="QueryClient" sub="one per request" />
      <Box {...dehydrate} label="dehydrate()" sub="serializeForScript" mono />
      <Box {...state} label="__EIGEN_QUERY_STATE__" sub="inline <script>" mono />
      <Box {...boundary} label="HydrationBoundary" sub="fills client cache" />
      <Box {...useQ} label="useQuery()" sub="cache hit, no fetch" mono tone="accent" />

      <Arrow from={right(loaderBox)} to={left(qc)} label="fills" />
      <Arrow from={right(qc)} to={left(dehydrate)} label="state" />
      <Arrow from={bottom(dehydrate)} to={top(state)} label="HTML" />
      <Arrow from={left(state)} to={right(boundary)} />
      <Arrow from={left(boundary)} to={right(useQ)} />
    </Diagram>
  );
}
