import { Arrow, bottom, Box, Diagram, Region, top } from "./kit";

const COL_W = 204;
const COLS = [28, 258, 488];
const slot = (i: number) => ({ x: COLS[i], y: 116, w: COL_W, h: 48 });
const cdn = (i: number) => ({ x: COLS[i], y: 228, w: COL_W, h: 76 });

const remotes = [
  { slot: "<DashboardApp />", name: "dashboard remote", sub: "Team A\ncdn.a.com/remoteEntry.js" },
  { slot: "<Marketplace />", name: "marketplace remote", sub: "Team B\ncdn.b.com/remoteEntry.js" },
  { slot: "<Checkout />", name: "checkout remote", sub: "Team C\ncdn.c.com/remoteEntry.js" },
];

export function FederationHostDiagram() {
  return (
    <Diagram
      width={720}
      height={316}
      caption="The host renders its own navigation and loads each team's remote module from that team's deployment at runtime, while all of them share one React."
    >
      <Region x={8} y={8} w={704} h={174} label="Host app (browser)" />
      <Box x={28} y={44} w={204} h={56} label="Navigation" sub="host's own code" />
      <Box
        x={258}
        y={44}
        w={434}
        h={56}
        label="react + react-dom"
        sub="shared singleton, loaded once"
        mono
        tone="accent"
      />

      {remotes.map((r, i) => (
        <g key={r.name}>
          <Box {...slot(i)} label={r.slot} mono tone="ghost" />
          <Box {...cdn(i)} label={r.name} sub={r.sub} tone="muted" />
          <Arrow from={top(cdn(i))} to={bottom(slot(i))} label="import()" mono dashed />
        </g>
      ))}
    </Diagram>
  );
}
