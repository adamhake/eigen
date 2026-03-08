# Part 16: Static Site Generation — Pre-rendering at Build Time

*This is the sixteenth installment in a series where we build a toy Next.js on top of Vite. In [Part 15](/15-server-functions), we built server functions. Now we'll add static site generation (SSG) — pre-rendering pages to HTML files at build time, so they can be served from a CDN with no server runtime.*

**Concepts introduced:** The `generateBundle` Rollup hook, `renderToString` at build time, typed `generateStaticParams`, ISR-like revalidation concepts, the `closeBundle` hook, hybrid SSR/SSG routing, build-time data fetching.

---

## SSG vs. SSR — when to pre-render

SSR renders pages on every request. SSG renders pages once at build time and serves them as static files. The trade-off is freshness vs. performance: SSR always shows current data, SSG serves from a CDN edge with near-zero latency but shows data from build time.

Next.js popularized the hybrid model — some pages are SSG, some are SSR, and ISR (Incremental Static Regeneration) lets SSG pages revalidate on a schedule. We'll implement the first two and sketch how ISR would work.

---

## The `generateStaticParams` convention

For dynamic routes like `/posts/:id`, the framework needs to know *which* IDs to pre-render. The developer provides this via a typed export:

```tsx
// src/pages/posts/[id].tsx
import type { RouteParamsMap } from 'eigen/route-types'

/**
 * Tell the framework which param combinations to pre-render.
 * The return type is constrained to match this route's params shape.
 */
export async function generateStaticParams(): Promise<
  Array<RouteParamsMap['/posts/:id']>
> {
  const res = await fetch('https://api.example.com/posts')
  const posts = await res.json() as Array<{ id: string }>
  return posts.map(p => ({ id: p.id }))
}

export const loader = defineLoader('/posts/:id', async ({ params }) => {
  const res = await fetch(`https://api.example.com/posts/${params.id}`)
  return res.json() as Promise<{ title: string; body: string }>
})

export default function PostPage({ params, data }: PageProps<'/posts/:id', LoaderData>) {
  return <article><h1>{data.title}</h1><p>{data.body}</p></article>
}
```

The return type `Array<RouteParamsMap['/posts/:id']>` is `Array<{ id: string }>`. If the route were `/posts/:id/:slug`, it would be `Array<{ id: string; slug: string }>`. TypeScript enforces the constraint — you can't return param objects that don't match the route.

---

## Marking routes for SSG

A page opts into SSG by exporting a `staticGeneration` config or by having `generateStaticParams`. Static routes (no dynamic segments) are SSG by default:

```typescript
// packages/eigen/types.ts — additions

export interface StaticGenerationConfig {
  /** Pre-render this page at build time */
  static: true
  /** Revalidation interval in seconds (ISR-like, for future use) */
  revalidate?: number
}
```

---

## The SSG build plugin

The `generateBundle` Rollup hook runs after Rollup has finished bundling but before it writes files to disk. This is where we pre-render:

```typescript
// plugins/eigen-ssg.ts
import type { Plugin } from 'vite'

