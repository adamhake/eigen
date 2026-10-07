"use client";

import { Play, RotateCcw } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/cn";

import { buttonClass, Output, Playground, primaryButtonClass } from "./frame";

/*
 * Part 14's pipeline, simulated step for step. `executeMiddleware` runs the
 * list in order; each middleware may return an object (merged into ctx),
 * a Response (short-circuit), nothing (pass through), throw a redirect
 * (turned into a Response) or throw anything else (rethrown). There is no
 * next(): once the chain finishes, runRoute runs the loaders, and the
 * response goes straight back to the server without passing through any
 * middleware again.
 */

type Mode = "as-written" | "response" | "throw";
type Entry = "page" | "data";

interface Mw {
  id: string;
  name: string;
  scope: "global" | "route";
  /** Static context type after this middleware has run */
  typeAfter: string;
  /** What "as written" does, given whether the visitor is signed in */
  run: (ctx: Ctx) => Outcome;
}

type Ctx = { user?: { name: string } | null };

type Outcome =
  | { kind: "merge"; add: Record<string, unknown>; text: string }
  | { kind: "void"; text: string }
  | { kind: "response"; status: number; text: string }
  | { kind: "redirect"; location: string; text: string }
  | { kind: "error"; text: string };

const PATH = "/dashboard";

const MIDDLEWARE: Mw[] = [
  {
    id: "rate",
    name: "rateLimitMiddleware",
    scope: "global",
    typeAfter: "BaseContext",
    run: () => ({ kind: "void", text: "under 100 requests/min → returns nothing" }),
  },
  {
    id: "session",
    name: "sessionMiddleware",
    scope: "global",
    typeAfter: "BaseContext & { user: User | null }",
    run: (ctx) => {
      const user = ctx.user;
      return {
        kind: "merge",
        add: { user },
        text: user ? `returns { user: { name: "${user.name}" } }` : "no session cookie → returns { user: null }",
      };
    },
  },
  {
    id: "log",
    name: "(ctx) => console.log(…)",
    scope: "global",
    typeAfter: "BaseContext & { user: User | null }",
    run: (ctx) => ({
      kind: "void",
      text: `logs "${ctx.user?.name ?? "anonymous"} requested ${PATH}", returns nothing`,
    }),
  },
  {
    id: "auth",
    name: "requireAuth",
    scope: "route",
    typeAfter: "EigenContext",
    run: (ctx) =>
      ctx.user
        ? { kind: "void", text: "ctx.user is set → returns nothing" }
        : {
            kind: "redirect",
            location: `/login?returnTo=${encodeURIComponent(PATH)}`,
            text: `ctx.user is null → throws redirect("/login?returnTo=${encodeURIComponent(PATH)}")`,
          },
  },
];

const OVERRIDES: Record<Exclude<Mode, "as-written">, (mw: Mw) => Outcome> = {
  response: (mw) =>
    mw.id === "rate"
      ? { kind: "response", status: 429, text: 'returns new Response("Too Many Requests", { status: 429 })' }
      : { kind: "response", status: 403, text: 'returns new Response("Forbidden", { status: 403 })' },
  throw: () => ({ kind: "error", text: 'throws new Error("boom")' }),
};

type StageStatus = "ran" | "stopped" | "skipped";
interface Stage {
  label: string;
  scope: string;
  status: StageStatus;
  detail: string;
  ctxAfter?: string;
  typeAfter?: string;
}

interface Trace {
  stages: Stage[];
  result: string;
  tone: "accent" | "warning";
}

function fmtCtx(ctx: Ctx, includeUser: boolean): string {
  const base = `{ request, params: {}, pathname: "${PATH}"`;
  if (!includeUser) return `${base} }`;
  const u = ctx.user ? `{ name: "${ctx.user.name}" }` : "null";
  return `${base}, user: ${u} }`;
}

