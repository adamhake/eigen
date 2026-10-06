import { Arrow, bottom, Box, Diagram, left, right, top } from "./kit";

const ROW1 = 24;
const ROW2 = 168;
const W = 188;
const H = 72;
const COL = [4, 266, 528];

const source = { x: COL[0], y: ROW1, w: W, h: H };
const load = { x: COL[1], y: ROW1, w: W, h: H };
const cache = { x: COL[2], y: ROW1, w: W, h: H };
const image = { x: COL[0], y: ROW2, w: W, h: H };
const mod = { x: COL[1], y: ROW2, w: W, h: H };
const assets = { x: COL[2], y: ROW2, w: W, h: H };

export function ImagePipelineDiagram() {
  return (
    <Diagram
      width={720}
      height={256}
      caption="An ?eigen-image import is processed by sharp into WebP variants, which are handed to Vite's asset pipeline via ?url so the generated module exports hashed public URLs for the srcset."
    >
      <Box {...source} label="hero.jpg" sub={"?eigen-image\nimport in a page"} mono />
      <Box {...load} label="load() + sharp" sub={"blur JPEG +\nWebP per width"} tone="accent" />
      <Box {...cache} label="WebP variants" sub={"node_modules/.eigen/\nimages/hero-<hash>-640w"} />
      <Box {...assets} label="Vite asset pipeline" sub={"hashed, base-aware\n/assets/…webp"} />
      <Box {...mod} label="generated module" sub={"export default\n{ src, srcSet, … }"} />
      <Box {...image} label="<Image>" sub={"srcset + sizes,\nblur placeholder"} mono />

      <Arrow from={right(source)} to={left(load)} label="resolveId" mono />
      <Arrow from={right(load)} to={left(cache)} label="writes" />
      <Arrow from={bottom(cache)} to={top(assets)} label="import ?url" mono />
      <Arrow from={left(assets)} to={right(mod)} label="URLs" />
      <Arrow from={left(mod)} to={right(image)} label="props" />
    </Diagram>
  );
}
