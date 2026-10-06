import { Arrow, Box, Diagram, left, Region, right } from "./kit";

const middleware = { x: 18, y: 52, w: 192, h: 56 };
const devEmit = { x: 18, y: 132, w: 192, h: 56 };
const collector = { x: 240, y: 92, w: 136, h: 56 };
const viteWs = { x: 240, y: 196, w: 136, h: 56 };

const overlay = { x: 510, y: 92, w: 192, h: 56 };
const viteClient = { x: 510, y: 196, w: 192, h: 56 };

export function DevOverlayChannelDiagram() {
  return (
    <Diagram
      width={720}
      height={280}
      caption="The overlay has its own WebSocket: request timings and devEmit events collect in the server's buffer and stream to the Shadow DOM badge, separate from Vite's HMR socket."
    >
      <Region x={4} y={12} w={390} h={256} label="Dev server (Node)" />
      <Region x={496} y={12} w={220} h={256} label="Browser tab" />

      <Box {...middleware} label="request middleware" sub="request:start / end" />
      <Box {...devEmit} label="devEmit()" sub="loader, middleware, cache" mono />
      <Box {...collector} label="collector" sub="buffer of 200" tone="accent" />
      <Box {...viteWs} label="Vite HMR" sub="ws at base" tone="muted" />

      <Box {...overlay} label="overlay script" sub="Shadow DOM badge" tone="accent" />
      <Box {...viteClient} label="@vite/client" sub="HMR updates" mono tone="muted" />

      <Arrow
        from={right(middleware)}
        via={[
          [225, 80],
          [225, 110],
        ]}
        to={left(collector, -10)}
      />
      <Arrow
        from={right(devEmit)}
        via={[
          [225, 160],
          [225, 130],
        ]}
        to={left(collector, 10)}
      />

      <Arrow from={right(collector)} to={left(overlay)} label="/_eigen/dev-ws" mono tone="accent" />
      <Arrow from={right(viteWs)} to={left(viteClient)} label="vite-hmr" mono />
    </Diagram>
  );
}
