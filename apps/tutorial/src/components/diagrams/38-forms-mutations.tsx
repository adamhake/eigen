import { Arrow, bottom, Box, Diagram, Region, top } from "./kit";

const noJsForm = { x: 28, y: 48, w: 304, h: 60 };
const formBranch = { x: 28, y: 166, w: 304, h: 60 };
const jsForm = { x: 388, y: 48, w: 304, h: 60 };
const jsonBranch = { x: 388, y: 166, w: 304, h: 60 };
const handler = { x: 150, y: 288, w: 420, h: 60 };

export function FormEnhancementDiagram() {
  return (
    <Diagram
      width={720}
      height={362}
      caption="The same <Form> posts to the same server function either way: without JavaScript the browser sends form-encoded fields and follows a 303, after hydration React's form action calls the stub, which sends JSON."
    >
      <Region x={8} y={8} w={344} h={236} label="without JavaScript" />
      <Box {...noJsForm} label="<form method=post>" sub="action = fn.url" mono />
      <Box {...formBranch} label="form branch" sub="formData() · 303 See Other" />
      <Arrow from={bottom(noJsForm)} to={top(formBranch)} label="urlencoded POST" />

      <Region x={368} y={8} w={344} h={236} label="after hydration" />
      <Box {...jsForm} label="<form action={fn}>" sub="React form action" mono />
      <Box {...jsonBranch} label="JSON branch" sub="Response.json()" />
      <Arrow from={bottom(jsForm)} to={top(jsonBranch)} label="stub: fetch JSON" />

      <Box {...handler} label="middleware → validator → handler" sub="one server function" tone="accent" />
      <Arrow from={bottom(formBranch)} to={top(handler, -180)} tone="accent" />
      <Arrow from={bottom(jsonBranch)} to={top(handler, 180)} tone="accent" />
    </Diagram>
  );
}
