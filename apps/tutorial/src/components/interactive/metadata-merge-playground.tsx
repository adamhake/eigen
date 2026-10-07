"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/cn";

import { buttonClass, inputClass, Output, Playground } from "./frame";

/*
 * Part 30's resolveMetadata + deepMerge + renderMetadataToHTML, ported as-is.
 * Layouts merge outermost → innermost, then the page on top. deepMerge only
 * recurses when BOTH sides are plain objects; anything else (strings, arrays,
 * null) is replaced by the child's value. There are no title templates: a
 * child's title simply replaces the parent's.
 */

type Source = "root" | "section" | "page";
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const LAYERS: Array<{ id: Source; label: string; file: string; initial: string }> = [
  {
    id: "root",
    label: "Root layout",
    file: "src/pages/layout.tsx · metadata",
    initial: `{
  "title": "My Blog",
  "openGraph": { "siteName": "My Blog", "locale": "en_US" },
  "twitter": { "card": "summary_large_image" }
}`,
  },
  {
    id: "section",
    label: "Posts layout",
    file: "src/pages/posts/layout.tsx · metadata",
    initial: `{
  "description": "Articles from My Blog.",
  "openGraph": {
    "type": "article",
    "images": [{ "url": "https://myblog.com/og/posts.png", "width": 1200, "height": 630 }]
  }
}`,
  },
  {
    id: "page",
    label: "Page",
    file: "src/pages/posts/[id].tsx · generateMetadata result",
    initial: `{
  "title": "Post Title",
  "openGraph": { "title": "Post Title" }
}`,
  },
];

/* --------------------------------------------- deepMerge, with provenance */

type Tagged = { kind: "obj"; entries: Record<string, Tagged> } | { kind: "leaf"; src: Source; value: Json };
type ObjNode = Extract<Tagged, { kind: "obj" }>;

function isPlainObject(v: unknown): v is Record<string, Json> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function tag(value: Json, src: Source): Tagged {
  if (isPlainObject(value)) {
    return { kind: "obj", entries: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, tag(v, src)])) };
  }
  return { kind: "leaf", src, value };
}

/** Part 30's deepMerge: child values win; recurse only when both are plain objects */
function deepMerge(parent: Tagged & { kind: "obj" }, child: Tagged & { kind: "obj" }): Tagged & { kind: "obj" } {
  const out: Record<string, Tagged> = { ...parent.entries };
  for (const [key, value] of Object.entries(child.entries)) {
    const prev = out[key];
    out[key] = prev?.kind === "obj" && value.kind === "obj" ? deepMerge(prev, value) : value;
  }
  return { kind: "obj", entries: out };
}

function untag(t: Tagged): Json {
  if (t.kind === "leaf") return t.value;
  return Object.fromEntries(Object.entries(t.entries).map(([k, v]) => [k, untag(v)]));
}

/* ----------------------------------------------- renderMetadataToHTML */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function metaTag(attr: "name" | "property", key: string, value: unknown): string {
  return `<meta ${attr}="${escapeHtml(key)}" content="${escapeHtml(String(value))}" />`;
}
const SCRIPT_ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};
function serializeForScript(value: unknown): string {
  return (JSON.stringify(value) ?? "null").replace(/[<>&\u2028\u2029]/g, (c) => SCRIPT_ESCAPES[c]);
}

/* The playground accepts any JSON, so reads are loosely typed like the real code's runtime would be */
function renderMetadataToHTML(meta: any): string[] {
  const tags: string[] = [];
  if (meta.title) tags.push(`<title>${escapeHtml(String(meta.title))}</title>`);
  if (meta.description) tags.push(metaTag("name", "description", meta.description));

  if (meta.openGraph) {
    const og = meta.openGraph;
    if (og.title) tags.push(metaTag("property", "og:title", og.title));
    if (og.description) tags.push(metaTag("property", "og:description", og.description));
    if (og.type) tags.push(metaTag("property", "og:type", og.type));
    if (og.siteName) tags.push(metaTag("property", "og:site_name", og.siteName));
    if (og.locale) tags.push(metaTag("property", "og:locale", og.locale));
    if (og.publishedTime) tags.push(metaTag("property", "article:published_time", og.publishedTime));
    for (const img of Array.isArray(og.images) ? og.images : []) {
      tags.push(metaTag("property", "og:image", img?.url));
      if (img?.width) tags.push(metaTag("property", "og:image:width", img.width));
      if (img?.height) tags.push(metaTag("property", "og:image:height", img.height));
      if (img?.alt) tags.push(metaTag("property", "og:image:alt", img.alt));
    }
  }

  if (meta.twitter) {
    const tw = meta.twitter;
    if (tw.card) tags.push(metaTag("name", "twitter:card", tw.card));
    if (tw.title) tags.push(metaTag("name", "twitter:title", tw.title));
    if (tw.description) tags.push(metaTag("name", "twitter:description", tw.description));
    if (tw.image) tags.push(metaTag("name", "twitter:image", tw.image));
    if (tw.creator) tags.push(metaTag("name", "twitter:creator", tw.creator));
  }

  if (meta.alternates?.canonical) {
    tags.push(`<link rel="canonical" href="${escapeHtml(String(meta.alternates.canonical))}" />`);
  }
  for (const [lang, href] of Object.entries(meta.alternates?.languages ?? {})) {
    tags.push(`<link rel="alternate" hreflang="${escapeHtml(lang)}" href="${escapeHtml(String(href))}" />`);
  }

  if (meta.robots) {
    const directives: string[] = [];
    if (meta.robots.index === false) directives.push("noindex");
    if (meta.robots.follow === false) directives.push("nofollow");
    if (meta.robots.noarchive) directives.push("noarchive");
    if (directives.length) tags.push(metaTag("name", "robots", directives.join(", ")));
  }

  for (const [name, content] of Object.entries(meta.other ?? {})) {
    tags.push(metaTag("name", name, content));
  }

  if (meta.structuredData) {
    const items = Array.isArray(meta.structuredData) ? meta.structuredData : [meta.structuredData];
    for (const item of items) tags.push(`<script type="application/ld+json">${serializeForScript(item)}</script>`);
  }
  return tags;
}