export default function eigenSSG(): Plugin {
  let serverEntry: string

  return {
    name: 'eigen-ssg',
    apply: 'build', // Only runs during production build

    configResolved(config) {
      serverEntry = config.build?.rollupOptions?.input as string
        ?? 'src/entry-server.tsx'
    },

    // closeBundle runs after ALL environment builds are complete.
    // This is important: we need the server build to exist
    // so we can import it to render pages.
    async closeBundle() {
      // Only run SSG during the server build phase
      if (this.environment?.name !== 'ssr') return

      console.log('\n⚡ Pre-rendering static pages...\n')

      // Import the built server entry
      const serverBuild = await import(
        resolve(process.cwd(), 'dist/server/entry-server.js')
      )

      // Import the route tree to discover SSG-eligible routes
      const { routes } = await import(
        resolve(process.cwd(), 'dist/server/entry-server.js')
      )

      // Read the client HTML template
      const template = readFileSync('dist/client/index.html', 'utf-8')

      const staticPages: Array<{ path: string; html: string }> = []

      for (const route of routes) {
        // Check if the route has generateStaticParams
        if (route.generateStaticParams) {
          const paramSets = await route.generateStaticParams()

          for (const params of paramSets) {
            // Build the actual URL from the params
            const url = route.path.replace(
              /:(\w+)/g,
              (_, key: string) => params[key],
            )

            const { html, data } = await serverBuild.render(url)
            const finalHtml = template
              .replace('<!--ssr-outlet-->', html)
              .replace(
                '</head>',
                `<script>window.__EIGEN_DATA__=${JSON.stringify(data)}</script></head>`,
              )

            staticPages.push({ path: url, html: finalHtml })
            console.log(`  ✓ ${url}`)
          }
        } else if (!route.path.includes(':')) {
          // Static route (no dynamic segments) — pre-render it
          const { html, data } = await serverBuild.render(route.path)
          const finalHtml = template
            .replace('<!--ssr-outlet-->', html)
            .replace(
              '</head>',
              `<script>window.__EIGEN_DATA__=${JSON.stringify(data)}</script></head>`,
            )

          staticPages.push({ path: route.path, html: finalHtml })
          console.log(`  ✓ ${route.path}`)
        }
      }

      // Write the pre-rendered HTML files
      for (const page of staticPages) {
        const filePath = page.path === '/'
          ? 'dist/client/index.html'
          : `dist/client${page.path}/index.html`

        mkdirSync(dirname(filePath), { recursive: true })
        writeFileSync(filePath, page.html)
      }

      console.log(`\n  ${staticPages.length} pages pre-rendered.\n`)
    },
  }
}
```

### Why `closeBundle` instead of `generateBundle`

We use `closeBundle` rather than `generateBundle` because SSG needs the *server build output* to exist on disk — we call `render()` from the built server module. `generateBundle` runs before files are written, so the server build wouldn't be available yet. `closeBundle` runs after all outputs are written.

In the Vite `buildApp` model, where the framework controls build ordering (client first, then server), `closeBundle` on the server build ensures both builds are complete.

---

## Hybrid SSR/SSG routing

The production server needs to serve pre-rendered pages when they exist and fall back to SSR for everything else:

```typescript
// server.prod.ts — hybrid routing
import express from 'express'
import { existsSync, readFileSync } from 'fs'

const app = express()
app.use(express.static('dist/client', { index: false }))

const { render } = await import('./dist/server/entry-server.js')
const template = readFileSync('dist/client/index.html', 'utf-8')

app.get('*', async (req, res) => {
  // Check if a pre-rendered file exists
  const staticPath = req.path === '/'
    ? 'dist/client/index.html'
    : `dist/client${req.path}/index.html`

  if (existsSync(staticPath)) {
    // Serve the pre-rendered HTML
    res.sendFile(resolve(staticPath))
    return
  }

  // Fall back to SSR
  const { html, status, data } = await render(req.originalUrl)
  const finalHtml = template
    .replace('<!--ssr-outlet-->', html)
    .replace('</head>', `<script>window.__EIGEN_DATA__=${JSON.stringify(data)}</script></head>`)

  res.status(status).set({ 'Content-Type': 'text/html' }).end(finalHtml)
})

app.listen(3000)
```

---

## What to observe

1. **Run `npm run build`** and check `dist/client/`. You'll see pre-rendered `.html` files for each static page alongside the bundled assets.

2. **The pre-rendered HTML is complete** — view source shows server-rendered content plus the `__EIGEN_DATA__` script. The page works without JavaScript (for content), and hydrates when JS loads.

3. **Dynamic routes generate multiple files.** If `generateStaticParams` returns 50 posts, you get 50 HTML files under `dist/client/posts/`.

4. **The type constraint on `generateStaticParams`** — try returning `[{ name: 'wrong' }]` for a route with an `[id]` param. TypeScript catches the mismatch.

---

## Key insight

SSG is a build-time loop: discover routes, call their loaders, render to HTML, write files. From Vite's perspective, the interesting hook is `closeBundle` — it runs after the build is complete, giving you access to the built artifacts for post-processing. The framework uses the *server build output* (the same `render()` function used for SSR) to generate the static files, which means the entire rendering pipeline (loaders, layouts, Suspense) works identically whether rendering happens at request time or build time. The only difference is *when* it runs.

---

## What's next

In Part 17, we'll build **deployment adapters** — the plugin pattern that transforms Eigen's generic build output into platform-specific deployment artifacts for Netlify, Cloudflare, Vercel, or a standalone Node server.
