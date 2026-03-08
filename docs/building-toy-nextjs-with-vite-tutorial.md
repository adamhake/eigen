# Building a Toy Next.js with Vite: A Framework Developer's Tutorial

**Goal:** Understand Vite deeply by progressively building a simplified React meta-framework — from a basic SPA all the way through SSR, file-based routing, and server functions. Each module introduces new Vite concepts by making them do real work. The framework itself is written in TypeScript, and a major design goal is providing strong type safety to application developers — type-safe route paths, inferred loader data, and typed params.

**Prerequisites:** Solid React and TypeScript knowledge, comfortable with Node.js and ESM (we covered ESM foundations in a previous conversation). Familiarity with what Next.js does at a high level.

**What you'll build:** A framework called **"Mini"** — a toy Next.js that handles file-based routing, server-side rendering, data loading, and production builds, all powered by Vite plugins and APIs. The framework provides end-to-end type safety: when you create `src/pages/posts/[id].tsx`, the router knows that `/posts/:id` exists, that `params.id` is a string, and that the loader's return type flows through to the component's `data` prop.

---

## Module 0: The Mental Model — What Vite Actually Is

Before writing code, you need to understand what Vite is and isn't, because this shapes every decision a framework author makes.

### Vite is two things

**In development**, Vite is an on-demand module transformer sitting on top of an HTTP server. When the browser requests a module, Vite transforms it (TSX → JS, TypeScript → JS, etc.) and serves it as native ESM. There is no bundling step. The browser's native `import` statements drive the dependency graph — Vite just intercepts and transforms each request as it comes in.

**In production**, Vite is a pre-configured Rollup build. It bundles everything into optimized chunks with tree-shaking, code-splitting, and minification. The dev server doesn't exist; Rollup takes over entirely.

This duality is the central tension of framework development with Vite. Your framework plugin has to work in both modes, and behavior that works in dev (lazy, on-demand) may need completely different handling in production (eager, ahead-of-time).

### The plugin pipeline

Vite's plugin system is Rollup's plugin system, extended with a few Vite-specific hooks. Every module request flows through this pipeline:

```
Browser requests /src/App.tsx
        ↓
   resolveId()    →  "What file does this import point to?"
        ↓
     load()       →  "What is the raw content of this file?"
        ↓
   transform()    →  "Transform the source code (TSX → JS, etc.)"
        ↓
   Browser gets transformed ESM
```

Vite-specific hooks run at other lifecycle points:

- `config()` — Modify the Vite config before it's resolved
- `configResolved()` — Read the final resolved config
- `configureServer()` — Add middleware to the dev server
- `transformIndexHtml()` — Modify the HTML entry point
- `handleHotUpdate()` — Custom HMR logic

### Virtual modules — the framework author's secret weapon

A virtual module is a module that doesn't exist on disk. Your plugin intercepts the import via `resolveId`, then generates its source code on the fly via `load`. This is how frameworks inject runtime code:

```typescript
// In your plugin:
resolveId(id) {
  if (id === 'virtual:my-framework/routes') return '\0virtual:routes'
},
load(id) {
  if (id === '\0virtual:routes') {
    return `export const routes = ${JSON.stringify(discoveredRoutes)}`
  }
}

// In your app code:
import { routes } from 'virtual:mini/routes'
```

The `\0` prefix is a Rollup convention that tells other plugins "this isn't a real file, don't try to resolve it further."

For TypeScript to understand these imports, you need a corresponding `.d.ts` declaration. Framework authors generate these — the plugin writes a declaration file that gives TypeScript full knowledge of the virtual module's shape.

### Vite 6 Environment API (context from your TanStack Start work)

You saw this in action when TanStack Start migrated from Vinxi to native Vite. In Vite 5, there were two implicit environments: `client` and `ssr`. Vite 6 formalizes this — you can define any number of named environments (client, SSR, edge worker, RSC, etc.), each with its own module graph, resolve conditions, and build config.

For this tutorial, we'll use the two default environments (`client` and `ssr`). But understanding that they exist as separate module graphs with separate plugin pipelines is essential. When your plugin's `transform` hook runs, `this.environment` tells you which graph you're in.

---

## Module 1: A Bare Vite SPA — Understanding the Dev Server

**Concepts introduced:** Vite project structure, TypeScript configuration, dev server, `index.html` as entry point, HMR.

### Setup

```bash
mkdir mini-framework && cd mini-framework
npm init -y
npm install vite react react-dom @vitejs/plugin-react
npm install -D typescript @types/react @types/react-dom
```

### Project structure

```
mini-framework/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
└── src/
    ├── main.tsx
    └── pages/
        ├── Home.tsx
        └── About.tsx
```

### `tsconfig.json` — The app code config

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "paths": {
      "mini-framework/*": ["./packages/mini/*"]
    }
  },
  "include": ["src/**/*", "packages/**/*"]
}
```

### `tsconfig.node.json` — The tooling config

Vite config and plugins run in Node, not in the browser. They need a separate tsconfig:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true
  },
  "include": ["vite.config.ts", "plugins/**/*", "server.ts"]
}
```

### `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

### `index.html`

```html
<!DOCTYPE html>
<html>
<head><title>Mini Framework</title></head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

### `src/main.tsx`

```tsx
import { createRoot } from 'react-dom/client'

function App() {
  return <h1>Hello from Mini Framework</h1>
}

createRoot(document.getElementById('root')!).render(<App />)
```

### What to observe

Run `npx vite` and open the browser. Then open DevTools → Network tab.

1. **The HTML is served as-is**, but Vite injects `/@vite/client` — a script that establishes a WebSocket for HMR.
2. **Each import is a separate HTTP request.** Click through the waterfall: `main.tsx` → `react` → `react-dom`. There's no bundle. Vite strips the types and transforms TSX → JS on the fly — TypeScript is a first-class citizen in Vite with zero config.
3. **Dependency pre-bundling:** Check the terminal — Vite ran esbuild to convert `react` and `react-dom` (which are CommonJS) into ESM and cached them in `node_modules/.vite`. This happens once. Your source files are *not* pre-bundled.
4. **Edit `App` and save.** The page updates without a full reload — that's HMR via `@vitejs/plugin-react`.

### Key insight

`index.html` is the true entry point of a Vite app — not a TypeScript file. Vite parses it, finds `<script type="module">` tags, and uses those as the module graph roots. This is why framework authors use `transformIndexHtml` to inject scripts, preload links, and SSR-rendered markup.

Vite handles TypeScript by *stripping types* (via esbuild), not by type-checking. This is important — `npx vite` will happily serve code with type errors. Type checking is a separate concern (`tsc --noEmit`). This separation is intentional: it keeps the dev server fast.

---

## Module 2: Your First Vite Plugin — File-Based Route Discovery

**Concepts introduced:** Writing a Vite plugin in TypeScript, `configureServer`, `resolveId`/`load` (virtual modules), type-safe route generation.

The goal: scan `src/pages/` for `.tsx` files, automatically generate a route manifest, and **generate TypeScript declarations** so that application code gets full type safety over route paths and params.

### Framework types

First, define the types that Mini exposes to application code. This is the framework's public API:

```typescript
// packages/mini/types.ts

