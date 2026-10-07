"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/cn";

import { inputClass, Output, Playground } from "./frame";

/*
 * Cookie behaviour per RFC 6265bis and MDN's Set-Cookie reference. The cookie
 * is set by https://app.example.com; "other.example" is an unrelated site.
 */

type SameSite = "Strict" | "Lax" | "None" | "omitted";
type PathOpt = "/" | "/account" | "omitted";

interface Attrs {
  name: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: SameSite;
  path: PathOpt;
  maxAge: string; // "" = omitted (session cookie)
}

const DEFAULTS: Attrs = {
  name: "__Host-session",
  httpOnly: true,
  secure: true,
  sameSite: "Lax",
  path: "/",
  maxAge: "604800",
};

/** Where the login handler that sets the cookie lives (decides the default Path). */
const SET_AT = "/auth/login";
const DEFAULT_PATH = "/auth";

const REQUEST_PATHS = ["/", "/account", "/account/billing", "/accounts", "/auth/callback"];

type Verdict = "yes" | "no" | "varies";
interface Row {
  scenario: string;
  verdict: Verdict;
  reason: string;
}

function header(a: Attrs) {
  const parts = [`${a.name}=8f3a…c2`];
  if (a.path !== "omitted") parts.push(`Path=${a.path}`);
  if (a.httpOnly) parts.push("HttpOnly");
  if (a.secure) parts.push("Secure");
  if (a.sameSite !== "omitted") parts.push(`SameSite=${a.sameSite}`);
  if (a.maxAge.trim() !== "") parts.push(`Max-Age=${a.maxAge.trim()}`);
  return `Set-Cookie: ${parts.join("; ")}`;
}

/** Why the browser refuses to store the cookie at all, if it does. */
function rejection(a: Attrs): string | null {
  if (a.name.startsWith("__Host-")) {
    if (!a.secure) return "The __Host- prefix requires Secure, so the browser ignores this cookie.";
    if (a.path !== "/")
      return "The __Host- prefix requires Path=/ (and no Domain), so the browser ignores this cookie.";
  }
  if (a.name.startsWith("__Secure-") && !a.secure) {
    return "The __Secure- prefix requires Secure, so the browser ignores this cookie.";
  }
  if (a.sameSite === "None" && !a.secure) {
    return "SameSite=None without Secure is rejected (RFC 6265bis; Chromium has enforced it since 2020). Add Secure.";
  }
  const n = Number(a.maxAge.trim());
  if (a.maxAge.trim() !== "" && Number.isFinite(n) && n <= 0) {
    return "Max-Age of zero or less expires the cookie immediately: this is how logout deletes it.";
  }
  return null;
}

function cookiePath(a: Attrs) {
  return a.path === "omitted" ? DEFAULT_PATH : a.path;
}

/** RFC 6265bis path-match: identical, or a prefix ending at a "/" boundary. */
function pathMatches(cookie: string, request: string) {
  if (cookie === request) return true;
  if (!request.startsWith(cookie)) return false;
  return cookie.endsWith("/") || request[cookie.length] === "/";
}

