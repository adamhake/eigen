import { Arrow, Box, Diagram, left, right } from "./kit";

const save = { x: 8, y: 60, w: 110, h: 56 };
const watcher = { x: 148, y: 60, w: 130, h: 56 };
const graph = { x: 308, y: 60, w: 170, h: 56 };
const hot = { x: 600, y: 10, w: 112, h: 56 };
const reload = { x: 600, y: 110, w: 112, h: 56 };

const ELBOW = 500;

export function HmrPropagationDiagram() {
  return (
    <Diagram
      width={720}
      height={182}
      caption="On save, Vite walks up the changed module's importers looking for an HMR boundary; if it finds one the module is hot-swapped, otherwise the page reloads."
    >
      <Box {...save} label="save" sub="src/main.tsx" />
      <Box {...watcher} label="file watcher" sub="change event" />
      <Box {...graph} label="module graph" sub="walk up importers" tone="accent" />
      <Box {...hot} label="hot update" sub="state kept" tone="accent" />
      <Box {...reload} label="full reload" sub="state lost" tone="ghost" />

      <Arrow from={right(save)} to={left(watcher)} />
      <Arrow from={right(watcher)} to={left(graph)} />
      <Arrow
        from={right(graph)}
        via={[
          [ELBOW, 88],
          [ELBOW, 38],
        ]}
        to={left(hot)}
        label="hot.accept()"
        labelAt={2}
        mono
        tone="accent"
      />
      <Arrow
        from={right(graph)}
        via={[
          [ELBOW, 88],
          [ELBOW, 138],
        ]}
        to={left(reload)}
        label="no boundary"
        labelAt={2}
      />
    </Diagram>
  );
}