/** A route param extracted from a dynamic segment like [id] */
export type RouteParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? { [K in Param]: string } & RouteParams<Rest>
    : T extends `${string}:${infer Param}`
      ? { [K in Param]: string }
      : Record<string, never>

/** Props passed to a page component */
export interface PageProps<
  TPath extends string = string,
  TData = unknown,
> {
  params: RouteParams<TPath>
  data: TData
}

/** A loader function that runs on the server */
export type LoaderFn<
  TPath extends string = string,
  TData = unknown,
> = (context: { params: RouteParams<TPath> }) => Promise<TData> | TData

/** Internal route definition used by the framework runtime */
export interface RouteDefinition {
  path: string
  component: React.ComponentType<any>
  loader?: LoaderFn
}
```

The `RouteParams` type is doing something important: it's a *template literal type* that extracts parameter names from a route path string. Given the path `/posts/:id/:slug`, TypeScript infers `{ id: string; slug: string }`. This is the same technique TanStack Router uses for its fully-typed route params.

### The route discovery plugin

```typescript
// plugins/mini-routes.ts
import { resolve } from 'path'
import { readdirSync, writeFileSync, mkdirSync } from 'fs'
import type { Plugin, ResolvedConfig } from 'vite'

interface DiscoveredRoute {
  path: string
  componentPath: string
  file: string
  paramNames: string[]
}

function fileToRoute(filename: string): { path: string; paramNames: string[] } {
  const paramNames: string[] = []

  const name = filename
    .replace(/\.tsx$/, '')
    .replace(/\[(\w+)\]/g, (_, param) => {
      paramNames.push(param)
      return `:${param}`
    })
    .replace(/\/index$/, '')

  const path = name === 'Home' ? '/' : `/${name.toLowerCase()}`
  return { path, paramNames }
}

function discoverRoutes(pagesDir: string): DiscoveredRoute[] {
  const files = readdirSync(pagesDir, { recursive: true })
    .filter((f): f is string => typeof f === 'string' && f.endsWith('.tsx'))

  return files.map(file => {
    const { path, paramNames } = fileToRoute(file)
    return {
      path,
      componentPath: `/src/pages/${file}`,
      file,
      paramNames,
    }
  })
}

/**
 * Generate a .d.ts file that gives TypeScript full knowledge of
 * the route paths, their params, and their loader data types.
 */
function generateRouteDeclarations(
  routes: DiscoveredRoute[],
  outDir: string,
): void {
  // Build a union type of all known route paths
  const pathUnion = routes.map(r => `'${r.path}'`).join(' | ') || 'never'

  // Build a mapping from each path to its param type
  const paramEntries = routes.map(r => {
    if (r.paramNames.length === 0) {
      return `    '${r.path}': Record<string, never>`
    }
    const paramType = r.paramNames
      .map(p => `${p}: string`)
      .join('; ')
    return `    '${r.path}': { ${paramType} }`
  }).join('\n')

  const dts = `// Auto-generated by mini-framework — do not edit
declare module 'virtual:mini/routes' {
  import type { RouteDefinition } from 'mini-framework/types'
  export const routes: RouteDefinition[]
}

declare module 'virtual:mini/route-types' {
  /** Union of all valid route paths in this application */
  export type RoutePaths = ${pathUnion}

  /** Maps each route path to its params type */
  export interface RouteParamsMap {
${paramEntries}
  }
}
`

  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'mini-routes.d.ts'), dts)
}

export default function miniRoutes(): Plugin {
  const virtualModuleId = 'virtual:mini/routes'
  const resolvedVirtualModuleId = '\0' + virtualModuleId
  let pagesDir: string
  let root: string

  return {
    name: 'mini-routes',

    configResolved(config: ResolvedConfig) {
      root = config.root
      pagesDir = resolve(config.root, 'src/pages')

      // Generate declarations on startup so the IDE has them immediately
      const routes = discoverRoutes(pagesDir)
      generateRouteDeclarations(routes, resolve(root, 'node_modules/.mini'))
    },

    resolveId(id: string) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId
      }
    },

    load(id: string) {
      if (id === resolvedVirtualModuleId) {
        const routes = discoverRoutes(pagesDir)
        const isSSR = this.environment?.name === 'ssr'

        if (isSSR) {
          // Server: static imports, include loaders
          const imports = routes.map((r, i) =>
            `import Page${i}, { loader as loader${i} } from '${r.componentPath}'`
          ).join('\n')

          const routeArray = routes.map((r, i) =>
            `  { path: '${r.path}', component: Page${i}, loader: typeof loader${i} !== 'undefined' ? loader${i} : undefined }`
          ).join(',\n')

          return `
            ${imports}
            export const routes = [\n${routeArray}\n]
          `
        } else {
          // Client: lazy imports for code splitting, no loaders
          const imports = routes.map((r, i) =>
            `import React from 'react'\nconst Page${i} = React.lazy(() => import('${r.componentPath}'))`
          ).join('\n')

          const routeArray = routes.map((r, i) =>
            `  { path: '${r.path}', component: Page${i} }`
          ).join(',\n')

          return `
            import React from 'react'
            ${imports}
            export const routes = [\n${routeArray}\n]
          `
        }
      }
    },

    configureServer(server) {
      server.watcher.add(pagesDir)
      server.watcher.on('all', (event, filePath) => {
        if (filePath.startsWith(pagesDir) && filePath.endsWith('.tsx')) {
          // Regenerate declarations so the IDE picks up new routes
          const routes = discoverRoutes(pagesDir)
          generateRouteDeclarations(routes, resolve(root, 'node_modules/.mini'))

          // Invalidate the virtual module so it regenerates
          const mod = server.moduleGraph.getModuleById(resolvedVirtualModuleId)
          if (mod) {
            server.moduleGraph.invalidateModule(mod)
            server.ws.send({ type: 'full-reload' })
          }
        }
      })
    },
  }
}
```

### Wiring up the generated declarations

Add the generated declaration directory to your tsconfig so TypeScript discovers it:

```json
// tsconfig.json (add to compilerOptions)
{
  "compilerOptions": {
    "typeRoots": ["./node_modules/@types", "./node_modules/.mini"]
  }
}
```

Now when you write `import { routes } from 'virtual:mini/routes'`, TypeScript knows the shape. And when you import route types:

```typescript
import type { RoutePaths, RouteParamsMap } from 'virtual:mini/route-types'

