import { Arrow, bottom, Box, Diagram, left, Region, right, top } from "./kit";

const browser = { x: 4, y: 66, w: 140, h: 60 };
const resolveId = { x: 178, y: 64, w: 150, h: 64 };
const load = { x: 362, y: 64, w: 150, h: 64 };
const transform = { x: 546, y: 64, w: 150, h: 64 };

export function PluginPipelineDiagram() {
  return (
    <Diagram
      width={720}
      height={222}
      caption="Every module request runs the same three hooks: resolveId names the module, load produces its source, transform rewrites it for the browser."
    >
      <Region x={158} y={20} w={554} h={140} label="Vite plugin pipeline" tone="accent" />
      <Box {...browser} label="Browser" sub={"import './App.tsx'"} />
      <Box {...resolveId} label="resolveId()" sub="which module is this?" mono tone="accent" />
      <Box {...load} label="load()" sub="what's in it?" mono tone="accent" />
      <Box {...transform} label="transform()" sub="TSX → plain JS" mono tone="accent" />

      <Arrow from={right(browser)} to={left(resolveId, 0)} label="GET" />
      <Arrow from={right(resolveId)} to={left(load)} label="id" mono />
      <Arrow from={right(load)} to={left(transform)} label="code" mono />
      <Arrow
        from={bottom(transform)}
        via={[
          [transform.x + transform.w / 2, 196],
          [browser.x + browser.w / 2, 196],
        ]}
        to={bottom(browser)}
        label="JavaScript module (ESM)"
      />
    </Diagram>
  );
}

/* ------------------------------------------------- dev server vs. build */

const devBrowser = { x: 80, y: 48, w: 200, h: 44 };
const devServer = { x: 80, y: 158, w: 200, h: 56 };
const devFile = { x: 80, y: 270, w: 200, h: 44 };

const buildGraph = { x: 440, y: 48, w: 200, h: 44 };
const rolldown = { x: 440, y: 158, w: 200, h: 56 };
const dist = { x: 440, y: 270, w: 200, h: 44 };

export function ViteDualityDiagram() {
  return (
    <Diagram
      width={720}
      height={340}
      caption="In dev, the browser pulls one module at a time through the dev server; in a build, Rolldown processes the whole graph up front and writes static files."
    >
      <Region x={8} y={8} w={344} h={320} label="vite (dev)" />
      <Region x={368} y={8} w={344} h={320} label="vite build" />

      <Box {...devBrowser} label="Browser" />
      <Box {...devServer} label="Dev server" sub="transforms on request" tone="accent" />
      <Box {...devFile} label="src/App.tsx" sub="one file at a time" mono />

      <Arrow from={bottom(devBrowser, -50)} to={top(devServer, -50)} label="GET /App.tsx" mono />
      <Arrow from={top(devServer, 50)} to={bottom(devBrowser, 50)} label="1 ESM module" />
      <Arrow from={bottom(devServer)} to={top(devFile)} label="reads" />

      <Box {...buildGraph} label="Whole module graph" sub="src + node_modules" />
      <Box {...rolldown} label="Rolldown" sub="bundle · split · minify" tone="accent" />
      <Box {...dist} label="dist/" sub="hashed static files" mono />

      <Arrow from={bottom(buildGraph)} to={top(rolldown)} label="all at once" />
      <Arrow from={bottom(rolldown)} to={top(dist)} label="writes" />
    </Diagram>
  );
}

/* ------------------------------------------- one plugin, two environments */

const plugin = { x: 235, y: 16, w: 250, h: 56 };
const clientCode = { x: 40, y: 150, w: 280, h: 56 };
const clientTarget = { x: 80, y: 240, w: 200, h: 44 };
const ssrCode = { x: 400, y: 150, w: 280, h: 56 };
const ssrTarget = { x: 440, y: 240, w: 200, h: 44 };

export function EnvironmentSplitDiagram() {
  return (
    <Diagram
      width={720}
      height={310}
      caption="The same plugin hook runs once per environment and generates different code for each: lazy imports for the browser, static imports with loaders for the server."
    >
      <Box {...plugin} label="your plugin" sub="load('eigen/routes')" tone="accent" />

      <Region x={8} y={110} w={344} h={190} label="client environment" />
      <Region x={368} y={110} w={344} h={190} label="ssr environment" />

      <Box {...clientCode} label="React.lazy(import())" sub="code-split pages" mono />
      <Box {...clientTarget} label="Browser" sub="over HTTP" />
      <Box {...ssrCode} label="import * as RouteMod0" sub="static, with loaders" mono />
      <Box {...ssrTarget} label="ModuleRunner" sub="in the Node process" />

      <Arrow
        from={bottom(plugin, -60)}
        via={[
          [plugin.x + plugin.w / 2 - 60, 92],
          [clientCode.x + clientCode.w / 2, 92],
        ]}
        to={top(clientCode)}
        label="client"
        labelAt={1}
        mono
        tone="accent"
      />
      <Arrow
        from={bottom(plugin, 60)}
        via={[
          [plugin.x + plugin.w / 2 + 60, 92],
          [ssrCode.x + ssrCode.w / 2, 92],
        ]}
        to={top(ssrCode)}
        label="ssr"
        labelAt={1}
        mono
        tone="accent"
      />
      <Arrow from={bottom(clientCode)} to={top(clientTarget)} />
      <Arrow from={bottom(ssrCode)} to={top(ssrTarget)} />
    </Diagram>
  );
}
