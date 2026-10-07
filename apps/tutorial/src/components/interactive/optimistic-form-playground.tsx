"use client";

import { startTransition, useEffect, useId, useOptimistic, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/cn";

import { inputClass, Output, Playground, primaryButtonClass } from "./frame";

/*
 * Part 38's TodoList, with the server function swapped for a simulated one.
 * The structure is the module's: confirmed state in useState, useOptimistic
 * on top of it, a form action that adds the optimistic item, awaits the
 * server, and either commits the saved row in a transition or records the
 * error. React drops the optimistic value when the action ends either way.
 */

type Todo = { id: string; title: string; completed: boolean };

const INITIAL: Todo[] = [
  { id: "1", title: "Read Part 38", completed: true },
  { id: "2", title: "Wire up <Form>", completed: false },
];

interface LogLine {
  n: number;
  ok: boolean;
  text: string;
}

export function OptimisticFormPlayground() {
  const uid = useId();
  const [latency, setLatency] = useState(1500);
  const [failNext, setFailNext] = useState(false);
  // The simulated server reads these when a request starts
  const latencyRef = useRef(latency);
  const failRef = useRef(failNext);
  useEffect(() => {
    latencyRef.current = latency;
    failRef.current = failNext;
  }, [latency, failNext]);
  const nextId = useRef(3);

  // Confirmed state, seeded from the "loader"
  const [todos, setTodos] = useState(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [optimisticTodos, addOptimistic] = useOptimistic(todos, (state: Todo[], newTodo: Todo) => [...state, newTodo]);

  /** Stands in for the addTodo server function's RPC stub */
  async function addTodo({ title }: { title: string }): Promise<Todo> {
    const fail = failRef.current;
    if (fail) {
      // "Fail the next request" applies to one request. Outside the action's
      // transition, so the checkbox clears now rather than when the action ends.
      failRef.current = false;
      setTimeout(() => setFailNext(false), 0);
    }
    await new Promise((r) => setTimeout(r, latencyRef.current));
    // The endpoint's generic 400 body (Part 15), not zod's "Title required"
    if (title.trim() === "") throw new Error("Invalid input");
    if (fail) throw new Error("Server answered 500: INSERT failed");
    return { id: String(nextId.current++), title: title.trim(), completed: false };
  }

  // A form action: React already runs it inside a transition
  async function addAction(formData: FormData) {
    const title = String(formData.get("title") ?? "");

    // Show the todo immediately
    addOptimistic({ id: `temp-${Date.now()}`, title, completed: false });

    try {
      // Then persist on the "server"
      const saved = await addTodo({ title });
      setError(null);
      setLog((l) =>
        [{ n: (l[0]?.n ?? 0) + 1, ok: true, text: `saved "${saved.title}" as id ${saved.id}` }, ...l].slice(0, 5),
      );
      // State updates after an await need their own transition
      startTransition(() => setTodos((current) => [...current, saved]));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not add todo";
      setError(message);
      setLog((l) =>
        [
          { n: (l[0]?.n ?? 0) + 1, ok: false, text: `"${title}" failed (${message}); optimistic item dropped` },
          ...l,
        ].slice(0, 5),
      );
    }
  }

  const pendingCount = optimisticTodos.filter((t) => t.id.startsWith("temp-")).length;

  return (
    <Playground
      title="useOptimistic with a slow, flaky server"
      prompt="Add a todo. Slow the server down to watch the optimistic item, then make the next request fail."
      caption="The optimistic item exists only while the action runs. On success the confirmed list gains the saved row; on failure nothing needs undoing, because React simply stops showing the optimistic value."
    >
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label htmlFor={`${uid}-latency`} className="grid gap-1 text-sm text-fd-foreground">
            <span className="flex justify-between gap-2">
              Server latency <span className="font-mono text-fd-muted-foreground">{latency}ms</span>
            </span>
            <input
              id={`${uid}-latency`}
              type="range"
              min={200}
              max={5000}
              step={100}
              value={latency}
              onChange={(e) => setLatency(Number(e.target.value))}
              aria-valuetext={`${latency} milliseconds`}
              className="w-full accent-fd-primary"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-fd-foreground">
            <input
              type="checkbox"
              checked={failNext}
              onChange={(e) => setFailNext(e.target.checked)}
              className="size-4 accent-fd-primary"
            />
            Fail the next request (500)
          </label>
        </div>

        <div className="rounded-lg border border-fd-border bg-fd-background p-3">
          <ul className="m-0 grid list-none gap-1.5 p-0" aria-label="Todos">
            {optimisticTodos.map((todo) => {
              const optimistic = todo.id.startsWith("temp-");
              return (
                <li
                  key={todo.id}
                  className={cn(
                    "relative flex items-center gap-2 overflow-hidden rounded-md border px-2.5 py-1.5 text-sm",
                    optimistic
                      ? "border-dashed border-fd-primary/50 text-fd-foreground/60"
                      : "border-fd-border text-fd-foreground",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-3 shrink-0 rounded-full border",
                      todo.completed ? "border-fd-primary bg-fd-primary" : "border-fd-muted-foreground/60",
                    )}
                  />
                  <span className="min-w-0 flex-1 break-words">
                    {todo.title || <em className="text-fd-muted-foreground">(empty)</em>}
                  </span>
                  <span className="shrink-0 font-mono text-[0.7rem] text-fd-muted-foreground">
                    {optimistic ? "saving…" : `id ${todo.id}`}
                  </span>
                  {optimistic && (
                    <span
                      aria-hidden
                      className="eigen-optimistic-progress absolute bottom-0 left-0 h-0.5 bg-fd-primary motion-reduce:hidden"
                      style={{ animationDuration: `${latency}ms` }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          <style>{`@keyframes eigen-optimistic-progress{from{width:0}to{width:100%}}.eigen-optimistic-progress{animation:eigen-optimistic-progress linear forwards}`}</style>

          <form action={addAction} className="mt-3 flex gap-2">
            <label htmlFor={`${uid}-title`} className="sr-only">
              New todo
            </label>
            <input
              id={`${uid}-title`}
              name="title"
              placeholder="New todo"
              autoComplete="off"
              required
              className={inputClass}
            />
            <SubmitButton />
          </form>
          {error && (
            <p role="alert" className="m-0 mt-2 text-sm text-fd-error">
              {error}
            </p>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div aria-live="polite" aria-atomic="true">
            <Output label="State" tone={pendingCount ? "accent" : "default"}>
              {`todos (confirmed): ${todos.length}\noptimisticTodos:   ${optimisticTodos.length}${
                pendingCount ? `  (${pendingCount} optimistic, action pending)` : ""
              }`}
            </Output>
          </div>
          <Output label="Server responses">
            {log.length === 0 ? (
              <span className="text-fd-muted-foreground">None yet.</span>
            ) : (
              <ol className="m-0 grid list-none gap-1 p-0 text-xs leading-5">
                {log.map((l) => (
                  <li key={l.n} className={l.ok ? "text-fd-foreground" : "text-fd-error"}>
                    {l.ok ? "✓ " : "✗ "}
                    {l.text}
                  </li>
                ))}
              </ol>
            )}
          </Output>
        </div>
      </div>
    </Playground>
  );
}

/** Reads the parent form's pending state; must be a child of the <form> */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn(primaryButtonClass, "shrink-0")}>
      {pending ? "Saving…" : "Add"}
    </button>
  );
}
