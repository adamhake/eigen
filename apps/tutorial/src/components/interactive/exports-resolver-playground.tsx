"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/cn";

import { buttonClass, inputClass, Output, Playground } from "./frame";

/*
 * A faithful port of Node's PACKAGE_EXPORTS_RESOLVE (nodejs.org/api/esm.html,
 * "Resolution Algorithm Specification"), with a trace of every step. Only the
 * exports half is modelled: the result is the target path inside the package.
 */

const PKG = "eigen";

const DEFAULT_EXPORTS = `{
  ".": {
    "types": "./dist/index.d.ts",
    "default": "./dist/index.js"
  },
  "./typescript-plugin": {
    "types": "./dist-cjs/typescript-plugin.d.cts",
    "require": "./dist-cjs/typescript-plugin.cjs"
  },
  "./auth/session": {
    "types": "./dist/auth-session.d.ts",
    "default": "./dist/auth-session.js"
  },
  "./theme.css": "./theme.css",
  "./package.json": "./package.json",
  "./*": {
    "types": "./dist/*.d.ts",
    "default": "./dist/*.js"
  }
}`;

const CONDITIONS = [
  "import",
  "require",
  "node",
  "browser",
  "types",
  "development",
  "production",
  "react-server",
] as const;
type Condition = (typeof CONDITIONS)[number];

const PRESETS: { label: string; conds: Condition[] }[] = [
  { label: "Node import", conds: ["node", "import"] },
  { label: "Node require()", conds: ["node", "require"] },
  { label: "Vite client (dev)", conds: ["import", "browser", "development"] },
  { label: "TypeScript (bundler)", conds: ["types", "import"] },
  { label: "RSC server", conds: ["react-server", "node", "import"] },
];

const SPECIFIERS = [
  "eigen",
  "eigen/server",
  "eigen/auth/session",
  "eigen/adapters/netlify",
  "eigen/typescript-plugin",
  "eigen/package.json",
  "eigen/theme.css",
];

/* ---------------------------------------------------------------- resolver */

interface Step {
  depth: number;
  text: string;
  tone?: "match" | "skip" | "fail";
}

class ResolveError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
const isObject = (v: Json): v is { [k: string]: Json } => typeof v === "object" && v !== null && !Array.isArray(v);

const BAD_SEGMENT = (s: string) => {
  let d = s;
  try {
    d = decodeURIComponent(s);
  } catch {}
  return ["", ".", "..", "node_modules"].includes(d.toLowerCase());
};

