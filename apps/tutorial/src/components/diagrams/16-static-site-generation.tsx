import { Arrow, At, bottom, Box, Diagram, left, Region, right, top } from "./kit";

const Y = 56;
const H = 60;
const W = 150;
const client = { x: 12, y: Y, w: W, h: H };
const ssr = { x: 192, y: Y, w: W, h: H };
const ssg = { x: 380, y: Y, w: W, h: H };
const adapter = { x: 560, y: Y, w: W, h: H };

const OY = 164;
const OH = 80;
const clientOut = { x: 12, y: OY, w: W, h: OH };
const ssrOut = { x: 192, y: OY, w: W, h: OH };
const ssgOut = { x: 380, y: OY, w: W, h: OH };
const adapterOut = { x: 560, y: OY, w: W, h: OH };

export function SsgBuildOrderDiagram() {
  return (
    <Diagram
      width={720}
      height={260}
      caption="One vite build: eigen()'s pre hook builds client then ssr, then the post hooks run one at a time in plugin order — SSG writes pages before the adapter packages them."
      steps={[
        "eigen()'s order: 'pre' buildApp hook builds the client environment first, writing index.html and the hashed assets to dist/client/.",
        "It then builds the ssr environment, which puts entry-server.js in dist/server/.",
        "eigenSSG() runs as an order: 'post' hook, so both builds are on disk. It saves index.html as dist/server/template.html, pre-renders each path with renderStream, and lists them in prerendered.json.",
        "A deployment adapter listed after it runs next. Vite awaits each post hook in plugin order, so the adapter packages the finished pages instead of racing them.",
      ]}
    >
      <Region x={4} y={16} w={346} h={112} label="buildApp · order: 'pre'" />
      <Region x={368} y={16} w={348} h={112} label="buildApp · order: 'post'" tone="accent" />

      <At step={1}>
        <Box {...client} label="client build" sub="environment: client" />
        <Box {...clientOut} label="dist/client/" sub={"index.html\nassets/"} mono tone="muted" />
        <Arrow from={bottom(client)} to={top(clientOut)} />
      </At>

      <At step={2}>
        <Box {...ssr} label="ssr build" sub="environment: ssr" />
        <Box {...ssrOut} label="dist/server/" sub={"entry-server.js"} mono tone="muted" />
        <Arrow from={right(client)} to={left(ssr)} />
        <Arrow from={bottom(ssr)} to={top(ssrOut)} />
      </At>

      <At step={3}>
        <Box {...ssg} label="eigenSSG()" sub="pre-render pages" mono tone="accent" />
        <Box {...ssgOut} label="template.html" sub={"page HTML\nprerendered.json"} mono tone="muted" />
        <Arrow from={right(ssr)} to={left(ssg)} />
        <Arrow from={bottom(ssg)} to={top(ssgOut)} />
      </At>

      <At step={4}>
        <Box {...adapter} label="adapter" sub="e.g. nodeAdapter()" />
        <Box
          {...adapterOut}
          label="platform files"
          sub={"server.mjs, or\n.netlify/v1/, or\nwrangler.json"}
          tone="muted"
        />
        <Arrow from={right(ssg)} to={left(adapter)} />
        <Arrow from={bottom(adapter)} to={top(adapterOut)} />
      </At>
    </Diagram>
  );
}