// RoutePaths = '/' | '/about' | '/posts/:id'
// RouteParamsMap['/posts/:id'] = { id: string }
```

### Using the virtual module in your app

Update `src/main.tsx` to consume the generated routes with type-safe navigation:

```tsx
import React, { Suspense, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { routes } from 'virtual:mini/routes'
import type { RouteDefinition } from 'mini-framework/types'
import type { RoutePaths, RouteParamsMap } from 'virtual:mini/route-types'

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

function Router() {
  const [pathname, setPathname] = useState(window.location.pathname)

  useEffect(() => {
    const handler = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  const match = matchRoute(pathname)
  if (!match) return <h1>404</h1>

  const { route, params } = match
  const Component = route.component

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Component params={params} data={undefined} />
    </Suspense>
  )
}

/**
 * Type-safe Link component.
 * The `to` prop only accepts known route paths.
 * For dynamic routes, you must provide the params.
 */
interface LinkProps<T extends RoutePaths> {
  to: T
  params?: RouteParamsMap[T]
  children: React.ReactNode
}

function Link<T extends RoutePaths>({ to, params, children }: LinkProps<T>) {
  let href: string = to
  if (params) {
    // Replace :param segments with actual values
    href = to.replace(/:(\w+)/g, (_, key) => {
      return (params as Record<string, string>)[key] ?? `:${key}`
    })
  }

  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        window.history.pushState({}, '', href)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }}
    >
      {children}
    </a>
  )
}

function App() {
  return (
    <div>
      <nav>
        {/* These are type-checked at compile time */}
        <Link to="/">Home</Link> | <Link to="/about">About</Link>
        {/* <Link to="/nonexistent">Oops</Link>  ← TypeScript error! */}
      </nav>
      <Router />
    </div>
  )
}

export { Link }
createRoot(document.getElementById('root')!).render(<App />)
```

### A type-safe page component

```tsx
// src/pages/posts/[id].tsx
import type { PageProps } from 'mini-framework/types'

// The type parameter ties params to this specific route's shape
type Props = PageProps<'/posts/:id', { title: string; body: string }>

export async function loader({ params }: { params: { id: string } }) {
  // params.id is typed as string — no runtime guessing
  const post = await fetch(`https://jsonplaceholder.typicode.com/posts/${params.id}`)
  return post.json() as Promise<{ title: string; body: string }>
}

export default function PostPage({ params, data }: Props) {
  // params.id: string       ← inferred from '/posts/:id'
  // data.title: string      ← inferred from loader return type
  // data.body: string       ← inferred from loader return type
  return (
    <article>
      <h1>{data.title}</h1>
      <p>Post #{params.id}</p>
      <p>{data.body}</p>
    </article>
  )
}
```

### What to observe

1. **Install `vite-plugin-inspect`** (`npm i -D vite-plugin-inspect`), add it to your config, and visit `/__inspect/`. Find the virtual module `virtual:mini/routes` — you can see the generated source code and the transform pipeline it passes through.
2. **Check `node_modules/.mini/mini-routes.d.ts`** — it contains the generated type declarations. Every time you add or remove a page file, this file updates.
3. **In your editor**, try typing `<Link to="/` — you should get autocomplete for `"/"`, `"/about"`, `"/posts/:id"`. Try an invalid path and see the type error.
4. **This is exactly what TanStack Router does** — it scans a directory, generates route definitions, and writes `.d.ts` files so the router has fully-typed paths, params, and search params. The `routeTree.gen.ts` file you see in TanStack Router projects is the same concept as our `mini-routes.d.ts`.

### Key insight

Type safety in a framework is a **code generation problem**. The plugin discovers routes at dev-server startup, generates JavaScript (the virtual module) for the runtime, and generates TypeScript declarations (the `.d.ts` file) for the type checker. These two outputs serve different consumers — the browser and the IDE — but are generated from the same source of truth: the filesystem.

---

## Module 3: Server-Side Rendering — The SSR Environment

**Concepts introduced:** Vite's SSR mode, `server.ssrLoadModule`, `createServer` programmatic API, `transformIndexHtml`, dual module graphs.

This is where framework development gets interesting. We need Vite to do two things simultaneously: serve the client app *and* run our React components on the server to produce HTML.

### The server entry point

Create `src/entry-server.tsx`:

```tsx
import React from 'react'
import { renderToString } from 'react-dom/server'
import { routes } from 'virtual:mini/routes'
import type { RouteDefinition } from 'mini-framework/types'

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

interface RenderResult {
  html: string
  status: number
  data: unknown
}

export async function render(pathname: string): Promise<RenderResult> {
  const match = matchRoute(pathname)
  if (!match) return { html: '<h1>404</h1>', status: 404, data: null }

  const { route, params } = match
  const Component = route.component

  // Call the loader if it exists
  let data: unknown = null
  if (route.loader) {
    data = await route.loader({ params })
  }

  const html = renderToString(<Component params={params} data={data} />)
  return { html, status: 200, data }
}
```

### The dev server with SSR

Replace `npx vite` with a custom server. Create `server.ts`:

```typescript
import express from 'express'
import { createServer as createViteServer, type ViteDevServer } from 'vite'
import { readFileSync } from 'fs'

async function start() {
  const app = express()

  // Create Vite server in middleware mode
  const vite: ViteDevServer = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom', // Don't serve index.html automatically
  })

  // Use Vite's connect middleware for HMR, static files, transforms
  app.use(vite.middlewares)

  app.get('*', async (req, res) => {
    const url = req.originalUrl

    try {
      // 1. Read the HTML template
      let template = readFileSync('index.html', 'utf-8')

      // 2. Apply Vite HTML transforms (injects HMR client, etc.)
      template = await vite.transformIndexHtml(url, template)

      // 3. Load the server entry — this is the key SSR API
      //    Vite transforms the module through the SSR environment's
      //    plugin pipeline, resolving imports for Node (not browser)
      const { render } = await vite.ssrLoadModule('/src/entry-server.tsx') as {
        render: (pathname: string) => Promise<{
          html: string
          status: number
          data: unknown
        }>
      }

      // 4. Render the app to HTML
      const { html: appHtml, status, data } = await render(url)

      // 5. Inject rendered HTML and serialized data into the template
      const finalHtml = template
        .replace('<!--ssr-outlet-->', appHtml)
        .replace(
          '</head>',
          `<script>window.__MINI_DATA__ = ${JSON.stringify(data)}</script></head>`,
        )

      res.status(status).set({ 'Content-Type': 'text/html' }).end(finalHtml)
    } catch (e) {
      // Vite captures stack traces and rewrites them to match source
      if (e instanceof Error) {
        vite.ssrFixStacktrace(e)
        console.error(e.stack)
        res.status(500).end(e.message)
      }
    }
  })

  app.listen(3000, () => console.log('http://localhost:3000'))
}

start()
```

Install express and its types: `npm install express && npm install -D @types/express`

### Typing `ssrLoadModule`

