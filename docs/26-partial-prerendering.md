# Part 26: Partial Prerendering — Static Shell, Dynamic Holes

*This is the twenty-sixth installment in a series where we build a toy Next.js on top of Vite. In [Part 25](/25-use-cache), we implemented the `"use cache"` directive. Now we'll build Partial Prerendering (PPR) — the architecture where a single route has a static shell rendered at build time and dynamic holes filled at request time via Suspense boundaries.*

**Concepts introduced:** PPR architecture, static shell generation at build time, Suspense boundaries as dynamic insertion points, combining SSG and SSR in a single response, the build-time / request-time rendering split, `"use cache"` as the mechanism for static shell inclusion, fallback HTML injection, streaming dynamic content into pre-rendered shells.

---

## The convergence of SSG and SSR

Throughout this series, we've treated SSG (Part 14) and SSR (Part 3) as separate rendering strategies. SSG pre-renders at build time — fast, cacheable, but stale. SSR renders at request time — fresh, personalized, but slower.

Partial Prerendering eliminates the choice. A single page can be *both*: the layout, navigation, and cacheable content are pre-rendered at build time (the "static shell"), while personalized or frequently-changing content is streamed at request time (the "dynamic holes").

```
┌──────────────────────────────────────┐
│  Static Shell (build time)           │
│  ┌──────────────┐  ┌──────────────┐  │
│  │ Navigation   │  │ Sidebar      │  │
│  └──────────────┘  └──────────────┘  │
│  ┌──────────────────────────────────┐│
│  │ Product Title & Description     ││  ← Cached ("use cache")
│  │                                  ││
│  │ ┌────────────────────────────┐  ││
│  │ │ ⏳ Loading price...       │  ││  ← Dynamic hole (Suspense)
│  │ └────────────────────────────┘  ││
│  │ ┌────────────────────────────┐  ││
│  │ │ ⏳ Loading reviews...     │  ││  ← Dynamic hole (Suspense)
│  │ └────────────────────────────┘  ││
│  └──────────────────────────────────┘│
│  ┌──────────────────────────────────┐│
│  │ Footer                          ││  ← Static
│  └──────────────────────────────────┘│
└──────────────────────────────────────┘
```

The browser receives the shell HTML instantly (from CDN/cache). The dynamic holes show their Suspense fallbacks. Then the server streams the resolved content into those holes — the same streaming mechanism from Part 11.

---

## How PPR works in the rendering pipeline

### Build time: generate the static shell

At build time, the framework renders each page but *stops at Suspense boundaries that wrap dynamic content*. The `renderToString` (or `onAllReady`) output excludes the Suspense children and includes the fallback HTML instead:

```typescript
// In the SSG build step (extending Part 14)
import { renderToReadableStream } from 'react-dom/server'

async function prerenderShell(pathname: string): Promise<string> {
  const match = matchRoute(pathname)
  if (!match) return '<h1>404</h1>'

  const Component = match.route.component

  // Render with a short timeout — cached components resolve immediately,
  // dynamic components hit their Suspense fallbacks
  const stream = await renderToReadableStream(<Component params={match.params} />, {
    onError(error: unknown) {
      // During shell prerendering, errors in Suspense boundaries
      // are expected — they become dynamic holes
    },
  })

  // DON'T await stream.allReady — we want the shell only
  // Read the shell (everything before Suspense boundaries resolve)
  const reader = stream.getReader()
  let shell = ''
  const decoder = new TextDecoder()

  // Read until the shell is complete
  // (React sends the shell first, then streams Suspense resolutions)
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    shell += decoder.decode(value)
    // Stop after the initial shell chunk
    // (heuristic: look for React's Suspense markers)
    if (shell.includes('<!--/$-->')) break
  }

  reader.cancel()
  return shell
}
```

The output is HTML with Suspense fallbacks in place of dynamic content:

```html
<div id="root">
  <nav>...</nav>
  <h1>Product Name</h1>
  <p>Product description from CMS (cached)</p>
  <!--$?--><template id="B:0"></template>
  <div>Loading price...</div>
  <!--/$-->
  <!--$?--><template id="B:1"></template>
  <div>Loading reviews...</div>
  <!--/$-->
  <footer>...</footer>
</div>
```

This shell is saved as the pre-rendered HTML file, served from the CDN.

### Request time: fill the dynamic holes

When a request comes in, the server doesn't re-render the shell. It loads the pre-rendered HTML and streams the dynamic content into the Suspense holes:

```typescript
// Production server — PPR mode
app.get('*', async (req, res) => {
  const shellPath = `dist/client${req.path}/shell.html`

  if (!existsSync(shellPath)) {
    // No pre-rendered shell — full SSR
    return fullSSR(req, res)
  }

  // Send the pre-rendered shell immediately
  const shell = readFileSync(shellPath, 'utf-8')
  res.setHeader('Content-Type', 'text/html')
  res.write(shell)

  // Now render only the dynamic parts
  const match = matchRoute(req.path)
  if (match) {
    // Run loaders for dynamic components
    const dynamicData = await fetchDynamicData(match)

    // Stream the Suspense resolution scripts
    // (same format as Part 11's streaming SSR)
    for (const [boundaryId, html] of dynamicData.entries()) {
      res.write(`
        <div hidden id="S:${boundaryId}">${html}</div>
        <script>$RC("B:${boundaryId}", "S:${boundaryId}")</script>
      `)
    }
  }

  res.end()
})
```

### The `"use cache"` connection

`"use cache"` determines what's in the shell vs. what's dynamic:

```tsx
// This component is cached → included in the static shell
async function ProductInfo({ id }: { id: string }) {
  'use cache'
  cacheLife('days')
  const product = await cms.getProduct(id)
  return <div><h1>{product.name}</h1><p>{product.description}</p></div>
}

// This component is NOT cached → becomes a dynamic hole
async function ProductPrice({ id }: { id: string }) {
  // No "use cache" — runs at request time
  const price = await pricing.getPrice(id, { currency: getUserCurrency() })
  return <span>${price.amount}</span>
}

// The page composes both
export default async function ProductPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <ProductInfo id={params.id} />       {/* Static: in the shell */}
      <Suspense fallback={<PriceSkeleton />}>
        <ProductPrice id={params.id} />    {/* Dynamic: streamed at request time */}
      </Suspense>
    </div>
  )
}
```

The build system renders `ProductInfo` at build time (it's cached, so its data is available). `ProductPrice` suspends (no cache, needs request-time data), so its Suspense fallback goes into the shell. At request time, only `ProductPrice` runs — `ProductInfo`'s output is already in the pre-rendered HTML.

---

## The Vite build plugin for PPR

Extending the SSG plugin from Part 14:

```typescript
// plugins/eigen-ppr.ts
async closeBundle() {
  if (this.environment?.name !== 'ssr') return

  const serverBuild = await import(resolve(process.cwd(), 'dist/server/entry-server.js'))
  const template = readFileSync('dist/client/index.html', 'utf-8')

  for (const route of serverBuild.routes) {
    // Prerender the shell for all routes (not just static ones)
    const shell = await prerenderShell(route.path, serverBuild)

    const shellHtml = template
      .replace('<!--ssr-outlet-->', shell)
      // Mark this as a PPR page — the production server knows to stream dynamic content
      .replace('</head>', '<meta name="eigen-ppr" content="true"></head>')

    const shellPath = route.path === '/'
      ? 'dist/client/shell.html'
      : `dist/client${route.path}/shell.html`

    mkdirSync(dirname(shellPath), { recursive: true })
    writeFileSync(shellPath, shellHtml)
    console.log(`  ✓ Shell: ${route.path}`)
  }
}
```

---

## Performance characteristics

| Metric | SSG | SSR | PPR |
|---|---|---|---|
| Time to First Byte | ~0ms (CDN) | 200ms+ (server render) | ~0ms (CDN, shell) |
| Time to Largest Contentful Paint | ~0ms | 200ms+ | ~0ms (shell content) |
| Time to full interactivity | Immediate | After hydration | Shell immediate, holes stream in |
| Data freshness | Build time | Request time | Shell: cache TTL. Holes: real-time |
| Personalization | None | Full | Holes only |

PPR gives you CDN-speed initial loads with request-time personalization — the best of both worlds.

---

## What to observe

1. **View source on a PPR page.** You'll see the static content fully rendered and the Suspense fallbacks as HTML placeholders.

2. **Watch the Network waterfall.** The document arrives fast (pre-rendered shell), then you see the incremental content streamed in as chunked transfer encoding.

3. **Compare TTFB** between a full SSR page and a PPR page. The PPR page's TTFB is the time to read a file from disk — typically <10ms vs. 200ms+ for SSR.

4. **Revalidate a cached component** (`revalidateTag`). The shell is regenerated in the background and the next request gets the updated shell.

---

## Key insight

PPR is the logical endpoint of the rendering strategy evolution: SSG (everything static) → SSR (everything dynamic) → ISR (static with revalidation) → PPR (static shell with dynamic holes). Each step gives developers finer control over the freshness/performance tradeoff.

From a Vite architecture perspective, PPR combines three mechanisms we've already built: the `closeBundle` hook for pre-rendering (Part 14), streaming SSR for dynamic content (Part 11), and `"use cache"` for declaring what's cacheable (Part 20). The framework's job is to orchestrate these at the right times — build time for the shell, request time for the holes.

---

## What's next

In Part 27, we'll build **AI streaming** — extending server functions to support structured streaming of AI model responses, with typed tool calls and progressive UI updates. This combines the server function pipeline from Part 13 with React's streaming architecture.
