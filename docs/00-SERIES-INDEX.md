# The Eigen Series: Building a React Framework with Vite

**A 36-part tutorial where you build a fully-featured React meta-framework from scratch using Vite's plugin API.** You'll understand not just *how* to use frameworks like Next.js and TanStack Start — you'll understand how they work, why they make the architectural decisions they do, and how to build your own.

The framework is called **Eigen** (from the German/physics term meaning "inherent" or "own" — as in eigenvalue). By the end of the series, Eigen handles file-based routing, server-side rendering, streaming, server functions, static site generation, React Server Components, edge deployment, and more — all powered by Vite plugins and fully typed with TypeScript.

**Prerequisites:** Solid React and TypeScript knowledge. Comfort with Node.js and ESM. Familiarity with what Next.js does at a high level.

---

## Phase I: Foundations

*Build a working SSR framework from scratch.*

By the end of this phase, you'll have a complete framework: file-based routing with typed params and generated declarations, server-side rendering, client hydration, typed data loaders, production builds, code transformation, dev middleware, HMR, a dev overlay, and a composable `eigen()` plugin function. Every core Vite API is covered. The result is a framework you could actually build simple applications on.

| Part | Title | What you learn |
|---|---|---|
| 0 | **The Mental Model** | Vite's duality (dev server vs. Rollup build), the plugin pipeline (`resolveId` → `load` → `transform`), virtual modules, the Environment API, friendly imports vs. `virtual:` prefix |
| 1 | **A Bare Vite SPA** | Project setup, TypeScript configuration (`tsconfig.json` vs. `tsconfig.node.json`), the dev server, `index.html` as entry point, dependency pre-bundling, HMR basics |
| 2 | **File-Based Route Discovery** | Writing a Vite plugin, `resolveId`/`load` for virtual modules, scanning the filesystem, generating TypeScript declarations (`.d.ts`), the `RouteParams` template literal type, type-safe `Link` component |
| 3 | **Server-Side Rendering** | `ssrLoadModule`, `createServer` programmatic API, Express middleware mode, `transformIndexHtml`, dual module graphs (client vs. SSR), typing `ssrLoadModule` results |
| 4 | **Hydration** | `hydrateRoot`, the `<!--ssr-outlet-->` pattern, typed `window.__EIGEN_DATA__`, the serialization boundary, matching server/client output |
| 5 | **Typed Loaders** | The `loader` export convention, `satisfies LoaderFn`, `defineLoader` with route path validation, `ReturnType` inference, three levels of type sophistication |
| 6 | **Production Builds** | `vite build`, client/server build coordination, manifest files, the `--ssr` flag, production server setup |
| 7 | **The `transform` Hook** | Stripping server-only code from client bundles, `applyToEnvironment`, regex vs. AST transforms, the TypeScript compiler API for code manipulation |
| 8 | **Dev Middleware** | `configureServer`, API route handling, middleware ordering (pre vs. post), typed `ApiHandler`, `ssrLoadModule` for API routes |
| 9 | **HMR** | `handleHotUpdate`, the module graph, HMR boundaries, declaration file regeneration cycle, `import.meta.hot` |
| 10 | **Dev Overlay** | An in-browser diagnostic panel: performance waterfall, cache inspector, streaming monitor, type generation log, route explorer. Built with `transformIndexHtml`, a dev WebSocket channel, and virtual modules |
| 11 | **Putting It All Together** | Composing plugins into `eigen()`, the `buildApp` hook, `MiniOptions` configuration, the three-layer type architecture (static types, generated types, virtual module types) |

**~20,000 words · Result: A working, deployable SSR framework with type-safe routing**

---

## Phase II: Production Features

*Ship it for real.*

This phase adds the features that separate a toy framework from one you'd use in production: streaming SSR, nested layouts, a middleware pipeline, server functions with the TanStack builder pattern, static site generation, deployment adapters, runtime validation, edge runtime support, and OpenTelemetry instrumentation. By the end, Eigen handles everything a real application needs.

| Part | Title | What you learn |
|---|---|---|
| 12 | **Streaming SSR** | `renderToPipeableStream`, `onShellReady` vs. `onAllReady`, Suspense-driven streaming, template splitting, bot detection, `renderToReadableStream` for edge |
| 13 | **Nested Layouts** | Recursive filesystem scanning, hierarchical virtual module generation, layout persistence across navigations, parallel loader execution, `LayoutDataContext` for typed parent-child data flow |
| 14 | **Framework Middleware** | Framework middleware vs. HTTP middleware, typed context accumulation, `defineMiddleware`, `redirect()`, auth guards, the `createMiddlewareChain` builder pattern, middleware ↔ server function interaction |
| 15 | **Server Functions** | `createServerFn`, the `transform` hook generating RPC stubs, type preservation across transforms, JSON serialization constraints, the TanStack builder pattern (`.middleware().validator().handler()`), `"use server"` comparison |
| 16 | **Static Site Generation** | `closeBundle` hook, typed `generateStaticParams`, hybrid SSR/SSG routing, pre-rendering the route tree |
| 17 | **Deployment Adapters** | The adapter pattern, Node/Netlify/Cloudflare adapters, `_redirects` and routing config generation, typed `AdapterConfig` with platform capabilities, serverless function packaging |
| 18 | **Runtime Validation** | Schema-first loaders with zod/valibot, inferring TypeScript types from schemas, the `parse` function surviving client bundles while `loader` is stripped, schema-library-agnostic design |
| 19 | **Edge Runtimes** | Custom Vite environments, `workerd` resolve conditions, `Request`/`Response` Web APIs, environment-polymorphic types, three-phase `buildApp`, `@cloudflare/vite-plugin` |
| 20 | **Observability** | OpenTelemetry SDK, request spans, middleware/loader/render child spans, auto-instrumentation via `transform`, adapter-specific exporters, performance budgets, metrics |

