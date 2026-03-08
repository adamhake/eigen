# Part 12: Streaming SSR — Progressive Rendering with Suspense

*This is the twelfth installment in a series where we build a toy Next.js on top of Vite. In [Part 11](/11-framework-plugin), we composed Eigen into a distributable framework plugin. Now we'll replace our synchronous `renderToString` SSR with React's streaming API, enabling progressive page loads powered by Suspense boundaries.*

**Concepts introduced:** `renderToPipeableStream`, Suspense-driven streaming, shell vs. content model, `onShellReady` / `onAllReady`, streaming through Express, typed stream results, `transformIndexHtml` in a streaming context, error handling in streams.

---

## Why streaming matters

In Parts 3 and 4, we built SSR with `renderToString`. This works, but it has a fundamental bottleneck: the entire page — including all loader data — must be fetched and rendered to a complete HTML string *before the first byte is sent to the browser*. If one loader is slow (say, a database query that takes 800ms), the user stares at a blank screen for 800ms.

Streaming SSR flips this model. React sends the HTML **progressively**:

1. The **shell** — the app layout, navigation, and any content that doesn't depend on slow data — is sent immediately.
2. **Suspense fallbacks** are rendered as placeholder HTML where slow content will appear.
3. As each data dependency resolves, React streams a `<script>` tag that injects the resolved content into the correct placeholder and hydrates it.

The browser starts rendering within milliseconds. Slow data arrives incrementally. This is the architecture that Next.js App Router and Remix both use under the hood.

---

## The React streaming API

React 18 introduced `renderToPipeableStream` for Node.js streaming (there's also `renderToReadableStream` for Web Streams / edge runtimes — we'll note the differences). The API looks like this:

```typescript
import { renderToPipeableStream } from 'react-dom/server'

const { pipe, abort } = renderToPipeableStream(
  <App />,
  {
    onShellReady() {
      // The shell (everything outside Suspense boundaries) has rendered.
      // This is the earliest point you can start sending HTML.
    },
    onShellError(error) {
      // The shell itself failed to render (fatal — send an error page).
    },
    onAllReady() {
      // All Suspense boundaries have resolved.
      // Useful for SSG or bots where you want complete HTML.
    },
    onError(error) {
      // A Suspense boundary errored during streaming.
      // The stream continues — React sends the fallback.
    },
  },
)
```

The critical distinction is between `onShellReady` and `onAllReady`:

**`onShellReady`** fires as soon as React has rendered everything *outside* of Suspense boundaries. This is the minimum viable HTML — the layout, nav, and Suspense fallback placeholders. For user-facing requests, you pipe here for the fastest time-to-first-byte (TTFB).

**`onAllReady`** fires when everything — including all Suspense content — has resolved. This gives you the complete, final HTML. You'd use this for crawlers/bots that need the full page, or for static site generation.

---

## Restructuring the page component for Suspense

Streaming only helps if your component tree has Suspense boundaries that separate fast content from slow content. This requires changing how loaders work.

In our current architecture, the server calls the loader *before* rendering and passes the data as a prop. With streaming, we want React to start rendering immediately and let individual data dependencies suspend.

### A resource-based loader pattern

```typescript
// packages/eigen/resource.ts

/**
 * A simple cache/resource abstraction for Suspense integration.
 * This is a teaching implementation — production frameworks use more
 * sophisticated caching (React's `use()` hook, TanStack Query, etc.)
 */

type ResourceStatus<T> =
  | { state: 'pending'; promise: Promise<T> }
  | { state: 'resolved'; value: T }
  | { state: 'rejected'; error: unknown }

export interface Resource<T> {
  read(): T
}

export function createResource<T>(promise: Promise<T>): Resource<T> {
  let status: ResourceStatus<T> = {
    state: 'pending',
    promise: promise.then(
      (value) => {
        status = { state: 'resolved', value }
        return value
      },
      (error) => {
        status = { state: 'rejected', error }
        throw error
      },
    ),
  }

  return {
    read() {
      switch (status.state) {
        case 'pending':
          // This throw is the Suspense mechanism:
          // React catches the promise, renders the fallback,
          // and re-renders the component when the promise resolves.
          throw status.promise
        case 'rejected':
          throw status.error
        case 'resolved':
          return status.value
      }
    },
  }
}
```

This `Resource` pattern is the low-level primitive behind Suspense data fetching. When `read()` throws a promise, React's Suspense boundary catches it, shows the fallback, and retries when the promise resolves. The component doesn't need to know about loading states — it just calls `resource.read()` and either gets data or suspends.

