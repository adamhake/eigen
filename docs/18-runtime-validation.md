# Part 18: Runtime Validation — Bridging Types and Reality

*This is the eighteenth installment in a series where we build a toy Next.js on top of Vite. In [Part 17](/17-deployment-adapters), we added SSG. Now we'll tackle a gap in our type safety story: the serialized data that crosses the server/client boundary is typed at compile time but unvalidated at runtime.*

**Concepts introduced:** Schema-first data validation with zod/valibot, inferring TypeScript types from runtime schemas, typed `window.__EIGEN_DATA__` narrowing, schema-aware `defineLoader`, validation in the hydration path, the parse-don't-validate pattern.

---

## The problem

Throughout this series, we've built type safety through code generation: `RoutePaths`, `RouteParamsMap`, `PageProps<'/path', Data>`. These types are enforced by the TypeScript compiler — they catch errors before the code runs.

But there's a gap. When loader data travels from server to client, it passes through JSON serialization:

```
Server: loader returns { user: { name: "Adam", joinedAt: new Date() } }
   ↓  JSON.stringify
HTML:  window.__EIGEN_DATA__ = {"user":{"name":"Adam","joinedAt":"2026-03-07T..."}}
   ↓  JSON.parse (implicit, via browser)
Client: data is { user: { name: "Adam", joinedAt: "2026-03-07T..." } }
```

The `Date` became a string. The TypeScript type still says `Date`. No error at compile time, a subtle bug at runtime. This is the **serialization boundary problem** — the types promise one thing, the runtime delivers another.

Runtime validation solves this by checking data against a schema at the point where it enters the client. If the shape doesn't match, you get a clear error instead of a silent type mismatch.

---

## Schema-first loaders with `defineLoader`

Instead of defining TypeScript types and hoping the data matches, we define a schema and *derive* the TypeScript type from it:

```typescript
// packages/eigen/validated-loader.ts
import type { RouteParamsMap } from 'eigen/route-types'
import type { z } from 'zod'

/**
 * Define a loader with runtime validation.
 * The TypeScript type is inferred from the schema — not manually annotated.
 */
export function defineValidatedLoader<
  TPath extends keyof RouteParamsMap,
  TSchema extends z.ZodType,
>(
  _path: TPath,
  schema: TSchema,
  fn: (ctx: { params: RouteParamsMap[TPath] }) => Promise<z.input<TSchema>>,
): {
  loader: (ctx: { params: RouteParamsMap[TPath] }) => Promise<z.output<TSchema>>
  schema: TSchema
  parse: (data: unknown) => z.output<TSchema>
} {
  return {
    loader: async (ctx) => {
      const raw = await fn(ctx)
      // Validate on the server too — catches bugs early
      return schema.parse(raw)
    },
    schema,
    parse: (data: unknown) => schema.parse(data),
  }
}
```

Usage in a page component:

```tsx
// src/pages/posts/[id].tsx
import { z } from 'zod'
import { defineValidatedLoader } from 'eigen/validated-loader'

const PostSchema = z.object({
  id: z.number(),
  title: z.string(),
  body: z.string(),
  createdAt: z.string().transform(s => new Date(s)), // String → Date at parse time
})

export const { loader, parse } = defineValidatedLoader(
  '/posts/:id',
  PostSchema,
  async ({ params }) => {
    const res = await fetch(`https://api.example.com/posts/${params.id}`)
    return res.json()
  },
)

// The type is INFERRED from the schema — not manually written
type PostData = z.infer<typeof PostSchema>
// PostData = { id: number; title: string; body: string; createdAt: Date }

export default function PostPage({ params, data }: { params: { id: string }; data: PostData }) {
  // data.createdAt is a real Date, not a string — the schema's transform handled it
  return (
    <article>
      <h1>{data.title}</h1>
      <time>{data.createdAt.toLocaleDateString()}</time>
      <p>{data.body}</p>
    </article>
  )
}
```

The schema does three things simultaneously: it validates that the data has the expected shape, it transforms values (string → Date), and it provides the TypeScript type (via `z.infer`). This is the "parse, don't validate" pattern — instead of checking a type assertion and hoping, you parse unknown data into a known shape.

---

## Validating during hydration

The `parse` function exported alongside the loader is used on the client to validate `window.__EIGEN_DATA__`:

```tsx
// In entry-client.tsx — validated hydration

function Router() {
  const [pathname, setPathname] = useState(window.location.pathname)
  const match = matchRoute(pathname)

  // Parse and validate the serialized data
  const data = useMemo(() => {
    const raw = window.__EIGEN_DATA__
    if (match?.route.parse) {
      // Route has a validation schema — parse the raw data
      try {
        return match.route.parse(raw)
      } catch (e) {
        console.error('Data validation failed during hydration:', e)
        return raw // Fall back to unvalidated data
      }
    }
    return raw
  }, [match])

  // ...render with validated data
}
```

### The route definition with parse functions

The virtual module needs to include `parse` functions for validated routes:

```typescript
// In the SSR load() for eigen/routes
`import Page${i}, { loader as loader${i}, parse as parse${i} } from '${r.componentPath}'`

