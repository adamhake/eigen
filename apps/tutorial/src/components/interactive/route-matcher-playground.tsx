"use client";

import { useId, useMemo, useState } from "react";

import { cn } from "@/lib/cn";

import { Output, Playground, inputClass } from "./frame";

/* ------------------------------------------------------------------------- *
 * Ports of the tutorial's own routing code, kept as close to the MDX as
 * possible so the playground behaves exactly like what readers build.
 * ------------------------------------------------------------------------- */

/** Part 2 — plugins/eigen-routes.ts `fileToRoute` (only knows `[name]`). */
function fileToRouteBasic(filename: string): { path: string; paramNames: string[] } {
  const paramNames: string[] = [];

  const segments = filename
    .replace(/\.tsx$/, "")
    .split("/")
    .map((segment) => {
      const param = /^\[(\w+)\]$/.exec(segment);
      if (param) {
        paramNames.push(param[1]);
        return `:${param[1]}`;
      }
      return segment.toLowerCase();
    });

  if (segments[segments.length - 1] === "index") segments.pop();

  const name = segments.join("/");
  const path = name === "home" || name === "" ? "/" : `/${name}`;
  return { path, paramNames };
}

/**
 * Part 23 — Part 2's per-segment `fileToRoute` with the catch-all and optional
 * checks added before the plain-param one. Each returns early, so param names
 * keep their casing while static segments are still lowercased.
 */
function fileToRouteRanked(filename: string): { path: string; paramNames: string[] } {
  const paramNames: string[] = [];

  const segments = filename
    .replace(/\.tsx$/, "")
    .split("/")
    .map((segment) => {
      const catchAll = /^\[\.\.\.(\w+)\]$/.exec(segment);
      if (catchAll) {
        paramNames.push(catchAll[1]);
        return `:${catchAll[1]}*`;
      }
      const optional = /^\[\[(\w+)\]\]$/.exec(segment);
      if (optional) {
        paramNames.push(optional[1]);
        return `:${optional[1]}?`;
      }
      const param = /^\[(\w+)\]$/.exec(segment);
      if (param) {
        paramNames.push(param[1]);
        return `:${param[1]}`;
      }
      return segment.toLowerCase();
    });

  if (segments[segments.length - 1] === "index") segments.pop();

  const name = segments.join("/");
  const path = name === "home" || name === "" ? "/" : `/${name}`;
  return { path, paramNames };
}

/** Part 3 — packages/eigen/match-route.ts, returning the matching route's index. */
function matchRouteBasic(pathname: string, routes: { path: string }[]) {
  const path = pathname.replace(/\/+$/, "") || "/";

  for (let r = 0; r < routes.length; r++) {
    const route = routes[r];
    if (route.path === path) return { index: r, params: {} as Record<string, string> };

    const routeParts = route.path.split("/");
    const pathParts = path.split("/");
    if (routeParts.length !== pathParts.length) continue;

    const params: Record<string, string> = {};
    const match = routeParts.every((part, i) => {
      if (part.startsWith(":")) {
        if (pathParts[i] === "") return false;
        params[part.slice(1)] = pathParts[i];
        return true;
      }
      return part === pathParts[i];
    });

    if (match) return { index: r, params };
  }
  return null;
}

/* Part 23 — packages/eigen/router/matcher.ts */

interface RouteSegment {
  type: "static" | "dynamic" | "optional" | "catch-all";
  value: string;
}

function compileRoute(path: string): RouteSegment[] {
  return path
    .split("/")
    .filter(Boolean)
    .map((seg): RouteSegment => {
      if (seg === "*") return { type: "catch-all", value: "*" };
      if (seg.startsWith(":") && seg.endsWith("*")) return { type: "catch-all", value: seg.slice(1, -1) };
      if (seg.startsWith(":") && seg.endsWith("?")) return { type: "optional", value: seg.slice(1, -1) };
      if (seg.startsWith(":")) return { type: "dynamic", value: seg.slice(1) };
      return { type: "static", value: seg };
    });
}

const RANK = { static: 4, dynamic: 3, end: 2, optional: 1, "catch-all": 0 } as const;

