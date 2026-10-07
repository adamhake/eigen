import { Arrow, At, Box, Diagram, Lifeline, Message, Note, Region } from "./kit";

export function SegmentCacheDiagram() {
  return (
    <Diagram
      width={720}
      height={330}
      caption="Two links to sibling pages need four segments, not six: the layouts are cached once and shared, and only the page segments are per URL."
    >
      <Box x={60} y={24} w={200} h={44} label="<Link> /shop/1" mono />
      <Box x={460} y={24} w={200} h={44} label="<Link> /shop/2" mono />

      <Region x={40} y={92} w={640} h={226} label="Client segment cache" />
      <Box x={260} y={114} w={200} h={46} label="layout /" sub="shared, fetched once" mono tone="accent" />
      <Box x={260} y={184} w={200} h={46} label="layout /shop" sub="shared, fetched once" mono tone="accent" />
      <Box x={60} y={254} w={200} h={46} label="page:/shop/1" sub="shell, per URL" mono tone="muted" />
      <Box x={460} y={254} w={200} h={46} label="page:/shop/2" sub="shell, per URL" mono tone="muted" />

      {/* Enter the cache region right of its label */}
      <Arrow from={[230, 68]} via={[[230, 137]]} to={[260, 137]} />
      <Arrow from={[490, 68]} via={[[490, 137]]} to={[460, 137]} />
      <Arrow from={[360, 160]} to={[360, 184]} />
      <Arrow from={[260, 207]} via={[[160, 207]]} to={[160, 254]} label="Outlet" mono />
      <Arrow from={[460, 207]} via={[[560, 207]]} to={[560, 254]} label="Outlet" mono />
    </Diagram>
  );
}

const BROWSER = 150;
const CACHE = 370;
const SERVER = 590;

export function InstantNavigationDiagram() {
  return (
    <Diagram
      width={720}
      height={380}
      caption="A prefetch fills the cache with segment shells before the click, so the click renders at once and only the page's holes wait for the server."
      steps={[
        "A link to /shop/2 scrolls into view. The scheduler matches it against the route manifest and asks only for the segments the cache is missing: here, the page.",
        "The server prerenders the page segment, aborts once the cached work has settled, and answers with a halted payload marked partial, plus its stale time.",
        "The user clicks. The router reads every segment from the cache and commits at once: layouts, cached content and Suspense fallbacks paint without waiting.",
        "The page segment was partial, so the click also starts a full render of that one segment.",
        "The full payload streams back. The router swaps it in for the shell, and the holes fill without re-sending the layouts.",
      ]}
    >
      <Lifeline x={BROWSER} bottom={370} label="Browser" />
      <Lifeline x={CACHE} bottom={370} label="segment cache" mono />
      <Lifeline x={SERVER} bottom={370} label="/_eigen/segment" mono />

      <At step={1}>
        <Message from={BROWSER} to={SERVER} y={88} label="page:/shop/2 (partial)" mono />
      </At>
      <At step={2}>
        <Message from={SERVER} to={CACHE} y={140} label="shell, stale: 300" tone="accent" mono />
      </At>
      <At step={3}>
        <Message from={CACHE} to={BROWSER} y={200} label="all segments" tone="accent" />
        <Note x={8} y={182} w={120} text={"click: paints\nimmediately"} tone="accent" />
      </At>
      <At step={4}>
        <Message from={BROWSER} to={SERVER} y={256} label="page:/shop/2 (full)" mono />
      </At>
      <At step={5}>
        <Message from={SERVER} to={BROWSER} y={320} label="full page payload" dashed />
        <Note x={8} y={302} w={120} text="holes fill in" />
      </At>
    </Diagram>
  );
}