### A page component using Suspense

```tsx
// src/pages/Dashboard.tsx
import React, { Suspense } from 'react'
import type { PageProps } from 'eigen/types'
import type { Resource } from 'eigen/resource'

interface DashboardData {
  stats: { users: number; revenue: number }
  recentOrders: Array<{ id: string; total: number }>
}

// This is a server-only loader that returns a Resource
// The resource's promise starts executing immediately,
// but the component doesn't block on it
export async function loader() {
  return {
    stats: await fetchStats(),        // Fast: 50ms
    recentOrders: fetchRecentOrders(), // Slow: 800ms — returns a promise, not awaited
  }
}

function StatsPanel({ stats }: { stats: DashboardData['stats'] }) {
  return (
    <div>
      <h2>Stats</h2>
      <p>Users: {stats.users}</p>
      <p>Revenue: ${stats.revenue}</p>
    </div>
  )
}

function RecentOrders({ resource }: { resource: Resource<DashboardData['recentOrders']> }) {
  const orders = resource.read() // Suspends if not yet loaded
  return (
    <div>
      <h2>Recent Orders</h2>
      <ul>
        {orders.map(o => <li key={o.id}>#{o.id}: ${o.total}</li>)}
      </ul>
    </div>
  )
}

export default function Dashboard({ data }: { data: any }) {
  return (
    <div>
      <h1>Dashboard</h1>
      <StatsPanel stats={data.stats} />

      {/* This Suspense boundary enables streaming. 
          The shell sends with the skeleton, and the 
          orders content streams in when ready. */}
      <Suspense fallback={<div>Loading orders...</div>}>
        <RecentOrders resource={data.recentOrders} />
      </Suspense>
    </div>
  )
}
```

The key architectural insight: the stats are awaited and available immediately, but `recentOrders` is a resource that might still be pending. The Suspense boundary around `<RecentOrders>` tells React "stream the fallback now, stream the real content when the promise resolves."

---

## Updating the server entry for streaming

Replace the `renderToString` call in `entry-server.tsx` with `renderToPipeableStream`:

```tsx
// src/entry-server.tsx
import React from 'react'
import { renderToPipeableStream } from 'react-dom/server'
import type { Response as ExpressResponse } from 'express'
import { routes } from 'eigen/routes'
import type { RouteDefinition } from 'eigen/types'

interface RouteMatch {
  route: RouteDefinition
  params: Record<string, string>
}

function matchRoute(pathname: string): RouteMatch | null {
  for (const route of routes) {
    if (route.path === pathname) return { route, params: {} }
    const routeParts = route.path.split('/')
    const pathParts = pathname.split('/')
    if (routeParts.length !== pathParts.length) continue
    const params: Record<string, string> = {}
    const match = routeParts.every((part, i) => {
      if (part.startsWith(':')) {
        params[part.slice(1)] = pathParts[i]
        return true
      }
      return part === pathParts[i]
    })
    if (match) return { route, params }
  }
  return null
}

function App({ pathname, data }: { pathname: string; data: unknown }) {
  const match = matchRoute(pathname)
  if (!match) return <h1>404</h1>
  const Component = match.route.component
  return (
    <div>
      <nav><a href="/">Home</a> | <a href="/about">About</a></nav>
      <Component params={match.params} data={data} />
    </div>
  )
}

export interface StreamRenderOptions {
  pathname: string
  /** The writable stream (Express response) */
  res: ExpressResponse
  /** The HTML template with <!--ssr-outlet--> marker */
  template: string
  /** Whether to wait for all content (bots/SSG) or stream on shell (users) */
  waitForAll?: boolean
}

export async function renderStream({
  pathname,
  res,
  template,
  waitForAll = false,
}: StreamRenderOptions): Promise<void> {
  const match = matchRoute(pathname)

  // Run the loader
  let data: unknown = null
  if (match?.route.loader) {
    data = await match.route.loader({ params: match.params })
  }

  // Split the template at the outlet marker
  const [htmlBefore, htmlAfter] = template.split('<!--ssr-outlet-->')

  // Track errors for the status code decision
  let shellError: Error | null = null

  return new Promise<void>((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <App pathname={pathname} data={data} />,
      {
        onShellReady() {
          if (waitForAll) return // Wait for onAllReady instead

          // Send the opening HTML (doctype, <head>, opening <body>)
          res.status(shellError ? 500 : (match ? 200 : 404))
          res.setHeader('Content-Type', 'text/html')
          res.write(htmlBefore)

          // Pipe React's stream into the response
          // React will write the shell HTML, then stream
          // <script> tags as Suspense boundaries resolve
          pipe(res)

          // Note: we don't call res.end() here.
          // React's pipe handles ending the stream
          // after writing htmlAfter equivalent content.
        },

        onAllReady() {
          if (!waitForAll) {
            // Already streaming — the pipe will complete on its own.
            // We just need to write the closing HTML.
            res.write(htmlAfter)
            res.end()
            resolve()
            return
          }

          // Bot/SSG mode: send everything at once
          res.status(match ? 200 : 404)
          res.setHeader('Content-Type', 'text/html')
          res.write(htmlBefore)
          pipe(res)
          res.write(htmlAfter)
          res.end()
          resolve()
        },

        onShellError(error) {
          shellError = error as Error
          // Shell failed — send a minimal error page
          res.status(500)
          res.setHeader('Content-Type', 'text/html')
          res.end('<h1>Server Error</h1>')
          reject(error)
        },

        onError(error) {
          // A Suspense boundary errored. The stream continues
          // with the fallback content. Log it for diagnostics.
          console.error('Streaming SSR error:', error)
        },
      },
    )

    // Abort the stream after a timeout to prevent hanging responses
    setTimeout(() => abort(), 10_000)
  })
}
```

