# Part 23: Advanced Router — Ranked Matching, Search Params, and Preloading

*This is the twenty-third installment in a series where we build a toy Next.js on top of Vite. In [Part 22](/22-navigation-api), we replaced our router with the Navigation API. Now we'll build a sophisticated route matching engine with ranked pattern matching, type-safe search params, catch-all routes, preloading strategies, and optimistic UI — the features that make TanStack Router's routing system best-in-class.*

**Concepts introduced:** Ranked/scored route matching, catch-all and optional segments, type-safe search params with validation, `URLSearchParams` ↔ typed objects, route preloading strategies (intent, viewport, hover), optimistic navigation state, pending UI with `useTransition`, scroll restoration, the `URLPattern` API.

---

## The limitations of our current router

Since Part 2, our route matching has been a linear scan with simple string comparison:

```typescript
for (const route of routes) {
  // Check each segment...
}
```

This breaks in several real-world scenarios. When both `/posts/:id` and `/posts/new` exist, which matches `/posts/new`? Our current router matches whichever comes first in the array. When `/docs/:category/:page` and `/docs/:slug` both exist, the more specific route should win — but our router can't distinguish specificity.

---

## Ranked route matching

Production routers score routes by specificity. A static segment scores higher than a dynamic segment, which scores higher than a catch-all:

```typescript
// packages/eigen/router/matcher.ts

interface CompiledRoute {
  path: string
  segments: RouteSegment[]
  score: number
  component: React.ComponentType<any>
  loader?: Function
}

interface RouteSegment {
  type: 'static' | 'dynamic' | 'catch-all' | 'optional'
  value: string          // The literal value ('posts') or param name ('id')
}

/** Score a route — higher scores match first */
function scoreRoute(segments: RouteSegment[]): number {
  let score = 0
  for (const seg of segments) {
    switch (seg.type) {
      case 'static':    score += 4; break  // /posts → 4 points
      case 'dynamic':   score += 2; break  // /:id → 2 points
      case 'optional':  score += 1; break  // /:id? → 1 point
      case 'catch-all': score += 0; break  // /* → 0 points
    }
  }
  // Bonus for more segments (more specific paths score higher)
  score += segments.length * 0.1
  return score
}

function compileRoute(path: string): RouteSegment[] {
  return path.split('/').filter(Boolean).map(seg => {
    if (seg === '*' || seg.startsWith('...'))
      return { type: 'catch-all', value: seg.replace('...', '') }
    if (seg.endsWith('?'))
      return { type: 'optional', value: seg.slice(1, -2) }
    if (seg.startsWith(':'))
      return { type: 'dynamic', value: seg.slice(1) }
    return { type: 'static', value: seg }
  })
}

/** Match a pathname against compiled, ranked routes */
export function matchRoute(
  pathname: string,
  compiledRoutes: CompiledRoute[],
): { route: CompiledRoute; params: Record<string, string> } | null {
  const pathSegments = pathname.split('/').filter(Boolean)

  // Routes are pre-sorted by score (highest first)
  for (const route of compiledRoutes) {
    const params = tryMatch(route.segments, pathSegments)
    if (params !== null) {
      return { route, params }
    }
  }

  return null
}

function tryMatch(
  routeSegments: RouteSegment[],
  pathSegments: string[],
): Record<string, string> | null {
  const params: Record<string, string> = {}

  for (let i = 0; i < routeSegments.length; i++) {
    const routeSeg = routeSegments[i]

    if (routeSeg.type === 'catch-all') {
      // Catch-all consumes the rest of the path
      params[routeSeg.value || '*'] = pathSegments.slice(i).join('/')
      return params
    }

    if (i >= pathSegments.length) {
      // Path is shorter than route
      if (routeSeg.type === 'optional') continue
      return null
    }

    if (routeSeg.type === 'static') {
      if (routeSeg.value !== pathSegments[i]) return null
    } else if (routeSeg.type === 'dynamic' || routeSeg.type === 'optional') {
      params[routeSeg.value] = pathSegments[i]
    }
  }

  // If path has more segments than route (and no catch-all), no match
  if (pathSegments.length > routeSegments.length) return null

  return params
}
```

### Route compilation in the virtual module

The route plugin pre-compiles and sorts routes at code generation time, not at runtime:

```typescript
// In the load() hook
const compiledRoutes = routes
  .map(r => ({
    ...r,
    segments: compileRoute(r.path),
    score: scoreRoute(compileRoute(r.path)),
  }))
  .sort((a, b) => b.score - a.score)

return `export const routes = ${JSON.stringify(compiledRoutes)}`
```

Now `/posts/new` (score: 8, two static segments) always matches before `/posts/:id` (score: 6, one static + one dynamic).

---

## Type-safe search params

TanStack Router's standout feature is type-safe search params — URL query strings validated at compile time. When you navigate to `/products?category=shoes&sort=price`, the `category` and `sort` parameters are typed, validated, and defaulted.

### Defining search param schemas per route

```tsx
// src/pages/products.tsx
import { z } from 'zod'
import type { PageProps } from 'eigen/types'

// Define the search params schema for this route
export const searchParams = z.object({
  category: z.string().optional(),
  sort: z.enum(['price', 'name', 'rating']).default('name'),
  page: z.coerce.number().default(1),    // z.coerce converts "3" → 3
  inStock: z.coerce.boolean().default(false),
})

export type SearchParams = z.infer<typeof searchParams>

export const loader = defineLoader('/products', async ({ params, search }) => {
  // search is typed as SearchParams — validated and defaulted
  const products = await db.query(
    'SELECT * FROM products WHERE category = $1 ORDER BY $2 LIMIT 20 OFFSET $3',
    [search.category, search.sort, (search.page - 1) * 20],
  )
  return { products: products.rows, total: products.rowCount }
})

export default function ProductsPage({
  data,
  search,
}: PageProps<'/products'> & { search: SearchParams }) {
  return (
    <div>
      <h1>Products {search.category ? `— ${search.category}` : ''}</h1>
      <p>Sorted by {search.sort}, page {search.page}</p>
      {/* ... */}
    </div>
  )
}
```

### Parsing search params in the router

The route plugin discovers `searchParams` exports and includes them in the virtual module:

```typescript
// In the load() hook — search param integration
const routeEntry = `{
  path: '${r.path}',
  component: Page${i},
  loader: loader${i},
  searchSchema: searchParams${i} ?? null,  // The zod schema, if exported
}`
```

The router parses and validates search params on every navigation:

```typescript
function parseSearchParams(
  url: URL,
  schema: z.ZodType | null,
): Record<string, unknown> {
  if (!schema) return {}

  const raw = Object.fromEntries(url.searchParams)
  const result = schema.safeParse(raw)

  if (result.success) return result.data

  // On validation failure, return defaults (don't crash)
  console.warn('Search param validation failed:', result.error.format())
  return schema.parse({}) // Returns defaults
}
```

### Type-safe navigation with search params

The `Link` component extends to accept typed search params:

```tsx
interface LinkProps<T extends RoutePaths> {
  to: T
  params?: RouteParamsMap[T]
  search?: SearchParamsMap[T]  // ← NEW: typed search params per route
  children: React.ReactNode
}

function Link<T extends RoutePaths>({ to, params, search, children }: LinkProps<T>) {
  let href: string = to
  if (params) {
    href = to.replace(/:(\w+)/g, (_, key: string) =>
      (params as Record<string, string>)[key] ?? `:${key}`,
    )
  }
  if (search) {
    const searchString = new URLSearchParams(
      Object.entries(search).filter(([, v]) => v !== undefined) as [string, string][],
    ).toString()
    if (searchString) href += `?${searchString}`
  }

  return <a href={href}>{children}</a>
}

// Usage — fully type-checked:
<Link to="/products" search={{ category: 'shoes', sort: 'price' }}>
  Shoes by price
</Link>

// Type error: 'invalid' is not assignable to 'price' | 'name' | 'rating'
// <Link to="/products" search={{ sort: 'invalid' }}>Oops</Link>
```

### Generating `SearchParamsMap`

The route plugin generates type declarations for search params alongside route params:

```typescript
// Generated in node_modules/.eigen/eigen-routes.d.ts
declare module 'eigen/route-types' {
  export type RoutePaths = '/' | '/products' | '/posts/:id'

  export interface RouteParamsMap {
    '/': Record<string, never>
    '/products': Record<string, never>
    '/posts/:id': { id: string }
  }

  export interface SearchParamsMap {
    '/': Record<string, never>
    '/products': {
      category?: string
      sort?: 'price' | 'name' | 'rating'
      page?: number
      inStock?: boolean
    }
    '/posts/:id': Record<string, never>
  }
}
```

---

## Catch-all and optional segments

The file convention extends to support catch-all and optional segments:

