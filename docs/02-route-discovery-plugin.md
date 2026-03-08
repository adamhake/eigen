# Part 2: Your First Vite Plugin — File-Based Route Discovery

*This is the third installment in a series where we build a toy Next.js on top of Vite. In [Part 1](/01-bare-vite-spa), we set up the project and observed the dev server in action. Now we'll write our first Vite plugin — the route discovery system that makes everything else possible.*

**Concepts introduced:** Writing a Vite plugin in TypeScript, `resolveId`/`load` for virtual modules, `configResolved`, `configureServer` for file watching, generated TypeScript declarations, template literal types for route params.

---

## What the plugin needs to do

Our route plugin has three jobs:

1. **Discover routes** — Scan `src/pages/` for `.tsx` files and convert filenames to route paths (`About.tsx` → `/about`, `posts/[id].tsx` → `/posts/:id`).

2. **Generate a virtual module** — Produce a JavaScript module that exports the route table. The module should generate *different code* for client vs. server environments (lazy imports for the client, static imports for the server).

3. **Generate TypeScript declarations** — Write a `.d.ts` file that tells TypeScript about all known route paths and their parameter types, so the `Link` component and loaders get full type safety.

This three-part pattern — filesystem scan → runtime JavaScript → type declarations — is the core of every typed framework's routing system. TanStack Router does it with `routeTree.gen.ts`. Next.js does a version of it internally (though with less type exposure). We're going to build it from scratch.

---

## Framework types

Before writing the plugin, we need to define the types that Eigen exposes to application code. These are the framework's public API:

```typescript
// packages/eigen/types.ts

/** 
 * Extract route param names from a path string.
 * Given '/posts/:id/:slug', produces { id: string; slug: string }.
 * 
 * This is a template literal type — TypeScript infers the structure
 * from the string literal at compile time.
 */
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

### Understanding `RouteParams`

The `RouteParams` type deserves close attention. It's a **recursive conditional type** that uses template literal inference to extract parameter names from a route path string:

```typescript
// Step through RouteParams<'/posts/:id/:slug'>:

// First match: T extends `${string}:${infer Param}/${infer Rest}`
//   Param = 'id'
//   Rest = ':slug'
//   Result: { id: string } & RouteParams<':slug'>

// Recurse: RouteParams<':slug'>
//   Matches: T extends `${string}:${infer Param}`
//   Param = 'slug'
//   Result: { slug: string }

// Final: { id: string } & { slug: string } = { id: string; slug: string }
```

For a static route like `/about`, none of the template literal patterns match, so the result is `Record<string, never>` — an empty params object.

This is the same technique TanStack Router uses for its fully-typed route params. The key insight is that TypeScript's type system is powerful enough to parse strings at compile time, which means route parameter types can be derived from route path strings without any runtime cost.

---

## The route discovery plugin

```typescript
// plugins/eigen-routes.ts
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
    .replace(/\[(\w+)\]/g, (_, param: string) => {
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
```

The `fileToRoute` function converts filesystem paths to route paths following the Next.js pages router convention: `Home.tsx` → `/`, `About.tsx` → `/about`, `posts/[id].tsx` → `/posts/:id`. The `[param]` → `:param` conversion extracts the parameter names, which we'll need for type generation.

### Generating type declarations

This function writes a `.d.ts` file that gives TypeScript full knowledge of the route topology:

```typescript
function generateRouteDeclarations(
  routes: DiscoveredRoute[],
  outDir: string,
): void {
  const pathUnion = routes.map(r => `'${r.path}'`).join(' | ') || 'never'

  const paramEntries = routes.map(r => {
    if (r.paramNames.length === 0) {
      return `    '${r.path}': Record<string, never>`
    }
    const paramType = r.paramNames
      .map(p => `${p}: string`)
      .join('; ')
    return `    '${r.path}': { ${paramType} }`
  }).join('\n')

  const dts = `// Auto-generated by eigen — do not edit
declare module 'eigen/routes' {
  import type { RouteDefinition } from 'eigen/types'
  export const routes: RouteDefinition[]
}

declare module 'eigen/route-types' {
  /** Union of all valid route paths in this application */
  export type RoutePaths = ${pathUnion}

  /** Maps each route path to its params type */
  export interface RouteParamsMap {
${paramEntries}
  }
}
`

  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'eigen-routes.d.ts'), dts)
}
```

For a project with `Home.tsx`, `About.tsx`, and `posts/[id].tsx`, this generates:

```typescript
declare module 'eigen/route-types' {
  export type RoutePaths = '/' | '/about' | '/posts/:id'