### Updating the dev server

```typescript
// server.ts — streaming version
import express from 'express'
import { createServer as createViteServer, type ViteDevServer } from 'vite'
import { readFileSync } from 'fs'

async function start() {
  const app = express()

  const vite: ViteDevServer = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  })

  app.use(vite.middlewares)

  app.get('*', async (req, res) => {
    const url = req.originalUrl

    try {
      let template = readFileSync('index.html', 'utf-8')
      template = await vite.transformIndexHtml(url, template)

      const { renderStream } = await vite.ssrLoadModule('/src/entry-server.tsx') as {
        renderStream: (opts: {
          pathname: string
          res: express.Response
          template: string
          waitForAll?: boolean
        }) => Promise<void>
      }

      // Detect bots by user-agent (simplified)
      const isBot = /bot|crawler|spider|googlebot/i.test(
        req.headers['user-agent'] ?? '',
      )

      await renderStream({
        pathname: url,
        res,
        template,
        waitForAll: isBot,
      })
    } catch (e) {
      if (e instanceof Error) {
        vite.ssrFixStacktrace(e)
        console.error(e.stack)
        if (!res.headersSent) {
          res.status(500).end(e.message)
        }
      }
    }
  })

  app.listen(3000, () => console.log('http://localhost:3000'))
}

start()
```

---

## How streaming HTML actually works on the wire

When you view the network response for a streaming SSR page, it looks surprising. The browser receives something like this, in chunks over time:

**Chunk 1 (immediate — the shell):**
```html
<!DOCTYPE html>
<html>
<head><title>Eigen Framework</title></head>
<body>
<div id="root"><div><nav>...</nav>
<h1>Dashboard</h1>
<div><h2>Stats</h2><p>Users: 1042</p><p>Revenue: $54,300</p></div>
<!--$?--><template id="B:0"></template><div>Loading orders...</div><!--/$-->
```

The `<!--$?-->` and `<template id="B:0">` markers are React's Suspense boundary placeholders. The fallback ("Loading orders...") is visible HTML. The `B:0` template is an empty insertion point.

**Chunk 2 (800ms later — when the orders query resolves):**
```html
<div hidden id="S:0"><div><h2>Recent Orders</h2><ul><li>#001: $120</li>...</ul></div></div>
<script>
// React's inline script that swaps the fallback for the real content
$RC = function(b, s) {
  // ... swap the template B:0 with the content S:0
};
$RC("B:0", "S:0")
</script>
```

React sends the resolved content in a hidden `<div>`, then a `<script>` that performs the DOM swap — replacing the fallback with the real content and hydrating the new nodes. The browser progressively renders the page without a full page reload or client-side re-render.

---

## Template splitting and `transformIndexHtml` considerations

Streaming changes how we use `transformIndexHtml`. With `renderToString`, we had the complete HTML and could do simple string replacement. With streaming, we need to split the template into "before the React root" and "after the React root" and write them at different times.

There's a subtlety here: `transformIndexHtml` adds Vite's HMR client script and asset preload links into `<head>`. This transformation must happen *before* we split the template, because the `<head>` content needs to be in the first chunk that the browser receives. If it's deferred to after the stream, the browser won't establish the HMR WebSocket connection until the page has fully streamed.

