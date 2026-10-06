import { Arrow, bottom, Box, Diagram, left, Region, right, top } from "./kit";

/* Build time (top row) */
const page = { x: 24, y: 48, w: 150, h: 60 };
const viteBuild = { x: 216, y: 48, w: 130, h: 60 };
const manifest = { x: 388, y: 48, w: 308, h: 60 };

/* Request time (bottom row) */
const request = { x: 24, y: 196, w: 140, h: 60 };
const match = { x: 204, y: 196, w: 140, h: 60 };
const collect = { x: 388, y: 196, w: 150, h: 60 };
const head = { x: 580, y: 196, w: 120, h: 60 };

export function CssManifestFlowDiagram() {
  return (
    <Diagram
      width={720}
      height={280}
      caption="At build time Vite records each module's CSS files in the SSR manifest; at request time the matched route's module ID looks them up, so the <head> links the page's stylesheets before the shell streams."
    >
      <Region x={8} y={8} w={704} h={110} label="build time" />
      <Box {...page} label="Dashboard.tsx" sub="imports .module.css" mono />
      <Box {...viteBuild} label="vite build" sub="client env" />
      <Box {...manifest} label="ssr-manifest.json" sub="moduleId → /assets/*.css" mono />
      <Arrow from={right(page)} to={left(viteBuild)} />
      <Arrow from={right(viteBuild)} to={left(manifest)} label="writes" />

      <Region x={8} y={156} w={704} h={112} label="request time" tone="accent" />
      <Box {...request} label="Request" sub="GET /dashboard" />
      <Box {...match} label="matchRoute" sub="route.moduleId" mono />
      <Box {...collect} label="collectCss()" sub="manifest lookup" mono tone="accent" />
      <Box {...head} label="SSR <head>" sub="<link> tags" mono />
      <Arrow from={right(request)} to={left(match)} />
      <Arrow from={right(match)} to={left(collect)} label="ids" />
      <Arrow from={right(collect)} to={left(head)} tone="accent" label="hrefs" />

      <Arrow
        from={bottom(manifest, -79)}
        to={top(collect)}
        dashed
        label="read once at startup"
        labelOffset={[0, -15]}
      />
    </Diagram>
  );
}
