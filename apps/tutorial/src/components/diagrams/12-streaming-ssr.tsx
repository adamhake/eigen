import { Arrow, bottom, Box, Diagram, Lifeline, left, Message, Note, Region, right, top } from "./kit";

const BROWSER = 230;
const SERVER = 600;
const NOTE_X = 12;
const NOTE_W = 168;

export function StreamingTimelineDiagram() {
  return (
    <Diagram
      width={720}
      height={340}
      caption="The server flushes the shell first, then streams each Suspense boundary as its data resolves; the browser paints at every step instead of waiting for the slowest query."
    >
      <Lifeline x={BROWSER} bottom={330} label="Browser" />
      <Lifeline x={SERVER} bottom={330} label="Server" />

      <Message from={BROWSER} to={SERVER} y={86} label="GET /dashboard" mono />

      <Message from={SERVER} to={BROWSER} y={140} label="shell: layout + fallbacks" tone="accent" />
      <Note x={NOTE_X} y={119} w={NOTE_W} text={"paints layout\nand spinners"} tone="accent" />

      <Message from={SERVER} to={BROWSER} y={210} label="<script> Stats chunk" dashed mono />
      <Note x={NOTE_X} y={195} w={NOTE_W} text="Stats panel appears" />

      <Message from={SERVER} to={BROWSER} y={280} label="<script> Orders chunk" dashed mono />
      <Note x={NOTE_X} y={265} w={NOTE_W} text="Orders table appears" />
    </Diagram>
  );
}

/* ------------------------------------------------------ response assembly */

const before = { x: 20, y: 136, w: 140, h: 56 };
const shell = { x: 180, y: 136, w: 140, h: 56 };
const chunks = { x: 340, y: 136, w: 160, h: 56 };
const tail = { x: 520, y: 136, w: 180, h: 56 };

const react = { x: 180, y: 16, w: 320, h: 48 };
const deferred = { x: 530, y: 16, w: 160, h: 48 };
const template = { x: 250, y: 246, w: 220, h: 56 };

export function StreamAssemblyDiagram() {
  return (
    <Diagram
      width={720}
      height={316}
      caption="renderStream wraps React's stream: the template head goes out in start(), React's shell and Suspense chunks follow, and flush() appends the data script and the template tail only after React has finished."
    >
      <Region x={4} y={96} w={712} h={110} label="Response body, in order" />

      <Box {...react} label="renderToReadableStream()" mono />
      <Box {...deferred} label="resolveDeferred()" mono />
      <Box {...template} label="index.html template" sub="split at the outlet" />

      <Box {...before} label="htmlBefore" sub="start()" mono />
      <Box {...shell} label="shell" sub="React stream" />
      <Box {...chunks} label="Suspense chunks" sub="as data resolves" tone="ghost" />
      <Box {...tail} label="data + htmlAfter" sub="flush()" tone="accent" />

      <Arrow from={right(before)} to={left(shell)} />
      <Arrow from={right(shell)} to={left(chunks)} />
      <Arrow from={right(chunks)} to={left(tail)} tone="accent" />

      <Arrow from={[250, 64]} to={top(shell)} label="shell ready" labelOffset={[0, -20]} />
      <Arrow from={[420, 64]} to={top(chunks)} label="later" dashed labelOffset={[0, -20]} />
      <Arrow from={bottom(deferred)} to={top(tail)} label="__EIGEN_DATA__" mono tone="accent" labelOffset={[0, -20]} />

      <Arrow
        from={[310, 246]}
        via={[
          [310, 226],
          [90, 226],
        ]}
        to={bottom(before)}
        label="before"
      />
      <Arrow
        from={[410, 246]}
        via={[
          [410, 226],
          [610, 226],
        ]}
        to={bottom(tail)}
        label="after"
      />
    </Diagram>
  );
}
