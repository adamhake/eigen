import { Arrow, bottom, Box, Diagram, left, Region, right, top } from "./kit";

const page = { x: 34, y: 16, w: 190, h: 56 };
const data = { x: 495, y: 16, w: 190, h: 56 };
const globalMw = { x: 44, y: 152, w: 170, h: 56 };
const routeMw = { x: 274, y: 152, w: 170, h: 56 };
const loaders = { x: 504, y: 152, w: 172, h: 56 };
const shortCircuit = { x: 104, y: 272, w: 280, h: 56 };
const result = { x: 484, y: 272, w: 212, h: 56 };

export function RunRoutePipelineDiagram() {
  return (
    <Diagram
      width={720}
      height={344}
      caption="Page renders and /_eigen/data both go through runRoute: global then per-route middleware, then every loader with the accumulated ctx — and any middleware can short-circuit with a Response."
    >
      <Box {...page} label="renderStream(request)" sub="GET /dashboard" mono />
      <Box {...data} label="loadData(request)" sub="GET /_eigen/data" mono />

      <Region x={20} y={108} w={680} h={124} label="runRoute()" tone="accent" />
      <Box {...globalMw} label="global middleware" sub="src/middleware.ts" tone="accent" />
      <Box {...routeMw} label="route middleware" sub="export middleware" tone="accent" />
      <Box {...loaders} label="loadRouteData" sub="layouts + page, ctx" mono />

      <Arrow from={bottom(page, 12)} to={top(globalMw, 12)} />
      <Arrow
        from={bottom(data)}
        via={[
          [data.x + data.w / 2, 90],
          [globalMw.x + globalMw.w / 2 + 40, 90],
        ]}
        to={top(globalMw, 40)}
        label="same pipeline"
      />
      <Arrow from={right(globalMw)} to={left(routeMw)} label="ctx" mono />
      <Arrow from={right(routeMw)} to={left(loaders)} label="ctx" mono />

      <Box {...shortCircuit} label="Response, returned as-is" sub="302 /login · 429 Too Many Requests" tone="muted" />
      <Arrow
        from={[globalMw.x + globalMw.w / 2, globalMw.y + globalMw.h]}
        to={[globalMw.x + globalMw.w / 2, shortCircuit.y]}
        dashed
      />
      <Arrow
        from={[routeMw.x + routeMw.w / 2, routeMw.y + routeMw.h]}
        to={[routeMw.x + routeMw.w / 2, shortCircuit.y]}
        dashed
      />

      <Box {...result} label="{ data, context }" sub="RouteData → HTML or JSON" mono />
      <Arrow from={bottom(loaders)} to={top(result, 590 - (result.x + result.w / 2))} />
    </Diagram>
  );
}
