import { Arrow, bottom, Box, Diagram, left, Lifeline, Message, right, top } from "./kit";

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
    >
      <Box {...request} label="Request" sub="page · /_eigen/data · fn" />
      <Box {...session} label="getSession(request)" sub="cookie → session store" mono />
      <Box {...csrf} label="checkCSRF()" sub="POST: Origin + HMAC token" mono tone="accent" />
      <Box {...guard} label="protected route?" sub="segment-boundary match" />
      <Box {...context} label="context" sub="session, user, csrfToken" />

      <Box {...forbidden} label="403 Forbidden" sub="bad Origin or token" tone="ghost" />
      <Box {...login} label="302 /login" sub="?returnTo=/dashboard" tone="ghost" />
      <Box {...downstream} label="loaders, server fns" sub="ctx.user typed as User" />

      <Arrow from={bottom(request)} to={top(session)} />
      <Arrow from={bottom(session)} to={top(csrf)} label="session" />
      <Arrow from={bottom(csrf)} to={top(guard)} label="ok" />
      <Arrow from={bottom(guard)} to={top(context)} label="ok" />

      <Arrow from={right(csrf)} to={left(forbidden)} label="fail" />
      <Arrow from={right(guard)} to={left(login)} label="no session" />
      <Arrow from={right(context)} to={left(downstream)} label="merged" />
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
    >
      <Lifeline x={BROWSER} bottom={646} label="Browser" />
      <Lifeline x={SERVER} bottom={646} label="Server" />
      <Lifeline x={STORE} bottom={646} label="Session store" w={150} />

      <Message from={BROWSER} to={SERVER} y={86} label="POST /api/login" mono />
      <Message from={SERVER} to={STORE} y={136} label="createSession()" mono />
      <Message from={SERVER} to={BROWSER} y={186} label="303 + Set-Cookie __Host-session" tone="accent" />

      <Message from={BROWSER} to={SERVER} y={256} label="GET /dashboard + cookie" />
      <Message from={SERVER} to={STORE} y={306} label="findSession(id)" mono />
      <Message from={SERVER} to={BROWSER} y={356} label="HTML + csrfToken" />

      <Message from={BROWSER} to={SERVER} y={426} label="POST /_eigen/fn + X-Eigen-CSRF" mono />
      <Message from={SERVER} to={BROWSER} y={476} label="JSON (token verified)" />

      <Message from={BROWSER} to={SERVER} y={546} label="POST /api/logout" mono />
      <Message from={SERVER} to={STORE} y={596} label="deleteSession(id)" mono />
      <Message from={SERVER} to={BROWSER} y={636} label="Set-Cookie Max-Age=0" />
    </Diagram>
  );
}
