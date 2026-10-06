import { Arrow, bottom, Box, Diagram, left, Region, right, top } from "./kit";

/* ------------------------------------------------------ workspace resolution */

const demo = { x: 8, y: 52, w: 160, h: 60 };
const link = { x: 196, y: 52, w: 160, h: 60 };
const exportsMap = { x: 396, y: 52, w: 124, h: 60 };
const dist = { x: 552, y: 52, w: 146, h: 60 };
const source = { x: 396, y: 160, w: 124, h: 56 };

export function WorkspaceResolutionDiagram() {
  return (
    <Diagram
      width={720}
      height={240}
      caption="A workspace import resolves exactly like a published one: the symlinked package's exports map points at dist/, which tsdown --watch keeps rebuilt from the source files."
    >
      <Box {...demo} label="apps/demo" sub="import 'eigen/plugin'" mono />
      <Box {...link} label="node_modules/eigen" sub="symlink (workspace:*)" mono tone="muted" />

      <Region x={378} y={12} w={334} h={216} label="packages/eigen" />
      <Box {...exportsMap} label='exports "./*"' sub="package.json" mono tone="accent" />
      <Box {...dist} label="dist/plugin.js" sub="+ plugin.d.ts" mono />
      <Box {...source} label="plugin.ts" sub="source" mono tone="muted" />

      <Arrow from={right(demo)} to={left(link)} />
      <Arrow from={right(link)} to={left(exportsMap)} />
      <Arrow from={right(exportsMap)} to={left(dist)} tone="accent" />
      <Arrow from={right(source)} via={[[625, 188]]} to={bottom(dist)} dashed label="tsdown --watch" labelAt={1} mono />
    </Diagram>
  );
}

/* ---------------------------------------------------------- release pipeline */

const changeset = { x: 8, y: 60, w: 140, h: 56 };
const push = { x: 184, y: 60, w: 116, h: 56 };
const action = { x: 352, y: 60, w: 170, h: 56 };
const releasePr = { x: 352, y: 172, w: 158, h: 56 };
const publish = { x: 540, y: 172, w: 156, h: 56 };
const npm = { x: 540, y: 284, w: 156, h: 56 };

export function ReleasePipelineDiagram() {
  return (
    <Diagram
      width={720}
      height={354}
      caption="Changesets accumulate on main; CI turns pending ones into a release PR, and once that PR is merged the next run publishes to npm through trusted publishing, with provenance and no stored token."
    >
      <Box {...changeset} label="pnpm changeset" sub=".changeset/*.md" mono />
      <Box {...push} label="push to main" />

      <Region x={336} y={20} w={376} h={224} label="GitHub Actions" />
      <Box {...action} label="changesets/action" sub="pending changesets?" mono />
      <Box {...releasePr} label="release PR" sub="versions + CHANGELOG" />
      <Box {...publish} label="changeset publish" sub="OIDC token" mono tone="accent" />

      <Box {...npm} label="npm registry" sub="+ provenance" tone="accent" />

      <Arrow from={right(changeset)} to={left(push)} />
      <Arrow from={right(push)} to={left(action)} label="CI" />
      <Arrow from={bottom(action, -6)} to={top(releasePr)} label="pending" />
      <Arrow from={right(action)} via={[[618, 88]]} to={top(publish)} label="none left" />
      <Arrow from={left(releasePr)} via={[[242, 200]]} to={bottom(push)} label="merge" />
      <Arrow from={bottom(publish)} to={top(npm)} tone="accent" label="trusted publish" />
    </Diagram>
  );
}