function resolveExports(exportsField: Json, subpath: string, conditions: Set<string>) {
  const trace: Step[] = [];
  const log = (depth: number, text: string, tone?: Step["tone"]) => trace.push({ depth, text, tone });
  const show = (v: Json) =>
    typeof v === "string" ? `"${v}"` : Array.isArray(v) ? "[…]" : v === null ? "null" : isObject(v) ? "{…}" : String(v);

  /** PACKAGE_TARGET_RESOLVE: string | null | undefined, or throws */
  function target(t: Json, patternMatch: string | null, depth: number): string | null | undefined {
    if (typeof t === "string") {
      if (!t.startsWith("./")) {
        log(depth, `${show(t)} doesn't start with "./"`, "fail");
        throw new ResolveError(
          "ERR_INVALID_PACKAGE_TARGET",
          `Invalid target ${show(t)}: exports targets must start with "./".`,
        );
      }
      if (t.split(/[/\\]/).slice(1).some(BAD_SEGMENT)) {
        log(depth, `${show(t)} contains an empty, ".", "..", or node_modules segment`, "fail");
        throw new ResolveError("ERR_INVALID_PACKAGE_TARGET", `Invalid target ${show(t)}.`);
      }
      if (patternMatch === null) {
        log(depth, `target ${show(t)}`, "match");
        return t;
      }
      if (patternMatch.split(/[/\\]/).some(BAD_SEGMENT)) {
        log(depth, `"*" would be "${patternMatch}", which contains an invalid segment`, "fail");
        throw new ResolveError(
          "ERR_INVALID_MODULE_SPECIFIER",
          `The "*" match "${patternMatch}" contains an invalid segment.`,
        );
      }
      const out = t.replaceAll("*", patternMatch);
      log(depth, `target ${show(t)}, "*" → "${patternMatch}" gives "${out}"`, "match");
      return out;
    }
    if (Array.isArray(t)) {
      if (t.length === 0) {
        log(depth, "empty array → null", "fail");
        return null;
      }
      log(depth, `array of ${t.length} fallbacks, tried in order`);
      let last: null | undefined | ResolveError = undefined;
      for (const [i, item] of t.entries()) {
        log(depth + 1, `[${i}]`);
        try {
          const r = target(item, patternMatch, depth + 2);
          if (r === undefined) continue;
          if (r === null) {
            last = null;
            continue;
          }
          return r;
        } catch (e) {
          if (e instanceof ResolveError && e.code === "ERR_INVALID_PACKAGE_TARGET") {
            last = e;
            continue;
          }
          throw e;
        }
      }
      if (last instanceof ResolveError) throw last;
      return last;
    }
    if (isObject(t)) {
      const keys = Object.keys(t);
      if (keys.some((k) => /^(0|[1-9]\d*)$/.test(k))) {
        log(depth, "condition object has a numeric key", "fail");
        throw new ResolveError("ERR_INVALID_PACKAGE_CONFIG", "Condition objects can't have numeric keys.");
      }
      for (const p of keys) {
        if (p === "default" || conditions.has(p)) {
          log(depth, `"${p}" ${p === "default" ? "always matches" : "is active"} → ${show(t[p])}`, "match");
          const r = target(t[p], patternMatch, depth + 1);
          if (r === undefined) {
            log(depth + 1, "nothing matched inside; keep looking", "skip");
            continue;
          }
          return r;
        }
        log(depth, `"${p}" not active, skip`, "skip");
      }
      log(depth, "no condition matched → undefined", "skip");
      return undefined;
    }
    if (t === null) {
      log(depth, "null target: explicitly not exported", "fail");
      return null;
    }
    log(depth, `${show(t)} is not a valid target`, "fail");
    throw new ResolveError("ERR_INVALID_PACKAGE_TARGET", `Invalid target ${show(t)}.`);
  }

  function run(): string {
    const dotKeys = isObject(exportsField) ? Object.keys(exportsField).filter((k) => k.startsWith(".")) : [];
    if (isObject(exportsField) && dotKeys.length > 0 && dotKeys.length !== Object.keys(exportsField).length) {
      log(0, 'exports mixes "./subpath" keys with condition keys', "fail");
      throw new ResolveError("ERR_INVALID_PACKAGE_CONFIG", 'An exports object can\'t mix "." keys and condition keys.');
    }
    let resolved: string | null | undefined;
    if (subpath === ".") {
      let main: Json | undefined;
      if (
        typeof exportsField === "string" ||
        Array.isArray(exportsField) ||
        (isObject(exportsField) && dotKeys.length === 0)
      ) {
        log(0, 'exports is a shorthand for the "." entry');
        main = exportsField;
      } else if (isObject(exportsField) && "." in exportsField) {
        log(0, 'exact key "." found', "match");
        main = exportsField["."];
      } else {
        log(0, 'no "." key', "fail");
      }
      if (main !== undefined) resolved = target(main, null, 1);
    } else if (isObject(exportsField) && dotKeys.length > 0) {
      resolved = subpathResolve(exportsField);
    } else {
      log(0, 'exports only defines "."; subpaths are not exported', "fail");
    }
    if (resolved === null || resolved === undefined) {
      throw new ResolveError(
        "ERR_PACKAGE_PATH_NOT_EXPORTED",
        `Package subpath '${subpath}' is not defined by "exports"${resolved === null ? "" : " for these conditions"}.`,
      );
    }
    return resolved;
  }

  /** PACKAGE_IMPORTS_EXPORTS_RESOLVE */
  function subpathResolve(obj: { [k: string]: Json }): string | null | undefined {
    if (subpath.endsWith("/")) {
      log(0, `"${subpath}" ends in "/"`, "fail");
      throw new ResolveError("ERR_INVALID_MODULE_SPECIFIER", 'A specifier can\'t end in "/".');
    }
    if (subpath in obj && !subpath.includes("*")) {
      log(0, `exact key "${subpath}" found`, "match");
      return target(obj[subpath], null, 1);
    }
    log(0, `no exact key "${subpath}"`, "skip");
    const expansion = Object.keys(obj)
      .filter((k) => k.split("*").length === 2)
      .sort((a, b) => {
        const ba = a.indexOf("*");
        const bb = b.indexOf("*");
        if (ba !== bb) return bb - ba;
        return b.length - a.length;
      });
    if (expansion.length === 0) log(0, "no pattern keys to try", "skip");
    for (const key of expansion) {
      const base = key.slice(0, key.indexOf("*"));
      const trailer = key.slice(key.indexOf("*") + 1);
      if (subpath.startsWith(base) && subpath !== base) {
        if (trailer.length === 0 || (subpath.endsWith(trailer) && subpath.length >= key.length)) {
          const match = subpath.slice(base.length, subpath.length - trailer.length);
          log(0, `pattern "${key}" matches, "*" = "${match}"`, "match");
          return target(obj[key], match, 1);
        }
      }
      log(0, `pattern "${key}" doesn't match`, "skip");
    }
    return null;
  }

  try {
    return { ok: true as const, value: run(), trace };
  } catch (e) {
    if (e instanceof ResolveError) return { ok: false as const, code: e.code, message: e.message, trace };
    throw e;
  }
}

/* --------------------------------------------------------------------- UI */

