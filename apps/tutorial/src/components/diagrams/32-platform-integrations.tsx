import { Arrow, Box, Diagram, left, right } from "./kit";

const imp = { x: 4, y: 152, w: 160, h: 56 };
const load = { x: 250, y: 144, w: 170, h: 72 };
const client = { x: 470, y: 24, w: 246, h: 64 };
const ssr = { x: 470, y: 148, w: 246, h: 64 };
const edge = { x: 470, y: 272, w: 246, h: 64 };
const ELBOW = 440;

export function DbDriverByEnvironmentDiagram() {
  return (
    <Diagram
      width={720}
      height={352}
      caption="One import of eigen/db resolves to different generated code per Vite environment: a throwing stub in the browser, a WebSocket pool on Node, and the HTTP driver on the edge."
    >
      <Box {...imp} label="import 'eigen/db'" sub="loader code" mono />
      <Box {...load} label="load()" sub={"switch on\nthis.environment.name"} mono tone="accent" />
      <Box {...client} label="client" sub="stub: throws when called" tone="ghost" />
      <Box {...ssr} label="ssr (Node)" sub="Pool over WebSocket" />
      <Box {...edge} label="edge" sub="neon() HTTP · sql.query" />

      <Arrow from={right(imp)} to={left(load)} label="resolveId" mono />
      <Arrow
        from={right(load, -12)}
        via={[
          [ELBOW, 168],
          [ELBOW, 56],
        ]}
        to={left(client)}
      />
      <Arrow from={right(load)} to={left(ssr)} />
      <Arrow
        from={right(load, 12)}
        via={[
          [ELBOW, 192],
          [ELBOW, 304],
        ]}
        to={left(edge)}
      />
    </Diagram>
  );
}
