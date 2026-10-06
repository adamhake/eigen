import { Arrow, bottom, Box, Diagram, left, right, top } from "./kit";

/* ------------------------------------------- one scan, three generated outputs */

const pages = { x: 8, y: 88, w: 130, h: 72 };
const discover = { x: 200, y: 96, w: 170, h: 56 };
const clientMod = { x: 470, y: 16, w: 242, h: 56 };
const ssrMod = { x: 470, y: 96, w: 242, h: 56 };
const dts = { x: 470, y: 176, w: 242, h: 56 };

export function RouteCodegenDiagram() {
  return (
    <Diagram
      width={720}
      height={248}
      caption="One filesystem scan feeds three outputs: a client and a server version of the eigen/routes virtual module, and a .d.ts file for the type checker."
    >
      <Box {...pages} label="src/pages/" sub={"About.tsx\nposts/[id].tsx"} mono />
      <Box {...discover} label="discoverRoutes()" sub="fileToRoute() each" mono tone="accent" />
      <Box {...clientMod} label="eigen/routes · client" sub="React.lazy(import())" mono tone="ghost" />
      <Box {...ssrMod} label="eigen/routes · ssr" sub="import * as RouteMod0" mono tone="ghost" />
      <Box {...dts} label="eigen-routes.d.ts" sub="RoutePaths · RouteParamsMap" mono />

      <Arrow from={right(pages)} to={left(discover)} label="readdir" />
      <Arrow from={top(discover)} via={[[discover.x + discover.w / 2, 44]]} to={left(clientMod)} label="load()" mono />
      <Arrow from={right(discover)} to={left(ssrMod)} label="load()" mono />
      <Arrow from={bottom(discover)} via={[[discover.x + discover.w / 2, 204]]} to={left(dts)} label="writes" />
    </Diagram>
  );
}

/* ---------------------------------------------- what the watcher reacts to */

const ROW1 = 16;
const ROW2 = 112;
const H = 60;
const W = 145;
const col = (i: number) => 8 + i * (W + 35);

const structural = { x: col(0), y: ROW1, w: W, h: H };
const regen = { x: col(1), y: ROW1, w: W, h: H };
const invalidate = { x: col(2), y: ROW1, w: W, h: H };
const reloadBox = { x: col(3), y: ROW1, w: W, h: H };
const edit = { x: col(0), y: ROW2, w: W, h: H };
const hmr = { x: col(1), y: ROW2, w: col(2) + W - col(1), h: H };

export function RouteWatcherDiagram() {
  return (
    <Diagram
      width={720}
      height={188}
      caption="Only adding or deleting a page changes the route table; editing an existing page is left to ordinary HMR."
    >
      <Box {...structural} label="add / unlink" sub="page added/removed" tone="accent" />
      <Box {...regen} label="regenerate" sub="eigen-routes.d.ts" />
      <Box {...invalidate} label="invalidate" sub="client + ssr graphs" />
      <Box {...reloadBox} label="full-reload" sub="hot.send()" mono />

      <Arrow from={right(structural)} to={left(regen)} tone="accent" />
      <Arrow from={right(regen)} to={left(invalidate)} tone="accent" />
      <Arrow from={right(invalidate)} to={left(reloadBox)} tone="accent" />

      <Box {...edit} label="change" sub="page edited" tone="muted" />
      <Box {...hmr} label="ordinary HMR" sub="Fast Refresh, no reload" tone="muted" />
      <Arrow from={right(edit)} to={left(hmr)} />
    </Diagram>
  );
}
