import { Arrow, Box, Diagram, Lifeline, left, Message, Region, right } from "./kit";

const source = { x: 4, y: 116, w: 220, h: 78 };
const serverOut = { x: 316, y: 54, w: 380, h: 60 };
const clientOut = { x: 316, y: 214, w: 380, h: 60 };
const ELBOW = 262;

export function ServerFnTransformDiagram() {
  return (
    <Diagram
      width={720}
      height={300}
      caption="One source file, two outputs: the ssr environment keeps the builder chain and its database code, while the client environment gets a stub that POSTs to the function's endpoint."
    >
      <Box {...source} label="Dashboard.tsx" sub={"createServerFn()\n  .handler(db.query…)"} mono />

      <Region x={296} y={16} w={420} h={112} label="ssr environment" />
      <Box {...serverOut} label="builder chain kept" sub="db.query(…) · getUsers.url = '/_eigen/fn/a3f2c891'" />

      <Region x={296} y={176} w={420} h={112} label="client environment" tone="accent" />
      <Box
        {...clientOut}
        label="createServerFnStub('a3f2c891')"
        sub="fetch() POST · db import removed"
        mono
        tone="accent"
      />

      <Arrow
        from={right(source)}
        via={[
          [ELBOW, source.y + source.h / 2],
          [ELBOW, serverOut.y + serverOut.h / 2],
        ]}
        to={left(serverOut)}
      />
      <Arrow
        from={right(source)}
        via={[
          [ELBOW, source.y + source.h / 2],
          [ELBOW, clientOut.y + clientOut.h / 2],
        ]}
        to={left(clientOut)}
      />
      <Arrow
        from={[clientOut.x + clientOut.w / 2, clientOut.y]}
        to={[serverOut.x + serverOut.w / 2, serverOut.y + serverOut.h]}
        label="POST /_eigen/fn/a3f2c891"
        dashed
        mono
      />
    </Diagram>
  );
}

const STUB = 82;
const ENDPOINT = 262;
const MIDDLEWARE = 452;
const HANDLER = 636;

export function ServerFnRpcDiagram() {
  return (
    <Diagram
      width={720}
      height={372}
      caption="A server function call is an HTTP request: the endpoint rejects anything that isn't a same-origin JSON POST to a known id, runs global and per-function middleware, then calls the handler."
    >
      <Lifeline x={STUB} bottom={360} label="client stub" w={140} />
      <Lifeline x={ENDPOINT} bottom={360} label="RPC endpoint" tone="accent" w={140} />
      <Lifeline x={MIDDLEWARE} bottom={360} label="middleware" w={140} />
      <Lifeline x={HANDLER} bottom={360} label="handler" w={140} />

      <Message from={STUB} to={ENDPOINT} y={88} label="POST /_eigen/fn/<id>" mono tone="accent" />
      <Message from={ENDPOINT} to={STUB} y={138} label="4xx if rejected" dashed />
      <Message from={ENDPOINT} to={MIDDLEWARE} y={188} label="middleware chain" />
      <Message from={MIDDLEWARE} to={HANDLER} y={238} label="{ data, context }" mono />
      <Message from={HANDLER} to={ENDPOINT} y={288} label="result" dashed />
      <Message from={ENDPOINT} to={STUB} y={338} label="200 JSON" tone="accent" dashed />
    </Diagram>
  );
}
