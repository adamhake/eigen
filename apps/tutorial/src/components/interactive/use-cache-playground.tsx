"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/cn";

import { buttonClass, inputClass, Output, Playground, primaryButtonClass } from "./frame";

/*
 * Part 25's runtime, run against a simulated clock:
 *  - key = `${fnId}:${stableStringify(args)}` (closures are NOT part of it)
 *  - MemoryCacheStore.get drops entries older than `expire`
 *  - runShared: age < revalidate → fresh hit; age < expire → serve stale and
 *    refill in the background; otherwise run the function and store it
 *  - revalidateTag deletes every entry carrying the tag
 * The background refill is treated as finishing instantly after the response.
 */

const PROFILES = {
  seconds: { revalidate: 1, expire: 60 },
  minutes: { revalidate: 60, expire: 3_600 },
  hours: { revalidate: 3_600, expire: 86_400 },
  days: { revalidate: 86_400, expire: 604_800 },
} as const;
type Profile = keyof typeof PROFILES;

// The plugin hashes `${relative path}:${name}:${node.start}`; any 8 hex chars stand in for it here
const FN_ID = "getPost_5c1e9a07";

interface Entry {
  value: { id: string; title: string; fetchedAt: number };
  createdAt: number; // seconds on the simulated clock
  revalidate: number;
  expire: number;
  tags: string[];
}

type Outcome = "fresh" | "stale" | "miss";

interface LogLine {
  n: number;
  text: string;
  outcome: Outcome | "revalidate" | "db";
}

/** Part 25's stableStringify, for the JSON-like values an input can produce */
function stableStringify(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as object).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

const deriveCacheKey = (fnId: string, args: unknown[]) => `${fnId}:${stableStringify(args)}`;

function fmtDuration(s: number): string {
  if (!Number.isFinite(s)) return "∞";
  if (s === 0) return "0s";
  const parts: string[] = [];
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3_600);
  const m = Math.floor((s % 3_600) / 60);
  const sec = s % 60;
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (sec) parts.push(`${sec}s`);
  return parts.join(" ");
}

const STEPS: Array<[string, number]> = [
  ["+1s", 1],
  ["+30s", 30],
  ["+1m", 60],
  ["+15m", 900],
  ["+1h", 3_600],
  ["+1d", 86_400],
];

function stateOf(e: Entry, now: number): "fresh" | "stale" | "expired" {
  const age = now - e.createdAt;
  if (age < e.revalidate) return "fresh";
  // MemoryCacheStore.get deletes at age > expire; runShared treats age >= expire as a miss
  if (age < e.expire) return "stale";
  return "expired";
}