Notice the type assertion on `ssrLoadModule`. This is a common friction point: `ssrLoadModule` returns `Record<string, any>` because Vite can't know the shape of an arbitrary module at compile time. Framework authors deal with this in a few ways:

1. **Type assertion at the call site** (what we're doing above) — simple, local, and the framework controls both sides
2. **A typed wrapper function** — the framework exports a helper that encapsulates the assertion:

```typescript
// packages/mini/server.ts
import type { ViteDevServer } from 'vite'
import type { RenderResult } from './types'

export async function loadServerEntry(vite: ViteDevServer) {
  const mod = await vite.ssrLoadModule('/src/entry-server.tsx')
  return mod as {
    render: (pathname: string) => Promise<RenderResult>
  }
}
```

3. **Code generation** — generate a typed server entry that re-exports with proper types (TanStack Start does this)

### What to observe

1. **`ssrLoadModule` is the core SSR API.** It processes your module through the SSR plugin pipeline — same `resolveId`/`load`/`transform` hooks, but in a Node-targeted environment. Imports like `react-dom/server` resolve correctly because the SSR environment uses Node resolve conditions.
2. **The virtual module generates different code per environment.** Client gets `React.lazy` with dynamic imports (code splitting). Server gets static imports (synchronous, no Suspense boundary needed). Both consume the same types.
3. **`transformIndexHtml` is critical.** It injects `/@vite/client` for HMR. Without it, dev mode breaks. In production, it handles asset URL rewriting.
4. **View source in the browser.** You'll see server-rendered HTML inside `<div id="root">`. The client then hydrates over it.

### Key insight

This is the fundamental architecture of every Vite-based SSR framework. The dev server simultaneously handles two module graphs: one for the browser (ESM, code splitting, HMR) and one for the server (Node, synchronous imports, `ssrLoadModule`). Your plugin generates different code for each. This is what Vinxi abstracted with its "router" concept, and what Vite 6 formalizes with the Environment API.

The `ssrLoadModule` type gap is representative of a broader challenge: the boundary between build-time code (the plugin, which knows everything) and runtime code (the server, which receives `any`) requires deliberate type bridging. The plugin generates both the JavaScript and the declarations — the runtime trusts the generated types.

---

## Module 4: Hydration — Connecting Server and Client

**Concepts introduced:** Client entry point, hydration, `transformIndexHtml` for script injection, matching server/client rendering, typed global state.

Server rendering is useless without hydration — the client needs to "take over" the server-rendered HTML and make it interactive.

### Typing the serialized data

The server writes `window.__MINI_DATA__` into the HTML. TypeScript doesn't know about this property. Declare it:

```typescript
// packages/mini/global.d.ts
declare global {
  interface Window {
    __MINI_DATA__: unknown
  }
}

export {}
```

### Create the client entry

`src/entry-client.tsx`:

```tsx
import React, { Suspense, useState, useEffect } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { routes } from 'virtual:mini/routes'
import type { RouteDefinition } from 'mini-framework/types'
import type { RoutePaths, RouteParamsMap } from 'virtual:mini/route-types'

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

function Router() {
  const [pathname, setPathname] = useState(window.location.pathname)
  const [data, setData] = useState<unknown>(window.__MINI_DATA__)

  useEffect(() => {
    const handler = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  const match = matchRoute(pathname)
  if (!match) return <h1>404</h1>
  const Component = match.route.component

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Component params={match.params} data={data} />
    </Suspense>
  )
}

interface LinkProps<T extends RoutePaths> {
  to: T
  params?: RouteParamsMap[T]
  children: React.ReactNode
}

function Link<T extends RoutePaths>({ to, params, children }: LinkProps<T>) {
  let href: string = to
  if (params) {
    href = to.replace(/:(\w+)/g, (_, key: string) => {
      return (params as Record<string, string>)[key] ?? `:${key}`
    })
  }

  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        window.history.pushState({}, '', href)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }}
    >
      {children}
    </a>
  )
}

function App() {
  return (
    <div>
      <nav>
        <Link to="/">Home</Link> | <Link to="/about">About</Link>
      </nav>
      <Router />
    </div>
  )
}

hydrateRoot(document.getElementById('root')!, <App />)
```

### Update `index.html`

```html
<!DOCTYPE html>
<html>
<head><title>Mini Framework</title></head>
<body>
  <div id="root"><!--ssr-outlet--></div>
  <script type="module" src="/src/entry-client.tsx"></script>
</body>
</html>
```

### Update `entry-server.tsx` to render the full App shell

```tsx
import React from 'react'
import { renderToString } from 'react-dom/server'
import { routes } from 'virtual:mini/routes'
import type { RouteDefinition } from 'mini-framework/types'

interface RouteMatch {
  route: RouteDefinition
  params: Record<string, string>
}

function matchRoute(pathname: string): RouteMatch | null {
  // Same matching logic as entry-client...
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
      <nav>
        <a href="/">Home</a> | <a href="/about">About</a>
      </nav>
      <Component params={match.params} data={data} />
    </div>
  )
}

export interface RenderResult {
  html: string
  status: number
  data: unknown
}

export async function render(pathname: string): Promise<RenderResult> {
  const match = matchRoute(pathname)

  let data: unknown = null
  if (match?.route.loader) {
    data = await match.route.loader({ params: match.params })
  }

  const html = renderToString(<App pathname={pathname} data={data} />)
  return { html, status: match ? 200 : 404, data }
}
```

### What to observe

1. **The HTML arrives fully rendered.** View source shows actual content, not an empty `<div id="root">`.
2. **`hydrateRoot` instead of `createRoot`.** React attaches event listeners to the existing DOM without re-rendering it. If there's a mismatch between server and client output, React warns in the console.
3. **`window.__MINI_DATA__` is typed as `unknown`.** This is deliberate — the serialized data crosses a trust boundary (server → HTML → client). Each page component should narrow the type using its `PageProps` generic.
4. **The `Link` component constrains `to` to `RoutePaths`.** Invalid paths are caught at compile time, not runtime.

### Key insight

Hydration is the moment where server-rendered HTML becomes a live React app. The critical requirement is that server and client render the same component tree for the same URL. Mismatches cause hydration errors. This is why frameworks are so careful about separating server-only code from universal code — and why TanStack Start uses separate `.server.ts` files and `createServerFn` to keep the boundary explicit.

The type story here has an interesting gap: `window.__MINI_DATA__` is `unknown` at the client, even though the server *knows* the loader's return type. Bridging this gap fully requires either runtime validation (zod, valibot) or more sophisticated code generation that produces per-route typed hydration helpers. TanStack Start takes the code generation path; Remix takes the runtime validation path with `useLoaderData<typeof loader>()`.

---

## Module 5: Data Loading — Typed Loaders

**Concepts introduced:** The `transform` hook for code manipulation, serializing server data to the client, the data → HTML → hydrate pipeline, inferring loader return types.

Next.js has `getServerSideProps`. Remix has `loader`. We'll build a similar pattern where each page can export a `loader` function that runs on the server, and the framework infers the return type so the component's `data` prop is fully typed.

### The loader convention with type inference

The key design goal: when a developer writes a loader, the return type should flow through to `data` automatically — no manual type annotations on the component.

```tsx
// src/pages/posts/[id].tsx
import type { PageProps, LoaderFn } from 'mini-framework/types'

// Define the loader — its return type is inferred
export const loader = (async ({ params }) => {
  const res = await fetch(
    `https://jsonplaceholder.typicode.com/posts/${params.id}`,
  )
  const post = await res.json() as { id: number; title: string; body: string }
  return post
}) satisfies LoaderFn<'/posts/:id'>