function evaluate(a: Attrs, reqPath: string): Row[] {
  const rejected = rejection(a);
  const p = cookiePath(a);
  const pathOk = pathMatches(p, reqPath);
  const pathReason = `Path=${p} doesn't cover ${reqPath}.`;

  const base = (scenario: string, compute: () => Omit<Row, "scenario">): Row => {
    if (rejected)
      return {
        scenario,
        verdict: "no",
        reason: "The cookie was never stored.",
      };
    if (!pathOk) return { scenario, verdict: "no", reason: pathReason };
    return { scenario, ...compute() };
  };

  const ss = a.sameSite;
  return [
    base("JS reads document.cookie", () =>
      a.httpOnly
        ? {
            verdict: "no",
            reason: "HttpOnly hides it from scripts — an XSS bug can't read it. It is still sent with fetch().",
          }
        : {
            verdict: "yes",
            reason: "Without HttpOnly, any script on the page (including injected ones) can read it.",
          },
    ),
    base("Same-site navigation", () => ({
      verdict: "yes",
      reason: "A link within app.example.com is a same-site request; every SameSite value allows it.",
    })),
    base("Top-level cross-site GET link", () =>
      ss === "Strict"
        ? {
            verdict: "no",
            reason: "Strict withholds it on any request started from another site — even a plain link.",
          }
        : ss === "Lax"
          ? {
              verdict: "yes",
              reason: "Lax allows top-level navigations with a safe method (GET).",
            }
          : ss === "None"
            ? {
                verdict: "yes",
                reason: "None sends it on every request, same-site or cross-site.",
              }
            : {
                verdict: "yes",
                reason: "Chromium treats a missing SameSite as Lax (allows this); Firefox and Safari treat it as None.",
              },
    ),
    base("Cross-site POST form", () =>
      ss === "Strict" || ss === "Lax"
        ? {
            verdict: "no",
            reason: `${ss} withholds it on cross-site POSTs — the classic CSRF form is cookieless.`,
          }
        : ss === "None"
          ? {
              verdict: "yes",
              reason: "None sends it: only an Origin check or CSRF token stops a forged POST.",
            }
          : {
              verdict: "varies",
              reason:
                "Chromium's default Lax blocks it, except for cookies set under 2 minutes ago (Lax+POST); Firefox and Safari send it.",
            },
    ),
    base("Cross-site fetch / iframe", () =>
      ss === "Strict" || ss === "Lax"
        ? {
            verdict: "no",
            reason: `${ss} withholds it on cross-site subresource requests.`,
          }
        : ss === "None"
          ? {
              verdict: "varies",
              reason:
                "Allowed by SameSite, but third-party cookie protections decide: Safari blocks it, Firefox partitions it, Chrome sends it unless the user blocks third-party cookies. fetch() also needs credentials: 'include'.",
            }
          : {
              verdict: "no",
              reason:
                "Chromium treats it as Lax; Firefox and Safari treat it as None, but their third-party cookie protections withhold it.",
            },
    ),
    base("Plain http:// request", () =>
      a.secure
        ? {
            verdict: "no",
            reason:
              "Secure cookies only travel over https:// (Chrome and Firefox exempt http://localhost; Safari does not).",
          }
        : {
            verdict: "yes",
            reason: "Without Secure it goes over plaintext HTTP, readable by anyone on the network.",
          },
    ),
  ];
}

function lifetime(a: Attrs) {
  const v = a.maxAge.trim();
  if (v === "")
    return "Session cookie: no Max-Age, so it's dropped when the browser session ends (session restore can keep it).";
  const n = Number(v);
  if (!Number.isFinite(n) || !/^-?\d+$/.test(v))
    return "Max-Age must be an integer number of seconds; an invalid value is ignored.";
  if (n <= 0) return "Expires immediately.";
  const days = n / 86400;
  return `Expires in ${n.toLocaleString("en-US")} s${days >= 1 ? ` (${Number.isInteger(days) ? days : days.toFixed(1)} days)` : n >= 3600 ? ` (${(n / 3600).toFixed(1)} h)` : ""}. Chromium caps lifetimes at 400 days.`;
}

const VERDICT_TEXT: Record<Verdict, string> = {
  yes: "Sent",
  no: "Not sent",
  varies: "Varies",
};

function Badge({ verdict, scenario }: { verdict: Verdict; scenario: string }) {
  const text = scenario.startsWith("JS") ? (verdict === "yes" ? "Visible" : "Hidden") : VERDICT_TEXT[verdict];
  return (
    <span
      className={cn(
        "inline-flex w-20 shrink-0 self-start justify-center rounded-md border px-1.5 py-0.5 text-xs font-semibold",
        verdict === "yes" && "border-fd-primary/50 bg-fd-primary/10 text-fd-primary",
        verdict === "no" && "border-fd-border bg-fd-muted text-fd-muted-foreground",
        verdict === "varies" && "border-fd-warning/50 bg-fd-warning/10 text-fd-warning",
      )}
    >
      {text}
    </span>
  );
}

const labelClass = "mb-1 block text-xs font-semibold text-fd-muted-foreground";

