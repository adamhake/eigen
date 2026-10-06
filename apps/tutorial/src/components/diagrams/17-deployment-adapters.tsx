import { Arrow, Box, Diagram, left, Region, right } from "./kit";

const distClient = { x: 20, y: 56, w: 172, h: 64 };
const distServer = { x: 20, y: 146, w: 172, h: 92 };

const AX = 254;
const AW = 200;
const node = { x: AX, y: 40, w: AW, h: 56 };
const netlify = { x: AX, y: 136, w: AW, h: 56 };
const cloudflare = { x: AX, y: 232, w: AW, h: 56 };

const OX = 498;
const OW = 218;
const nodeOut = { x: OX, y: 40, w: OW, h: 56 };
const netlifyOut = { x: OX, y: 136, w: OW, h: 56 };
const cloudflareOut = { x: OX, y: 232, w: OW, h: 56 };

const FAN_X = 224;
const SRC: [number, number] = [212, netlify.y + netlify.h / 2];

export function AdapterFanOutDiagram() {
  return (
    <Diagram
      width={720}
      height={308}
      caption="The same build output feeds whichever adapter is listed after eigen(): each reads dist/ and writes the entry point and routing config its platform expects."
    >
      <Region x={4} y={16} w={208} h={276} label="Eigen build output" />
      <Box {...distClient} label="dist/client/" sub="assets + pages" mono />
      <Box {...distServer} label="dist/server/" sub={"entry-server.js\ntemplate.html\nprerendered.json"} mono />

      <Box {...node} label="nodeAdapter()" sub="H3 server" mono tone="accent" />
      <Box {...netlify} label="netlifyAdapter()" sub="Frameworks API" mono tone="accent" />
      <Box {...cloudflare} label="cloudflareAdapter()" sub="Workers + assets" mono tone="accent" />

      <Arrow
        from={SRC}
        via={[
          [FAN_X, SRC[1]],
          [FAN_X, node.y + node.h / 2],
        ]}
        to={left(node)}
      />
      <Arrow from={SRC} to={left(netlify)} />
      <Arrow
        from={SRC}
        via={[
          [FAN_X, SRC[1]],
          [FAN_X, cloudflare.y + cloudflare.h / 2],
        ]}
        to={left(cloudflare)}
      />

      <Box {...nodeOut} label="dist/server.mjs" sub="+ package.json (h3)" mono />
      <Box {...netlifyOut} label=".netlify/v1/" sub="functions/eigen-ssr.mjs" mono />
      <Box {...cloudflareOut} label="dist/cloudflare/" sub="worker.js · wrangler.json" mono />

      <Arrow from={right(node)} to={left(nodeOut)} />
      <Arrow from={right(netlify)} to={left(netlifyOut)} />
      <Arrow from={right(cloudflare)} to={left(cloudflareOut)} />
    </Diagram>
  );
}
