"use client";

import { type ReactNode, useId, useMemo, useState } from "react";

import { cn } from "@/lib/cn";

import { Output, Playground, buttonClass, inputClass } from "./frame";

/* Part 3 — packages/eigen/serialize.ts, verbatim. */
const SCRIPT_ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

function serializeForScript(value: unknown): string {
  return (JSON.stringify(value) ?? "null").replace(/[<>&\u2028\u2029]/g, (char) => SCRIPT_ESCAPES[char]);
}

/* -------------------------------------------------------------------------- *
 * A small model of the HTML tokenizer's script-data states (HTML spec 13.2.5,
 * "script data" through "script data double escaped"). It answers one
 * question: where does the parser decide this <script> element ends?
 * -------------------------------------------------------------------------- */

const DELIM = /[\t\n\f />]/;

function isTag(s: string, i: number, tag: "</script" | "<script") {
  return s.slice(i, i + tag.length).toLowerCase() === tag && DELIM.test(s[i + tag.length] ?? "");
}

/** Index where the end tag that closes the script starts, or -1 if it never closes. */
function scriptEnd(s: string): { end: number; trap: number } {
  let state: "data" | "escaped" | "double" = "data";
  let trap = -1; // where a "<!--" + "<script" sequence started swallowing end tags
  let i = 0;
  while (i < s.length) {
    if (state === "data") {
      if (s.startsWith("<!--", i)) {
        state = "escaped";
        i += 2; // stay on the dashes so "<!-->" closes the escape again
        continue;
      }
      if (isTag(s, i, "</script")) return { end: i, trap };
    } else if (state === "escaped") {
      if (s.startsWith("-->", i)) {
        state = "data";
        i += 3;
        continue;
      }
      if (isTag(s, i, "</script")) return { end: i, trap };
      if (isTag(s, i, "<script")) {
        state = "double";
        if (trap === -1) trap = i;
        i += 7;
        continue;
      }
    } else {
      if (s.startsWith("-->", i)) {
        state = "data";
        i += 3;
        continue;
      }
      if (isTag(s, i, "</script")) {
        state = "escaped"; // in this state "</script>" does NOT end the element
        i += 8;
        continue;
      }
    }
    i++;
  }
  return { end: -1, trap };
}

/* ------------------------------------------------------------------ view */

const PRESETS: { label: string; value: string }[] = [
  {
    label: "</script> injection",
    value: `{
  "title": "Hello",
  "comment": "</script><script>alert(1)</script>",
  "note": "line\\u2028separator"
}`,
  },
  {
    label: "<!-- <script> trap",
    value: `{
  "bio": "<!--<script>"
}`,
  },
  {
    label: "Harmless",
    value: `{
  "title": "Ben & Jerry's",
  "tags": ["a", "b"]
}`,
  },
];

const PREFIX = "<script>window.__EIGEN_DATA__ = ";
const SUFFIX = "</script>";
// The page goes on after the data script; a trap can swallow this too.
const AFTER = '\n<script type="module" src="/src/entry-client.tsx"></script>';

/** Show invisible line separators instead of rendering them as nothing. */
function visible(text: string): ReactNode[] {
  return text.split(/([\u2028\u2029])/).map((part, i) =>
    part === "\u2028" || part === "\u2029" ? (
      <mark key={i} className="rounded bg-fd-warning/20 px-0.5 text-fd-warning" title="raw line separator character">
        {part === "\u2028" ? "⟨U+2028⟩" : "⟨U+2029⟩"}
      </mark>
    ) : (
      part
    ),
  );
}

