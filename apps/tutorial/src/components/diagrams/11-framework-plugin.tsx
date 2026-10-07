import { Arrow, At, bottom, Box, Diagram, left, Region, right, top } from "./kit";

/* ------------------------------------------------------------ buildApp order */

const viteBuild = { x: 4, y: 48, w: 112, h: 56 };
const pre = { x: 156, y: 48, w: 170, h: 56 };
const configHook = { x: 366, y: 48, w: 150, h: 56 };
const post = { x: 556, y: 48, w: 150, h: 56 };

const buildClient = { x: 156, y: 136, w: 170, h: 56 };
const buildSsr = { x: 156, y: 216, w: 170, h: 56 };
const distClient = { x: 366, y: 136, w: 150, h: 56 };
const distServer = { x: 366, y: 216, w: 150, h: 56 };

export function BuildAppOrderDiagram() {
  return (
    <Diagram
      width={720}
      height={300}
      caption="A single vite build runs the buildApp hooks in order: Eigen's 'pre' hook builds the client and then the server, so 'post' hooks such as SSG and adapters find both outputs on disk."
      steps={[
        "With builder: {} set, a single vite build runs in app mode: it creates a ViteBuilder and runs the buildApp hooks, starting with order: 'pre'.",
        "Eigen's 'pre' handler builds the client environment first, which writes the assets and manifest.json to dist/client/.",
        "Then it builds the ssr environment into dist/server/. The server build can reference the client manifest because it's already on disk.",
        "Next comes the builder.buildApp config option, if the project sets one.",
        "Handlers with order: 'post' run last. Static pre-rendering and deployment adapters live here, so they find both builds already on disk.",
      ]}
    >
      <Region x={140} y={8} w={576} h={280} label="buildApp hooks, in order" />

      <At step={1}>
        <Box {...viteBuild} label="vite build" sub="builder: {}" mono />
        <Box {...pre} label="order: 'pre'" sub="eigen() plugin" mono tone="accent" />
        <Arrow from={right(viteBuild)} to={left(pre)} />
      </At>

      <At step={2}>
        <Box {...buildClient} label="build(client)" sub="first" mono tone="accent" />
        <Box {...distClient} label="dist/client/" sub="assets + manifest" mono />
        <Arrow from={bottom(pre)} to={top(buildClient)} />
        <Arrow from={right(buildClient)} to={left(distClient)} />
      </At>

      <At step={3}>
        <Box {...buildSsr} label="build(ssr)" sub="second" mono tone="accent" />
        <Box {...distServer} label="dist/server/" sub="entry-server.js" mono />
        <Arrow from={bottom(buildClient)} to={top(buildSsr)} />
        <Arrow from={right(buildSsr)} to={left(distServer)} />
      </At>

      <At step={4}>
        <Box {...configHook} label="builder.buildApp" sub="config option" mono tone="muted" />
        <Arrow from={right(pre)} to={left(configHook)} />
      </At>

      <At step={5}>
        <Box {...post} label="order: 'post'" sub="SSG, adapters" mono tone="ghost" />
        <Arrow from={right(configHook)} to={left(post)} />
        <Arrow from={right(distClient)} via={[[611, 164]]} to={bottom(post, -20)} dashed />
        <Arrow
          from={right(distServer)}
          via={[[651, 244]]}
          to={bottom(post, 20)}
          label="reads output"
          labelAt={0}
          dashed
        />
      </At>
    </Diagram>
  );
}

/* ------------------------------------------------------- three type layers */

const layerW = 216;
const layers = [4, 252, 500];
const boxW = 192;
const row1 = 48;
const row2 = 112;
const app = { x: 252, y: 234, w: 216, h: 56 };

export function TypeLayersDiagram() {
  const bx = (i: number) => layers[i] + (layerW - boxW) / 2;
  return (
    <Diagram
      width={720}
      height={304}
      caption="Application code imports from three layers: static types shipped in the package, project-specific types generated into node_modules/.eigen, and the virtual route module the plugin builds."
    >
      <Region x={layers[0]} y={8} w={layerW} h={170} label="1 · static (package)" />
      <Region x={layers[1]} y={8} w={layerW} h={170} label="2 · generated .d.ts" />
      <Region x={layers[2]} y={8} w={layerW} h={170} label="3 · virtual module" />

      <Box x={bx(0)} y={row1} w={boxW} h={52} label="PageProps" sub="<TPath, TData>" mono />
      <Box x={bx(0)} y={row2} w={boxW} h={52} label="LoaderFn" sub="RouteParams<TPath>" mono />

      <Box x={bx(1)} y={row1} w={boxW} h={52} label="RoutePaths" sub={"'/' | '/posts/:id'"} mono />
      <Box x={bx(1)} y={row2} w={boxW} h={52} label="RouteParamsMap" sub="path → params" mono />

      <Box x={bx(2)} y={row1} w={boxW} h={52} label="eigen/routes" sub="RouteDefinition[]" mono />
      <Box x={bx(2)} y={row2} w={boxW} h={52} label="load() hook" sub="code per environment" mono tone="ghost" />

      <Box {...app} label="Application code" sub="pages, loaders, Link" tone="accent" />

      <Arrow from={[112, 178]} via={[[112, 262]]} to={left(app)} label="import type" mono />
      <Arrow from={[360, 178]} to={top(app)} label="import type" mono />
      <Arrow from={[608, 178]} via={[[608, 262]]} to={right(app)} label="import" mono />
    </Diagram>
  );
}
