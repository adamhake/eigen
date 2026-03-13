export interface ConceptDefinition {
  description: string;
  url?: string;
}

/**
 * Central definitions for every concept used across the tutorial series.
 * Keys are lowercase concept names matching the frontmatter values.
 */
export const conceptDefinitions: Record<string, ConceptDefinition> = {
  // Part 1
  "html-first dev servers": {
    description:
      "Vite uses index.html as the application entry point, not a JavaScript file. The dev server parses HTML to discover module graph roots.",
    url: "https://vite.dev/guide/#index-html-and-project-root",
  },
  "on-demand module serving": {
    description:
      "Instead of bundling upfront, the dev server transforms and serves modules only when the browser requests them.",
    url: "https://vite.dev/guide/why.html",
  },
  "dependency pre-bundling": {
    description:
      "Vite uses esbuild to convert node_modules dependencies from CommonJS to ESM and collapse many internal files into single modules.",
    url: "https://vite.dev/guide/dep-pre-bundling.html",
  },
  "hot module replacement": {
    description:
      "A mechanism for updating modules in the browser without a full page reload, preserving application state during development.",
    url: "https://vite.dev/guide/features.html#hot-module-replacement",
  },

  // Part 2
  "virtual modules": {
    description:
      "Modules that don't exist on disk — generated at build time by plugins via the resolveId/load hook pair.",
    url: "https://vite.dev/guide/api-plugin.html#virtual-modules-convention",
  },
  "file-system routing": {
    description:
      "Deriving URL routes from the directory structure of source files, so filenames become route paths automatically.",
  },
  "the resolve/load pattern": {
    description:
      "A two-phase plugin pattern: resolveId claims a module ID, then load provides its content. The foundation of virtual modules.",
    url: "https://rollupjs.org/plugin-development/#resolveid",
  },
  "generated type declarations": {
    description:
      "Automatically producing .d.ts files so that code-generated modules get full TypeScript support in the editor.",
  },

  // Part 3
  "server-side rendering": {
    description:
      "Rendering React components to HTML on the server so the browser receives ready-to-display markup.",
    url: "https://vite.dev/guide/ssr.html",
  },
  "dual module graphs": {
    description:
      "Vite maintains separate module graphs for client and server code, each with its own transform pipeline and resolve conditions.",
    url: "https://vite.dev/guide/ssr.html#ssr-externals",
  },
  "html as a template": {
    description:
      "Using index.html as a server-side template where the framework injects rendered markup, data, and asset links at request time.",
  },
  "programmatic dev server": {
    description:
      "Creating a Vite dev server via the JavaScript API (createServer) instead of the CLI, so framework code can control it.",
    url: "https://vite.dev/guide/api-javascript.html#createserver",
  },

  // Part 4
  "hydration": {
    description:
      "Attaching event listeners and React state to server-rendered HTML so it becomes interactive without re-rendering from scratch.",
    url: "https://react.dev/reference/react-dom/client/hydrateRoot",
  },
  "the server/client data contract": {
    description:
      "A shared agreement about the shape and location of serialized data passed from the server render to the client hydration step.",
  },
  "shared route matching": {
    description:
      "Using the same route-matching logic on both server and client so both sides agree on which component renders for a given URL.",
  },

  // Part 5
  "data loading conventions": {
    description:
      "File-based patterns (like exporting a loader function) that let the framework fetch data for a route before rendering.",
  },
  "constrained type inference": {
    description:
      "Using TypeScript's `satisfies` operator to validate a value against a type while preserving its narrower inferred type.",
    url: "https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator",
  },
  "client-side data endpoints": {
    description:
      "Automatically generated API routes that let the client fetch loader data via HTTP during navigation, without a full page load.",
  },

  // Part 6
  "client/server build coordination": {
    description:
      "Running separate Vite builds for client and server code that share a consistent module graph and asset references.",
  },
  "asset manifests": {
    description:
      "JSON files produced during the build that map source modules to their output filenames, enabling correct asset references at runtime.",
    url: "https://vite.dev/guide/backend-integration.html#backend-integration",
  },
  "content-hashed filenames": {
    description:
      "Including a hash of the file's contents in its output filename so browsers can cache aggressively and bust caches automatically on change.",
  },
  "the production server": {
    description:
      "A minimal Node.js server that serves the built client assets and handles SSR using the server build output.",
  },

  // Part 7
  "compile-time code transformation": {
    description:
      "Rewriting source code during the build via Vite's transform hook — stripping, injecting, or replacing code before it reaches the browser.",
    url: "https://rollupjs.org/plugin-development/#transform",
  },
  "server/client boundary enforcement": {
    description:
      "Ensuring that server-only code never appears in client bundles and vice versa, typically enforced at compile time.",
  },
  'the "use server" / "use client" model': {
    description:
      "React's directive-based system for marking module boundaries between server and client execution environments.",
    url: "https://react.dev/reference/rsc/use-client",
  },
  "regex vs. ast-based transforms": {
    description:
      "Two approaches to code transformation: fast but fragile string matching vs. slower but precise syntax tree manipulation.",
  },

  // Part 8
  "dev server middleware": {
    description:
      "Custom request handlers inserted into Vite's dev server pipeline to handle API routes, auth, or other server logic during development.",
    url: "https://vite.dev/guide/api-plugin.html#configureserver",
  },
  "middleware ordering": {
    description:
      "The sequence in which middleware runs matters — Vite's built-in middleware must be positioned correctly relative to framework middleware.",
  },
  "the dev/prod middleware gap": {
    description:
      "The structural difference between dev (Vite middleware) and production (standalone server) that frameworks must bridge.",
  },

  // Part 9
  "hmr boundaries": {
    description:
      "Modules that accept hot updates, preventing changes from propagating further up the module graph and triggering a full reload.",
    url: "https://vite.dev/guide/api-hmr.html#hot-accept-cb",
  },
  "the module graph": {
    description:
      "Vite's runtime representation of all imported modules and their dependencies, used for HMR propagation and on-demand transforms.",
    url: "https://vite.dev/guide/api-environment.html#the-modulerunner-class",
  },
  "module invalidation": {
    description:
      "Marking a module and its dependents as stale so they are re-transformed and re-evaluated on the next request.",
  },
  "type regeneration on change": {
    description:
      "Automatically re-generating .d.ts declaration files when source files change, keeping editor types in sync with runtime code.",
  },

  // Part 10
  "dev-only code injection": {
    description:
      "Adding development tools (overlays, diagnostics) to the page via transformIndexHtml that are automatically excluded from production builds.",
  },
  "websocket diagnostics": {
    description:
      "Using the dev server's WebSocket connection to push real-time diagnostic information (errors, warnings, metrics) to the browser.",
  },
  "shadow dom isolation": {
    description:
      "Encapsulating dev tool UI in a Shadow DOM so its styles and DOM don't interfere with the application being developed.",
    url: "https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM",
  },
  "zero-cost production removal": {
    description:
      "Using import.meta.env.DEV guards so bundlers can tree-shake entire dev-only code paths from production builds.",
    url: "https://vite.dev/guide/env-and-mode.html",
  },

  // Part 11
  "plugin composition": {
    description:
      "Combining multiple Vite plugins into a single framework plugin that presents a unified API to the application developer.",
  },
  "the framework as a plugin": {
    description:
      "Packaging the entire framework as a Vite plugin, so using the framework means adding one plugin to vite.config.ts.",
  },
  "public type surface design": {
    description:
      "Deliberately designing which TypeScript types the framework exports, creating a stable contract between framework and application code.",
  },

  // Part 12
  "streaming server rendering": {
    description:
      "Sending HTML to the browser in chunks as components finish rendering, rather than waiting for the entire page to complete.",
    url: "https://react.dev/reference/react-dom/server/renderToPipeableStream",
  },
  "suspense-driven progressive loading": {
    description:
      "Using React Suspense boundaries to define which parts of the page can stream in later, showing fallback content immediately.",
    url: "https://react.dev/reference/react/Suspense",
  },
  "the shell vs. content model": {
    description:
      "Sending the page layout (shell) immediately, then streaming data-dependent content into placeholder slots as it resolves.",
  },
  "error handling in streams": {
    description:
      "Strategies for handling errors during streaming SSR — whether to send an error page, inject an error boundary, or abort the stream.",
  },

  // Part 13
  "nested layouts": {
    description:
      "A routing pattern where parent route segments render persistent layouts that wrap child route content, preserving state across navigations.",
  },
  "hierarchical code generation": {
    description:
      "Generating virtual modules that compose a tree of layout and page components matching the filesystem's directory hierarchy.",
  },
  "parent-to-child data flow": {
    description:
      "Passing data from parent layout loaders down to child route components through props or context, following the component tree.",
  },
  "directory-driven component trees": {
    description:
      "Using the filesystem directory structure as the source of truth for how layout and page components nest inside each other.",
  },

  // Part 14
  "the middleware chain pattern": {
    description:
      "A sequential pipeline where each middleware function processes the request, optionally adds context, and passes control to the next.",
  },
  "typed context accumulation": {
    description:
      "Each middleware adds typed properties to a context object, and downstream middleware and loaders see the accumulated type.",
  },
  "per-route vs. global middleware": {
    description:
      "Middleware that runs for every request (global) vs. middleware scoped to specific routes, with different composition strategies.",
  },
  "auth guards": {
    description:
      "Middleware that checks authentication/authorization before a route's loader runs, redirecting unauthorized requests.",
  },

  // Part 15
  "server functions": {
    description:
      "Functions that execute on the server but can be called from client code as if they were local, with the framework handling serialization.",
  },
  "code generation from function signatures": {
    description:
      "Analyzing a function's parameters and return type to automatically generate an API endpoint and a typed client proxy.",
  },
  "typed client proxies": {
    description:
      "Auto-generated client-side functions that mirror server function signatures, providing end-to-end type safety across the network boundary.",
  },
  'the "use server" directive': {
    description:
      "A module-level directive that marks functions as server-only, telling the compiler to replace them with RPC calls in client bundles.",
    url: "https://react.dev/reference/rsc/use-server",
  },

  // Part 16
  "static site generation": {
    description:
      "Pre-rendering pages to static HTML files at build time, so they can be served from a CDN without a running application server.",
  },
  "build-time rendering": {
    description:
      "Executing React rendering during the build step to produce HTML files, using the same components and data loaders as SSR.",
  },
  "hybrid ssr/ssg routing": {
    description:
      "A routing model where some pages are statically generated at build time while others are server-rendered on demand.",
  },
  "incremental static regeneration": {
    description:
      "Rebuilding individual static pages in the background after deployment, based on time-based or on-demand revalidation triggers.",
  },

  // Part 17
  "the adapter pattern": {
    description:
      "An abstraction layer that transforms the framework's build output into the format required by a specific hosting platform.",
  },
  "platform-specific build transforms": {
    description:
      "Post-build transformations that reshape server code, configuration, and routing for platforms like Vercel, Netlify, or Cloudflare.",
  },
  "serverless and edge packaging": {
    description:
      "Bundling server-side route handlers into the specific formats and file structures expected by serverless and edge runtime platforms.",
  },
  "adapter composition": {
    description:
      "Combining the deployment adapter with the framework plugin so a single Vite config handles both development and platform-specific production builds.",
  },

  // Part 18
  "schema-first validation": {
    description:
      "Defining data shapes as runtime schemas (using zod or valibot) and deriving TypeScript types from them, so validation and types stay in sync.",
    url: "https://zod.dev/",
  },
  "inferring types from runtime schemas": {
    description:
      "Using TypeScript's type inference to extract static types from runtime schema definitions, eliminating type/validation drift.",
  },
  "the parse-don't-validate pattern": {
    description:
      "Instead of checking data and hoping it's correct, parsing it through a schema that returns a properly typed result or throws.",
  },

  // Part 19
  "custom vite environments": {
    description:
      "Defining additional module transform and execution environments beyond the default client and SSR, such as RSC or edge workers.",
    url: "https://vite.dev/guide/api-environment.html",
  },
  "multi-runtime builds": {
    description:
      "Producing separate build outputs targeting different JavaScript runtimes (Node, Cloudflare Workers, Deno) from a single Vite config.",
  },
  "web apis vs. node apis": {
    description:
      "The distinction between the Web-standard Request/Response APIs and Node's IncomingMessage/ServerResponse, and when each applies.",
  },
  "environment-polymorphic code": {
    description:
      "Writing code that works across different runtime environments by abstracting over platform-specific APIs.",
  },

  // Part 20
  "distributed tracing": {
    description:
      "Tracking a request's journey across services and components using spans and trace IDs, typically with OpenTelemetry.",
    url: "https://opentelemetry.io/docs/concepts/signals/traces/",
  },
  "automatic instrumentation": {
    description:
      "Using the transform hook to inject tracing spans into loaders, middleware, and server functions without manual code changes.",
  },
  "performance budgets": {
    description:
      "Setting quantitative thresholds for metrics like bundle size, response time, or request count, and failing builds that exceed them.",
  },
  "trace context propagation": {
    description:
      "Forwarding W3C Trace Context headers across service boundaries so distributed traces connect into a single end-to-end view.",
    url: "https://www.w3.org/TR/trace-context/",
  },

  // Part 21
  "react server components": {
    description:
      "Components that render exclusively on the server, sending a serialized component tree (not HTML) to the client for reconciliation.",
    url: "https://react.dev/reference/rsc/server-components",
  },
  'the "use client" boundary': {
    description:
      "A directive that marks where the server component tree hands off to client components, creating a serialization boundary.",
    url: "https://react.dev/reference/rsc/use-client",
  },
  "three-phase rendering": {
    description:
      "The RSC rendering pipeline: server components produce a payload, SSR renders it to HTML, then the client hydrates it.",
  },
  "server component streaming payloads": {
    description:
      "The wire format React uses to serialize server component trees, including references to client components and their props.",
  },

  // Part 22
  "browser-native routing": {
    description:
      "Using the browser's Navigation API instead of a JavaScript router library to handle client-side navigations.",
    url: "https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API",
  },
  "navigation interception": {
    description:
      "Intercepting browser navigations with NavigateEvent.intercept() to handle them with custom logic while preserving browser UX.",
  },
  "progressive enhancement": {
    description:
      "Building on top of standard browser behavior (MPA navigations) so the app works without JavaScript and gets enhanced with it.",
  },
  "mpa-to-spa transitions": {
    description:
      "Upgrading a traditional multi-page application to single-page navigation behavior without changing the server or routing model.",
  },

  // Part 23
  "ranked route matching": {
    description:
      "Scoring route patterns by specificity so that /posts/new beats /posts/:id when both match, without relying on definition order.",
  },
  "type-safe search params": {
    description:
      "Validating and typing URL search parameters with schemas so components receive parsed, typed objects instead of raw strings.",
  },
  "route preloading strategies": {
    description:
      "Prefetching route data and code on hover, viewport intersection, or intent signals to make navigations feel instant.",
  },
  "optimistic navigation": {
    description:
      "Immediately showing the next page's UI while data loads in the background, using useTransition to manage the pending state.",
  },
  "scroll restoration": {
    description:
      "Saving and restoring scroll positions when navigating back/forward, matching user expectations for browser history navigation.",
  },

  // Part 24
  "view transitions": {
    description:
      "The browser API for animating between page states, providing built-in crossfade and morphing animations between old and new DOM.",
    url: "https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API",
  },
  "cross-document animations": {
    description:
      "View transitions that work across full page navigations (MPA), not just within a single-page app.",
  },
  "speculative prerendering": {
    description:
      "Using the Speculation Rules API to tell the browser to prefetch or fully prerender likely next pages before the user clicks.",
    url: "https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API",
  },
  "zero-latency navigations": {
    description:
      "Combining prerendered pages with view transitions so clicking a link shows the next page instantly with a smooth animation.",
  },

  // Part 25
  "compiler-driven caching": {
    description:
      "Using a \"use cache\" directive to tell the compiler to wrap functions in caching logic, making cache behavior a code annotation.",
  },
  "cache key derivation": {
    description:
      "Automatically computing cache keys from a function's arguments, so the same inputs always return the cached result.",
  },
  "stale-while-revalidate": {
    description:
      "A caching strategy that serves stale content immediately while fetching a fresh version in the background for the next request.",
  },
  "on-demand revalidation": {
    description:
      "Explicitly invalidating cached data by tag or key when the underlying data changes, rather than waiting for time-based expiry.",
  },
  "cache scoping (remote, private)": {
    description:
      "Controlling where cached data lives: shared across requests (remote), per-request (private), or per-user.",
  },

  // Part 26
  "partial prerendering": {
    description:
      "Serving a static HTML shell immediately while streaming dynamic content into Suspense boundary placeholders at request time.",
  },
  "static shells with dynamic holes": {
    description:
      "Pre-rendering the page layout at build time with placeholder slots that get filled with dynamic, personalized content at request time.",
  },
  "the build-time / request-time split": {
    description:
      "Deciding which parts of a page can be computed once at build time vs. which must be computed fresh for every request.",
  },
  "streaming into pre-rendered html": {
    description:
      "Injecting dynamically-rendered content into a pre-built HTML shell using streaming, combining SSG speed with SSR flexibility.",
  },

  // Part 27
  "streaming server functions": {
    description:
      "Server functions that return a ReadableStream, sending data incrementally to the client as it becomes available.",
  },
  "the ai sdk protocol": {
    description:
      "Vercel's AI SDK streaming format for LLM responses, providing a standard wire protocol for text, tool calls, and structured data.",
    url: "https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol",
  },
  "progressive ui updates": {
    description:
      "Updating the UI incrementally as streamed data arrives, showing partial results instead of waiting for the complete response.",
  },
  "structured object streaming": {
    description:
      "Streaming typed, structured data (not just text) from server to client, with the client receiving validated partial objects.",
  },

  // Part 28
  "websocket primitives": {
    description:
      "Low-level WebSocket handling in the dev server and production, providing the transport layer for real-time bidirectional communication.",
  },
  "typed event channels": {
    description:
      "WebSocket channels with TypeScript-enforced event names and payload types, catching protocol mismatches at compile time.",
  },
  "room multiplexing": {
    description:
      "Routing messages to specific groups of connected clients (rooms/topics) over a single WebSocket connection.",
  },
  "server-to-client push": {
    description:
      "The server initiating data delivery to connected clients without the client polling, enabling real-time updates.",
  },
  "hmr vs. application websocket": {
    description:
      "The distinction between Vite's HMR WebSocket (dev-only, for module updates) and the application's own WebSocket (for user-facing features).",
  },

  // Part 29
  "micro-frontend architecture": {
    description:
      "Composing a UI from independently built, deployed, and versioned applications that integrate at runtime.",
  },
  "runtime module loading": {
    description:
      "Loading JavaScript modules from remote URLs at runtime, rather than bundling all code together at build time.",
  },
  "shared dependency negotiation": {
    description:
      "Multiple micro-frontends agreeing on shared library versions (like React) at runtime to avoid loading duplicates.",
  },
  "independent deployment": {
    description:
      "Each micro-frontend can be built and deployed on its own schedule without coordinating releases with other teams.",
  },
  "server-side vs. client-side composition": {
    description:
      "Assembling micro-frontends on the server (for initial HTML) vs. in the browser (for dynamic loading), with different trade-offs.",
  },

  // Part 30
  "route-level metadata": {
    description:
      "Defining page title, description, and other head tags per route, with the framework injecting them during rendering.",
  },
  "dynamic open graph tags": {
    description:
      "Generating OG meta tags from loader data so social media previews reflect each page's actual content.",
  },
  "json-ld structured data": {
    description:
      "Embedding machine-readable structured data in the page for search engines, using the JSON-LD format.",
    url: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data",
  },
  "sitemap generation": {
    description:
      "Automatically producing a sitemap.xml from the route tree so search engines can discover all pages.",
  },

  // Part 31
  "build-time image processing": {
    description:
      "Transforming images during the build (resizing, format conversion, placeholder generation) using tools like sharp.",
  },
  "responsive images and srcset": {
    description:
      "Generating multiple image sizes and using the srcset attribute so browsers download the optimal size for the viewport.",
    url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/HTML_images#responsive_images",
  },
  "format negotiation (webp/avif)": {
    description:
      "Producing images in modern formats and letting the browser choose the best format it supports via the picture element or Accept header.",
  },
  "blur placeholders (lqip)": {
    description:
      "Generating tiny, blurred preview images inlined as base64, shown while the full image loads to prevent layout shift.",
  },
  "image cdn integration": {
    description:
      "Transforming image URLs to point to a CDN (Cloudinary, Imgix) that handles resizing, format conversion, and caching at the edge.",
  },

  // Part 32
  "the integration plugin pattern": {
    description:
      "Packaging third-party service setup (database connections, analytics, error tracking) as a Vite plugin that generates typed helpers.",
  },
  "serverless connection management": {
    description:
      "Managing database connections in serverless environments where each invocation may need its own connection or a shared pool.",
  },
  "environment variable validation": {
    description:
      "Checking that required environment variables are present and correctly typed at build time, failing fast instead of at runtime.",
  },
  "server-side analytics": {
    description:
      "Tracking events from loaders and server functions (not just the browser), capturing data that client-side analytics misses.",
  },

  // Part 33
  "session management": {
    description:
      "Creating, storing, and validating user sessions across requests, bridging the stateless HTTP protocol with stateful user identity.",
  },
  "typed user context": {
    description:
      "Threading a typed user object through middleware, loaders, and components so auth state is always available and type-safe.",
  },
  "route-level access control": {
    description:
      "Declaring which routes require authentication or specific roles, enforced by middleware before the route's loader runs.",
  },
  "csrf protection": {
    description:
      "Preventing cross-site request forgery attacks on server functions by validating request origin or tokens.",
    url: "https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF",
  },
  "auth provider abstraction": {
    description:
      "An adapter layer between the framework's auth primitives and specific auth libraries (Auth.js, Lucia, Better Auth).",
  },

  // Part 34
  "request deduplication": {
    description:
      "Ensuring that multiple components requesting the same data during a single render share one fetch instead of duplicating requests.",
  },
  "parallel vs. waterfall loading": {
    description:
      "Loading data for nested routes simultaneously (parallel) vs. sequentially waiting for parent data before fetching child data (waterfall).",
  },
  "ssr-to-client cache handoff": {
    description:
      "Transferring the data cache built during server rendering to the client so it doesn't re-fetch data it already has.",
  },
  "isomorphic fetch": {
    description:
      "A fetch implementation that works identically on server and client, normalizing differences in APIs and caching behavior.",
  },
  "background refetching": {
    description:
      "Silently re-fetching data in the background after serving from cache, so the next request gets fresh data without visible loading states.",
  },

  // Part 35
  "route-scoped error boundaries": {
    description:
      "Error boundaries placed at route segment boundaries, so an error in one route doesn't crash the entire application.",
    url: "https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary",
  },
  "file-based error/loading conventions": {
    description:
      "Special filenames (error.tsx, loading.tsx, not-found.tsx) that the framework maps to error boundaries and loading states for each route.",
  },
  "error recovery patterns": {
    description:
      "Strategies for recovering from errors in the UI, such as the reset() function that re-renders the error boundary's children.",
  },
  "streaming-compatible loading states": {
    description:
      "Loading indicators that work with streaming SSR, showing fallback content while Suspense boundaries wait for data.",
  },
  "error serialization across ssr": {
    description:
      "Safely converting server-side errors into a format that can cross the SSR boundary and be displayed by client-side error boundaries.",
  },

  // Part 36
  "unit testing pure functions": {
    description:
      "Testing stateless functions (route parsing, matching, ID generation) in isolation with no external dependencies, providing fast and reliable coverage.",
    url: "https://vitest.dev/guide/",
  },
  "snapshot testing transforms": {
    description:
      "Capturing the exact output of a code transform and comparing it against a stored baseline, catching silent regressions in plugin output.",
    url: "https://vitest.dev/guide/snapshot.html",
  },
  "plugin testing with Vite's test utilities": {
    description:
      "Testing Vite plugin hooks (resolveId, load, transform) by either extracting logic into pure functions or using a real Vite instance in middleware mode.",
  },
  "integration testing the SSR pipeline": {
    description:
      "Testing the full server render pipeline — route matching, middleware execution, data loading, and component rendering — without a browser or HTTP server.",
  },
};