function Parsed({ json, safe }: { json: string; safe: boolean }) {
  const doc = PREFIX + json + SUFFIX + AFTER;
  const contentStart = "<script>".length;
  const intendedEnd = PREFIX.length + json.length;
  const { end: rel, trap: trapRel } = scriptEnd(doc.slice(contentStart));
  const end = rel === -1 ? -1 : contentStart + rel;
  const ok = end === intendedEnd;
  const js = doc.slice(contentStart, end === -1 ? doc.length : end);

  let verdict: string;
  if (ok) {
    verdict = "The script ends at the intended </script>, so its body is the whole assignment.";
  } else if (end === -1) {
    verdict = `A "<!--" followed by "<script" put the tokenizer in its double-escaped state, where </script> no longer ends the element. The script never closes and swallows the rest of the page as script text.`;
  } else {
    verdict = `The parser ends the script ${intendedEnd - end} characters early, at the </script> inside the data. Everything after it is parsed as HTML${
      /<script/i.test(doc.slice(end + 9, intendedEnd)) ? " — including a brand-new <script> element" : ""
    }.`;
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Output label={safe ? "serializeForScript(data)" : "JSON.stringify(data)"} tone={safe ? "accent" : "default"}>
        <span className="[font-variant-ligatures:none]">{visible(json)}</span>
      </Output>
      <div
        className={cn(
          "rounded-lg border p-3",
          ok ? "border-fd-primary/40 bg-fd-primary/6" : "border-fd-warning/40 bg-fd-warning/6",
        )}
      >
        <p className="m-0 mb-1.5 text-[0.7rem] font-semibold tracking-[0.06em] text-fd-muted-foreground uppercase">
          How the HTML parser splits it
        </p>
        <pre className="m-0 font-mono text-sm leading-6 break-words whitespace-pre-wrap text-fd-foreground">
          <span className="text-fd-muted-foreground">{"<script>"}</span>
          <span className="rounded-sm bg-fd-primary/10">
            {visible(js.slice(0, trapRel === -1 ? js.length : trapRel))}
          </span>
          {trapRel !== -1 && end === -1 && (
            <span className="rounded-sm bg-fd-warning/20 underline decoration-fd-warning decoration-wavy">
              {visible(js.slice(trapRel))}
            </span>
          )}
          {end !== -1 && (
            <>
              <span
                className={cn("rounded-sm font-semibold", ok ? "text-fd-primary" : "bg-fd-warning/25 text-fd-warning")}
              >
                {"</script>"}
              </span>
              <span className={cn(!ok && "rounded-sm bg-fd-warning/10")}>{visible(doc.slice(end + 9))}</span>
            </>
          )}
        </pre>
        <p className="m-0 mt-2 flex flex-wrap gap-x-3 text-xs text-fd-muted-foreground">
          <span>
            <span className="mr-1 inline-block size-2.5 rounded-sm bg-fd-primary/25 align-middle" />
            script text
          </span>
          {!ok && (
            <span>
              <span className="mr-1 inline-block size-2.5 rounded-sm bg-fd-warning/30 align-middle" />
              where it goes wrong
            </span>
          )}
        </p>
        <p className="m-0 mt-2 text-sm leading-6 text-fd-foreground">
          {verdict}
          {!ok && end !== -1 && (
            <span className="text-fd-muted-foreground">
              {" "}
              The script body now stops inside a string literal, so it is a SyntaxError and window.__EIGEN_DATA__ is
              never set.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

export function ScriptEscapingPlayground() {
  const [source, setSource] = useState(PRESETS[0].value);
  const id = useId();

  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(source) as unknown };
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : String(e) };
    }
  }, [source]);

  const naive = parsed.ok ? (JSON.stringify(parsed.value) ?? "null") : "";
  const safe = parsed.ok ? serializeForScript(parsed.value) : "";
  const roundTrips = parsed.ok && JSON.stringify(JSON.parse(safe)) === naive;
  const hasSeparator = parsed.ok && /[\u2028\u2029]/.test(naive);

  return (
    <Playground
      title="Embedding loader data in a <script>"
      prompt={
        <>
          Edit the loader data as JSON (<code>{"\\u2028"}</code> in a string becomes the real character), then compare
          where the HTML parser ends each script.
        </>
      }
      caption="The HTML parser looks for </script> before any JavaScript runs; serializeForScript escapes < > & so the data can never contain one, and the value arrives unchanged."
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm text-fd-muted-foreground" id={`${id}-presets`}>
          Examples:
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className={cn(buttonClass, "font-mono text-xs [font-variant-ligatures:none]")}
            onClick={() => setSource(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <label htmlFor={`${id}-data`} className="mb-1.5 block text-sm font-medium text-fd-foreground">
        Loader data
      </label>
      <textarea
        id={`${id}-data`}
        value={source}
        onChange={(e) => setSource(e.target.value)}
        rows={5}
        spellCheck={false}
        className={cn(inputClass, "resize-y leading-6 [font-variant-ligatures:none]")}
      />

      <div aria-live="polite" className="mt-4">
        {parsed.ok ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="m-0 mb-2 text-sm font-semibold text-fd-foreground">Naive</p>
                <Parsed json={naive} safe={false} />
              </div>
              <div>
                <p className="m-0 mb-2 text-sm font-semibold text-fd-primary">serializeForScript</p>
                <Parsed json={safe} safe />
              </div>
            </div>
            <p className="m-0 mt-3 text-sm leading-6 text-fd-muted-foreground">
              {roundTrips
                ? "JSON.parse(serializeForScript(data)) equals the original: \\u003c inside a string literal is just <."
                : "Round trip mismatch."}
              {hasSeparator &&
                " The raw U+2028 in the naive output is legal in modern JavaScript, but older engines treated it as a line break inside a string literal — a SyntaxError — so serializeForScript escapes it too."}
            </p>
          </>
        ) : (
          <Output label="Not valid JSON" tone="warning">
            {parsed.message}
          </Output>
        )}
      </div>
    </Playground>
  );
}
