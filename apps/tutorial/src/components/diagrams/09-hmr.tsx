import { Arrow, bottom, Box, Diagram, left, Region, right, top } from "./kit";

/* ---------------------------------------------------------- hotUpdate flow */

const chokidar = { x: 4, y: 24, w: 130, h: 56 };
const hook = { x: 184, y: 24, w: 150, h: 56 };
const fallback = { x: 500, y: 24, w: 212, h: 56 };

const clientEnv = { x: 184, y: 176, w: 150, h: 56 };
const clientInvalidate = { x: 374, y: 176, w: 150, h: 56 };
const clientReload = { x: 562, y: 176, w: 148, h: 56 };
const ssrEnv = { x: 184, y: 256, w: 150, h: 56 };
const ssrInvalidate = { x: 374, y: 256, w: 150, h: 56 };
const ssrReload = { x: 562, y: 256, w: 148, h: 56 };

export function HmrHotUpdateDiagram() {
  return (
    <Diagram
      width={720}
      height={340}
      caption="hotUpdate runs once per environment: content edits fall through to default HMR, while a created or deleted page invalidates the route module and reloads both the browser and the SSR runner."
    >
      <Box {...chokidar} label="chokidar" sub="page .tsx event" />
      <Box {...hook} label="hotUpdate()" sub="this.environment" mono tone="accent" />
      <Box {...fallback} label="default HMR" sub="Fast Refresh, no reload" tone="muted" />

      <Arrow from={right(chokidar)} to={left(hook)} />
      <Arrow from={right(hook)} to={left(fallback)} label="type: 'update'" mono />

      <Region x={4} y={136} w={712} h={190} label="per environment" tone="accent" />

      <Box {...clientEnv} label="client" mono />
      <Box {...clientInvalidate} label="invalidate()" sub={"\\0eigen/routes"} mono />
      <Box {...clientReload} label="full-reload" sub="browser reloads" mono tone="accent" />

      <Box {...ssrEnv} label="ssr" mono />
      <Box {...ssrInvalidate} label="invalidate()" sub={"\\0eigen/routes"} mono />
      <Box {...ssrReload} label="full-reload" sub="runner drops cache" mono tone="accent" />

      <Arrow from={bottom(hook)} to={top(clientEnv)} label="'create', 'delete'" mono labelOffset={[0, -14]} />
      <Arrow from={bottom(clientEnv)} to={top(ssrEnv)} />

      <Arrow from={right(clientEnv)} to={left(clientInvalidate)} />
      <Arrow from={right(clientInvalidate)} to={left(clientReload)} />
      <Arrow from={right(ssrEnv)} to={left(ssrInvalidate)} />
      <Arrow from={right(ssrInvalidate)} to={left(ssrReload)} />
    </Diagram>
  );
}

/* ------------------------------------------------- two parallel update paths */

const event = { x: 4, y: 120, w: 124, h: 56 };
const typeRow = [
  { x: 166, y: 52, w: 160, h: 56 },
  { x: 356, y: 52, w: 170, h: 56 },
  { x: 556, y: 52, w: 150, h: 56 },
];
const runtimeRow = [
  { x: 166, y: 188, w: 160, h: 56 },
  { x: 356, y: 188, w: 170, h: 56 },
  { x: 556, y: 188, w: 150, h: 56 },
];

export function HmrTwoUpdatePathsDiagram() {
  return (
    <Diagram
      width={720}
      height={282}
      caption="One new page file drives two independent updates: the debounced watcher rewrites the declaration file for the IDE, and hotUpdate refreshes the runtime route table in every environment."
    >
      <Region x={150} y={12} w={566} h={118} label="Type system (IDE)" />
      <Region x={150} y={148} w={566} h={118} label="Runtime (browser + SSR)" />

      <Box {...event} label="chokidar" sub={"'add' event"} tone="accent" />

      <Box {...typeRow[0]} label="watcher" sub="debounced 100ms" />
      <Box {...typeRow[1]} label="eigen-routes.d.ts" sub="rewritten" mono />
      <Box {...typeRow[2]} label="TS server" sub={"'/users/:name'"} />

      <Box {...runtimeRow[0]} label="hotUpdate()" sub="type: 'create'" mono />
      <Box {...runtimeRow[1]} label="invalidate()" sub="+ full-reload" mono />
      <Box {...runtimeRow[2]} label="fresh routes" sub="browser + runner" />

      <Arrow
        from={right(event)}
        via={[
          [139, 148],
          [139, 80],
        ]}
        to={left(typeRow[0])}
      />
      <Arrow
        from={right(event)}
        via={[
          [139, 148],
          [139, 216],
        ]}
        to={left(runtimeRow[0])}
      />

      <Arrow from={right(typeRow[0])} to={left(typeRow[1])} />
      <Arrow from={right(typeRow[1])} to={left(typeRow[2])} />
      <Arrow from={right(runtimeRow[0])} to={left(runtimeRow[1])} />
      <Arrow from={right(runtimeRow[1])} to={left(runtimeRow[2])} />
    </Diagram>
  );
}