/* ------------------------------------------------------- rendering */

const SRC_CLASS: Record<Source, string> = {
  root: "text-fd-muted-foreground",
  section: "text-fd-info",
  page: "text-fd-primary",
};
const SRC_LABEL: Record<Source, string> = { root: "root layout", section: "posts layout", page: "page" };

/** Pretty-print the merged object, annotating each leaf with the layer it came from */
function TaggedView({ node, indent = 0 }: { node: Tagged & { kind: "obj" }; indent?: number }) {
  const pad = "  ".repeat(indent + 1);
  const keys = Object.keys(node.entries);
  if (keys.length === 0) return <>{"{}"}</>;
  return (
    <>
      {"{\n"}
      {keys.map((k, i) => {
        const v = node.entries[k];
        const comma = i < keys.length - 1 ? "," : "";
        return (
          <span key={k}>
            {pad}
            {JSON.stringify(k)}:{" "}
            {v.kind === "obj" ? (
              <>
                <TaggedView node={v} indent={indent + 1} />
                {comma}
              </>
            ) : (
              <>
                <span className={SRC_CLASS[v.src]}>{JSON.stringify(v.value)}</span>
                {comma} <span className={cn("text-xs", SRC_CLASS[v.src])}>{`// ${SRC_LABEL[v.src]}`}</span>
              </>
            )}
            {"\n"}
          </span>
        );
      })}
      {"  ".repeat(indent)}
      {"}"}
    </>
  );
}

function parse(text: string): { ok: true; value: Record<string, Json> } | { ok: false; error: string } {
  if (text.trim() === "") return { ok: true, value: {} };
  try {
    const value = JSON.parse(text) as Json;
    if (!isPlainObject(value)) return { ok: false, error: "Metadata must be an object." };
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

export function MetadataMergePlayground() {
  const uid = useId();
  const [texts, setTexts] = useState<Record<Source, string>>(
    () => Object.fromEntries(LAYERS.map((l) => [l.id, l.initial])) as Record<Source, string>,
  );

  const parsed = LAYERS.map((l) => ({ ...l, result: parse(texts[l.id]) }));
  const firstError = parsed.find((p) => !p.result.ok);

  // resolveMetadata: start from {}, merge each layer in order (layouts, then the page)
  const merged: ObjNode | null = firstError
    ? null
    : parsed.reduce<ObjNode>((acc, p) => (p.result.ok ? deepMerge(acc, tag(p.result.value, p.id) as ObjNode) : acc), {
        kind: "obj",
        entries: {},
      });
  const head = merged ? renderMetadataToHTML(untag(merged)) : [];

  return (
    <Playground
      title="Merging layout and page metadata"
      prompt="Edit any layer (JSON). Try giving the page its own openGraph.images, or setting openGraph to a string."
      caption="Layouts merge outermost to innermost, then the page on top. Plain objects merge key by key; everything else, arrays included, is replaced by the child's value."
    >
      <div className="grid gap-4 [&>*]:min-w-0">
        <div className="grid gap-3 [&>*]:min-w-0">
          {parsed.map((p) => (
            <div key={p.id} className="grid min-w-0 content-start gap-1">
              <label htmlFor={`${uid}-${p.id}`} className="text-sm font-semibold text-fd-foreground">
                <span className={SRC_CLASS[p.id]}>●</span> {p.label}
                <span className="block font-mono text-[0.7rem] font-normal break-all text-fd-muted-foreground">
                  {p.file}
                </span>
              </label>
              <textarea
                id={`${uid}-${p.id}`}
                spellCheck={false}
                rows={p.initial.split("\n").length + 1}
                wrap="off"
                value={texts[p.id]}
                aria-invalid={!p.result.ok}
                aria-describedby={!p.result.ok ? `${uid}-${p.id}-err` : undefined}
                onChange={(e) => setTexts((t) => ({ ...t, [p.id]: e.target.value }))}
                className={cn(inputClass, "resize-y text-xs leading-5", !p.result.ok && "border-fd-error")}
              />
              {!p.result.ok && (
                <p id={`${uid}-${p.id}-err`} className="m-0 text-xs text-fd-error">
                  {p.result.error}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className={buttonClass}
            onClick={() => setTexts(Object.fromEntries(LAYERS.map((l) => [l.id, l.initial])) as Record<Source, string>)}
          >
            Reset to Part 30&apos;s example
          </button>
        </div>

        <p className="sr-only" aria-live="polite">
          {merged ? `Merged metadata renders ${head.length} head tags.` : `Invalid JSON in ${firstError?.label}.`}
        </p>
        <div className="grid gap-3 [&>*]:min-w-0">
          <Output label="resolveMetadata() result" tone={firstError ? "warning" : "default"}>
            {merged ? (
              <div className="text-xs leading-5">
                <TaggedView node={merged} />
              </div>
            ) : (
              `Fix the JSON in “${firstError?.label}” to see the merge.`
            )}
          </Output>
          <Output label="Tags replacing <!--eigen-head-->" tone="accent">
            {merged ? (
              head.length ? (
                <span className="block overflow-x-auto text-xs leading-5 whitespace-pre">{head.join("\n")}</span>
              ) : (
                <span className="text-fd-muted-foreground">No tags.</span>
              )
            ) : (
              "—"
            )}
          </Output>
        </div>
      </div>
    </Playground>
  );
}