// Extract the loader's return type for the component
type LoaderData = Awaited<ReturnType<typeof loader>>

export default function PostPage({ params, data }: PageProps<'/posts/:id', LoaderData>) {
  // data.id: number       ← inferred
  // data.title: string    ← inferred
  // data.body: string     ← inferred
  // params.id: string     ← inferred from route path
  return (
    <article>
      <h1>{data.title}</h1>
      <p>Post #{params.id}</p>
      <p>{data.body}</p>
    </article>
  )
}
```

The `satisfies LoaderFn<'/posts/:id'>` constraint gives you two things: it ensures the loader's `params` argument matches the route's dynamic segments, and it preserves the narrow return type (instead of widening to `unknown`). This is the `satisfies` operator doing exactly what it was designed for — constraining without widening.

### Making it even more ergonomic with `defineLoader`

For a nicer DX, the framework can provide a helper that ties the loader to its route path:

```typescript
// packages/mini/helpers.ts
import type { RouteParamsMap } from 'virtual:mini/route-types'

/**
 * Define a type-safe loader for a specific route.
 * The params type is inferred from the route path.
 */
export function defineLoader<
  TPath extends keyof RouteParamsMap,
  TData,
>(
  _path: TPath,
  fn: (ctx: { params: RouteParamsMap[TPath] }) => Promise<TData> | TData,
): (ctx: { params: RouteParamsMap[TPath] }) => Promise<TData> | TData {
  return fn
}
```

Usage:

```tsx
// src/pages/posts/[id].tsx
import { defineLoader } from 'mini-framework/helpers'
import type { PageProps } from 'mini-framework/types'

export const loader = defineLoader('/posts/:id', async ({ params }) => {
  // params.id is typed as string — guaranteed by the route path
  const res = await fetch(`https://api.example.com/posts/${params.id}`)
  return res.json() as Promise<{ id: number; title: string; body: string }>
})

type LoaderData = Awaited<ReturnType<typeof loader>>

export default function PostPage({ params, data }: PageProps<'/posts/:id', LoaderData>) {
  return (
    <article>
      <h1>{data.title}</h1>
      <p>Post #{params.id}</p>
      <p>{data.body}</p>
    </article>
  )
}
```

The first argument to `defineLoader` is the route path — TypeScript validates it against the `RouteParamsMap` generated by the plugin. If you write `defineLoader('/posts/:id', ...)` but the file is actually at `src/pages/users/[name].tsx`, the path won't match any entry in `RouteParamsMap` and you get a type error.

### Advanced: generating per-route typed hooks (the TanStack Router approach)

The approach above still requires the developer to write `Awaited<ReturnType<typeof loader>>` manually. To eliminate this entirely, the plugin can generate per-route modules:

```typescript
// Generated by the plugin into node_modules/.mini/route-helpers.d.ts
declare module 'virtual:mini/page/posts/[id]' {
  import type { PageProps } from 'mini-framework/types'

  /** Pre-typed props for this specific page */
  export type Props = PageProps<'/posts/:id'>

  /** Hook to access this route's loader data with full types */
  export function useLoaderData(): Awaited<ReturnType<typeof import('/src/pages/posts/[id].tsx').loader>>
}
```

This is essentially what TanStack Router's code generation produces — per-route typed hooks and components. The complexity scales, but the DX is seamless: the developer never writes a type annotation.

### Server-side: calling loaders

The server entry (`entry-server.tsx`) already calls `route.loader({ params })` from Module 3. The data flows to the component as a prop, and is serialized to `window.__MINI_DATA__` for hydration.

### Client-side: data on navigation

After the initial hydration, client-side navigations need fresh data. The client fetches it from a data endpoint:

```tsx
// In entry-client.tsx Router component
async function navigateTo(pathname: string) {
  // Fetch loader data from a server endpoint
  const res = await fetch(`/_mini/data?path=${encodeURIComponent(pathname)}`)
  const data = await res.json()

  setData(data)
  setPathname(pathname)
  window.history.pushState({}, '', pathname)
}
```

And the framework plugin adds a middleware for this:

```typescript
// In the configureServer hook
server.middlewares.use(async (req, res, next) => {
  if (!req.url?.startsWith('/_mini/data')) return next()

  const url = new URL(req.url, 'http://localhost')
  const pathname = url.searchParams.get('path') ?? '/'

  const { render } = await server.ssrLoadModule('/src/entry-server.tsx')
  const { data } = await render(pathname)

  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
})
```

### What to observe

1. **The loader's return type flows through** — `data.title` is typed without any manual annotation on the component (when using the `satisfies` pattern or `defineLoader`).
2. **The loader never appears in the client bundle.** Because the client virtual module doesn't import it, Vite's tree-shaking eliminates it entirely.
3. **`window.__MINI_DATA__` serialization** — view source and you'll see the JSON in a `<script>` tag. This is exactly how Next.js serializes `getServerSideProps` return values as `__NEXT_DATA__`.
4. **The `defineLoader` path argument is type-checked** — invalid route paths produce compile errors.

### Key insight

The loader type inference story has three levels of sophistication, each involving more code generation:

1. **Manual**: Developer annotates `PageProps<'/path', DataType>` — simple but verbose
2. **`satisfies` + `ReturnType`**: Developer writes `satisfies LoaderFn<'/path'>` and extracts the type — moderate DX
3. **Generated per-route types**: Plugin generates a `.d.ts` with pre-connected types — zero-annotation DX but complex generation

Real frameworks choose different points on this spectrum. Next.js App Router with Server Components sidesteps it entirely (components *are* the data fetching layer). TanStack Router goes full code generation. Remix uses `useLoaderData<typeof loader>()` which is the `ReturnType` approach wrapped in a hook.

---

## Module 6: Production Builds — The Build Pipeline

**Concepts introduced:** `vite build`, client/server build coordination, manifest files, static asset handling.

Development is one thing. Production requires generating optimized, deployable artifacts.

### Two builds, one command

A framework SSR build requires two Rollup builds:
1. **Client build** — Bundles the client entry into hashed, optimized chunks
2. **Server build** — Bundles the server entry into a Node-compatible module

### Configure the builds

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import miniRoutes from './plugins/mini-routes.ts'

export default defineConfig({
  plugins: [react(), miniRoutes()],
  build: {
    manifest: true,
    rollupOptions: {
      input: 'src/entry-client.tsx',
    },
  },
})
```

