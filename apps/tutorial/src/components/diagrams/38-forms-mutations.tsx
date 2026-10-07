import { Arrow, At, bottom, Box, Diagram, Region, top } from "./kit";

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
      steps={[
        "On the server, <Form> renders a plain <form method=post> whose action is the server function's URL. Submitted without JavaScript, it sends a urlencoded POST that the endpoint's new form branch picks up.",
        "handleFormSubmission reads the fields with formData(), runs the global middleware, and calls the server function. It answers with a 303 See Other, to the redirect() target or back to the form's page, and the browser follows with a GET.",
        "After hydration, <Form> renders a React form action instead. React calls it in a transition with the FormData, and it calls the client stub, which POSTs JSON.",
        "That request takes Part 15's JSON path to the same server function. Both paths hand the validator the same plain object built from the form fields.",
      ]}
    >
      <Region x={8} y={8} w={344} h={236} label="without JavaScript" />
      <Region x={368} y={8} w={344} h={236} label="after hydration" />

      <At step={1}>
        <Box {...noJsForm} label="<form method=post>" sub="action = fn.url" mono />
        <Box {...formBranch} label="form branch" sub="formData() · 303 See Other" />
        <Arrow from={bottom(noJsForm)} to={top(formBranch)} label="urlencoded POST" />
      </At>

      <At step={2}>
        <Box {...handler} label="middleware → validator → handler" sub="one server function" tone="accent" />
        <Arrow from={bottom(formBranch)} to={top(handler, -180)} tone="accent" />
      </At>

      <At step={3}>
        <Box {...jsForm} label="<form action={fn}>" sub="React form action" mono />
        <Box {...jsonBranch} label="JSON branch" sub="Response.json()" />
        <Arrow from={bottom(jsForm)} to={top(jsonBranch)} label="stub: fetch JSON" />
      </At>

      <At step={4}>
        <Arrow from={bottom(jsonBranch)} to={top(handler, 180)} tone="accent" />
      </At>
    </Diagram>
  );
}