function compareRoutes(a: RouteSegment[], b: RouteSegment[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ra = RANK[a[i]?.type ?? "end"];
    const rb = RANK[b[i]?.type ?? "end"];
    if (ra !== rb) return rb - ra;
  }
  return 0;
}

function tryMatch(routeSegments: RouteSegment[], pathSegments: string[]): Record<string, string> | null {
  const params: Record<string, string> = {};

  for (let i = 0; i < routeSegments.length; i++) {
    const routeSeg = routeSegments[i];

    if (routeSeg.type === "catch-all") {
      if (i >= pathSegments.length) return null;
      params[routeSeg.value] = pathSegments.slice(i).join("/");
      return params;
    }

    if (i >= pathSegments.length) {
      if (routeSeg.type === "optional") continue;
      return null;
    }

    if (routeSeg.type === "static") {
      if (routeSeg.value !== pathSegments[i]) return null;
    } else {
      params[routeSeg.value] = pathSegments[i];
    }
  }

  if (pathSegments.length > routeSegments.length) return null;

  return params;
}

/* ------------------------------------------------------------------ model */

type Mode = "basic" | "ranked";

interface Row {
  file: string;
  path: string;
  segments: RouteSegment[];
  /** Why the route can't be used, if it can't. */
  problem?: string;
  /** Not a .tsx file: discoverRoutes skips it. */
  ignored?: boolean;
}

const DEFAULT_FILES: Record<Mode, string> = {
  basic: [
    "Home.tsx",
    "About.tsx",
    "posts/[id].tsx",
    "posts/new.tsx",
    "users/[userId]/posts/[postId].tsx",
    "blog/index.tsx",
  ].join("\n"),
  ranked: [
    "index.tsx",
    "[section]/new.tsx",
    "posts/[id].tsx",
    "posts/new.tsx",
    "docs/index.tsx",
    "docs/[...slug].tsx",
    "users/[[id]].tsx",
  ].join("\n"),
};

const DEFAULT_URL: Record<Mode, string> = { basic: "/users/7/posts/99", ranked: "/posts/new" };

function normalizeFile(line: string) {
  return line
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.?\/?(src\/)?pages\//, "");
}

function buildRows(text: string, mode: Mode): Row[] {
  return text
    .split("\n")
    .map(normalizeFile)
    .filter(Boolean)
    .map((file): Row => {
      if (!file.endsWith(".tsx")) return { file, path: "", segments: [], ignored: true };
      const { path } = mode === "basic" ? fileToRouteBasic(file) : fileToRouteRanked(file);
      const segments = compileRoute(path);
      let problem: string | undefined;
      if (mode === "ranked") {
        const opt = segments.findIndex((s) => s.type === "optional");
        if (opt !== -1 && opt !== segments.length - 1)
          problem = "optional segment must be last — rejected at discovery";
      }
      return { file, path, segments, problem };
    });
}