### Build scripts

```json
{
  "scripts": {
    "build": "npm run build:client && npm run build:server",
    "build:client": "vite build --outDir dist/client",
    "build:server": "vite build --outDir dist/server --ssr src/entry-server.tsx"
  }
}
```

The `--ssr` flag tells Vite to build for the SSR environment: Node-targeted, no code splitting, externalized node_modules.

### Production server

```typescript
// server.prod.ts
import express from 'express'
import { readFileSync } from 'fs'

const app = express()

// Serve static assets from the client build
app.use(express.static('dist/client', { index: false }))

// Read the built HTML template
const template = readFileSync('dist/client/index.html', 'utf-8')

// Read the manifest for asset URLs
const manifest: Record<string, { file: string; css?: string[] }> = JSON.parse(
  readFileSync('dist/client/.vite/manifest.json', 'utf-8'),
)

// Import the server build
const { render } = await import('./dist/server/entry-server.js') as {
  render: (pathname: string) => Promise<{
    html: string
    status: number
    data: unknown
  }>
}

app.get('*', async (req, res) => {
  const { html: appHtml, status, data } = await render(req.originalUrl)

  const finalHtml = template
    .replace('<!--ssr-outlet-->', appHtml)
    .replace(
      '</head>',
      `<script>window.__MINI_DATA__ = ${JSON.stringify(data)}</script></head>`,
    )

  res.status(status).set({ 'Content-Type': 'text/html' }).end(finalHtml)
})

app.listen(3000)
```

### What to observe

1. **The client build produces hashed filenames** like `entry-client-a1b2c3d4.js`. The manifest maps `src/entry-client.tsx` to this filename so the server knows which script tags to inject.
2. **The server build produces a plain `.js` file** with no hashing, no code splitting — it's designed to be imported by Node.
3. **Both builds run the same plugin pipeline.** Your `mini-routes` plugin generates the virtual module during both builds, but with different code for each environment.
4. **Type annotations from `.tsx` files are stripped in the output.** The production bundles are pure JavaScript — types are a dev-time concern only.

### Key insight

The production build is where the "two separate module graphs" concept becomes concrete. You get two entirely different output directories. The manifest file is the bridge — it tells the production server which client assets exist and what their URLs are. Every SSR framework has this pattern: build client, build server, use manifest to connect them.

---

## Module 7: The `transform` Hook — Code Transformation at Scale

**Concepts introduced:** AST-level code transformation, removing server code from client bundles, the "use server" / "use client" boundary.

So far our server/client boundary is enforced by the virtual module generating different imports. But what if someone imports a database driver directly in a page file? We need a `transform` hook that strips server-only code from client bundles.

### Implementing a loader-stripping transform

```typescript
// plugins/mini-strip-loaders.ts
import type { Plugin } from 'vite'

export default function miniStripLoaders(): Plugin {
  return {
    name: 'mini-strip-loaders',

    // Vite 6: only apply to the client environment
    applyToEnvironment(environment) {
      return environment.name === 'client'
    },

    transform(code: string, id: string) {
      // Only process page files
      if (!id.includes('/pages/') || !id.endsWith('.tsx')) return

      // Check if the file exports a loader
      if (!/export\s+(const|async\s+function|function)\s+loader/.test(code)) {
        return
      }

      // Strip the loader export
      // A real implementation would use an AST parser (babel, swc, or ts.transpileModule)
      // For demonstration, we use a regex approach
      //
      // This handles:
      //   export async function loader(...) { ... }
      //   export const loader = defineLoader(...)
      //   export const loader = (async (...) => { ... }) satisfies LoaderFn

      const stripped = code.replace(
        /export\s+(?:const\s+loader\s*=[\s\S]*?(?:;|\n(?=export|import|\/\/))|(?:async\s+)?function\s+loader\s*\([^)]*\)\s*(?::\s*[^{]*?)?\{[\s\S]*?\n\})/,
        '// loader stripped for client bundle',
      )

      // Also strip the defineLoader import if nothing else uses it
      const result = stripped.replace(
        /import\s*\{\s*defineLoader\s*\}\s*from\s*['"]mini-framework\/helpers['"]\s*;?\n?/,
        '',
      )

      return { code: result, map: null }
    },
  }
}
```

### Why this matters

Without this transform, if your loader imports `pg` (PostgreSQL driver), that import would end up in the client bundle — and fail because `pg` doesn't run in browsers. This is exactly the "server-side imports leaking to client bundles" issue we flagged in the TanStack Start architecture review (issues #2783 and #6185). TanStack Start mitigates it with `.server.ts` file conventions. Next.js mitigates it by running `getServerSideProps` in a separate compilation unit. Our `transform` hook is the low-level mechanism beneath both approaches.

### Typed AST transforms (for production frameworks)

The regex approach above is fragile. A production framework would parse TypeScript properly:

```typescript
import ts from 'typescript'

function stripLoaderExport(code: string, id: string): string {
  const sourceFile = ts.createSourceFile(
    id,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )

  const printer = ts.createPrinter()
  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    return (source) => {
      function visit(node: ts.Node): ts.Node | undefined {
        // Remove: export function loader(...) { ... }
        if (
          ts.isFunctionDeclaration(node) &&
          node.name?.text === 'loader' &&
          node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
        ) {
          return undefined // removes the node
        }

        // Remove: export const loader = ...
        if (
          ts.isVariableStatement(node) &&
          node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
        ) {
          const decl = node.declarationList.declarations[0]
          if (ts.isIdentifier(decl.name) && decl.name.text === 'loader') {
            return undefined
          }
        }

        return ts.visitEachChild(node, visit, context)
      }

      return ts.visitNode(source, visit) as ts.SourceFile
    }
  }

  const result = ts.transform(sourceFile, [transformer])
  return printer.printFile(result.transformed[0])
}
```

Using the TypeScript compiler API ensures you correctly handle all the syntactic forms a loader can take — arrow functions, function declarations, re-exports, `satisfies` expressions. The trade-off is speed: `ts.createSourceFile` is slower than a regex check. SWC's Rust-based parser is what most production frameworks use for this reason.

### A note on `applyToEnvironment` (Vite 6)

The `applyToEnvironment` hook is the clean Vite 6 way to make a plugin environment-aware. Before Vite 6, you'd check `this.environment?.name === 'ssr'` or use the `ssr` boolean passed to some hooks. The new API is more explicit and handles edge cases like custom environments (edge workers, RSC).

### Key insight

The `transform` hook is where framework authors do their most delicate work. It's essentially a compiler pass — you receive source code and return modified source code. The TypeScript angle adds complexity: you're transforming TypeScript source that may contain type-only exports, `satisfies` operators, and generic type arguments. A naive regex that looks for `export function loader` might accidentally match a type definition. This is why production frameworks invest in proper AST parsing.