export function UseCachePlayground() {
  const uid = useId();
  const [now, setNow] = useState(0);
  const [profile, setProfile] = useState<Profile>("minutes");
  const [arg, setArg] = useState("42");
  const [store, setStore] = useState<Record<string, Entry>>({});
  // "Database" rows: the current revision of each post's title
  const [db, setDb] = useState<Record<string, number>>({});
  const [queries, setQueries] = useState(0);
  const [log, setLog] = useState<LogLine[]>([]);
  const [last, setLast] = useState<{ key: string; outcome: Outcome; served: Entry["value"] } | null>(null);

  const key = deriveCacheKey(FN_ID, [arg]);
  const life = PROFILES[profile];

  const push = (text: string, outcome: LogLine["outcome"]) =>
    setLog((l) => [{ n: (l[0]?.n ?? 0) + 1, text, outcome }, ...l].slice(0, 6));

  /** Run the original function body: cacheLife/cacheTag record into the scope, then the "query" */
  const runImpl = (id: string): Entry => {
    const rev = db[id] ?? 1;
    setQueries((q) => q + 1);
    return {
      value: { id, title: `Post ${id} (rev ${rev})`, fetchedAt: now },
      createdAt: now,
      revalidate: life.revalidate,
      expire: life.expire,
      tags: [`post-${id}`],
    };
  };

  const call = () => {
    const sig = `getPost(${JSON.stringify(arg)})`;
    let entry: Entry | undefined = store[key];
    // MemoryCacheStore.get: an entry past `expire` is deleted and reported missing
    if (entry && now - entry.createdAt > entry.expire) entry = undefined;
    const age = entry ? now - entry.createdAt : Infinity;

    if (entry && age < entry.revalidate) {
      setLast({ key, outcome: "fresh", served: entry.value });
      push(`${sig} → fresh hit (age ${fmtDuration(age)}), function not run`, "fresh");
      return;
    }
    if (entry && age < entry.expire) {
      const refilled = runImpl(arg);
      setStore((s) => ({ ...s, [key]: refilled }));
      setLast({ key, outcome: "stale", served: entry.value });
      push(
        `${sig} → stale hit (age ${fmtDuration(age)}): served the old value, background refill stored "${refilled.value.title}"`,
        "stale",
      );
      return;
    }
    const filled = runImpl(arg);
    setStore((s) => ({ ...s, [key]: filled }));
    setLast({ key, outcome: "miss", served: filled.value });
    push(
      `${sig} → miss${store[key] ? " (expired)" : ""}: ran the function, stored for revalidate ${fmtDuration(filled.revalidate)} / expire ${fmtDuration(filled.expire)}`,
      "miss",
    );
  };

  const revalidateTag = (tag: string) => {
    const doomed = Object.entries(store).filter(([, e]) => e.tags.includes(tag));
    setStore((s) => Object.fromEntries(Object.entries(s).filter(([, e]) => !e.tags.includes(tag))));
    push(`revalidateTag("${tag}") → deleted ${doomed.length} entr${doomed.length === 1 ? "y" : "ies"}`, "revalidate");
  };

  const editPost = () => {
    const next = (db[arg] ?? 1) + 1;
    setDb((d) => ({ ...d, [arg]: next }));
    push(`UPDATE posts SET title = "Post ${arg} (rev ${next})" WHERE id = ${JSON.stringify(arg)}`, "db");
  };

  const reset = () => {
    setNow(0);
    setStore({});
    setDb({});
    setQueries(0);
    setLog([]);
    setLast(null);
  };

  const tags = [...new Set(Object.values(store).flatMap((e) => e.tags))].sort();
  const entries = Object.entries(store).sort(([a], [b]) => a.localeCompare(b));

  return (
    <Playground
      title='A "use cache" function on a simulated clock'
      prompt="Call getPost, move the clock past revalidate and expire, change the post in the database, and revalidate its tag."
      caption="Fresh hits skip the function, stale hits answer with the old value and refill in the background, and revalidateTag deletes entries so the next call waits for fresh data."
    >
      <div className="grid gap-4">
        <pre className="m-0 overflow-x-auto rounded-lg border border-fd-border bg-fd-background p-3 font-mono text-[0.8rem] leading-5 text-fd-foreground">
          {`async function getPost(id: string) {
  "use cache";
  cacheLife("${profile}"); // revalidate ${fmtDuration(life.revalidate)}, expire ${fmtDuration(life.expire)}
  cacheTag(\`post-\${id}\`);
  return db.query("SELECT * FROM posts WHERE id = $1", [id]);
}`}
        </pre>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-fd-foreground" htmlFor={`${uid}-id`}>
              Argument <code className="font-mono text-xs text-fd-muted-foreground">id</code>
              <input id={`${uid}-id`} className={inputClass} value={arg} onChange={(e) => setArg(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-fd-foreground" htmlFor={`${uid}-profile`}>
              cacheLife profile (applies to the next fill)
              <select
                id={`${uid}-profile`}
                className={inputClass}
                value={profile}
                onChange={(e) => setProfile(e.target.value as Profile)}
              >
                {(Object.keys(PROFILES) as Profile[]).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryButtonClass} onClick={call}>
              Call getPost
            </button>
            <button type="button" className={buttonClass} onClick={editPost}>
              Edit post {arg || '""'} in DB
            </button>
          </div>
        </div>

        <Output label="Derived cache key">
          {key}
          {"\n"}
          <span className="text-fd-muted-foreground">
            {"// functionId + serialized args. Closed-over values are not part of the key."}
          </span>
        </Output>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Advance the clock">
          <span className="font-mono text-sm text-fd-foreground">
            clock: <span className="text-fd-primary">t = {fmtDuration(now)}</span>
          </span>
          {STEPS.map(([label, s]) => (
            <button
              key={label}
              type="button"
              className={buttonClass}
              onClick={() => setNow((t) => t + s)}
              aria-label={`Advance clock by ${label.slice(1)}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Revalidate a tag">
          {tags.length === 0 ? (
            <span className="text-sm text-fd-muted-foreground">No tags in the store yet.</span>
          ) : (
            tags.map((tag) => (
              <button key={tag} type="button" className={buttonClass} onClick={() => revalidateTag(tag)}>
                <code className="font-mono text-xs">revalidateTag(&quot;{tag}&quot;)</code>
              </button>
            ))
          )}
          <button type="button" className={cn(buttonClass, "ml-auto")} onClick={reset}>
            Reset
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div aria-live="polite" aria-atomic="true">
            <Output
              label="Last call"
              tone={last?.outcome === "fresh" ? "accent" : last?.outcome === "stale" ? "warning" : "default"}
            >
              {last ? (
                <>
                  <span className="font-semibold">
                    {last.outcome === "fresh" ? "HIT (fresh)" : last.outcome === "stale" ? "HIT (stale)" : "MISS"}
                  </span>
                  {"\n"}returned {JSON.stringify(last.served)}
                </>
              ) : (
                <span className="text-fd-muted-foreground">Not called yet.</span>
              )}
            </Output>
          </div>
          <Output label={`Function runs (db queries): ${queries}`}>
            {log.length === 0 ? (
              <span className="text-fd-muted-foreground">Nothing yet.</span>
            ) : (
              <ol className="m-0 grid list-none gap-1 p-0 text-xs leading-5">
                {log.map((l) => (
                  <li key={l.n} className={cn(l.outcome === "db" && "text-fd-muted-foreground")}>
                    {l.text}
                  </li>
                ))}
              </ol>
            )}
          </Output>
        </div>

        <div className="overflow-x-auto rounded-lg border border-fd-border">
          <table className="w-full min-w-[30rem] border-collapse text-left text-xs">
            <caption className="sr-only">Entries in the memory cache store</caption>
            <thead className="bg-fd-muted/60 text-fd-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">key</th>
                <th className="px-3 py-2 font-semibold">value.title</th>
                <th className="px-3 py-2 font-semibold">age</th>
                <th className="px-3 py-2 font-semibold">state</th>
                <th className="px-3 py-2 font-semibold">tags</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 font-sans text-fd-muted-foreground">
                    The store is empty.
                  </td>
                </tr>
              ) : (
                entries.map(([k, e]) => {
                  const st = stateOf(e, now);
                  return (
                    <tr key={k} className={cn("border-t border-fd-border", k === key && "bg-fd-primary/6")}>
                      <td className="px-3 py-2 break-all">{k}</td>
                      <td className="px-3 py-2">{e.value.title}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDuration(now - e.createdAt)}</td>
                      <td
                        className={cn(
                          "px-3 py-2 font-sans font-semibold",
                          st === "fresh" && "text-fd-primary",
                          st === "stale" && "text-fd-warning",
                          st === "expired" && "text-fd-muted-foreground",
                        )}
                      >
                        {st}
                        <span className="block font-normal text-fd-muted-foreground">
                          {st === "fresh"
                            ? `stale in ${fmtDuration(e.revalidate - (now - e.createdAt))}`
                            : st === "stale"
                              ? `expires in ${fmtDuration(e.expire - (now - e.createdAt))}`
                              : "next call misses"}
                        </span>
                      </td>
                      <td className="px-3 py-2">{e.tags.join(", ")}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Playground>
  );
}
