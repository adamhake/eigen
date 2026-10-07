import { Arrow, At, bottom, Box, Diagram, Lifeline, left, Message, Note, Region, right, top } from "./kit";

const BROWSER = 230;
const SERVER = 600;
const NOTE_X = 12;
const NOTE_W = 168;

export function StreamingTimelineDiagram() {
  return (
    <Diagram
      width={720}
      height={340}
      caption="The server sends the shell as soon as the awaited part of the loader is done, then streams the deferred Orders boundary when its query resolves; the browser paints at each step instead of waiting for the slowest query."
      steps={[
        "The browser requests /dashboard. The loader awaits the fast stats query (~50 ms) and leaves the slow orders query as a promise.",
        "The server sends the shell right away: the layout, navigation, the Stats panel (its data was awaited), and the Orders fallback as placeholder HTML. The browser paints it.",
        "About 800 ms later the orders query resolves. React streams the finished Recent Orders HTML plus a small inline <script> that swaps it into its placeholder.",
        "React closes its stream, so flush() appends the __EIGEN_DATA__ script and the rest of the template. The client entry runs and hydrates the page.",
      ]}
    >
      <Lifeline x={BROWSER} bottom={330} label="Browser" />
      <Lifeline x={SERVER} bottom={330} label="Server" />

      <At step={1}>
        <Message from={BROWSER} to={SERVER} y={86} label="GET /dashboard" mono />
      </At>

      <At step={2}>
        <Message from={SERVER} to={BROWSER} y={140} label="shell: layout + Stats + fallback" tone="accent" />
        <Note x={NOTE_X} y={119} w={NOTE_W} text={"paints layout, Stats\nand orders fallback"} tone="accent" />
      </At>

      <At step={3}>
        <Message from={SERVER} to={BROWSER} y={210} label="<script> Orders chunk" dashed mono />
        <Note x={NOTE_X} y={195} w={NOTE_W} text="Recent Orders appear" />
      </At>

      <At step={4}>
        <Message from={SERVER} to={BROWSER} y={280} label="__EIGEN_DATA__ + tail" dashed mono />
        <Note x={NOTE_X} y={265} w={NOTE_W} text="hydrates" />
      </At>
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
      steps={[
        "renderStream splits the index.html template at the <!--ssr-outlet--> marker. The TransformStream's start() enqueues htmlBefore before React writes anything.",
        "Once renderToReadableStream() has the shell ready, React's HTML flows through the transform and follows the template head.",
        "Each Suspense boundary's chunk streams in later, as its data resolves, still in the middle of the response.",
        "flush() runs once, after React closes its stream. It awaits resolveDeferred() for the __EIGEN_DATA__ script (rejected or timed-out values become null) and appends it with htmlAfter, so the tail always lands after the last chunk.",
      ]}
    >
      <Region x={4} y={96} w={712} h={110} label="Response body, in order" />

      <At step={1}>
        <Box {...template} label="index.html template" sub="split at the outlet" />
        <Box {...before} label="htmlBefore" sub="start()" mono />
        <Arrow
          from={[310, 246]}
          via={[
            [310, 226],
            [90, 226],
          ]}
          to={bottom(before)}
          label="before"
        />
      </At>

      <At step={2}>
        <Box {...react} label="renderToReadableStream()" mono />
        <Box {...shell} label="shell" sub="React stream" />
        <Arrow from={right(before)} to={left(shell)} />
        <Arrow from={[250, 64]} to={top(shell)} label="shell ready" labelOffset={[0, -20]} />
      </At>

      <At step={3}>
        <Box {...chunks} label="Suspense chunks" sub="as data resolves" tone="ghost" />
        <Arrow from={right(shell)} to={left(chunks)} />
        <Arrow from={[420, 64]} to={top(chunks)} label="later" dashed labelOffset={[0, -20]} />
      </At>

      <At step={4}>
        <Box {...deferred} label="resolveDeferred()" mono />
        <Box {...tail} label="data + htmlAfter" sub="flush()" tone="accent" />
        <Arrow from={right(chunks)} to={left(tail)} tone="accent" />
        <Arrow
          from={bottom(deferred)}
          to={top(tail)}
          label="__EIGEN_DATA__"
          mono
          tone="accent"
          labelOffset={[0, -20]}
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
      </At>
    </Diagram>
  );
}