function pathnameOf(input: string) {
  let p = input.trim().split(/[?#]/)[0];
  if (!p.startsWith("/")) p = `/${p}`;
  return p;
}

const segTone: Record<RouteSegment["type"], string> = {
  static: "text-fd-foreground",
  dynamic: "text-fd-primary",
  optional: "text-fd-info",
  "catch-all": "text-fd-warning",
};

/* -------------------------------------------------------------- component */

export function RouteMatcherPlayground({ mode: initialMode = "basic" }: { mode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [files, setFiles] = useState(DEFAULT_FILES[initialMode]);
  const [url, setUrl] = useState(DEFAULT_URL[initialMode]);
  const id = useId();

  const result = useMemo(() => {
    const rows = buildRows(files, mode);
    const usable = rows.map((r, i) => ({ ...r, i })).filter((r) => !r.ignored && !r.problem);
    const pathname = pathnameOf(url);

    if (mode === "basic") {
      // Tested in discovery order — the order of the list.
      const order = usable;
      const match = matchRouteBasic(pathname, order);
      const alsoMatch = new Set<number>();
      if (match) {
        order.forEach((r, k) => {
          if (k > match.index && matchRouteBasic(pathname, [r])) alsoMatch.add(k);
        });
      }
      return { rows, order, pathname, match, alsoMatch, ties: new Set<number>(), error: null as string | null };
    }

    // Ranked: sort a copy with compareRoutes (Array.prototype.sort is stable).
    const order = [...usable].sort((a, b) => compareRoutes(a.segments, b.segments));
    const ties = new Set<number>();
    // compareRoutes returns 0 for any two routes with the same segment types
    // ('/about' vs '/blog' too); it's only a conflict when the static parts agree.
    const sameShape = (a: RouteSegment[], b: RouteSegment[]) =>
      compareRoutes(a, b) === 0 && a.every((s, j) => s.type !== "static" || s.value === b[j].value);
    for (let k = 0; k < order.length; k++) {
      for (let j = k + 1; j < order.length; j++) {
        if (sameShape(order[k].segments, order[j].segments)) {
          ties.add(k);
          ties.add(j);
        }
      }
    }
    let pathSegments: string[];
    try {
      pathSegments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
    } catch {
      return {
        rows,
        order,
        pathname,
        match: null,
        alsoMatch: new Set<number>(),
        ties,
        error:
          "null: decodeURIComponent throws a URIError on this malformed escape, so matchRoute catches it and returns null before comparing routes (404).",
      };
    }
    let match: { index: number; params: Record<string, string> } | null = null;
    const alsoMatch = new Set<number>();
    order.forEach((r, k) => {
      const params = tryMatch(r.segments, pathSegments);
      if (params === null) return;
      if (!match) match = { index: k, params };
      else alsoMatch.add(k);
    });
    return { rows, order, pathname, match, alsoMatch, ties, error: null as string | null };
  }, [files, mode, url]);

  const matched = result.match ? result.order[result.match.index] : null;
  const params = result.match ? Object.entries(result.match.params) : [];

  const switchMode = (next: Mode) => {
    setMode(next);
  };

  return (
    <Playground
      title={mode === "basic" ? "File → route → match (Parts 2 and 3)" : "Ranked route matching (Part 23)"}
      prompt={
        mode === "basic" ? (
          <>
            Edit the files under <code>src/pages/</code> and the URL. Try <code>/posts/new</code>, then reorder the
            list.
          </>
        ) : (
          <>
            Order no longer matters. Try <code>/docs</code>, <code>/docs/a/b</code>, <code>/users</code> and{" "}
            <code>/archive/new</code>.
          </>
        )
      }
      caption={
        mode === "basic"
          ? "Part 3's matchRoute tests routes in discovery order and returns the first hit, so when two routes overlap, list order decides."
          : "Part 23 sorts routes with compareRoutes, segment by segment (static > dynamic > end > optional > catch-all), so the most specific route wins regardless of file order."
      }
    >
      <div
        role="radiogroup"
        aria-label="Matcher"
        className="mb-4 inline-flex rounded-lg border border-fd-border p-0.5 text-sm"
      >
        {(["basic", "ranked"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => switchMode(m)}
            className={cn(
              "rounded-md px-3 py-1 transition-colors",
              mode === m
                ? "bg-fd-primary text-fd-primary-foreground"
                : "text-fd-muted-foreground hover:text-fd-foreground",
            )}
          >
            {m === "basic" ? "Linear (Part 3)" : "Ranked (Part 23)"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <div>
            <label htmlFor={`${id}-files`} className="mb-1.5 block text-sm font-medium text-fd-foreground">
              Page files{" "}
              <span className="font-normal text-fd-muted-foreground">(one per line, relative to src/pages)</span>
            </label>
            <textarea
              id={`${id}-files`}
              value={files}
              onChange={(e) => setFiles(e.target.value)}
              rows={8}
              spellCheck={false}
              className={cn(inputClass, "resize-y leading-6 [font-variant-ligatures:none]")}
            />
            <button
              type="button"
              onClick={() => setFiles(DEFAULT_FILES[mode])}
              className="mt-1 text-xs text-fd-muted-foreground underline-offset-2 hover:text-fd-foreground hover:underline"
            >
              Reset to example files
            </button>
          </div>
          <div>
            <label htmlFor={`${id}-url`} className="mb-1.5 block text-sm font-medium text-fd-foreground">
              URL
            </label>
            <input
              id={`${id}-url`}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="rounded-lg border border-fd-border bg-fd-background p-3">
            <p className="m-0 mb-1.5 text-[0.7rem] font-semibold tracking-[0.06em] text-fd-muted-foreground uppercase">
              {mode === "basic" ? "Routes, in the order tested" : "Routes, after sorting with compareRoutes"}
            </p>
            <ol className="m-0 flex list-none flex-col gap-1 p-0">
              {result.order.map((r, k) => {
                const isMatch = result.match?.index === k;
                const shadowed = result.alsoMatch.has(k);
                return (
                  <li
                    key={`${r.i}-${r.file}`}
                    className={cn(
                      "flex flex-wrap items-baseline gap-x-2 rounded-md px-2 py-1 font-mono text-sm",
                      isMatch && "bg-fd-primary/12 ring-1 ring-fd-primary/50",
                    )}
                  >
                    <span className="w-5 shrink-0 text-xs text-fd-muted-foreground">{k + 1}.</span>
                    <span className="min-w-0 break-all">
                      {r.path === "/" ? (
                        <span>/</span>
                      ) : (
                        r.segments.map((s, j) => (
                          <span key={j}>
                            <span className="text-fd-muted-foreground">/</span>
                            <span
                              className={
                                mode === "ranked" ? segTone[s.type] : s.type === "static" ? "" : "text-fd-primary"
                              }
                            >
                              {r.path.split("/").filter(Boolean)[j]}
                            </span>
                          </span>
                        ))
                      )}
                    </span>
                    <span className="min-w-0 text-xs break-all text-fd-muted-foreground">← {r.file}</span>
                    {isMatch && <span className="ml-auto text-xs font-semibold text-fd-primary">match</span>}
                    {shadowed && <span className="ml-auto text-xs text-fd-muted-foreground">also matches</span>}
                    {result.ties.has(k) && (
                      <span className="basis-full pl-7 text-xs text-fd-warning">
                        same shape as another route — the plugin warns
                      </span>
                    )}
                  </li>
                );
              })}
              {result.order.length === 0 && <li className="text-sm text-fd-muted-foreground">No routes.</li>}
            </ol>
            {result.rows.some((r) => r.ignored || r.problem) && (
              <ul className="m-0 mt-2 list-none border-t border-fd-border p-0 pt-2 text-xs text-fd-muted-foreground">
                {result.rows
                  .filter((r) => r.ignored || r.problem)
                  .map((r, k) => (
                    <li key={k} className="font-mono break-all">
                      {r.file}:{" "}
                      {r.ignored ? "skipped (discoverRoutes only reads .tsx files)" : `${r.path} — ${r.problem}`}
                    </li>
                  ))}
              </ul>
            )}
            {mode === "ranked" && (
              <p className="m-0 mt-2 flex flex-wrap gap-x-3 text-xs">
                <span className={segTone.static}>static</span>
                <span className={segTone.dynamic}>:dynamic</span>
                <span className={segTone.optional}>:optional?</span>
                <span className={segTone["catch-all"]}>:catchAll*</span>
              </p>
            )}
          </div>

          <div aria-live="polite">
            <Output
              label={`Result for ${result.pathname}`}
              tone={matched ? "accent" : result.error ? "warning" : "default"}
            >
              {result.error ? (
                result.error
              ) : matched ? (
                <>
                  <span className="text-fd-muted-foreground">route </span>
                  {matched.path}
                  <span className="text-fd-muted-foreground"> ({matched.file})</span>
                  {"\n"}
                  <span className="text-fd-muted-foreground">params </span>
                  {params.length === 0
                    ? "{}"
                    : `{ ${params.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ")} }`}
                </>
              ) : (
                <>null — no route matches (404)</>
              )}
            </Output>
          </div>
        </div>
      </div>
    </Playground>
  );
}
