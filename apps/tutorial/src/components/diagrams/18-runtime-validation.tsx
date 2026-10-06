import { Arrow, bottom, Box, Diagram, left, Region, right, top } from "./kit";

// Server row (left → right), client row (right → left), joined by the JSON boundary.
const api = { x: 28, y: 46, w: 180, h: 76 };
const loader = { x: 270, y: 46, w: 180, h: 76 };
const ssr = { x: 512, y: 46, w: 180, h: 76 };

const data = { x: 512, y: 216, w: 180, h: 76 };
const parse = { x: 270, y: 216, w: 180, h: 76 };
const hydrate = { x: 28, y: 216, w: 180, h: 76 };

export function ValidationBoundaryDiagram() {
  return (
    <Diagram
      width={720}
      height={324}
      caption="The same schema parses twice: the loader turns the API's string into a Date for SSR, JSON turns it back into a string, and the client's parse() restores the Date."
    >
      <Region x={8} y={8} w={704} h={130} label="Server" />
      <Box {...api} label="upstream API" sub="createdAt: string" />
      <Box {...loader} label="loader" sub={"schema parse\n→ createdAt: Date"} mono tone="accent" />
      <Box {...ssr} label="SSR render" sub="createdAt: Date" />
      <Arrow from={right(api)} to={left(loader)} />
      <Arrow from={right(loader)} to={left(ssr)} />

      <Region x={8} y={178} w={704} h={130} label="Client" />
      <Box {...data} label="__EIGEN_DATA__" sub="createdAt: string" mono tone="muted" />
      <Box {...parse} label="parse()" sub={"same schema\n→ createdAt: Date"} mono tone="accent" />
      <Box {...hydrate} label="hydrate" sub="createdAt: Date" />
      <Arrow from={left(data)} to={right(parse)} />
      <Arrow from={left(parse)} to={right(hydrate)} />

      <Arrow from={bottom(ssr)} to={top(data)} label="serializeForScript" mono />
    </Diagram>
  );
}