  export interface RouteParamsMap {
    '/': Record<string, never>
    '/about': Record<string, never>
    '/posts/:id': { id: string }
  }
}
```

Now TypeScript knows every valid route path and what parameters each one expects. This is pure compile-time information — none of it exists at runtime.

### The plugin itself

```typescript
export default function eigenRoutes(): Plugin {
  const virtualModuleId = 'eigen/routes'
  const resolvedVirtualModuleId = '\0' + virtualModuleId
  let pagesDir: string
  let root: string

  return {
    name: 'eigen-routes',

    configResolved(config: ResolvedConfig) {
      root = config.root
      pagesDir = resolve(config.root, 'src/pages')

      // Generate declarations on startup so the IDE has them immediately
      const routes = discoverRoutes(pagesDir)
      generateRouteDeclarations(routes, resolve(root, 'node_modules/.eigen'))
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
          `.trim()
        } else {
          // Client: lazy imports for code splitting, no loaders
          const imports = routes.map((r, i) =>
            `const Page${i} = React.lazy(() => import('${r.componentPath}'))`
          ).join('\n')

          const routeArray = routes.map((r, i) =>
            `  { path: '${r.path}', component: Page${i} }`
          ).join(',\n')

          return `
import React from 'react'
${imports}
export const routes = [\n${routeArray}\n]
          `.trim()
        }
      }
    },

    configureServer(server) {
      server.watcher.add(pagesDir)
      server.watcher.on('all', (event, filePath) => {
        if (filePath.startsWith(pagesDir) && filePath.endsWith('.tsx')) {
          // Regenerate declarations so the IDE picks up new routes
          const routes = discoverRoutes(pagesDir)
          generateRouteDeclarations(routes, resolve(root, 'node_modules/.eigen'))

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

Let's walk through each hook:

**`configResolved`** runs after all config processing is done. We store the project root and pages directory, and immediately generate declarations so the IDE has type information from the moment the dev server starts. Without this, the developer would see type errors until the first page was requested.

**`resolveId`** intercepts the import `'eigen/routes'` and returns our internal ID (prefixed with `\0`). This tells Vite "I'll handle this module — don't look for it on disk."

**`load`** generates the virtual module's source code. It checks `this.environment?.name` to determine whether it's generating for the client or server environment, and produces different code for each. The client version uses `React.lazy()` for code splitting; the server version uses static imports and includes the `loader` exports.

**`configureServer`** sets up a file watcher on the pages directory. When a file is added, deleted, or renamed, it regenerates the type declarations and invalidates the virtual module in Vite's module graph. The `server.ws.send({ type: 'full-reload' })` tells the browser to refresh, since the route table has changed structurally.

---

## Wiring up declarations

Add the generated declaration directory to your tsconfig:

```json
{
  "compilerOptions": {
    "typeRoots": ["./node_modules/@types", "./node_modules/.eigen"]
  }
}
```

We write declarations to `node_modules/.eigen/` rather than a project-level directory for a reason: it's conventionally gitignored (via `node_modules/`), so generated files don't pollute version control. TanStack Router takes a different approach — its `routeTree.gen.ts` is a committed file — but the `.eigen` approach avoids merge conflicts and keeps the git history focused on human-authored code.

---

## Using the virtual module

Update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import eigenRoutes from './plugins/eigen-routes'

export default defineConfig({
  plugins: [react(), eigenRoutes()],
})
```

Update `src/main.tsx` to consume the generated routes with type-safe navigation:

```tsx
import React, { Suspense, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { routes } from 'eigen/routes'
import type { RouteDefinition } from 'eigen/types'
import type { RoutePaths, RouteParamsMap } from 'eigen/route-types'

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

  const Component = match.route.component
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Component params={match.params} data={undefined} />
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

The `Link` component is generic over `T extends RoutePaths`. When you write `<Link to="/">`, TypeScript infers `T = "/"` and checks that it's a member of the `RoutePaths` union. If you write `<Link to="/posts/:id">`, TypeScript requires a `params` prop of type `{ id: string }`. If you write `<Link to="/nonexistent">`, you get a compile error — `/nonexistent` isn't in the union.

---

## A type-safe page component

```tsx
// src/pages/posts/[id].tsx
import type { PageProps } from 'eigen/types'

type Props = PageProps<'/posts/:id', { title: string; body: string }>

export async function loader({ params }: { params: { id: string } }) {
  const post = await fetch(
    `https://jsonplaceholder.typicode.com/posts/${params.id}`,
  )
  return post.json() as Promise<{ title: string; body: string }>
}

export default function PostPage({ params, data }: Props) {
  // params.id: string       ← inferred from '/posts/:id'
  // data.title: string      ← from the PageProps generic
  // data.body: string       ← from the PageProps generic
  return (
    <article>
      <h1>{data.title}</h1>
      <p>Post #{params.id}</p>
      <p>{data.body}</p>
    </article>
  )
}
```

The `PageProps<'/posts/:id', { title: string; body: string }>` type ties this component to its route. `RouteParams<'/posts/:id'>` expands to `{ id: string }`, giving `params` its shape. The second generic parameter types the `data` prop (which we'll connect to the loader's return type in Part 5).

---

## What to observe

1. **Install `vite-plugin-inspect`** (`npm i -D vite-plugin-inspect`), add it to your config, and visit `/__inspect/`. Find the virtual module `eigen/routes` — you can see the generated source code and the transform pipeline it passes through. This is an invaluable debugging tool for plugin development.

2. **Check `node_modules/.eigen/eigen-routes.d.ts`** — it contains the generated type declarations. Every time you add or remove a page file, this file updates automatically.

3. **In your editor**, try typing `<Link to="/` — you should get autocomplete for `"/"`, `"/about"`, `"/posts/:id"`. Try an invalid path and see the type error. This is the generated `RoutePaths` union in action.

4. **Add a new page file** while the dev server is running. Create `src/pages/Contact.tsx` with a default export. The watcher fires, declarations regenerate, the virtual module invalidates, and the dev server reloads. Your new `/contact` route appears in `RoutePaths` autocomplete.

---

## Key insight

Type safety in a framework is a **code generation problem**. The plugin discovers routes at dev-server startup, generates JavaScript (the virtual module) for the runtime, and generates TypeScript declarations (the `.d.ts` file) for the type checker. These two outputs serve different consumers — the browser and the IDE — but are generated from the same source of truth: the filesystem.

The plugin is the single source of truth. It writes two parallel representations of the same information: JavaScript for execution, TypeScript for verification. When the filesystem changes, both representations update. This is the architectural pattern that makes TanStack Router's type-safe routing possible, and it's the same pattern we'll use for loaders, API routes, and eventually server functions.

---

## What's next

In Part 3, we'll add server-side rendering. This means introducing Vite's `ssrLoadModule` API, creating a custom dev server with Express, and understanding how the two module graphs (client and SSR) work in practice. The virtual module will start generating different code per environment.