export function CookieAttributesPlayground() {
  const id = useId();
  const [a, setA] = useState<Attrs>(DEFAULTS);
  const [reqPath, setReqPath] = useState("/account");
  const set = <K extends keyof Attrs>(k: K, v: Attrs[K]) => setA((prev) => ({ ...prev, [k]: v }));

  const rejected = rejection(a);
  const rows = evaluate(a, reqPath);

  return (
    <Playground
      title="Cookie attributes, scenario by scenario"
      prompt="Start from Eigen's session cookie, then loosen or tighten each attribute and see which requests still carry it."
      caption="Each attribute closes off a different leak: HttpOnly against scripts, Secure against the network, SameSite against other sites, Path and Max-Age against scope and lifetime."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className={labelClass}>
            Cookie name
          </label>
          <select id={`${id}-name`} className={inputClass} value={a.name} onChange={(e) => set("name", e.target.value)}>
            <option value="__Host-session">__Host-session</option>
            <option value="__Secure-session">__Secure-session</option>
            <option value="session">session</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-ss`} className={labelClass}>
            SameSite
          </label>
          <select
            id={`${id}-ss`}
            className={inputClass}
            value={a.sameSite}
            onChange={(e) => set("sameSite", e.target.value as SameSite)}
          >
            <option value="Strict">Strict</option>
            <option value="Lax">Lax</option>
            <option value="None">None</option>
            <option value="omitted">(omitted)</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-path`} className={labelClass}>
            Path
          </label>
          <select
            id={`${id}-path`}
            className={inputClass}
            value={a.path}
            onChange={(e) => set("path", e.target.value as PathOpt)}
          >
            <option value="/">/</option>
            <option value="/account">/account</option>
            <option value="omitted">(omitted)</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-age`} className={labelClass}>
            Max-Age (seconds, empty = omitted)
          </label>
          <input
            id={`${id}-age`}
            className={inputClass}
            inputMode="numeric"
            value={a.maxAge}
            onChange={(e) => set("maxAge", e.target.value)}
            spellCheck={false}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {(
          [
            ["httpOnly", "HttpOnly"],
            ["secure", "Secure"],
          ] as const
        ).map(([k, label]) => (
          <label
            key={k}
            className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-sm text-fd-foreground"
          >
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-fd-primary)]"
              checked={a[k]}
              onChange={(e) => set(k, e.target.checked)}
            />
            {label}
          </label>
        ))}
        <button
          type="button"
          className="text-sm text-fd-primary underline-offset-2 hover:underline"
          onClick={() => setA(DEFAULTS)}
        >
          Reset to Eigen&rsquo;s cookie
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <Output label="Response header (set by https://app.example.com)" tone={rejected ? "warning" : "accent"}>
          {header(a)}
        </Output>
        <div aria-live="polite" className="space-y-3">
          <p className={cn("m-0 text-sm leading-6", rejected ? "text-fd-warning" : "text-fd-muted-foreground")}>
            {rejected ?? lifetime(a)}
            {!rejected && a.path === "omitted" && (
              <>
                {" "}
                No Path: it defaults to the directory of the URL that set it ({SET_AT} → <code>{DEFAULT_PATH}</code>).
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <label htmlFor={`${id}-req`} className="text-sm text-fd-foreground">
            Requests to
          </label>
          <select
            id={`${id}-req`}
            className={cn(inputClass, "w-auto py-1")}
            value={reqPath}
            onChange={(e) => setReqPath(e.target.value)}
          >
            {REQUEST_PATHS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <ul
          className="m-0 list-none divide-y divide-fd-border rounded-lg border border-fd-border bg-fd-background p-0"
          aria-live="polite"
        >
          {rows.map((r) => (
            <li key={r.scenario} className="flex gap-3 p-3">
              <Badge verdict={r.verdict} scenario={r.scenario} />
              <div className="min-w-0">
                <p className="m-0 text-sm font-semibold text-fd-foreground">{r.scenario}</p>
                <p className="m-0 mt-0.5 text-sm leading-6 text-fd-muted-foreground">{r.reason}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="m-0 mt-2 text-xs leading-5 text-fd-muted-foreground">
          Cross-site means another registrable domain (other.example) or another scheme. Browsers differ at the edges —
          the missing-SameSite default and third-party cookie rules most of all — so test in the browsers you support.
        </p>
      </div>
    </Playground>
  );
}
