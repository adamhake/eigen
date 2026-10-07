import { Arrow, bottom, Box, Diagram, left, Region, right, top } from "./kit";

const middleware = { x: 18, y: 52, w: 192, h: 56 };
const devEmit = { x: 18, y: 132, w: 192, h: 56 };
const collector = { x: 240, y: 52, w: 136, h: 56 };
const hotChannel = { x: 240, y: 196, w: 136, h: 56 };

const overlay = { x: 510, y: 52, w: 192, h: 56 };
const viteClient = { x: 510, y: 196, w: 192, h: 56 };

export function DevOverlayChannelDiagram() {
  return (
    <Diagram
      width={720}
      height={280}
      caption="Request timings and devEmit events collect in the server's buffer and travel as eigen:dev custom events over Vite's own HMR WebSocket; @vite/client hands them to the overlay's import.meta.hot.on listener, separately from HMR updates."
    >
      <Region x={4} y={12} w={390} h={256} label="Dev server (Node)" />
      <Region x={496} y={12} w={220} h={256} label="Browser tab" />

      <Box {...middleware} label="request middleware" sub="request:start / end" />
      <Box {...devEmit} label="devEmit()" sub="any framework code" mono />
      <Box {...collector} label="collector" sub="buffer of 200" tone="accent" />
      <Box {...hotChannel} label="client hot channel" sub="Vite WebSocket :24678" tone="muted" />

      <Box {...overlay} label="overlay module" sub="import.meta.hot.on" tone="accent" />
      <Box {...viteClient} label="@vite/client" sub="HMR + custom events" mono tone="muted" />

      <Arrow from={right(middleware)} to={left(collector)} />
      <Arrow
        from={right(devEmit)}
        via={[
          [225, 160],
          [225, 90],
        ]}
        to={left(collector, 10)}
      />

      <Arrow from={bottom(collector)} to={top(hotChannel)} label="hot.send('eigen:dev')" mono tone="accent" />
      <Arrow from={right(hotChannel)} to={left(viteClient)} label="vite-hmr" mono both />
      <Arrow from={top(viteClient)} to={bottom(overlay)} label="eigen:dev" mono tone="accent" />
    </Diagram>
  );
}
