import { Arrow, Box, Diagram, left, right } from "./kit";

const rscEnv = { x: 12, y: 30, w: 160, h: 92 };
const ssrEnv = { x: 280, y: 30, w: 160, h: 92 };
const clientEnv = { x: 548, y: 30, w: 160, h: 92 };

export function RscEnvironmentsDiagram() {
  return (
    <Diagram
      width={720}
      height={138}
      caption="Three environments in a row: rsc runs server components and emits the RSC payload, ssr turns that payload into HTML, and the browser hydrates only the client components."
    >
      <Box {...rscEnv} label="rsc" sub={"cond: react-server\nserver components\ndb + secrets OK"} mono tone="accent" />
      <Box {...ssrEnv} label="ssr" sub={"cond: node\npayload → HTML\nSSR of client comps"} mono />
      <Box {...clientEnv} label="client" sub={"browser\nhydrates the page\nonly 'use client'"} mono />
      <Arrow from={right(rscEnv)} to={left(ssrEnv)} label="RSC payload" tone="accent" />
      <Arrow from={right(ssrEnv)} to={left(clientEnv)} label={"HTML +\npayload"} />
    </Diagram>
  );
}

const source = { x: 16, y: 114, w: 200, h: 64 };
const asRsc = { x: 380, y: 24, w: 320, h: 64 };
const asSsr = { x: 380, y: 114, w: 320, h: 64 };
const asClient = { x: 380, y: 204, w: 320, h: 64 };
const SPLIT_X = 290;

export function RscClientReferenceDiagram() {
  const [sx, sy] = right(source);
  return (
    <Diagram
      width={720}
      height={284}
      caption="The same 'use client' file resolves three ways: the rsc environment sees only a reference stub, while ssr and client get the real component."
    >
      <Box {...source} label="LikeButton.tsx" sub={'"use client"'} mono />
      <Box {...asRsc} label="registerClientReference()" sub="stub: module id + export name" mono tone="accent" />
      <Box {...asSsr} label="function LikeButton()" sub="real component, renders HTML" mono />
      <Box {...asClient} label="function LikeButton()" sub="real component, own chunk, hydrates" mono />

      <Arrow
        from={[sx, sy]}
        via={[
          [SPLIT_X, sy],
          [SPLIT_X, asRsc.y + asRsc.h / 2],
        ]}
        to={left(asRsc)}
        label="rsc"
        labelAt={2}
        mono
        tone="accent"
      />
      <Arrow from={[sx, sy]} to={left(asSsr)} label="ssr" mono labelOffset={[37, 0]} />
      <Arrow
        from={[sx, sy]}
        via={[
          [SPLIT_X, sy],
          [SPLIT_X, asClient.y + asClient.h / 2],
        ]}
        to={left(asClient)}
        label="client"
        labelAt={2}
        mono
      />
    </Diagram>
  );
}
