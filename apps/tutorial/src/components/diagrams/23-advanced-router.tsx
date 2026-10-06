import { Box, Diagram, Label, Pill } from "./kit";

const ROUTE_X = 16;
const ROUTE_W = 170;
const SEG1_X = 220;
const SEG2_X = 390;
const SEG_W = 150;
const RANK_X = 640;
const ROW_H = 52;

const rows = [
  {
    route: "/posts/new",
    segs: [
      ["posts", "static"],
      ["new", "static"],
    ],
    rank: "1st",
  },
  {
    route: "/posts/:id",
    segs: [
      ["posts", "static"],
      [":id", "dynamic"],
    ],
    rank: "2nd",
  },
  {
    route: "/:section/new",
    segs: [
      [":section", "dynamic"],
      ["new", "static"],
    ],
    rank: "3rd",
  },
] as const;

const rowY = (i: number) => 64 + i * 66;

export function RouteRankingDiagram() {
  return (
    <Diagram
      width={720}
      height={268}
      caption="Routes are compared one segment at a time from the left; the first column where their segment kinds differ decides the order."
    >
      <Label x={ROUTE_X + ROUTE_W / 2} y={36} size={11} muted>
        route
      </Label>
      <Label x={SEG1_X + SEG_W / 2} y={36} size={11} muted>
        segment 1
      </Label>
      <Label x={SEG2_X + SEG_W / 2} y={36} size={11} muted>
        segment 2
      </Label>
      <Label x={RANK_X} y={36} size={11} muted>
        order
      </Label>

      {rows.map((row, i) => {
        const y = rowY(i);
        // The cell that decides this row's position against the row above it
        const decides = (col: number) => (i === 1 && col === 1) || (i === 2 && col === 0);
        return (
          <g key={row.route}>
            <Box x={ROUTE_X} y={y} w={ROUTE_W} h={ROW_H} label={row.route} mono tone={i === 0 ? "accent" : "default"} />
            {row.segs.map(([value, kind], col) => (
              <Box
                key={col}
                x={col === 0 ? SEG1_X : SEG2_X}
                y={y}
                w={SEG_W}
                h={ROW_H}
                label={value}
                sub={kind === "static" ? "static (rank 4)" : "dynamic (rank 3)"}
                mono
                tone={decides(col) ? "accent" : "muted"}
              />
            ))}
            <Pill x={RANK_X} y={y + ROW_H / 2} label={row.rank} />
          </g>
        );
      })}

      <Label x={(SEG2_X + SEG_W + RANK_X) / 2 - 8} y={rowY(1) + ROW_H / 2} size={11} muted>
        {"loses at\nsegment 2"}
      </Label>
      <Label x={(SEG2_X + SEG_W + RANK_X) / 2 - 8} y={rowY(2) + ROW_H / 2} size={11} muted>
        {"loses at\nsegment 1"}
      </Label>
    </Diagram>
  );
}
