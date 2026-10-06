import { Arrow, Box, Diagram, Label, left, Region, right } from "./kit";

/* --------------------------------------- one source file, two environments */

const source = { x: 10, y: 112, w: 180, h: 64 };
const strip = { x: 260, y: 48, w: 200, h: 64 };
const skip = { x: 260, y: 176, w: 200, h: 64 };
const clientOut = { x: 540, y: 48, w: 170, h: 64 };
const serverOut = { x: 540, y: 176, w: 170, h: 64 };

export function StripLoaderEnvironmentsDiagram() {
  const fork = 225;
  return (
    <Diagram
      width={720}
      height={256}
      caption="The strip plugin runs only in the client environment, so the browser chunk loses the loader and its imports while the server bundle keeps the file intact."
    >
      <Region x={240} y={8} w={476} h={120} label="client environment" tone="accent" />
      <Region x={240} y={136} w={476} h={112} label="ssr environment" />

      <Box {...source} label="dashboard.tsx" sub={"loader + db import\n+ component"} mono />
      <Box {...strip} label="eigen-strip-loaders" sub="strip + prune imports" mono tone="accent" />
      <Box {...skip} label="plugin not applied" sub="applyToEnvironment" tone="ghost" />
      <Box {...clientOut} label="client chunk" sub="component only" tone="accent" />
      <Box {...serverOut} label="server bundle" sub="loader + db + page" />

      <Arrow
        from={right(source)}
        via={[
          [fork, 144],
          [fork, 80],
        ]}
        to={left(strip)}
        tone="accent"
      />
      <Arrow
        from={right(source)}
        via={[
          [fork, 144],
          [fork, 208],
        ]}
        to={left(skip)}
      />
      <Arrow from={right(strip)} to={left(clientOut)} tone="accent" />
      <Arrow from={right(skip)} to={left(serverOut)} label="unchanged" />
    </Diagram>
  );
}

/* -------------------------------------------------- where enforce: 'pre' runs */

const W = 158;
const GAP = 22;
const Y = 12;
const stages = [
  { label: "enforce: 'pre'", sub: "eigen-strip-loaders", tone: "accent" as const },
  { label: "Vite core", sub: "vite:oxc, TS → JS", tone: "muted" as const },
  { label: "no enforce", sub: "react(), eigenRoutes", tone: "default" as const },
  { label: "enforce: 'post'", sub: "late rewrites", tone: "muted" as const },
];
const boxes = stages.map((s, i) => ({ ...s, x: 8 + i * (W + GAP), y: Y, w: W, h: 64 }));

export function PluginOrderDiagram() {
  return (
    <Diagram
      width={720}
      height={118}
      caption="enforce: 'pre' runs the strip plugin before Vite's built-in Oxc transform, so it sees the TSX the developer wrote and everything after it never sees the loader."
    >
      {boxes.map((b) => (
        <Box key={b.label} x={b.x} y={b.y} w={b.w} h={b.h} label={b.label} sub={b.sub} tone={b.tone} mono />
      ))}
      {boxes.slice(0, -1).map((b, i) => (
        <Arrow key={b.label} from={right(b)} to={left(boxes[i + 1])} />
      ))}
      <Label x={boxes[0].x + W / 2} y={100} size={11} muted>
        sees TSX source
      </Label>
      <Label x={boxes[1].x + W / 2} y={100} size={11} muted>
        types, JSX compiled
      </Label>
      <Label x={boxes[2].x + W / 2} y={100} size={11} muted>
        sees plain JS
      </Label>
      <Label x={boxes[3].x + W / 2} y={100} size={11} muted>
        sees plain JS
      </Label>
    </Diagram>
  );
}
