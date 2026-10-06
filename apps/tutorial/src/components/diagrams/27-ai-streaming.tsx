import { Arrow, bottom, Box, Diagram, left, Region, right, top } from "./kit";

const gen = { x: 40, y: 48, w: 240, h: 60 };
const encode = { x: 440, y: 48, w: 250, h: 60 };
const decode = { x: 440, y: 222, w: 250, h: 60 };
const hook = { x: 40, y: 222, w: 240, h: 60 };

export function SseStreamDiagram() {
  return (
    <Diagram
      width={720}
      height={310}
      caption="Each chunk the server function yields becomes one SSE event on the wire, and the client stub decodes events back into typed chunks for useChat."
    >
      <Region x={8} y={8} w={704} h={118} label="Server: /_eigen/fn/<id>" />
      <Region x={8} y={182} w={704} h={118} label="Browser" />

      <Box {...gen} label="async function*" sub=".streamHandler(...)" mono />
      <Box {...encode} label="toEventStream()" sub="one data: event per chunk" mono tone="accent" />
      <Box {...decode} label="sseDecoder()" sub="event: done ends stream" mono />
      <Box {...hook} label="useChat()" sub="setMessages per delta" mono />

      <Arrow from={right(gen)} to={left(encode)} label="yield chunk" mono />
      <Arrow from={bottom(encode)} to={top(decode)} label="text/event-stream" tone="accent" />
      <Arrow from={left(decode)} to={right(hook)} label="ChatChunk" mono />
      <Arrow from={top(hook)} to={bottom(gen)} label="cancel() on disconnect" dashed />
    </Diagram>
  );
}