export function ExportsResolverPlayground() {
  const id = useId();
  const [json, setJson] = useState(DEFAULT_EXPORTS);
  const [spec, setSpec] = useState("eigen/server");
  const [conds, setConds] = useState<Set<Condition>>(new Set(["node", "import"]));

  let parsed: { ok: true; value: Json } | { ok: false; error: string };
  try {
    parsed = { ok: true, value: JSON.parse(json) as Json };
  } catch (e) {
    parsed = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const s = spec.trim();
  const ownsSpec = s === PKG || s.startsWith(PKG + "/");
  const subpath = s === PKG ? "." : "./" + s.slice(PKG.length + 1);
  const result = parsed.ok && ownsSpec ? resolveExports(parsed.value, subpath, new Set<string>(conds)) : null;

  const toggle = (c: Condition) =>
    setConds((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  return (
    <Playground
      title="Resolve an import through exports"
      prompt="Pick a specifier and a set of active conditions. Condition objects are read in their own key order — the first active key wins, whatever order you tick the boxes in."
      caption="Exact subpaths beat patterns; within a target, conditions are tried in the order the package lists them, and default always matches."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor={`${id}-json`} className="mb-1 block text-xs font-semibold text-fd-muted-foreground">
            packages/eigen/package.json → <span className="font-mono">"exports"</span>
          </label>
          <textarea
            id={`${id}-json`}
            className={cn(inputClass, "h-80 resize-y text-xs leading-5")}
            value={json}
            onChange={(e) => setJson(e.target.value)}
            spellCheck={false}
            wrap="off"
            aria-invalid={!parsed.ok}
          />
          {!parsed.ok && <p className="m-0 mt-1 text-xs text-fd-warning">Invalid JSON: {parsed.error}</p>}
          <button
            type="button"
            className={cn(buttonClass, "mt-1.5 py-1 text-xs")}
            onClick={() => setJson(DEFAULT_EXPORTS)}
          >
            Reset to Part 40&rsquo;s map
          </button>
        </div>

        <div className="min-w-0 space-y-3">
          <div>
            <label htmlFor={`${id}-spec`} className="mb-1 block text-xs font-semibold text-fd-muted-foreground">
              import specifier
            </label>
            <input
              id={`${id}-spec`}
              className={inputClass}
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              spellCheck={false}
              autoCapitalize="off"
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SPECIFIERS.map((x) => (
                <button
                  key={x}
                  type="button"
                  aria-pressed={s === x}
                  className={cn(
                    buttonClass,
                    "px-2 py-0.5 font-mono text-xs",
                    s === x && "border-fd-primary bg-fd-primary/10",
                  )}
                  onClick={() => setSpec(x)}
                >
                  {x}
                </button>
              ))}
            </div>
          </div>

          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="mb-1 text-xs font-semibold text-fd-muted-foreground">Active conditions</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {CONDITIONS.map((c) => (
                <label
                  key={c}
                  className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-sm text-fd-foreground"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--color-fd-primary)]"
                    checked={conds.has(c)}
                    onChange={() => toggle(c)}
                  />
                  {c}
                </label>
              ))}
              <label className="inline-flex items-center gap-1.5 font-mono text-sm text-fd-muted-foreground">
                <input type="checkbox" className="size-4 accent-[var(--color-fd-primary)]" checked disabled />
                default <span className="font-sans text-xs">(always)</span>
              </label>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => {
                const on = p.conds.length === conds.size && p.conds.every((c) => conds.has(c));
                return (
                  <button
                    key={p.label}
                    type="button"
                    aria-pressed={on}
                    className={cn(buttonClass, "px-2 py-0.5 text-xs", on && "border-fd-primary bg-fd-primary/10")}
                    onClick={() => setConds(new Set(p.conds))}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div aria-live="polite" className="space-y-3">
            {!ownsSpec ? (
              <Output label="Result" tone="warning">
                <span className="font-sans">
                  “{s}” isn&rsquo;t this package: specifiers must be &ldquo;
                  {PKG}&rdquo; or start with &ldquo;{PKG}/&rdquo;.
                </span>
              </Output>
            ) : !result ? (
              <Output label="Result" tone="warning">
                <span className="font-sans">Fix the JSON to resolve.</span>
              </Output>
            ) : result.ok ? (
              <Output label={`Resolved (subpath "${subpath}")`} tone="accent">
                node_modules/eigen/{result.value.slice(2)}
              </Output>
            ) : (
              <Output label={result.code} tone="warning">
                <span className="font-sans">{result.message}</span>
              </Output>
            )}
          </div>

          {result && (
            <div className="rounded-lg border border-fd-border bg-fd-background p-3">
              <p className="m-0 mb-1.5 text-[0.7rem] font-semibold tracking-[0.06em] text-fd-muted-foreground uppercase">
                Trace
              </p>
              <ol className="m-0 list-none space-y-0.5 p-0 font-mono text-xs leading-5">
                {result.trace.map((step, i) => (
                  <li
                    key={i}
                    style={{ paddingLeft: `${step.depth * 0.9}rem` }}
                    className={cn(
                      "break-words",
                      step.tone === "match" && "text-fd-primary",
                      step.tone === "skip" && "text-fd-muted-foreground",
                      step.tone === "fail" && "text-fd-warning",
                      !step.tone && "text-fd-foreground",
                    )}
                  >
                    {step.tone === "match" ? "✓ " : step.tone === "fail" ? "✗ " : step.tone === "skip" ? "· " : "→ "}
                    {step.text}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </Playground>
  );
}
