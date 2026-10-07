import { Arrow, bottom, Box, Diagram, left, Region, right, top } from "./kit";

const configure = { x: 24, y: 48, w: 160, h: 56 };
const checks = { x: 240, y: 48, w: 170, h: 56 };
const collector = { x: 240, y: 160, w: 170, h: 56 };
const terminal = { x: 516, y: 52, w: 180, h: 48 };
const overlay = { x: 516, y: 160, w: 180, h: 56 };

export function DiagnosticsFlowDiagram() {
  return (
    <Diagram
      width={720}
      height={244}
      caption="Health checks run once when the dev server starts; their results go to the terminal immediately and into the overlay's event buffer, which replays them to each browser that connects later."
    >
      <Region x={8} y={8} w={420} h={224} label="vite dev (Node)" />
      <Box {...configure} label="configureServer" sub="eigen:diagnostics" mono />
      <Box {...checks} label="runHealthChecks()" sub="tsconfig · deps · pages" mono />
      <Box {...collector} label="dev collector" sub="buffers last 200 events" tone="accent" />

      <Region x={500} y={124} w={212} h={108} label="browser" />
      <Box {...terminal} label="terminal" sub="logger, per level" />
      <Box {...overlay} label="dev overlay" sub="DiagnosticsPanel" />

      <Arrow from={right(configure)} to={left(checks)} />
      <Arrow from={right(checks)} to={left(terminal)} label="log" />
      <Arrow from={bottom(checks)} to={top(collector)} label="emit()" mono />
      <Arrow from={right(collector)} to={left(overlay)} tone="accent" label="replay" />
    </Diagram>
  );
}
