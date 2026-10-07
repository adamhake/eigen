import { Arrow, At, bottom, Box, Diagram, left, Region, right, top } from "./kit";

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
      steps={[
        "The chat server function's .streamHandler() is an async generator. It maps the model's stream and yields a typed ChatChunk for each text delta and tool event.",
        "handleServerFnRequest sees an async iterable and responds with text/event-stream. toEventStream() pulls one chunk at a time and writes it as a data: event, then sends an explicit done event at the end.",
        "In the browser, the streaming stub pipes the response body through sseDecoder(), which parses each event back into a chunk. The done event ends the stream, so finishing is distinct from a dropped connection.",
        "useChat() reads the chunks and calls setMessages as each delta arrives, so the reply renders while the model is still writing.",
        "If the browser disconnects, the response body is cancelled. toEventStream()'s cancel() stops the generator, which stops consuming the model's stream.",
      ]}
    >
      <Region x={8} y={8} w={704} h={118} label="Server: /_eigen/fn/<id>" />
      <Region x={8} y={182} w={704} h={118} label="Browser" />

      <At step={1}>
        <Box {...gen} label="async function*" sub=".streamHandler(...)" mono />
      </At>

      <At step={2}>
        <Box {...encode} label="toEventStream()" sub="one data: event per chunk" mono tone="accent" />
        <Arrow from={right(gen)} to={left(encode)} label="yield chunk" mono />
      </At>

      <At step={3}>
        <Box {...decode} label="sseDecoder()" sub="event: done ends stream" mono />
        <Arrow from={bottom(encode)} to={top(decode)} label="text/event-stream" tone="accent" />
      </At>

      <At step={4}>
        <Box {...hook} label="useChat()" sub="setMessages per delta" mono />
        <Arrow from={left(decode)} to={right(hook)} label="ChatChunk" mono />
      </At>

      <At step={5}>
        <Arrow from={top(hook)} to={bottom(gen)} label="cancel() on disconnect" dashed />
      </At>
    </Diagram>
  );
}
