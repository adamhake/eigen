import { Diagram, Lifeline, Message, Note } from "./kit";

const BROWSER = 80;
const NAV = 250;
const ROUTER = 440;
const SERVER = 630;
const BOTTOM = 486;

export function NavigateLifecycleDiagram() {
  return (
    <Diagram
      width={720}
      height={BOTTOM + 10}
      caption="Every navigation becomes a navigate event; the router decides before calling intercept(), and the browser owns the URL, the transition and its abort signal until the handler settles."
    >
      <Lifeline x={BROWSER} bottom={BOTTOM} label="Browser" />
      <Lifeline x={NAV} bottom={BOTTOM} label="navigation" mono />
      <Lifeline x={ROUTER} bottom={BOTTOM} label="Eigen router" />
      <Lifeline x={SERVER} bottom={BOTTOM} label="Server" />

      <Message from={BROWSER} to={NAV} y={86} label="click <a href>" mono />
      <Message from={NAV} to={ROUTER} y={136} label="navigate event" />
      <Note x={ROUTER + 12} y={150} w={166} text="matchRoute() first" />

      <Message from={ROUTER} to={NAV} y={200} label="intercept({ handler })" mono tone="accent" />
      <Message from={NAV} to={BROWSER} y={250} label="URL + transition" />

      <Message from={ROUTER} to={SERVER} y={300} label="GET /_eigen/data" mono />
      <Note x={ROUTER + 12} y={312} w={166} text="event.signal aborts it" />
      <Message from={SERVER} to={ROUTER} y={372} label="JSON" dashed mono />

      <Message from={ROUTER} to={NAV} y={422} label="handler resolves" />
      <Message from={NAV} to={BROWSER} y={466} label="navigatesuccess" mono />
    </Diagram>
  );
}