/** The executeMiddleware → runRoute → caller pipeline from Part 14 */
function simulate(signedIn: boolean, modes: Record<string, Mode>, entry: Entry): Trace {
  const stages: Stage[] = [];
  // What sessionMiddleware would find in the cookie
  const cookieUser = signedIn ? { name: "ada" } : null;
  let ctx: Ctx = {};
  let hasUser = false;
  let stop: Outcome | null = null;

  for (const mw of MIDDLEWARE) {
    const label = mw.name;
    const scope = mw.scope === "global" ? "global · src/middleware.ts" : "per-route · dashboard/index.tsx";
    if (stop) {
      stages.push({ label, scope, status: "skipped", detail: "never called" });
      continue;
    }
    const mode = modes[mw.id] ?? "as-written";
    const out = mode === "as-written" ? mw.run(mw.id === "session" ? { user: cookieUser } : ctx) : OVERRIDES[mode](mw);

    if (out.kind === "merge") {
      ctx = { ...ctx, ...(out.add as Ctx) };
      hasUser = true;
      stages.push({
        label,
        scope,
        status: "ran",
        detail: out.text,
        ctxAfter: fmtCtx(ctx, hasUser),
        typeAfter: mw.typeAfter,
      });
    } else if (out.kind === "void") {
      stages.push({
        label,
        scope,
        status: "ran",
        detail: out.text,
        ctxAfter: fmtCtx(ctx, hasUser),
        typeAfter: mw.typeAfter,
      });
    } else {
      stop = out;
      stages.push({ label, scope, status: "stopped", detail: out.text });
    }
  }

  const loaderLabel = "Loaders (layout + page, in parallel)";
  const renderLabel = entry === "page" ? "renderStream → HTML" : "loadData → JSON";

  if (stop) {
    stages.push({ label: loaderLabel, scope: "runRoute", status: "skipped", detail: "never called" });
    stages.push({ label: renderLabel, scope: "entry-server", status: "skipped", detail: "never called" });
    if (stop.kind === "error") {
      return {
        stages,
        tone: "warning",
        result:
          "executeMiddleware only catches RedirectResponse, so the Error is rethrown. It escapes runRoute and the server's error handling answers (a 500).",
      };
    }
    if (stop.kind === "redirect") {
      return {
        stages,
        tone: "warning",
        result:
          entry === "page"
            ? `302 Found\nLocation: ${stop.location}\n\nThe thrown RedirectResponse became { response }; renderStream returns it as-is.`
            : `204 No Content\nX-Eigen-Redirect: ${stop.location}\n\nasClientRedirect turned the 302 into a header the client router follows.`,
      };
    }
    if (stop.kind === "response") {
      return {
        stages,
        tone: "warning",
        result: `${stop.status} ${stop.status === 429 ? "Too Many Requests" : "Forbidden"}\n\nReturned as { response }; nothing after it ran.${
          entry === "data"
            ? " asClientRedirect only rewrites 3xx, so the router sees a non-OK status and falls back to a full page load of /dashboard."
            : ""
        }`,
      };
    }
  }

  stages.push({
    label: loaderLabel,
    scope: "runRoute",
    status: "ran",
    detail: "every loader receives { params, ctx } with ctx: EigenContext",
  });
  stages.push({
    label: renderLabel,
    scope: "entry-server",
    status: "ran",
    detail: entry === "page" ? "streams the page" : "Response.json(await resolveRouteData(data))",
  });
  return {
    stages,
    tone: "accent",
    result: `200 OK (${entry === "page" ? "text/html" : "application/json"})\n\nThe response goes straight back to the server: there is no next(), so no middleware runs after the loaders.`,
  };
}

