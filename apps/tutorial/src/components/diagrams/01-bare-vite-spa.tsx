import { Arrow, At, Box, Diagram, left, right } from "./kit";

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
      caption="On save, Vite walks up the changed module's importers looking for an HMR boundary. If the boundary accepts the update, the module is hot-swapped; if there is no boundary, or the boundary invalidates itself, the page reloads."
      steps={[
        "You save src/main.tsx, and Vite's file watcher detects the change.",
        "Vite finds the changed module in the module graph and walks up its importers, looking for an HMR boundary.",
        "A boundary is a module that registered an import.meta.hot.accept() handler. @vitejs/plugin-react adds one to every module that declares a component; when the new module's exports are all components, Fast Refresh swaps them with no state loss.",
        "main.tsx declares App, so it is its own boundary and Vite sends an update. But it exports nothing, so the Fast Refresh runtime calls import.meta.hot.invalidate(); the update bubbles to index.html, and Vite falls back to a full page reload.",
      ]}
    >
      <At step={1}>
        <Box {...save} label="save" sub="src/main.tsx" />
        <Box {...watcher} label="file watcher" sub="change event" />
        <Arrow from={right(save)} to={left(watcher)} />
      </At>

      <At step={2}>
        <Box {...graph} label="module graph" sub="walk up importers" tone="accent" />
        <Arrow from={right(watcher)} to={left(graph)} />
      </At>

      <At step={3}>
        <Box {...hot} label="hot update" sub="state kept" tone="accent" />
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
      </At>

      <At step={4}>
        <Box {...reload} label="full reload" sub="state lost" tone="ghost" />
        <Arrow
          from={right(graph)}
          via={[
            [ELBOW, 88],
            [ELBOW, 138],
          ]}
          to={left(reload)}
          label="invalidate()"
          mono
          labelAt={2}
        />
      </At>
    </Diagram>
  );
}