---

## Module 8: `configureServer` and Dev Middleware — The Framework Shell

**Concepts introduced:** Custom dev server middleware, API routes, typed request/response handling.

A real framework's dev server does more than serve HTML. It handles API routes, manages auth redirects, serves static files with correct headers, and more. All of this lives in `configureServer`.

### Adding typed API routes

```typescript
// packages/mini/api-types.ts

/** The context passed to an API route handler */
export interface ApiContext {
  params: Record<string, string>
  query: Record<string, string>
}

/** An API route handler function */
export type ApiHandler<TResponse = unknown> = (
  ctx: ApiContext,
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
) => Promise<TResponse> | TResponse
```

```typescript
// plugins/mini-api.ts
import type { Plugin, ViteDevServer } from 'vite'

export default function miniApi(): Plugin {
  let viteServer: ViteDevServer

  return {
    name: 'mini-api',

    configureServer(server) {
      viteServer = server

      // Return a function to add middleware AFTER Vite's built-in middleware
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/api/')) return next()

          try {
            // Map /api/hello → src/api/hello.ts
            const urlPath = req.url.split('?')[0]
            const apiPath = `/src/api${urlPath.replace('/api', '')}.ts`

            const mod = await viteServer.ssrLoadModule(apiPath) as {
              default?: (...args: unknown[]) => unknown
            }

            if (typeof mod.default !== 'function') {
              res.writeHead(404)
              res.end('Not found')
              return
            }

            const url = new URL(req.url, 'http://localhost')
            const ctx = {
              params: {},
              query: Object.fromEntries(url.searchParams),
            }

            const result = await mod.default(ctx, req, res)
            if (!res.writableEnded) {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(result))
            }
          } catch (e) {
            if (e instanceof Error) {
              viteServer.ssrFixStacktrace(e)
              console.error(e.stack)
            }
            res.writeHead(500)
            res.end('Internal server error')
          }
        })
      }
    },
  }
}
```

### Create a typed API route

```typescript
// src/api/hello.ts
import type { ApiHandler } from 'mini-framework/api-types'

interface HelloResponse {
  message: string
  timestamp: number
}

const handler: ApiHandler<HelloResponse> = async (ctx) => {
  return {
    message: `Hello! Query: ${JSON.stringify(ctx.query)}`,
    timestamp: Date.now(),
  }
}

export default handler
```

### Middleware ordering matters

Notice the `return () => { ... }` pattern in `configureServer`. If you add middleware directly (not in the returned function), it runs *before* Vite's middleware. If you return a function, the middleware in that function runs *after*. The ordering:

1. Pre-middlewares (added directly in `configureServer`)
2. Vite's internal middleware (HMR WebSocket, static file serving, transform pipeline)
3. Post-middlewares (added in the returned function)

For SSR and API routes, you almost always want post-middleware — let Vite handle static assets first, then catch everything else.

### Key insight

`configureServer` is how a framework takes control of the HTTP layer during development. In production, this middleware doesn't exist — the production server (Express, Hono, Fastify, or a serverless adapter) handles routing directly. This is why frameworks like TanStack Start need deployment adapters (Netlify, Vercel, Cloudflare) — the dev server middleware has to be translated into each platform's routing model.

The `ssrLoadModule` type assertion pattern appears again here. The framework can't statically know the shape of an arbitrary API route module — it uses a convention (`export default`) and asserts the type. The `ApiHandler<T>` type gives the *developer* safety when writing the route; the framework runtime trusts the convention.

---

## Module 9: HMR — Making Development Fast

**Concepts introduced:** `handleHotUpdate`, `import.meta.hot`, HMR boundaries, the module graph, regenerating declarations on changes.

HMR is what makes Vite development feel instant. When you save a file, only that module (and its dependents) are re-evaluated — the page doesn't reload.

### How Vite HMR works

1. **File change detected** (via chokidar watcher)
2. **Vite finds the changed module in the module graph**
3. **Walks up the dependency tree** looking for an HMR boundary — a module that accepts hot updates
4. **Sends an update via WebSocket** to the client
5. **Client re-imports the changed modules** and calls accept handlers

`@vitejs/plugin-react` sets up HMR boundaries for every React component — that's why editing a component hot-reloads without losing state.

### Custom HMR for route changes

When a page file is added or deleted, we need to regenerate both the route manifest (runtime) and the type declarations (IDE). Our `configureServer` watcher already does a full reload, but we can be smarter:

```typescript
// In mini-routes plugin, add:
handleHotUpdate({ file, server }) {
  if (file.includes('/pages/') && file.endsWith('.tsx')) {
    // Regenerate type declarations so the IDE picks up changes
    const routes = discoverRoutes(pagesDir)
    generateRouteDeclarations(routes, resolve(root, 'node_modules/.mini'))

    // Invalidate the virtual route module
    const routeModule = server.moduleGraph.getModuleById(
      resolvedVirtualModuleId,
    )
    if (routeModule) {
      server.moduleGraph.invalidateModule(routeModule)

      // Only do a full reload if a file was added/deleted
      // For content changes within a page, let React HMR handle it
      return [] // Return empty array = we handled it, don't do default HMR
    }
  }
}
```

### The type regeneration cycle

This creates a virtuous feedback loop:

1. Developer creates `src/pages/users/[name].tsx`
2. Chokidar fires a watcher event
3. Plugin regenerates `mini-routes.d.ts` — TypeScript now knows about `/users/:name`
4. Plugin invalidates the virtual module — runtime route list updates
5. Dev server sends a full reload
6. Developer's editor shows autocomplete for `<Link to="/users/:name" params={{ name: "..." }}>` immediately

This is the same cycle TanStack Router runs when you add a new route file — its `@tanstack/router-plugin/vite` watches the filesystem and regenerates `routeTree.gen.ts`.

### Understanding the module graph

Vite maintains a module graph that tracks import relationships. You can inspect it programmatically:

```typescript
configureServer(server) {
  server.httpServer?.on('listening', () => {
    setTimeout(() => {
      const mods = server.moduleGraph.idToModuleMap
      for (const [id, mod] of mods) {
        const importers = [...(mod.importers || [])]
          .map(m => m.id)
          .filter(Boolean)
        if (importers.length > 0) {
          console.log(`${id} ← imported by: ${importers.join(', ')}`)
        }
      }
    }, 3000)
  })
}
```

### Key insight