function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useReducedMotion() {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

const MODE_LABEL: Record<Mode, string> = {
  "as-written": "As written",
  response: "Return a Response",
  throw: "Throw an Error",
};

export function MiddlewareOnionPlayground() {
  const uid = useId();
  const reduced = useReducedMotion();
  const [signedIn, setSignedIn] = useState(false);
  const [entry, setEntry] = useState<Entry>("page");
  const [modes, setModes] = useState<Record<string, Mode>>({});
  const [trace, setTrace] = useState<Trace | null>(null);
  // How many stages are revealed (animation cursor)
  const [shown, setShown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => clearInterval(timer.current ?? undefined), []);

  const reset = () => {
    clearInterval(timer.current ?? undefined);
    setTrace(null);
    setShown(0);
  };

  const send = () => {
    clearInterval(timer.current ?? undefined);
    const t = simulate(signedIn, modes, entry);
    setTrace(t);
    if (reduced) {
      setShown(t.stages.length);
      return;
    }
    setShown(1);
    let n = 1;
    timer.current = setInterval(() => {
      n++;
      setShown(n);
      if (n >= t.stages.length) clearInterval(timer.current ?? undefined);
    }, 550);
  };

  const done = trace !== null && shown >= trace.stages.length;
  const lastCtx = trace?.stages
    .slice(0, shown)
    .filter((s) => s.ctxAfter)
    .at(-1);

  return (
    <Playground
      title="The middleware pipeline for GET /dashboard"
      prompt="Sign in or out, make a middleware short-circuit or throw, then send the request and watch the context build up."
      caption="executeMiddleware runs global middleware, then the route's own, then runRoute calls the loaders. The first Response or thrown error stops everything after it."
    >
      <div className="grid gap-4">
        <fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-2">
          <legend className="sr-only">Request</legend>
          <label className="flex items-center gap-2 text-sm text-fd-foreground">
            <input
              type="checkbox"
              checked={signedIn}
              onChange={(e) => {
                setSignedIn(e.target.checked);
                reset();
              }}
              className="size-4 accent-fd-primary"
            />
            Request has a valid <code className="font-mono text-[0.85em]">session</code> cookie
          </label>
          <label className="flex flex-wrap items-center gap-2 text-sm text-fd-foreground">
            Sent by
            <select
              value={entry}
              onChange={(e) => {
                setEntry(e.target.value as Entry);
                reset();
              }}
              className="rounded-lg border border-fd-border bg-fd-background px-2 py-1 text-sm text-fd-foreground focus-visible:border-fd-primary focus-visible:ring-2 focus-visible:ring-fd-primary/25 focus-visible:outline-none"
            >
              <option value="page">typing the URL (HTML render)</option>
              <option value="data">a Link click (/_eigen/data)</option>
            </select>
          </label>
        </fieldset>

        <ol className="m-0 grid list-none gap-2 p-0" aria-label="Pipeline stages">
          {MIDDLEWARE.map((mw, i) => {
            const stage = trace && i < shown ? trace.stages[i] : undefined;
            return (
              <StageRow
                key={mw.id}
                index={i + 1}
                stage={stage}
                label={mw.name}
                scope={mw.scope === "global" ? "global" : "per-route"}
                active={!!trace && i === shown - 1 && !done}
              >
                <label className="flex flex-wrap items-center gap-2 text-xs text-fd-muted-foreground">
                  <span className="sr-only">{mw.name} behaviour</span>
                  <select
                    id={`${uid}-${mw.id}`}
                    value={modes[mw.id] ?? "as-written"}
                    onChange={(e) => {
                      setModes((m) => ({ ...m, [mw.id]: e.target.value as Mode }));
                      reset();
                    }}
                    className="rounded-md border border-fd-border bg-fd-background px-1.5 py-0.5 text-xs text-fd-foreground focus-visible:border-fd-primary focus-visible:ring-2 focus-visible:ring-fd-primary/25 focus-visible:outline-none"
                  >
                    {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
                      <option key={m} value={m}>
                        {MODE_LABEL[m]}
                      </option>
                    ))}
                  </select>
                </label>
              </StageRow>
            );
          })}
          {[0, 1].map((k) => {
            const i = MIDDLEWARE.length + k;
            const stage = trace && i < shown ? trace.stages[i] : undefined;
            return (
              <StageRow
                key={k}
                index={i + 1}
                stage={stage}
                label={k === 0 ? "Loaders" : entry === "page" ? "renderStream" : "loadData"}
                scope="framework"
                active={!!trace && i === shown - 1 && !done}
              />
            );
          })}
        </ol>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={primaryButtonClass} onClick={send}>
            <Play className="size-3.5" aria-hidden /> Send request
          </button>
          <button type="button" className={buttonClass} onClick={reset} disabled={!trace}>
            <RotateCcw className="size-3.5" aria-hidden /> Reset
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Output label="ctx so far">
            {lastCtx ? (
              <>
                {lastCtx.ctxAfter}
                {"\n"}
                <span className="text-fd-muted-foreground">// type: {lastCtx.typeAfter}</span>
              </>
            ) : (
              <span className="text-fd-muted-foreground">
                {fmtCtx({}, false)}
                {"\n"}// type: BaseContext
              </span>
            )}
          </Output>
          <div aria-live="polite" aria-atomic="true">
            <Output label="Response" tone={done ? trace.tone : "default"}>
              {done ? (
                trace.result
              ) : (
                <span className="text-fd-muted-foreground">{trace ? "running…" : "Not sent yet."}</span>
              )}
            </Output>
          </div>
        </div>
      </div>
    </Playground>
  );
}

function StageRow({
  index,
  label,
  scope,
  stage,
  active,
  children,
}: {
  index: number;
  label: string;
  scope: string;
  stage?: Stage;
  active: boolean;
  children?: ReactNode;
}) {
  const status = stage?.status;
  return (
    <li
      className={cn(
        "rounded-lg border px-3 py-2 transition-colors motion-reduce:transition-none",
        !stage && "border-fd-border bg-fd-background",
        status === "ran" && "border-fd-primary/40 bg-fd-primary/6",
        status === "stopped" && "border-fd-warning/50 bg-fd-warning/8",
        status === "skipped" && "border-dashed border-fd-border bg-transparent",
        active && "ring-2 ring-fd-primary/30",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-mono text-xs text-fd-muted-foreground">{index}</span>
        <span className="min-w-0 font-mono text-sm break-all text-fd-foreground [font-variant-ligatures:none]">
          {label}
        </span>
        <span className="rounded-full border border-fd-border px-1.5 text-[0.65rem] tracking-[0.04em] text-fd-muted-foreground uppercase">
          {scope}
        </span>
        {stage && (
          <span
            className={cn(
              "text-xs font-semibold",
              status === "ran" && "text-fd-primary",
              status === "stopped" && "text-fd-warning",
              status === "skipped" && "text-fd-muted-foreground",
            )}
          >
            {status === "ran" ? "ran" : status === "stopped" ? "stopped the pipeline" : "skipped"}
          </span>
        )}
        {children && <div className="ml-auto">{children}</div>}
      </div>
      {stage && (
        <p className="m-0 mt-1 font-mono text-xs leading-5 break-words text-fd-foreground/80">{stage.detail}</p>
      )}
    </li>
  );
}