```typescript
// The order matters:
let template = readFileSync('index.html', 'utf-8')
template = await vite.transformIndexHtml(url, template)  // ← FIRST: inject HMR client
const [before, after] = template.split('<!--ssr-outlet-->')  // ← THEN: split
```

For production, `transformIndexHtml` isn't called (there's no dev server). The built HTML template already has the correct asset URLs from the manifest. But the split pattern is the same.

---

## Typing the stream

The streaming API introduces a new typing challenge. With `renderToString`, the return type was simple: `Promise<{ html: string; status: number; data: unknown }>`. With streaming, there's no single HTML string — the output is piped directly to the response.

Our `StreamRenderOptions` interface captures this:

```typescript
export interface StreamRenderOptions {
  pathname: string
  res: ExpressResponse      // The writable target
  template: string          // HTML template to split
  waitForAll?: boolean      // Bot mode vs. streaming mode
}
```

The return type is `Promise<void>` — the function writes to the response directly rather than returning a value. This changes the error handling contract: errors during streaming can't be caught by the caller in the usual way, because headers (including the status code) have already been sent. The `onShellError` / `onError` callbacks handle this instead.

This is a real framework design tension. Remix solves it by providing `handleError` in the entry server. Next.js uses `error.tsx` boundaries. The core issue is the same: once you've started streaming a 200 response, you can't change it to a 500 if a Suspense boundary fails mid-stream.

---

## Web Streams variant for edge runtimes

If you're targeting Cloudflare Workers or Deno (the edge environment exercise from Part 10), you'd use `renderToReadableStream` instead:

```typescript
import { renderToReadableStream } from 'react-dom/server'

export async function renderEdge(pathname: string): Promise<Response> {
  const stream = await renderToReadableStream(<App pathname={pathname} data={data} />, {
    onError(error: unknown) {
      console.error('Stream error:', error)
    },
  })

  // For bots, wait for all content
  if (isBot) {
    await stream.allReady
  }

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })
}
```

The `renderToReadableStream` API returns a Web `ReadableStream` instead of a Node `Writable` pipe. The `allReady` property is a promise equivalent to `onAllReady`. This is the API you'd use in an edge environment created with `createWorkerdEnvironment`.

The type difference between the Node and edge APIs is significant: Node uses `ExpressResponse` (or `http.ServerResponse`), edge uses `Response` (the Web API). A framework that supports both needs environment-polymorphic types — which is exactly the challenge we noted in Part 10's exercises.

---

## What to observe

1. **Open DevTools → Network** and watch the response timing. With `renderToString`, the document request completes all at once. With streaming, you'll see the response start quickly (the shell) and the content length grow incrementally.

2. **View the raw response** with `curl -N http://localhost:3000/dashboard`. You'll see the shell arrive immediately, then after a pause, the Suspense resolution scripts stream in.

3. **Compare TTFB** (Time to First Byte) between the `renderToString` and `renderToPipeableStream` approaches. With a slow loader, the difference is dramatic — streaming sends the shell in ~10ms regardless of loader speed.

4. **Test bot mode.** Change the user-agent to `Googlebot` and observe that the response waits for `onAllReady` — the full HTML arrives in one chunk, ensuring crawlers see complete content.

5. **Error during streaming.** Make a Suspense-wrapped component throw after a delay. Observe that the shell renders successfully, the fallback appears, and then the error is logged server-side. The stream doesn't crash — React handles it gracefully.

---

## Key insight

Streaming SSR changes the contract between the server and the browser from "here's a complete page" to "here's the start of a page, more is coming." This is fundamentally enabled by two things: HTTP chunked transfer encoding (the transport) and React Suspense (the component model that declares data dependencies declaratively).

From a Vite perspective, streaming doesn't change the plugin architecture — `resolveId`, `load`, `transform`, and `configureServer` all work the same. What changes is the *server entry point* and the *dev server middleware*. The Express handler switches from `res.end(finalHtml)` to `pipe(res)`. The template must be split before streaming begins. And error handling moves from try/catch to stream callbacks.

This is why framework authors care about Suspense — it's not just a loading indicator pattern. It's the mechanism that enables progressive server rendering, and it requires the framework's SSR layer to support streaming responses.

---

## What's next

In Part 13, we'll implement **nested layouts** — a `layout.tsx` convention where each directory segment wraps its child routes in shared UI, requiring recursive virtual module generation and a new dimension of type-safe data flow.