// Route entry
`{ path: '${r.path}', component: Page${i}, loader: loader${i}, parse: parse${i} }`
```

And for the client — importantly, the `parse` function is *not* server-only. It needs to be in the client bundle because it runs during hydration. The `transform` hook (Part 7) strips `loader` but keeps `parse`:

```typescript
// In eigen-strip-loaders.ts — updated to preserve parse
transform(code: string, id: string) {
  // Strip loader but NOT parse — parse runs on the client
  // Only strip the loader function and its server-only imports
}
```

This is a subtle distinction. The loader contains server-only code (database queries, API keys). The parse function contains only the zod schema — pure validation logic with no server dependencies. It must survive into the client bundle.

---

## Valibot as a lighter alternative

Zod is ~14KB minified. For a framework that prioritizes bundle size, valibot (~1KB per schema) is a compelling alternative:

```typescript
import * as v from 'valibot'

const PostSchema = v.object({
  id: v.number(),
  title: v.string(),
  body: v.string(),
  createdAt: v.pipe(v.string(), v.transform(s => new Date(s))),
})

type PostData = v.InferOutput<typeof PostSchema>
```

The framework's `defineValidatedLoader` can be schema-library-agnostic by accepting any object with a `parse` method:

```typescript
interface SchemaLike<T> {
  parse(data: unknown): T
}

export function defineValidatedLoader<
  TPath extends keyof RouteParamsMap,
  TSchema extends SchemaLike<any>,
>(
  path: TPath,
  schema: TSchema,
  fn: (ctx: { params: RouteParamsMap[TPath] }) => Promise<unknown>,
): {
  loader: (ctx: { params: RouteParamsMap[TPath] }) => Promise<ReturnType<TSchema['parse']>>
  parse: TSchema['parse']
}
```

This works with zod, valibot, arktype, or any library that exposes `.parse()`. The framework doesn't couple to a specific validation library — it couples to a protocol.

---

## Generating schemas from TypeScript types (the inverse direction)

We've shown schema → type (define a schema, infer the TS type). The opposite direction is also possible: type → schema (have the build system generate a schema from TS types).

This is much harder. Tools like `ts-to-zod` and `typia` can generate runtime validators from TypeScript types, but they require build-step integration:

```typescript
// Hypothetical: the plugin analyzes the loader's return type
// and generates a validation schema automatically
export const loader = defineLoader('/posts/:id', async ({ params }) => {
  // Return type: Promise<{ title: string; body: string }>
  // → Plugin generates: z.object({ title: z.string(), body: z.string() })
})
```

This would require the plugin's `transform` hook to use the TypeScript compiler API to extract return types and generate zod/valibot calls. It's technically possible but fragile — TypeScript's type system is Turing-complete, so arbitrary return types can't always be mapped to schemas.

The pragmatic choice is the schema-first direction: developers write schemas, TypeScript infers types. This is what Remix does with `unstable_defineLoader` + zod, and it's the approach we recommend.

---

## What to observe

1. **Make a loader return a `Date` object.** Without validation, the client receives a string and `date.toLocaleDateString()` throws. With the zod schema's `.transform()`, the string is parsed back into a `Date` during hydration.

2. **Return data that doesn't match the schema.** The `parse` call throws a `ZodError` with a detailed path showing exactly which field failed validation. Compare this to a silent type mismatch.

3. **Check the client bundle size.** With zod imported only for specific route schemas (via dynamic import or the route's parse function), tree-shaking keeps the cost proportional to usage.

4. **The TypeScript type comes from the schema** — hover over `PostData` and confirm it matches the schema, not a manual annotation. Change the schema and the type updates automatically.

---

## Key insight

Runtime validation closes the last gap in the type safety story. Compile-time types catch developer errors (wrong field names, missing properties). Runtime validation catches *data* errors (API changes, serialization artifacts, stale caches). The schema is the single source of truth — it generates both the TypeScript type (for the compiler) and the validation logic (for the runtime).

From a Vite perspective, the interesting nuance is that validation code must survive into the client bundle while loader code must not. The `transform` hook's job gets more surgical: it needs to distinguish between "server-only exports" (loader) and "universal exports" (parse, schema). This is the same tree-shaking challenge that real frameworks face — and why conventions like `"use server"` and `.server.ts` files exist. They give the transform hook clear signals about what to strip.

---

## What's next

In Part 19, we'll introduce **edge runtimes** — adding a third Vite environment that targets Cloudflare Workers, with Web API types (`Request`/`Response`) instead of Node types, and environment-polymorphic handler signatures.
