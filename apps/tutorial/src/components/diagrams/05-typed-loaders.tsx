import { Arrow, bottom, Box, Diagram, Lifeline, left, Message, Note, Region, right, top } from "./kit";

/* ------------------------------------------------- loader type inference */

const pathBox = { x: 24, y: 52, w: 160, h: 56 };
const mapBox = { x: 270, y: 52, w: 180, h: 56 };
const paramsBox = { x: 530, y: 52, w: 170, h: 56 };
const returnBox = { x: 24, y: 220, w: 160, h: 56 };
const tdataBox = { x: 270, y: 220, w: 180, h: 56 };
const dataBox = { x: 530, y: 220, w: 170, h: 56 };

export function LoaderTypeFlowDiagram() {
  return (
    <Diagram
      width={720}
      height={300}
      caption="defineLoader derives the params type from the path string and the component's data type from the loader's return value, with no annotations in between."
    >
      <Region x={4} y={8} w={712} h={120} label="params" />
      <Region x={4} y={176} w={712} h={116} label="data" />

      <Box {...pathBox} label={'"/posts/:id"'} sub="TPath literal" mono />
      <Box {...mapBox} label="RouteParamsMap" sub="generated .d.ts" mono />
      <Box {...paramsBox} label="{ id: string }" sub="params" mono tone="accent" />

      <Box {...returnBox} label="return { … }" sub="loader body" mono />
      <Box {...tdataBox} label="TData" sub="inferred" mono />
      <Box {...dataBox} label="data" sub="PageProps data prop" mono tone="accent" />

      <Arrow from={right(pathBox)} to={left(mapBox)} label="key" />
      <Arrow from={right(mapBox)} to={left(paramsBox)} label="lookup" />
      <Arrow
        from={bottom(paramsBox)}
        via={[
          [paramsBox.x + paramsBox.w / 2, 152],
          [returnBox.x + returnBox.w / 2, 152],
        ]}
        to={top(returnBox)}
        label="contextual type for ({ params })"
      />
      <Arrow from={right(returnBox)} to={left(tdataBox)} label="infer" />
      <Arrow from={right(tdataBox)} to={left(dataBox)} label="Awaited<…>" mono />
    </Diagram>
  );
}

/* ----------------------------------------- initial load vs client navigation */

const BROWSER = 240;
const SERVER = 440;
const LOADER = 630;
const NOTE_X = 16;
const NOTE_W = 150;

export function LoaderDataFetchDiagram() {
  return (
    <Diagram
      width={720}
      height={532}
      caption="The first visit gets loader data embedded in the HTML; every navigation after hydration asks the /_eigen/data endpoint, which runs the same loader on the server."
    >
      <Region x={4} y={48} w={712} h={214} label="Initial load (server-rendered)" />
      <Region x={4} y={278} w={712} h={240} label="Client navigation" tone="accent" />

      <Lifeline x={BROWSER} bottom={522} label="Browser" />
      <Lifeline x={SERVER} bottom={522} label="Server" />
      <Lifeline x={LOADER} bottom={522} label="loader()" mono />

      <Message from={BROWSER} to={SERVER} y={104} label="GET /posts/1" mono />
      <Message from={SERVER} to={LOADER} y={150} label="{ params }" mono />
      <Message from={LOADER} to={SERVER} y={196} label="post data" dashed />
      <Message from={SERVER} to={BROWSER} y={242} label="HTML + __EIGEN_DATA__" mono />
      <Note x={NOTE_X} y={208} w={NOTE_W} text={"hydrates with\nembedded data"} />

      <Note x={NOTE_X} y={312} w={NOTE_W} text={"Link click\n→ pushState"} tone="accent" />
      <Message from={BROWSER} to={SERVER} y={344} label="GET /_eigen/data" mono tone="accent" />
      <Message from={SERVER} to={LOADER} y={394} label="runLoader(path)" mono />
      <Message from={LOADER} to={SERVER} y={444} label="post data" dashed />
      <Message from={SERVER} to={BROWSER} y={494} label="JSON" tone="accent" />
      <Note x={NOTE_X} y={462} w={NOTE_W} text={"setData →\nre-render"} tone="accent" />
    </Diagram>
  );
}