```
src/pages/
├── docs/[...slug].tsx      → /docs/* (catch-all)
├── users/[[id]].tsx        → /users/:id? (optional param)
```

The virtual module generates the appropriate segments:

```typescript
// /docs/* → catch-all route
{ path: '/docs/:slug*', segments: [
  { type: 'static', value: 'docs' },
  { type: 'catch-all', value: 'slug' },
]}

// /users/:id? → optional param
{ path: '/users/:id?', segments: [
  { type: 'static', value: 'users' },
  { type: 'optional', value: 'id' },
]}
```

The param types reflect this:

```typescript
// RouteParamsMap entry for catch-all
'/docs/:slug*': { slug: string }  // "guides/getting-started/install"

// RouteParamsMap entry for optional
'/users/:id?': { id?: string }    // undefined if visiting /users
```

---

## Route preloading

Preloading fetches a route's loader data *before* the user navigates, so the page appears instantly on click:

```typescript
// packages/eigen/router/preload.ts

const preloadCache = new Map<string, Promise<unknown>>()

export function preloadRoute(pathname: string): void {
  if (preloadCache.has(pathname)) return

  const promise = fetch(`/_eigen/data?path=${encodeURIComponent(pathname)}`)
    .then(res => res.json())

  preloadCache.set(pathname, promise)

  // Clear after 30 seconds (stale data)
  setTimeout(() => preloadCache.delete(pathname), 30_000)
}

export function getPreloadedData(pathname: string): Promise<unknown> | undefined {
  return preloadCache.get(pathname)
}
```

Preloading strategies (configurable per-link):

```tsx
// Preload on hover (default)
<Link to="/products" preload="intent">Products</Link>

// Preload when visible in viewport
<Link to="/about" preload="viewport">About</Link>

// Preload immediately (for critical navigation paths)
<Link to="/dashboard" preload="render">Dashboard</Link>

// No preloading
<Link to="/settings" preload="none">Settings</Link>
```

The `Link` component adds listeners based on the strategy:

```typescript
function Link({ to, preload = 'intent', ...props }) {
  const ref = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (preload === 'render') {
      preloadRoute(to)
    } else if (preload === 'viewport') {
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) preloadRoute(to)
      })
      if (ref.current) observer.observe(ref.current)
      return () => observer.disconnect()
    }
  }, [to, preload])

  return (
    <a
      ref={ref}
      href={to}
      onMouseEnter={preload === 'intent' ? () => preloadRoute(to) : undefined}
      {...props}
    />
  )
}
```

---

## The `URLPattern` API

The `URLPattern` API is a web standard (available in Chrome, Deno, and via polyfill) that provides built-in pattern matching for URLs. It can replace our custom matching logic:

```typescript
// Using URLPattern for route matching
const pattern = new URLPattern({ pathname: '/posts/:id' })
const result = pattern.exec({ pathname: '/posts/42' })
// result.pathname.groups = { id: '42' }
```

The framework could use `URLPattern` as its matching engine, falling back to the custom matcher for environments that don't support it. This is another example of the browser platform absorbing framework responsibilities.

---

## What to observe

1. **Create routes that overlap** (`/posts/new` and `/posts/:id`). Navigate to `/posts/new` and confirm the static route wins due to higher specificity score.

2. **Add search params to a route.** Navigate with different query strings and watch the search params get validated and defaulted. Invalid values fall back to defaults.

3. **Hover over a `Link` with `preload="intent"`.** Watch the Network tab — the loader data is fetched on hover, before you click. When you click, the page renders instantly.

4. **Check type safety** — in your editor, type `<Link to="/products" search={{ sort: ` and confirm autocomplete shows `'price' | 'name' | 'rating'`.

---

## Key insight

The router is where type safety, performance, and UX converge. Ranked matching ensures correctness. Search param schemas ensure data integrity. Preloading eliminates perceived latency. And the type system — generated by the route plugin from the filesystem — gives developers compile-time guarantees over paths, params, and search params.

This is the layer where TanStack Router differentiates itself most. Its fully-inferred type system for routes, params, search params, and loader data is generated by `@tanstack/router-plugin/vite` — the same pattern we've built throughout this series, pushed to its most sophisticated expression.

---

## What's next

In Part 24, we'll combine the Navigation API with the **View Transitions API** and **Speculation Rules** — adding CSS-driven animated page transitions and browser-native prerendering that give Eigen the feel of a native app.
