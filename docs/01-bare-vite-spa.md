# Part 1: A Bare Vite SPA — Understanding the Dev Server

*This is the second installment in a series where we build a toy Next.js on top of Vite. In [Part 0](/00-the-mental-model), we covered the mental model — Vite's dual nature, the plugin pipeline, virtual modules, and the Environment API. Now we'll set up the project and observe the dev server in action.*

**Concepts introduced:** Vite project structure, TypeScript configuration for framework development, the dev server, `index.html` as entry point, dependency pre-bundling, HMR.

---

## Setting up the project

```bash
mkdir eigen && cd eigen
npm init -y
npm install vite react react-dom @vitejs/plugin-react
npm install -D typescript @types/react @types/react-dom
```

We'll end up with a project that has two distinct zones of TypeScript: **app code** (React components, entry points — runs in the browser and/or Node SSR) and **tooling code** (Vite config, plugins, the dev server script — runs in Node only). These need different TypeScript configurations.

### Project structure

```
eigen/
├── index.html              ← Vite's true entry point
├── vite.config.ts           ← Vite configuration (tooling code)
├── tsconfig.json            ← TypeScript config for app code
├── tsconfig.node.json       ← TypeScript config for tooling code
├── packages/
│   └── eigen/                ← The framework itself (we'll build this out)
│       └── types.ts
├── plugins/                 ← Vite plugins (tooling code)
└── src/
    ├── main.tsx             ← App entry point
    └── pages/
        ├── Home.tsx
        └── About.tsx
```

