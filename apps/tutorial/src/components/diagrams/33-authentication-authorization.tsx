import { Arrow, At, bottom, Box, Diagram, left, Lifeline, Message, right, top } from "./kit";

const COL_X = 60;
const COL_W = 280;
const H = 56;
const step = (y: number) => ({ x: COL_X, y, w: COL_W, h: H });

const request = step(16);
const session = step(112);
const csrf = step(208);
const guard = step(304);
const context = step(400);

const OUT_X = 440;
const OUT_W = 260;
const forbidden = { x: OUT_X, y: 208, w: OUT_W, h: H };
const login = { x: OUT_X, y: 304, w: OUT_W, h: H };
const downstream = { x: OUT_X, y: 400, w: OUT_W, h: H };

export function AuthMiddlewareFlowDiagram() {
  return (
    <Diagram
      width={720}
      height={472}
      caption="Every page, data and server-function request passes the auth middleware: it resolves the session, rejects cross-site writes, redirects anonymous visitors away from protected routes, and only then adds the session to the context."
      steps={[
        "A page render, a /_eigen/data fetch, and a server function call all pass through the same auth middleware in the global chain.",
        "getSession(request) reads the __Host-session cookie and looks the ID up in the session store. A missing, unknown, revoked, or expired ID comes back as the anonymous session.",
        "checkCSRF() requires state-changing requests to come from our own origin and carry a valid token. If either check fails, the middleware returns 403 before anything else runs.",
        "If the path matches a protected route on segment boundaries and the session isn't authenticated, redirect() sends the visitor to /login with a returnTo.",
        "Otherwise the middleware returns the session, user, and csrfToken. They're merged into the context, so loaders and server functions see ctx.user with the application's User type.",
      ]}
    >
      <At step={1}>
        <Box {...request} label="Request" sub="page · /_eigen/data · fn" />
      </At>

      <At step={2}>
        <Box {...session} label="getSession(request)" sub="cookie → session store" mono />
        <Arrow from={bottom(request)} to={top(session)} />
      </At>

      <At step={3}>
        <Box {...csrf} label="checkCSRF()" sub="POST: Origin + HMAC token" mono tone="accent" />
        <Box {...forbidden} label="403 Forbidden" sub="bad Origin or token" tone="ghost" />
        <Arrow from={bottom(session)} to={top(csrf)} label="session" />
        <Arrow from={right(csrf)} to={left(forbidden)} label="fail" />
      </At>

      <At step={4}>
        <Box {...guard} label="protected route?" sub="segment-boundary match" />
        <Box {...login} label="302 /login" sub="?returnTo=/dashboard" tone="ghost" />
        <Arrow from={bottom(csrf)} to={top(guard)} label="ok" />
        <Arrow from={right(guard)} to={left(login)} label="no session" />
      </At>

      <At step={5}>
        <Box {...context} label="context" sub="session, user, csrfToken" />
        <Box {...downstream} label="loaders, server fns" sub="ctx.user typed as User" />
        <Arrow from={bottom(guard)} to={top(context)} label="ok" />
        <Arrow from={right(context)} to={left(downstream)} label="merged" />
      </At>
    </Diagram>
  );
}

const BROWSER = 110;
const SERVER = 390;
const STORE = 630;

export function SessionCookieLifecycleDiagram() {
  return (
    <Diagram
      width={720}
      height={656}
      caption="The session cookie's life: login creates a server-side session and sets an HttpOnly cookie, each request resolves it, writes carry the CSRF token, and logout revokes the session and clears the cookie."
      steps={[
        "handleLogin verifies the password and calls createSession() for a new random session ID. The 303 response sets an HttpOnly __Host-session cookie that holds only that ID.",
        "The browser sends the cookie with later requests. getSession() looks the ID up with findSession(), so the user record and expiry stay on the server.",
        "The rendered page includes the csrfToken in the serialized session, an HMAC of the session ID. The session ID itself never reaches client code.",
        "State-changing requests such as server function calls send the token in the X-Eigen-CSRF header, and checkCSRF() verifies it before the handler runs.",
        "handleLogout deletes the session from the store, so even a copied cookie stops working, and clears the browser's cookie with Max-Age=0.",
      ]}
    >
      <Lifeline x={BROWSER} bottom={646} label="Browser" />
      <Lifeline x={SERVER} bottom={646} label="Server" />
      <Lifeline x={STORE} bottom={646} label="Session store" w={150} />

      <At step={1}>
        <Message from={BROWSER} to={SERVER} y={86} label="POST /api/login" mono />
        <Message from={SERVER} to={STORE} y={136} label="createSession()" mono />
        <Message from={SERVER} to={BROWSER} y={186} label="303 + Set-Cookie __Host-session" tone="accent" />
      </At>

      <At step={2}>
        <Message from={BROWSER} to={SERVER} y={256} label="GET /dashboard + cookie" />
        <Message from={SERVER} to={STORE} y={306} label="findSession(id)" mono />
      </At>
      <At step={3}>
        <Message from={SERVER} to={BROWSER} y={356} label="HTML + csrfToken" />
      </At>

      <At step={4}>
        <Message from={BROWSER} to={SERVER} y={426} label="POST /_eigen/fn + X-Eigen-CSRF" mono />
        <Message from={SERVER} to={BROWSER} y={476} label="JSON (token verified)" />
      </At>

      <At step={5}>
        <Message from={BROWSER} to={SERVER} y={546} label="POST /api/logout" mono />
        <Message from={SERVER} to={STORE} y={596} label="deleteSession(id)" mono />
        <Message from={SERVER} to={BROWSER} y={636} label="Set-Cookie Max-Age=0" />
      </At>
    </Diagram>
  );
}
