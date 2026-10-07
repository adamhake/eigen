import { At, Box, Diagram, Lifeline, Message, Note, Region } from "./kit";

export function PprShellDiagram() {
  return (
    <Diagram
      width={720}
      height={330}
      caption="One page, two lifetimes: everything in the static shell is rendered at build time, and each Suspense hole is filled at request time."
    >
      <Region x={8} y={8} w={704} h={314} label="Static shell (prelude, built once)" />
      <Box x={28} y={44} w={664} h={40} label="Navigation" tone="muted" />
      <Box x={28} y={96} w={170} h={164} label="Sidebar" tone="muted" />
      <Box
        x={214}
        y={96}
        w={478}
        h={60}
        label="Product title & description"
        sub="'use cache' — rendered into the shell"
        tone="muted"
      />
      <Box
        x={214}
        y={168}
        w={232}
        h={92}
        label="Price"
        sub={"dynamic hole\nfallback in shell,\nfilled per request"}
        tone="accent"
      />
      <Box
        x={460}
        y={168}
        w={232}
        h={92}
        label="Reviews"
        sub={"dynamic hole\nfallback in shell,\nfilled per request"}
        tone="accent"
      />
      <Box x={28} y={272} w={664} h={36} label="Footer" tone="muted" />
    </Diagram>
  );
}

const BROWSER = 250;
const SERVER = 450;
const REACT = 630;

export function PprResumeTimelineDiagram() {
  return (
    <Diagram
      width={720}
      height={344}
      caption="The server answers with the pre-rendered shell at once, then streams the holes that resume() renders into the same response."
      steps={[
        "The browser requests /products/1. It's listed in ppr.json, so once middleware lets the request through, the server reads its shell.html and postponed.json instead of falling back to SSR.",
        "The server enqueues the whole shell immediately. The browser paints the static content and the hole fallbacks.",
        "resumePage re-runs the RSC render and passes the element and the postponed state to resume(), so only the holes render.",
        "resume() returns each hole's HTML with fill-in scripts that match the boundary IDs already in the prelude.",
        "The server forwards those chunks on the same response as they resolve; resume() ends with the closing </body></html>. The price appears in place of its fallback.",
      ]}
    >
      <Lifeline x={BROWSER} bottom={334} label="Browser" />
      <Lifeline x={SERVER} bottom={334} label="H3 server" />
      <Lifeline x={REACT} bottom={334} label="resume()" mono />

      <At step={1}>
        <Message from={BROWSER} to={SERVER} y={86} label="GET /products/1" mono />
      </At>

      <At step={2}>
        <Message from={SERVER} to={BROWSER} y={140} label="shell.html prelude" tone="accent" />
        <Note x={8} y={122} w={164} text={"paints shell\nand fallbacks"} tone="accent" />
      </At>

      <At step={3}>
        <Message from={SERVER} to={REACT} y={192} label="element, postponed" mono />
      </At>
      <At step={4}>
        <Message from={REACT} to={SERVER} y={244} label="hole HTML + $RC" dashed mono />
      </At>

      <At step={5}>
        <Message from={SERVER} to={BROWSER} y={296} label="streamed hole chunks" dashed />
        <Note x={8} y={280} w={164} text="price appears" />
      </At>
    </Diagram>
  );
}