### `tsconfig.json` — App code

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
      "eigen/*": ["./packages/eigen/*"]
    }
  },
  "include": ["src/**/*", "packages/**/*"]
}
```

A few of these settings deserve explanation:

**`moduleResolution: "Bundler"`** — This tells TypeScript to use resolution rules that match what a bundler like Vite does. It supports `exports` fields in `package.json`, allows extensionless imports, and handles `import` conditions. Without this, TypeScript might resolve imports differently than Vite, causing phantom type errors or missing types.

**`isolatedModules: true`** — Vite transforms each file independently (via esbuild), without cross-file type information. This flag tells TypeScript to error on patterns that require cross-file analysis, like `const enum` or `export =`. It keeps your code compatible with Vite's transform model.

**`noEmit: true`** — Vite handles compilation. TypeScript is only used for type-checking. The `tsc` command never writes output files.

**`paths`** — Maps `eigen/*` imports to our local `packages/eigen/` directory. This simulates what would happen if Eigen were an installed npm package, letting us write `import type { PageProps } from 'eigen/types'` in app code.

### `tsconfig.node.json` — Tooling code

Vite config and plugins run in Node, not in the browser. They need different settings:

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

No `jsx` setting here — plugins don't contain JSX. No `paths` — plugins import from `vite` and Node builtins, not from the framework's public API.

### Why two tsconfigs?

This dual-tsconfig pattern is standard in Vite projects, but it's worth understanding why. The app code targets the browser (or a browser-like environment), uses JSX, and is transformed by Vite's plugin pipeline. The tooling code targets Node, uses Node APIs like `fs` and `path`, and is executed directly by Vite's config loader (which uses esbuild to transpile `.ts` config files).

If you use a single tsconfig with `jsx: "react-jsx"`, TypeScript won't complain about JSX in your plugins (where it shouldn't appear). If you use a single tsconfig with `types: ["node"]`, TypeScript will offer `fs.readFileSync` autocomplete in React components (where it shouldn't be available). Two configs keep each zone's type environment honest.

---

## The configuration file

### `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

This is minimal on purpose. Let's understand what's happening:

**`defineConfig`** is a helper that provides type-safe autocomplete for the config object. It doesn't transform the config — it's a pass-through function with a typed signature. You could export a plain object instead, but you'd lose IDE support.

**`react()`** is `@vitejs/plugin-react`, which returns an array of Vite plugins that handle React-specific concerns:

- **JSX transformation** — Compiles JSX/TSX to `React.createElement` calls (or the automatic runtime `jsx()` calls with `react-jsx`).
- **Fast Refresh** — Injects HMR boundary code into every React component so that edits hot-reload without losing component state.
- **React-specific Babel plugins** — Depending on configuration, it can use Babel (for features like `styled-components` or React Compiler) or SWC.

The `react()` plugin is separate from the framework plugin we'll build. This is by design — in the Vite ecosystem, the UI library plugin (React, Vue, Svelte) and the framework plugin (Next.js-like SSR, routing) are independent. TanStack Start's config has the same shape: `plugins: [tanstackStart(), react()]`.

---

## The HTML entry point

### `index.html`

```html
<!DOCTYPE html>
<html>
<head><title>Eigen Framework</title></head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

This is one of Vite's most distinctive design decisions: **`index.html` is the entry point of the application**, not a JavaScript or TypeScript file. Vite parses the HTML, finds `<script type="module">` tags, and uses those as the roots of the module graph.

This has several implications for framework development:

**The HTML is the container.** During SSR, the framework's server will read this file, inject rendered markup into it, and serve the result. The `<!--ssr-outlet-->` marker we'll add later is how the framework knows where to insert rendered HTML.

**`transformIndexHtml` is the injection point.** Vite's hook for modifying HTML is how the framework adds SSR content, serialized data (`<script>window.__EIGEN_DATA__ = ...</script>`), asset preload links, and other dynamic elements.

**The `src` attribute uses an absolute path from the project root.** `/src/main.tsx` is resolved relative to the project root, not relative to the HTML file. Vite intercepts this path and serves the transformed module.

**The `type="module"` attribute is required.** It tells the browser to treat the script as an ES module, which enables native `import`/`export` support. Without it, the browser would try to execute the TypeScript source as a classic script and fail.

---

## The app entry point

### `src/main.tsx`

```tsx
import { createRoot } from 'react-dom/client'

function App() {
  return <h1>Hello from Eigen Framework</h1>
}

createRoot(document.getElementById('root')!).render(<App />)
```

### `src/pages/Home.tsx`

```tsx
export default function Home() {
  return (
    <div>
      <h1>Home Page</h1>
      <p>Welcome to Eigen Framework.</p>
    </div>
  )
}
```

### `src/pages/About.tsx`

```tsx
export default function About() {
  return (
    <div>
      <h1>About</h1>
      <p>A toy Next.js built on Vite.</p>
    </div>
  )
}
```

The pages aren't wired up to routing yet — that's Part 2. For now, they're just files sitting in the `src/pages/` directory, waiting to be discovered by our route plugin.

---

## Observing the dev server

Run `npx vite` and open `http://localhost:5173` in the browser. Now open DevTools.

### Network waterfall

Open the Network tab and reload. You'll see a cascade of requests:

```
index.html              ← The HTML entry point
/@vite/client           ← HMR client (injected by Vite)
/src/main.tsx           ← Your entry module (transformed TSX → JS)
/node_modules/.vite/deps/react.js         ← Pre-bundled React
/node_modules/.vite/deps/react-dom_client.js  ← Pre-bundled ReactDOM
```

Each of these is a separate HTTP request. There is no bundle. The browser makes an `import` request for `main.tsx`, Vite transforms it and responds, the browser parses the response, finds `import { createRoot } from 'react-dom/client'`, and makes another request. The module graph is walked on demand.

Click on the `/src/main.tsx` request and look at the response. You'll see transformed JavaScript — the TypeScript types have been stripped, the JSX has been compiled, and there may be HMR-related code injected by `@vitejs/plugin-react`. But it's still clearly your source code, not a bundled artifact.

### Dependency pre-bundling

Check the terminal where `npx vite` is running. On first startup, you'll see something like:

```
Pre-bundling dependencies:
  react
  react-dom/client
```

Vite detected that your code imports these packages and ran esbuild to convert them from CommonJS (React's default format) to ESM, combining internal files into single modules. The results are cached in `node_modules/.vite/deps/`.

Look at the Network tab paths: the pre-bundled dependencies are served from `/node_modules/.vite/deps/`, not from the original `node_modules/react/` directory. They have a content hash in their cache headers, so the browser caches them aggressively. On subsequent page loads, the browser fetches them from its HTTP cache without contacting the dev server.

Your own source files in `/src/` are *not* pre-bundled. They're transformed on the fly for each request. This asymmetry is intentional: dependencies rarely change (so pre-bundling once and caching is efficient), while source files change constantly during development (so on-demand transformation with no caching gives you instant updates).

### HMR in action

Edit `src/main.tsx` — change the heading text and save. The browser updates without a full page reload. Open the Console tab and you'll see HMR log messages:

```
[vite] hot updated: /src/main.tsx
```

What happened:

1. Vite's file watcher (chokidar) detected the save.
2. Vite found the changed module in the module graph.
3. Vite walked up the dependency tree looking for an **HMR boundary** — a module that has registered a `import.meta.hot.accept()` handler.
4. `@vitejs/plugin-react` injected an HMR boundary into every React component via its `transform` hook. So `main.tsx` itself is a boundary.
5. Vite sent an update message via WebSocket to the `@vite/client` script running in the browser.
6. The browser re-imported the module and React's Fast Refresh re-rendered the component without losing state.

If you have a component with `useState`, try changing the JSX without changing the state logic. You'll see the component re-render with the new markup while preserving its state. This is React Fast Refresh, enabled by the HMR boundary code that `@vitejs/plugin-react` injects.

### TypeScript and type checking

Notice that Vite *does not* type-check your code. Try adding a type error to `main.tsx`:

```tsx
const x: number = "this is a string"  // Type error!
```

Save the file. The browser still updates — Vite happily strips the types and serves the code. The type error only surfaces if you run `npx tsc --noEmit` separately, or if your editor's TypeScript language server shows it.

This is by design. Vite uses esbuild for TypeScript transformation, and esbuild strips types without checking them. Type checking is a separate, parallel concern. This separation keeps the dev server fast — esbuild transforms TypeScript 10-100x faster than `tsc` because it doesn't do type analysis.

For a framework author, this means you can't rely on Vite to catch type errors in generated code. If your plugin generates a virtual module with a type error, Vite won't tell you. The `.d.ts` declaration files you generate are for the developer's IDE, not for Vite itself.

---

## Key insight

`index.html` is the true entry point of a Vite app — not a TypeScript file. Vite parses it, finds `<script type="module">` tags, and uses those as the module graph roots. This is why framework authors use `transformIndexHtml` to inject scripts, preload links, and SSR-rendered markup. The HTML file is the frame; the framework fills it.

The dev server's on-demand architecture means startup is instant, but also means the full module graph is never known upfront during development. This is important for framework plugins: if you need to know "all the routes" (to generate a route manifest), you have to discover them by scanning the filesystem, not by analyzing the module graph. The module graph only contains modules that have actually been requested by the browser.

---

## What's next

In Part 2, we'll write our first Vite plugin — a file-based route discovery system that scans `src/pages/`, generates a virtual module with the route table, and generates TypeScript declarations so the router has type-safe paths and params. This is where the framework starts to take shape.
