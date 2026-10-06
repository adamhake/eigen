import { Arrow, bottom, Box, Diagram, left, Region, right, top } from "./kit";

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
    >
      <Region x={4} y={16} w={346} h={112} label="buildApp · order: 'pre'" />
      <Region x={368} y={16} w={348} h={112} label="buildApp · order: 'post'" tone="accent" />

      <Box {...client} label="client build" sub="environment: client" />
      <Box {...ssr} label="ssr build" sub="environment: ssr" />
      <Box {...ssg} label="eigenSSG()" sub="pre-render pages" mono tone="accent" />
      <Box {...adapter} label="adapter" sub="e.g. nodeAdapter()" />

      <Arrow from={right(client)} to={left(ssr)} />
      <Arrow from={right(ssr)} to={left(ssg)} />
      <Arrow from={right(ssg)} to={left(adapter)} />

      <Box {...clientOut} label="dist/client/" sub={"index.html\nassets/"} mono tone="muted" />
      <Box {...ssrOut} label="dist/server/" sub={"entry-server.js"} mono tone="muted" />
      <Box {...ssgOut} label="template.html" sub={"page HTML\nprerendered.json"} mono tone="muted" />
      <Box
        {...adapterOut}
        label="platform files"
        sub={"server.mjs, or\n.netlify/v1/, or\nwrangler.json"}
        tone="muted"
      />

      <Arrow from={bottom(client)} to={top(clientOut)} />
      <Arrow from={bottom(ssr)} to={top(ssrOut)} />
      <Arrow from={bottom(ssg)} to={top(ssgOut)} />
      <Arrow from={bottom(adapter)} to={top(adapterOut)} />
    </Diagram>
  );
}
