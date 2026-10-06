import { Arrow, bottom, Box, Diagram, Region, top } from "./kit";

const source = { x: 260, y: 16, w: 200, h: 56 };

const ssrBundle = { x: 28, y: 162, w: 304, h: 60 };
const ssrRun = { x: 28, y: 250, w: 304, h: 56 };

const edgeBundle = { x: 388, y: 162, w: 304, h: 60 };
const edgeRun = { x: 388, y: 250, w: 304, h: 56 };

export function EdgeVsNodeBuildDiagram() {
  return (
    <Diagram
      width={720}
      height={338}
      caption="One entry, two environments: the ssr build resolves Node builds and leaves dependencies external, while the edge build resolves workerd builds and inlines everything into one Worker module."
    >
      <Box {...source} label="src/entry-*.tsx" sub="same Web-streams code" mono />

      <Region x={8} y={120} w={344} h={202} label="ssr environment" />
      <Region x={368} y={120} w={344} h={202} label="edge environment" tone="accent" />

      <Arrow
        from={bottom(source, -10)}
        via={[
          [350, 96],
          [180, 96],
        ]}
        to={top(ssrBundle)}
        label="conditions: node"
        mono
      />
      <Arrow
        from={bottom(source, 10)}
        via={[
          [370, 96],
          [540, 96],
        ]}
        to={top(edgeBundle)}
        label="conditions: workerd"
        mono
        tone="accent"
      />

      <Box {...ssrBundle} label="dist/server/entry-server.js" sub="react-dom → node_modules (external)" mono />
      <Box {...ssrRun} label="serve(app, { port })" sub="long-running Node process" mono tone="muted" />
      <Arrow from={bottom(ssrBundle)} to={top(ssrRun)} />

      <Box {...edgeBundle} label="dist/edge/entry-edge.js" sub="React edge build inlined" mono tone="accent" />
      <Box {...edgeRun} label="export default { fetch }" sub="workerd invokes it per request" mono tone="muted" />
      <Arrow from={bottom(edgeBundle)} to={top(edgeRun)} />
    </Diagram>
  );
}