**~18,000 words · Result: A production-capable framework with streaming, server functions, SSG, deployment adapters, and observability**

---

## Phase III: The Modern Web

*Push the boundaries.*

This phase covers the frontier: React Server Components (the three-environment architecture), modern browser APIs (Navigation API, View Transitions, Speculation Rules), advanced caching (`"use cache"`, Partial Prerendering), and cutting-edge patterns (AI streaming, real-time WebSockets, module federation). It also includes deep-dive modules on SEO, image optimization, platform integrations, authentication, data fetching strategy, and error handling.

### Core modules

| Part | Title | What you learn |
|---|---|---|
| 21 | **React Server Components** | The `rsc` environment with `react-server` condition, `"use client"` boundaries, RSC streaming payload, three-phase rendering (RSC → SSR → hydration), `@vitejs/plugin-rsc` |
| 22 | **Navigation API** | `navigation.navigate()`, `NavigateEvent.intercept()`, abort signals, `navigation.transition`, typed history state, progressive enhancement |
| 23 | **Advanced Router** | Ranked/scored route matching, catch-all and optional segments, type-safe search params with zod, `SearchParamsMap`, `URLPattern` API, route preloading strategies |
| 24 | **View Transitions + Speculation Rules** | `startViewTransition`, `::view-transition-old/new`, shared element transitions, `<script type="speculationrules">`, generating rules from the route tree |
| 25 | **`"use cache"` Directive** | The third React directive, `transform` hook generating cache wrappers, `cacheLife`/`cacheTag`, pluggable cache stores, on-demand revalidation |
| 26 | **Partial Prerendering** | Static shell + dynamic holes, build-time shell generation, request-time Suspense resolution, converging SSG + SSR + `"use cache"` |
| 27 | **AI Streaming** | `createStreamingServerFn`, SSE transport, typed tool calls, `useChat` hook, structured object streaming |
| 28 | **Real-Time Primitives** | WebSocket upgrade in `configureServer`, typed channel schemas, `useChannel` hook, server-push from server functions, reconnection |
| 29 | **Module Federation** | `@module-federation/vite`, host/remote architecture, shared singleton React, typed remote contracts, `.remote.ts` route convention |

### Deep-dive modules

These modules go deep on specific concerns. Each is self-contained and can be read in any order after the prerequisites noted in the module.

| Part | Title | What you learn |
|---|---|---|
| 30 | **Route Metadata & SEO** | `generateMetadata`, typed `RouteMetadata`, JSON-LD structured data, sitemap.xml generation, nested layout metadata merging |
| 31 | **Image Optimization** | Build-time processing with `sharp`, responsive `srcset`, blur placeholders (LQIP), Cloudinary/Imgix provider abstraction, the `<Image>` component |
| 32 | **Platform Integrations** | Neon (virtual `eigen/db` module, environment-aware drivers), PostHog (`transformIndexHtml` injection, server-side tracking, feature flags), the integration plugin pattern |
| 33 | **Authentication & Authorization** | `AuthConfig<TUser>`, session middleware, typed `ctx.user`, `useSession` hook, route-level access control, CSRF protection, auth library integration (Better Auth, Auth.js) |
| 34 | **Data Fetching Strategy** | Request deduplication, parallel loader execution, TanStack Query integration (`prefetchQuery` → `dehydrate` → `HydrationBoundary`), isomorphic fetch, prefetching |
| 35 | **Error Boundaries & Loading States** | Route-scoped error boundaries, typed `ErrorBoundaryProps<'/path'>`, loader vs. render errors, `retryLoader()`, `loading.tsx` convention, pending UI with `useTransition` |

**~25,000 words · Result: A framework that rivals production meta-frameworks in capability and developer experience**

---

## How to read this series

**If you want to understand Vite deeply:** Read Phase I start to finish. Every module builds on the previous one, and by Part 11 you'll understand the plugin API, virtual modules, SSR, and the Environment API at a level that most framework users never reach.

**If you want to understand framework architecture:** Read Phases I and II. You'll know how streaming, server functions, middleware, SSG, adapters, and edge deployment work at the Vite plugin level — the same architecture that powers TanStack Start, Remix, and Astro.

**If you want the complete picture:** Read all three phases. Phase III covers the bleeding edge — RSC, `"use cache"`, PPR, AI streaming — and the deep-dive modules cover the practical concerns (auth, SEO, images, data fetching) that make a framework usable for real applications.

**If you're building something specific:** The deep-dive modules (30–35) are self-contained. Jump to Authentication if you need auth patterns, or Image Optimization if you need responsive images, without reading the full series.

---

## The throughline

Every module teaches the same lesson at increasing scale: **a framework is a coordinated set of Vite plugins that generate code.** `resolveId` provides module identity. `load` generates code from build-time knowledge. `transform` rewrites code per environment. `configureServer` handles the dev experience. `buildApp` orchestrates production output. And TypeScript declarations, generated alongside the runtime code, give developers type safety over all of it.

The framework doesn't add magic. It generates code.
