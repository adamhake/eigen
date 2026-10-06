import { Arrow, Box, Diagram, Label, left, Region, right } from "./kit";

/* ------------------------------------------------------------ test pyramid */

const ROW_H = 56;
const GAP = 8;
const CX = 360;
const layer = (i: number, w: number) => ({ x: CX - w / 2, y: 16 + i * (ROW_H + GAP), w, h: ROW_H });

const e2e = layer(0, 280);
const integration = layer(1, 400);
const plugin = layer(2, 520);
const unit = layer(3, 640);

export function TestingPyramidDiagram() {
  return (
    <Diagram
      width={720}
      height={288}
      caption="Each layer of the pyramid exercises more of the framework per test and runs slower, so the suite has many fast unit tests at the base and few browser tests at the top."
    >
      <Box {...e2e} label="E2E (Playwright)" sub="hydration, navigation · ~1s" tone="muted" />
      <Box {...integration} label="Integration" sub="render(request): middleware → loader → HTML · ~100ms" />
      <Box {...plugin} label="Plugin" sub="resolveId / load / transform through Vite · ~10ms" />
      <Box {...unit} label="Unit" sub="fileToRoute · matchRoute · generateFnId · ~1ms" tone="accent" />
    </Diagram>
  );
}

/* ------------------------------------------------- client vs SSR build test */

const fixture = { x: 8, y: 98, w: 150, h: 60 };
const builder = { x: 198, y: 98, w: 150, h: 60 };

const clientRegion = { x: 388, y: 8, w: 324, h: 132 };
const entryChunk = { x: 402, y: 44, w: 92, h: 56 };
const homeChunk = { x: 506, y: 44, w: 92, h: 56 };
const idChunk = { x: 610, y: 44, w: 92, h: 56 };

const ssrRegion = { x: 388, y: 152, w: 324, h: 96 };
const ssrEntry = { x: 402, y: 188, w: 300, h: 48 };

export function TestingBuildOutputsDiagram() {
  return (
    <Diagram
      width={720}
      height={256}
      caption="The integration test builds one fixture for both environments and asserts on what differs: lazy pages become dynamic chunks without the loader on the client, while the SSR bundle imports them statically with the loader intact."
    >
      <Box {...fixture} label="fixture app" sub="loader + MARKER" />
      <Box {...builder} label="createBuilder()" sub="write: false" mono />
      <Arrow from={right(fixture)} to={left(builder)} />

      <Region {...clientRegion} label="client build" />
      <Box {...entryChunk} label="entry" sub="index" mono tone="muted" />
      <Box {...homeChunk} label="Home" sub="dynamic" mono tone="accent" />
      <Box {...idChunk} label="[id]" sub="dynamic" mono tone="accent" />
      <Label x={552} y={120} size={11} muted>
        {"2 dynamic entries · no MARKER"}
      </Label>

      <Region {...ssrRegion} label="ssr build" />
      <Box {...ssrEntry} label="entry-server.js" sub="static imports · MARKER kept" mono />

      <Arrow
        from={right(builder)}
        via={[
          [368, 128],
          [368, 72],
        ]}
        to={left(entryChunk)}
      />
      <Arrow
        from={right(builder)}
        via={[
          [368, 128],
          [368, 212],
        ]}
        to={left(ssrEntry)}
      />
    </Diagram>
  );
}
