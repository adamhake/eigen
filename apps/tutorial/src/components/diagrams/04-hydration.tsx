import { Arrow, Box, Diagram, left, Region, right } from "./kit";

/* ------------------------------------- the server → client data handoff */

const loader = { x: 24, y: 92, w: 90, h: 44 };
const render = { x: 150, y: 48, w: 180, h: 44 };
const serialize = { x: 150, y: 136, w: 180, h: 44 };
const dom = { x: 410, y: 48, w: 132, h: 44 };
const data = { x: 410, y: 136, w: 132, h: 44 };
const hydrate = { x: 584, y: 78, w: 124, h: 72 };

const SPLIT = 132;
const JOIN = 562;

export function HydrationDataFlowDiagram() {
  return (
    <Diagram
      width={720}
      height={210}
      caption="The loader's data crosses to the browser twice, as rendered HTML and as a serialized script, so hydrateRoot can render the same tree with the same data and adopt the existing DOM."
    >
      <Region x={8} y={8} w={362} h={188} label="Server" />
      <Region x={378} y={8} w={334} h={188} label="Browser" />

      <Box {...loader} label="loader()" mono />
      <Box {...render} label="renderToString()" mono />
      <Box {...serialize} label="serializeForScript()" mono tone="accent" />
      <Box {...dom} label="#root markup" mono />
      <Box {...data} label="__EIGEN_DATA__" mono tone="accent" />
      <Box {...hydrate} label="hydrateRoot()" sub={"same tree,\nsame data"} mono />

      <Arrow
        from={right(loader)}
        via={[
          [SPLIT, 114],
          [SPLIT, 70],
        ]}
        to={left(render)}
      />
      <Arrow
        from={right(loader)}
        via={[
          [SPLIT, 114],
          [SPLIT, 158],
        ]}
        to={left(serialize)}
        tone="accent"
      />

      <Arrow from={right(render)} to={left(dom)} label="HTML" />
      <Arrow from={right(serialize)} to={left(data)} label="<script>" mono tone="accent" />

      <Arrow
        from={right(dom)}
        via={[
          [JOIN, 70],
          [JOIN, 104],
        ]}
        to={left(hydrate, -10)}
      />
      <Arrow
        from={right(data)}
        via={[
          [JOIN, 158],
          [JOIN, 124],
        ]}
        to={left(hydrate, 10)}
        tone="accent"
      />
    </Diagram>
  );
}