HMR is the module graph plus the WebSocket. The module graph knows which modules import which others. When a leaf module changes, Vite traces upward to find the nearest HMR boundary. If it reaches the root without finding one, it does a full page reload. Framework plugins set up the boundaries (React's `import.meta.hot.accept`), and can customize what happens when specific files change via `handleHotUpdate`.

For a typed framework, HMR has a second dimension: declaration file regeneration. The runtime module graph and the TypeScript declaration graph are parallel structures. When the filesystem changes, both need to update. The module graph update is instant (invalidation); the declaration update requires a file write, which triggers the TypeScript language server to re-check.

---

## Module 10: Putting It All Together — `buildApp` and the Framework Plugin

**Concepts introduced:** Composing plugins, the `buildApp` hook, creating a single plugin that encapsulates the framework, the plugin's public type surface.

A real framework ships as a single plugin (or a small set of coordinated plugins) that users add to their `vite.config.ts`. Let's compose everything into a `mini()` plugin.

### The unified framework plugin

```typescript
// packages/mini/plugin.ts
import type { Plugin, UserConfig } from 'vite'
import miniRoutes from './plugins/mini-routes'
import miniStripLoaders from './plugins/mini-strip-loaders'
import miniApi from './plugins/mini-api'

export interface MiniOptions {
  /** Directory containing page components. Default: 'src/pages' */
  pagesDir?: string
  /** Directory containing API routes. Default: 'src/api' */
  apiDir?: string
}

export default function mini(options: MiniOptions = {}): Plugin[] {
  return [
    // Route discovery and virtual module generation
    miniRoutes({ pagesDir: options.pagesDir }),

    // Strip server-only code from client bundles
    miniStripLoaders(),

    // API route handling in dev
    miniApi({ apiDir: options.apiDir }),

    // The framework configuration plugin
    {
      name: 'mini-framework',

      config(userConfig: UserConfig) {
        return {
          build: {
            manifest: true,
            rollupOptions: {
              input: userConfig.build?.rollupOptions?.input
                ?? 'src/entry-client.tsx',
            },
          },
          environments: {
            ssr: {
              build: {
                outDir: 'dist/server',
                rollupOptions: {
                  input: 'src/entry-server.tsx',
                },
              },
            },
          },
        }
      },

      // Coordinate client + server builds in production
      buildApp: {
        order: 'pre' as const,
        async handler(builder) {
          // Build client first (generates manifest)
          await builder.build(builder.environments.client)
          // Then build server (can reference manifest)
          await builder.build(builder.environments.ssr)
        },
      },
    },
  ]
}
```

### The framework's type exports

```typescript
// packages/mini/index.ts — the public API
export type { PageProps, LoaderFn, RouteDefinition } from './types'
export type { ApiHandler, ApiContext } from './api-types'
export { defineLoader } from './helpers'
```

### User-facing config

Now the user's config is clean:

```typescript
// vite.config.ts (user's project)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mini from 'mini-framework/plugin'

export default defineConfig({
  plugins: [mini(), react()],
})
```

### What this teaches about real frameworks

Compare this to TanStack Start's config:

```typescript
// TanStack Start vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [tanstackStart(), react()],
})
```

The pattern is identical. `tanstackStart()` returns an array of plugins that handle route generation, server function compilation, build orchestration, and dev server configuration. The `buildApp` hook is how it coordinates the multi-environment build that replaced Vinxi's `vinxi build`.

### The type surface a framework ships

Looking at what Mini exports, the framework's type API has three layers:

| Layer | What | How |
|---|---|---|
| **Static types** | `PageProps`, `LoaderFn`, `ApiHandler` | Shipped in `.d.ts` files in the npm package |
| **Generated types** | `RoutePaths`, `RouteParamsMap` | Written to `node_modules/.mini/` by the plugin at dev time |
| **Virtual module types** | `virtual:mini/routes` | Declared in the generated `.d.ts`, backed by plugin `load()` at runtime |

The static types define contracts. The generated types provide project-specific information. The virtual module types bridge the two — they give TypeScript access to what the plugin generates at runtime. This three-layer pattern is universal across typed frameworks.

---

## Where to Go Next

You've now built — in miniature — every layer that a production framework like Next.js or TanStack Start implements, with full TypeScript throughout:

| Concept | Your Mini version | Next.js equivalent | TanStack Start equivalent |
|---|---|---|---|
| Route discovery | `mini-routes` plugin scanning `pages/` | Filesystem router in `pages/` or `app/` | `@tanstack/router-plugin/vite` file-based routing |
| Type-safe routes | Generated `.d.ts` with `RoutePaths` union | Limited (string paths) | `routeTree.gen.ts` with fully-typed paths |
| Virtual modules | `virtual:mini/routes` | Internal route manifest | `@tanstack/react-start/plugin` virtual modules |
| SSR | `ssrLoadModule` + Express | Built-in Node server | Nitro server via `createServerFn` |
| Hydration | `hydrateRoot` + typed `__MINI_DATA__` | `hydrateRoot` + `__NEXT_DATA__` | `hydrateRoot` + router hydration |
| Data loading | `loader` with `satisfies LoaderFn` | `getServerSideProps` / Server Components | `createServerFn` + route loaders |
| Loader type inference | `defineLoader` + `ReturnType` | `InferGetServerSidePropsType` | Full inference via codegen |
| Code stripping | `transform` hook removing loaders | Automatic server/client separation | `.server.ts` convention + transform |
| Build orchestration | `buildApp` hook | Custom webpack builds | `buildApp` via Vite plugin |
| Dev middleware | `configureServer` with typed handlers | Custom Next.js dev server | Nitro dev server middleware |

### Exercises to deepen understanding

1. **Add `generateStaticParams`** — Implement static site generation (SSG) by calling loaders at build time and writing out HTML files. This teaches you about the `generateBundle` Rollup hook. Add a type constraint so `generateStaticParams` must return arrays matching the route's param shape.

2. **Add streaming SSR** — Replace `renderToString` with `renderToPipeableStream`. This teaches you about streaming responses and how React Suspense boundaries work on the server. Type the stream chunks.

3. **Add a layout system** — Implement nested layouts (like Next.js App Router's `layout.tsx`). This teaches you about recursive virtual module generation. The type challenge: each layout can define its own loader, and child routes need access to parent layout data.

4. **Add server functions** — Implement a `createServerFn` API where server-only code is compiled into API endpoints with RPC client stubs. This is the deepest `transform` hook exercise — you're generating a typed client proxy from a server function signature. The function's parameter and return types must survive the transform.

5. **Add route-level type validation** — Use `zod` or `valibot` schemas in `defineLoader` to validate loader return types at runtime, not just at compile time. Generate the schemas from the TypeScript types using a build step, or have developers supply them and infer the TS types from the schema (the Remix/React Router approach with `unstable_defineLoader`).

6. **Add an edge environment** — Use the Vite 6 Environment API to add a third environment that targets Cloudflare Workers. This is exactly what Astro 6 and TanStack Start are doing with `createWorkerdEnvironment`. The typing challenge: edge environments have different global APIs (`Request`/`Response` vs Node's `IncomingMessage`/`ServerResponse`), so your `ApiHandler` type needs to be environment-polymorphic.
