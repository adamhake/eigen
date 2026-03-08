# Part 25: The `"use cache"` Directive — Caching as a Compiler Concern

*This is the twenty-fifth installment in a series where we build a toy Next.js on top of Vite. In [Part 24](/24-view-transitions-speculation), we added View Transitions and Speculation Rules. Now we'll implement the third member of React's directive family: `"use cache"` — which turns caching from a runtime concern into a compile-time transformation.*

**Concepts introduced:** The `"use cache"` directive, `cacheLife` and `cacheTag` semantics, cache key derivation from function arguments, `transform` hook generation of cache wrappers, `"use cache: remote"` for distributed caching, `"use cache: private"` for request-scoped caching, stale-while-revalidate patterns, on-demand revalidation via `revalidateTag`.

---

## The third directive

React's directive model now has three entries:

| Directive | Environment | Meaning |
|---|---|---|
| `"use client"` | RSC → Client boundary | This component runs in the browser; include it in the client bundle |
| `"use server"` | Client → Server boundary | This function runs on the server; generate an RPC stub for the client |
| `"use cache"` | Cache boundary | This function/component's result should be cached; wrap it with cache logic |

`"use cache"` is orthogonal to the other two. A server component can be cached. A server function can be cached. Even a `"use client"` component tree can be cached at the server component level that renders it. The directive tells the framework's build system to wrap the function with caching logic — memoizing based on arguments, respecting time-to-live, and supporting on-demand revalidation.

---

## How it works: developer's view

```tsx
// src/pages/posts/[id].tsx — a server component
import { cacheLife, cacheTag } from 'eigen/cache'

export default async function PostPage({ params }: { params: { id: string } }) {
  'use cache'
  cacheLife('hours')        // Cache for 1 hour
  cacheTag(`post-${params.id}`)  // Tag for targeted revalidation

  const post = await db.query('SELECT * FROM posts WHERE id = $1', [params.id])
  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.body}</p>
    </article>
  )
}
```

Without `"use cache"`, this component re-fetches from the database on every request. With it, the result is cached — subsequent requests for the same `params.id` serve from cache until the TTL expires or the tag is revalidated.

### Granular caching — function level

```typescript
async function getPopularPosts() {
  'use cache'
  cacheLife('days')
  cacheTag('popular-posts')
  return db.query('SELECT * FROM posts ORDER BY views DESC LIMIT 10')
}

async function getCurrentUser(sessionId: string) {
  'use cache: private'
  cacheLife({ stale: 60, revalidate: 300 })
  return db.query('SELECT * FROM users WHERE session_id = $1', [sessionId])
}
```

Notice `"use cache: private"` — this variant caches per-request and can access runtime APIs like cookies. The result is cached only in memory for the current request, never persisted to shared storage.

---

## The transform: what the compiler generates

When the `transform` hook encounters `"use cache"`, it wraps the function body with cache logic. The original:

```typescript
async function getPopularPosts() {
  'use cache'
  cacheLife('days')
  cacheTag('popular-posts')
  return db.query('SELECT * FROM posts ORDER BY views DESC LIMIT 10')
}
```

Becomes (simplified):

```typescript
import { __cache_wrap } from 'eigen/runtime/cache'

const getPopularPosts = __cache_wrap(
  'getPopularPosts_a3f2c8',   // Stable ID from file + function name
  {
    life: 'days',
    tags: ['popular-posts'],
  },
  async function getPopularPosts_impl() {
    return db.query('SELECT * FROM posts ORDER BY views DESC LIMIT 10')
  },
)
```

The `__cache_wrap` function:
1. Derives a cache key from the function ID + serialized arguments
2. Checks the cache store (in-memory, Redis, KV store, etc.)
3. On hit: returns the cached value
4. On miss: calls the original function, stores the result, returns it
5. Respects `cacheLife` TTL and `cacheTag` for revalidation

### The transform plugin

