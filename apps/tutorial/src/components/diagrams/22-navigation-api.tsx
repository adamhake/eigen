import { At, Diagram, Lifeline, Message, Note } from "./kit";

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
      steps={[
        "The user clicks the plain <a href> that Link renders. There's no onClick or preventDefault; the browser starts the navigation itself.",
        "The navigation object fires a navigate event. Eigen's handler calls matchRoute() before intercepting, so a route it doesn't know falls through to a normal page load.",
        "The router calls event.intercept() with an async handler. The browser commits to an SPA navigation, updates the URL, and exposes the work as navigation.transition.",
        "The handler fetches the loader data from /_eigen/data with event.signal, so a newer navigation aborts this fetch automatically.",
        "The handler sets the new pathname and data in a React transition and resolves once React has committed them. Only then does the browser fire navigatesuccess and settle focus and scroll, against the new page.",
      ]}
    >
      <Lifeline x={BROWSER} bottom={BOTTOM} label="Browser" />
      <Lifeline x={NAV} bottom={BOTTOM} label="navigation" mono />
      <Lifeline x={ROUTER} bottom={BOTTOM} label="Eigen router" />
      <Lifeline x={SERVER} bottom={BOTTOM} label="Server" />

      <At step={1}>
        <Message from={BROWSER} to={NAV} y={86} label="click <a href>" mono />
      </At>

      <At step={2}>
        <Message from={NAV} to={ROUTER} y={136} label="navigate event" />
        <Note x={ROUTER + 12} y={150} w={166} text="matchRoute() first" />
      </At>

      <At step={3}>
        <Message from={ROUTER} to={NAV} y={200} label="intercept({ handler })" mono tone="accent" />
        <Message from={NAV} to={BROWSER} y={250} label="URL + transition" />
      </At>

      <At step={4}>
        <Message from={ROUTER} to={SERVER} y={300} label="GET /_eigen/data" mono />
        <Note x={ROUTER + 12} y={312} w={166} text="event.signal aborts it" />
        <Message from={SERVER} to={ROUTER} y={372} label="JSON" dashed mono />
      </At>

      <At step={5}>
        <Message from={ROUTER} to={NAV} y={422} label="resolves after commit" />
        <Message from={NAV} to={BROWSER} y={466} label="navigatesuccess" mono />
      </At>
    </Diagram>
  );
}
