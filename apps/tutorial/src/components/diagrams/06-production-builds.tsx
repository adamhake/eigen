import { Arrow, bottom, Box, Diagram, left, Region, right, top } from "./kit";

/* ------------------------------------------------------ dev vs production */

const devServer = { x: 270, y: 44, w: 180, h: 40 };
const clientGraph = { x: 40, y: 116, w: 180, h: 56 };
const ssrGraph = { x: 270, y: 116, w: 180, h: 56 };
const dataMw = { x: 500, y: 116, w: 180, h: 56 };

const build = { x: 30, y: 286, w: 160, h: 56 };
const distClient = { x: 260, y: 244, w: 200, h: 56 };
const distServer = { x: 260, y: 328, w: 200, h: 56 };
const prodServer = { x: 530, y: 286, w: 170, h: 56 };

export function DevVsProdBuildDiagram() {
  const fork = 100;
  const split = 225;
  const join = 495;
  return (
    <Diagram
      width={720}
      height={412}
      caption="In dev, one Vite server transforms both graphs on demand; in production, two builds write two directories and a plain H3 server reads them."
    >
      <Region x={4} y={8} w={712} h={180} label="Development (Part 5)" tone="default" />
      <Box {...devServer} label="Vite dev server" />
      <Box {...clientGraph} label="client graph" sub="on demand" tone="muted" />
      <Box {...ssrGraph} label="SSR graph" sub="module runner" tone="muted" />
      <Box {...dataMw} label="/_eigen/data" sub="plugin middleware" mono tone="muted" />
      <Arrow
        from={bottom(devServer)}
        via={[
          [360, fork],
          [130, fork],
        ]}
        to={top(clientGraph)}
      />
      <Arrow from={bottom(devServer)} to={top(ssrGraph)} />
      <Arrow
        from={bottom(devServer)}
        via={[
          [360, fork],
          [590, fork],
        ]}
        to={top(dataMw)}
      />

      <Region x={4} y={204} w={712} h={200} label="Production (this part)" tone="accent" />
      <Box {...build} label="vite build ×2" sub="client, then --ssr" />
      <Box {...distClient} label="dist/client/" sub="index.html + assets" mono />
      <Box {...distServer} label="dist/server/" sub="entry-server.js" mono />
      <Box {...prodServer} label="server.prod.ts" sub="H3, no Vite" mono tone="accent" />
      <Arrow
        from={right(build)}
        via={[
          [split, 314],
          [split, 272],
        ]}
        to={left(distClient)}
      />
      <Arrow
        from={right(build)}
        via={[
          [split, 314],
          [split, 356],
        ]}
        to={left(distServer)}
      />
      <Arrow
        from={right(distClient)}
        via={[
          [join, 272],
          [join, 302],
        ]}
        to={left(prodServer, -12)}
      />
      <Arrow
        from={right(distServer)}
        via={[
          [join, 356],
          [join, 326],
        ]}
        to={left(prodServer, 12)}
      />
    </Diagram>
  );
}

/* ------------------------------------------- why loaders survive the client build */

const entryChunk = { x: 20, y: 100, w: 220, h: 72 };
const defaultExport = { x: 350, y: 60, w: 330, h: 56 };
const loaderExport = { x: 350, y: 140, w: 330, h: 56 };

export function LazyChunkExportsDiagram() {
  return (
    <Diagram
      width={720}
      height={232}
      caption="React.lazy receives the whole module namespace from import(), so Rolldown can't prove the loader is unused and keeps it in the page chunk."
    >
      <Box {...entryChunk} label="index-a1b2.js" sub={"lazy(() => import(…))\nreads .default only"} mono />
      <Region x={320} y={16} w={380} h={200} label="posts/[id] page chunk" />
      <Box {...defaultExport} label="export default PostPage" sub="rendered on the client" mono />
      <Box {...loaderExport} label="export const loader" sub="never called, still shipped" mono tone="accent" />
      <Arrow from={right(entryChunk)} to={[320, 136]} label="import()" mono dashed />
    </Diagram>
  );
}

/* ------------------------------------------- data endpoint: dev vs production */

const COL1 = { x: 20, w: 110 };
const COL2 = { x: 170, w: 170 };
const COL3 = { x: 380, w: 170 };
const DEV_Y = 48;
const PROD_Y = 164;
const ROW_H = 52;
const runLoaderBox = { x: 596, y: DEV_Y, w: 116, h: PROD_Y + ROW_H - DEV_Y };

export function DataEndpointPortDiagram() {
  const dev1 = { ...COL1, y: DEV_Y, h: ROW_H };
  const dev2 = { ...COL2, y: DEV_Y, h: ROW_H };
  const dev3 = { ...COL3, y: DEV_Y, h: ROW_H };
  const prod1 = { ...COL1, y: PROD_Y, h: ROW_H };
  const prod2 = { ...COL2, y: PROD_Y, h: ROW_H };
  const prod3 = { ...COL3, y: PROD_Y, h: ROW_H };
  return (
    <Diagram
      width={720}
      height={236}
      caption="Only the glue changes between dev and production: both paths end in the same runLoader call and return the same JSON."
    >
      <Region x={4} y={8} w={562} h={104} label="Dev: Part 5" />
      <Region x={4} y={124} w={562} h={104} label="Prod: this part" tone="accent" />

      <Box {...dev1} label="Browser" />
      <Box {...dev2} label="plugin middleware" sub="/_eigen/data" />
      <Box {...dev3} label="runner.import()" sub="'eigen/routes'" mono />

      <Box {...prod1} label="Browser" />
      <Box {...prod2} label="H3 route" sub="/_eigen/data" tone="accent" />
      <Box {...prod3} label="loadData(path)" sub="entry-server.js" mono tone="accent" />

      <Box {...runLoaderBox} label="runLoader()" sub={"match →\nloader →\nJSON"} mono />

      <Arrow from={right(dev1)} to={left(dev2)} />
      <Arrow from={right(dev2)} to={left(dev3)} />
      <Arrow from={right(dev3)} to={[runLoaderBox.x, DEV_Y + ROW_H / 2]} />
      <Arrow from={right(prod1)} to={left(prod2)} />
      <Arrow from={right(prod2)} to={left(prod3)} />
      <Arrow from={right(prod3)} to={[runLoaderBox.x, PROD_Y + ROW_H / 2]} />
    </Diagram>
  );
}