```typescript
// plugins/eigen-cache.ts
import type { Plugin } from 'vite'

export default function eigenCache(): Plugin {
  return {
    name: 'eigen-cache-transform',

    // Only transform in server environments (RSC and SSR)
    applyToEnvironment(env) {
      return env.name === 'rsc' || env.name === 'ssr'
    },

    transform(code: string, id: string) {
      if (!code.includes("'use cache'") && !code.includes('"use cache"')) {
        return
      }

      // Find functions with "use cache" directive
      // A real implementation uses an AST parser
      const transformed = code.replace(
        /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*\{[\s]*['"]use cache(?::?\s*(\w+))?['"]/g,
        (match, name, args, variant) => {
          const fnId = generateStableId(id, name)
          const cacheVariant = variant || 'default'

          // Extract cacheLife and cacheTag calls from the function body
          // (simplified — real implementation parses the full body)

          return `const ${name} = __cache_wrap(
            '${fnId}',
            { variant: '${cacheVariant}' },
            async function ${name}_impl(${args}) {`
        },
      )

      // Add the import
      if (transformed !== code) {
        return {
          code: `import { __cache_wrap } from 'eigen/runtime/cache';\n${transformed}`,
          map: null,
        }
      }
    },
  }
}
```

---

## Cache key derivation

The cache key must capture everything that affects the output: the function's identity, its arguments, and any closed-over values. For a component like:

```tsx
async function PostPage({ params }: { params: { id: string } }) {
  'use cache'
  const post = await db.query(...)
  return <article>...</article>
}
```

The cache key is derived from: `functionId + serialize(params)`. Two requests with `{ id: '42' }` hit the same cache entry. A request with `{ id: '43' }` gets a different entry.

```typescript
// packages/eigen/runtime/cache.ts
function deriveCacheKey(fnId: string, args: unknown[]): string {
  const argsHash = stableStringify(args)
  return `${fnId}:${argsHash}`
}

// Stable JSON serialization (deterministic key ordering)
function stableStringify(value: unknown): string {
  if (typeof value !== 'object' || value === null) {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  const keys = Object.keys(value).sort()
  const entries = keys.map(k =>
    `${JSON.stringify(k)}:${stableStringify((value as any)[k])}`,
  )
  return `{${entries.join(',')}}`
}
```

### Serialization constraint

Like server functions (Part 13), cache keys require that arguments are JSON-serializable. You can't cache a function that receives a `Date`, a `Map`, or a React element as an argument — the cache key derivation would produce inconsistent results. This is the same serialization boundary that `"use server"` enforces.

---

## Cache storage backends

The `__cache_wrap` function delegates to a pluggable cache store:

```typescript
// packages/eigen/runtime/cache.ts

export interface CacheStore {
  get(key: string): Promise<{ value: string; timestamp: number } | null>
  set(key: string, value: string, ttl: number): Promise<void>
  revalidateTag(tag: string): Promise<void>
}

// Default: in-memory (single process, lost on restart)
class MemoryCacheStore implements CacheStore {
  private store = new Map<string, { value: string; timestamp: number; ttl: number; tags: string[] }>()

  async get(key: string) {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > entry.ttl * 1000) {
      this.store.delete(key)
      return null
    }
    return { value: entry.value, timestamp: entry.timestamp }
  }

  async set(key: string, value: string, ttl: number, tags: string[] = []) {
    this.store.set(key, { value, timestamp: Date.now(), ttl, tags })
  }

  async revalidateTag(tag: string) {
    for (const [key, entry] of this.store) {
      if (entry.tags.includes(tag)) {
        this.store.delete(key)
      }
    }
  }
}
```

Next.js supports `"use cache: remote"` for distributed caching (Redis, Cloudflare KV, Vercel KV). The framework configures the store via `cacheHandlers` in the config:

```typescript
// eigen.config.ts
export default {
  cacheHandlers: {
    default: new MemoryCacheStore(),
    remote: new RedisCacheStore(process.env.REDIS_URL),
  },
}
```

---

## On-demand revalidation

The `cacheTag` function associates cache entries with tags. When data changes, the application calls `revalidateTag` to invalidate all entries with that tag:

```typescript
// In a server function triggered by a webhook or form submission
import { revalidateTag } from 'eigen/cache'

export const updatePost = createServerFn(async (post: { id: string; title: string }) => {
  await db.query('UPDATE posts SET title = $1 WHERE id = $2', [post.title, post.id])

  // Invalidate all cache entries tagged with this post
  await revalidateTag(`post-${post.id}`)
  // Also invalidate the popular posts list
  await revalidateTag('popular-posts')
})
```

This is the mechanism that makes `"use cache"` practical for dynamic content: you cache aggressively (hours, days), and invalidate precisely when the underlying data changes.

---

## What to observe

1. **Add a `console.log` inside a cached function.** On the first request, it logs. On subsequent requests within the TTL, it doesn't — the cache serves the stored result.

2. **Call `revalidateTag` and request again.** The function re-executes and the new result is cached.

3. **Check the transform output in `vite-plugin-inspect`.** The `"use cache"` directive is gone, replaced by a `__cache_wrap` call with the extracted configuration.

4. **Compare `"use cache"` with `"use cache: private"`.** Private entries are per-request — they're useful for deduplicating within a single render pass but don't persist across requests.

---

## Key insight

`"use cache"` extends the directive-as-compiler-hint pattern established by `"use client"` and `"use server"`. The developer writes a string literal in their function body; the framework's `transform` hook detects it and generates caching infrastructure. The developer never imports a cache library, configures a TTL, or manages cache keys — the compiler infers all of it from the function's arguments and the `cacheLife`/`cacheTag` calls.

This is caching without ceremony. The mental model is simple: "this function is expensive, cache its results, invalidate when I say so." The complexity — key derivation, TTL management, storage backends, serialization — lives in the framework's generated code, not in the developer's.

---

## What's next

In Part 26, we'll implement **Partial Prerendering** — the convergence of SSG and SSR where a single route has a static shell (cached at build time) and dynamic holes (filled at request time via Suspense). This is the architecture that `"use cache"` enables: cached components become the static shell, uncached components become the dynamic content.
