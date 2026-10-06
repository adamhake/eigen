import { Arrow, Box, Diagram, left, right } from "./kit";

const run = { x: 16, y: 128, w: 180, h: 64 };
const get = { x: 246, y: 128, w: 160, h: 64 };
const fresh = { x: 470, y: 22, w: 234, h: 76 };
const stale = { x: 470, y: 122, w: 234, h: 76 };
const miss = { x: 470, y: 222, w: 234, h: 76 };
const ELBOW = 438;

export function CacheRunDiagram() {
  return (
    <Diagram
      width={720}
      height={312}
      caption="__cache_run looks the key up and branches on the entry's age: fresh entries return directly, stale ones return immediately while a background fill refreshes them, and misses run the function."
    >
      <Box {...run} label="__cache_run()" sub="key = fnId + args" mono />
      <Box {...get} label="store.get(key)" sub="entry age?" mono />
      <Box {...fresh} label="fresh hit" sub={"age < revalidate\nreturn cached value"} tone="muted" />
      <Box {...stale} label="stale hit" sub={"age < expire\nreturn now, refill in bg"} tone="accent" />
      <Box {...miss} label="miss or expired" sub={"run fn in cache scope\nstore.set, then return"} />

      <Arrow from={right(run)} to={left(get)} />
      <Arrow
        from={right(get, -12)}
        via={[
          [ELBOW, get.y + get.h / 2 - 12],
          [ELBOW, fresh.y + fresh.h / 2],
        ]}
        to={left(fresh)}
      />
      <Arrow from={right(get)} to={left(stale)} tone="accent" />
      <Arrow
        from={right(get, 12)}
        via={[
          [ELBOW, get.y + get.h / 2 + 12],
          [ELBOW, miss.y + miss.h / 2],
        ]}
        to={left(miss)}
      />
    </Diagram>
  );
}
