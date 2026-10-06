import { Arrow, bottom, Box, Diagram, Region, top } from "./kit";

const W = 300;
const H = 52;
const LX = 30;
const RX = 390;
const ROWS = [60, 136, 212, 288];

const l = (i: number) => ({ x: LX, y: ROWS[i], w: W, h: H });
const r = (i: number) => ({ x: RX, y: ROWS[i], w: W, h: H });

export function NavigationModesDiagram() {
  return (
    <Diagram
      width={720}
      height={360}
      caption="An intercepted navigation stays in the same document, so a speculative prerender is never used; only a cross-document navigation can activate it."
    >
      <Region x={10} y={12} w={340} h={340} label="Intercepted route (SPA)" />
      <Region x={370} y={12} w={340} h={340} label="navigation = 'document'" tone="accent" />

      <Box {...l(0)} label="click <Link>" sub="navigate event fires" mono />
      <Box {...l(1)} label="event.intercept()" sub="same document; prerender unused" mono />
      <Box {...l(2)} label="fetch /_eigen/data" sub="or Part 23's hover preload" mono />
      <Box {...l(3)} label="startViewTransition()" sub="same-document animation" mono />

      <Box {...r(0)} label="hover link" sub="speculation rule matches" />
      <Box {...r(1)} label="prerender page" sub="hidden background page" tone="accent" />
      <Box {...r(2)} label="click, not intercepted" sub="cross-document navigation" />
      <Box {...r(3)} label="activate prerender" sub="@view-transition animates" tone="accent" />

      {[0, 1, 2].map((i) => (
        <g key={i}>
          <Arrow from={bottom(l(i))} to={top(l(i + 1))} />
          <Arrow from={bottom(r(i))} to={top(r(i + 1))} tone={i === 2 ? "accent" : "default"} />
        </g>
      ))}
    </Diagram>
  );
}
