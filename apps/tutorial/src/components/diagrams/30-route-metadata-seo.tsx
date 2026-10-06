import { Arrow, bottom, Box, Diagram, left, right, top } from "./kit";

const layout = { x: 4, y: 24, w: 200, h: 64 };
const page = { x: 4, y: 124, w: 200, h: 64 };
const loader = { x: 4, y: 236, w: 200, h: 56 };
const merge = { x: 268, y: 74, w: 170, h: 64 };
const render = { x: 486, y: 74, w: 230, h: 64 };
const head = { x: 486, y: 200, w: 230, h: 72 };

export function MetadataMergeDiagram() {
  return (
    <Diagram
      width={720}
      height={308}
      caption="Layout metadata is merged first and the page's generateMetadata result (built from its loader data) is merged on top, then rendered once into the head placeholder."
    >
      <Box {...layout} label="layout.tsx" sub="metadata (static)" mono />
      <Box {...page} label="posts/[id].tsx" sub="generateMetadata()" mono />
      <Box {...loader} label="loader" sub="Post data" mono tone="muted" />
      <Box {...merge} label="deepMerge()" sub="child wins" mono tone="accent" />
      <Box {...render} label="renderMetadataToHTML" sub="escape + serializeForScript" mono />
      <Box {...head} label="<!--eigen-head-->" sub={"<title>, og:*, canonical,\nJSON-LD"} mono />

      <Arrow from={top(loader)} to={bottom(page)} label="data" />
      <Arrow
        from={right(layout)}
        via={[
          [236, 56],
          [236, 96],
        ]}
        to={left(merge, -10)}
      />
      <Arrow
        from={right(page)}
        via={[
          [236, 156],
          [236, 116],
        ]}
        to={left(merge, 10)}
      />
      <Arrow from={right(merge)} to={left(render)} label="merged" />
      <Arrow from={bottom(render)} to={top(head)} label="tags" />
    </Diagram>
  );
}
