import { Arrow, bottom, Box, Diagram, Lifeline, Message, Region, top } from "./kit";

const BROWSER = 80;
const H3 = 260;
const VITE = 440;
const RUNNER = 620;
const BOTTOM = 552;

export function SsrRequestSequenceDiagram() {
  return (
    <Diagram
      width={720}
      height={560}
      caption="A page request falls through Vite's middleware to the SSR handler, which transforms the HTML template, imports the server entry through the ModuleRunner, renders, and returns one complete HTML response."
    >
      <Lifeline x={BROWSER} bottom={BOTTOM} label="Browser" />
      <Lifeline x={H3} bottom={BOTTOM} label="H3 server" />
      <Lifeline x={VITE} bottom={BOTTOM} label="Vite" />
      <Lifeline x={RUNNER} bottom={BOTTOM} label="SSR runner" tone="accent" />

      <Message from={BROWSER} to={H3} y={86} label="GET /posts/42" mono />

      <Message from={H3} to={VITE} y={136} label="middlewares" mono />
      <Message from={VITE} to={H3} y={186} label="no match: next()" dashed />

      <Message from={H3} to={VITE} y={236} label="transformIndexHtml()" mono />
      <Message from={VITE} to={H3} y={286} label="+ /@vite/client" dashed mono />

      <Message from={H3} to={RUNNER} y={336} label="runner.import(entry-server)" mono tone="accent" />
      <Message from={RUNNER} to={H3} y={386} label="{ render }" dashed mono />

      <Message from={H3} to={RUNNER} y={436} label="render('/posts/42')" mono />
      <Message from={RUNNER} to={H3} y={486} label="{ html, status, data }" dashed mono />

      <Message from={H3} to={BROWSER} y={536} label="full HTML page" tone="accent" />
    </Diagram>
  );
}

/* ------------------------------------- raw JSON vs. serializeForScript */

const rawIn = { x: 28, y: 48, w: 304, h: 56 };
const rawOut = { x: 28, y: 160, w: 304, h: 56 };
const safeIn = { x: 388, y: 48, w: 304, h: 56 };
const safeOut = { x: 388, y: 160, w: 304, h: 56 };

export function ScriptEscapingDiagram() {
  return (
    <Diagram
      width={720}
      height={244}
      caption="Raw JSON lets a </script> inside the data close the script element early; serializeForScript escapes < so the browser keeps reading one JavaScript string."
    >
      <Region x={8} y={8} w={344} h={228} label="JSON.stringify" />
      <Region x={368} y={8} w={344} h={228} label="serializeForScript" tone="accent" />

      <Box {...rawIn} label={'{"t":"</script>…"}'} sub="inserted verbatim" mono />
      <Box {...rawOut} label="script ends early" sub="rest parsed as HTML" tone="ghost" />
      <Arrow from={bottom(rawIn)} to={top(rawOut)} label="HTML parser" />

      <Box {...safeIn} label={'{"t":"\\u003c/script…"}'} sub={"< escaped as \\u003c"} mono />
      <Box {...safeOut} label="one JS string" sub="data arrives intact" tone="accent" />
      <Arrow from={bottom(safeIn)} to={top(safeOut)} label="HTML parser" tone="accent" />
    </Diagram>
  );
}
