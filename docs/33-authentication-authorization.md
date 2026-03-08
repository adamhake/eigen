# Part 32: Authentication and Authorization — Framework Primitives for Auth

*In this installment, we build the authentication and authorization primitives that Eigen provides to application developers. The framework doesn't implement a specific auth strategy — it provides the hooks, middleware patterns, session management, and typed context that make any strategy (session cookies, JWTs, OAuth, SAML, passkeys) plug in cleanly.*

**Concepts introduced:** Session middleware and typed user context, the `getSession` / `getUser` pattern, route-level access control declarations, session serialization across SSR/client boundary, CSRF protection for server functions, the `useSession` hook for client components, auth provider abstraction, protected route conventions, role-based access control types, the relationship between framework auth primitives and auth libraries (Better Auth, Lucia, Auth.js).

**Suggested placement:** After Framework Middleware (Part 13) and before Server Functions (Part 14). Auth middleware is the most common middleware in any application, and server functions need auth context to be meaningful.

---

## What the framework provides vs. what the application provides

The framework is responsible for *plumbing* — getting auth state from the request into every layer of the application in a typed, secure way. The application (or an auth library) is responsible for *strategy* — how users log in, how sessions are stored, how tokens are verified.

| Responsibility | Framework (Eigen) | Application / Auth library |
|---|---|---|
| Parse session from request | `getSession()` primitive | Configure session storage (cookie, DB, JWT) |
| Type the user object | `Session<TUser>` generic | Define the `User` type |
| Protect routes | `auth` route config, middleware | Define which routes need protection |
| Redirect unauthenticated users | `redirect()` in middleware | Choose login page URL |
| Make user available in loaders | `ctx.user` via middleware context | — |
| Make user available in components | `useSession()` hook | — |
| Serialize session to client | `__EIGEN_DATA__` session field | — |
| CSRF protection | Token generation and validation | — |
| Role/permission checks | `authorize()` helper | Define role hierarchy |

---

## The session type system

The framework defines a generic session that applications fill in with their user type:

```typescript
// packages/eigen/auth.ts

/** The session object available throughout the request lifecycle */
export interface Session<TUser = unknown> {
  /** The authenticated user, or null if not authenticated */
  user: TUser | null
  /** Session ID for server-side session stores */
  sessionId: string | null
  /** Whether this is an authenticated session */
  isAuthenticated: boolean
  /** Session expiry timestamp */
  expiresAt: number | null
}

/** Configuration for the auth middleware */
export interface AuthConfig<TUser> {
  /** 
   * Resolve a session from the incoming request.
   * This is where the auth strategy plugs in — parse a cookie,
   * verify a JWT, check a session store, etc.
   */
  getSession: (request: Request) => Promise<Session<TUser>>

  /** URL to redirect to when authentication is required but missing */
  loginUrl?: string

  /** 
   * Routes that require authentication.
   * Can be exact paths, glob patterns, or a function.
   */
  protectedRoutes?: string[] | ((pathname: string) => boolean)

  /**
   * Routes that should NOT require authentication even if they
   * match a protected pattern. Login, signup, public API, etc.
   */
  publicRoutes?: string[]
}
```

### Application-side: defining the user type

```typescript
// src/auth.config.ts
import type { AuthConfig } from 'eigen/auth'
import { verifySessionCookie } from './lib/session'

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'editor' | 'viewer'
  organizationId: string
}

export const authConfig: AuthConfig<User> = {
  async getSession(request) {
    const cookie = request.headers.get('cookie')
    const sessionToken = parseCookie(cookie, 'session')

    if (!sessionToken) {
      return { user: null, sessionId: null, isAuthenticated: false, expiresAt: null }
    }

    try {
      const session = await verifySessionCookie(sessionToken)
      return {
        user: session.user,
        sessionId: session.id,
        isAuthenticated: true,
        expiresAt: session.expiresAt,
      }
    } catch {
      return { user: null, sessionId: null, isAuthenticated: false, expiresAt: null }
    }
  },

  loginUrl: '/login',

  protectedRoutes: ['/dashboard/*', '/settings/*', '/api/admin/*'],

  publicRoutes: ['/login', '/signup', '/api/public/*'],
}

function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined
  const match = header.match(new RegExp(`${name}=([^;]+)`))
  return match?.[1]
}
```

---

## The auth middleware plugin

The framework provides an auth middleware that runs early in the chain and makes the session available to everything downstream:

```typescript
// packages/eigen/auth-middleware.ts
import type { Plugin, ResolvedConfig } from 'vite'
import type { AuthConfig, Session } from './auth'

export function eigenAuth<TUser>(config: AuthConfig<TUser>): Plugin {
  return {
    name: 'eigen-auth',

    // Generate the auth middleware as a virtual module
    resolveId(id) {
      if (id === 'eigen/auth/middleware') return '\0eigen:auth-middleware'
      if (id === 'eigen/auth/session') return '\0eigen:auth-session'
    },

    load(id) {
      if (id === '\0eigen:auth-middleware') {
        // Generate middleware that uses the application's auth config
        return `
          import { authConfig } from '/src/auth.config'
          import { redirect } from 'eigen/middleware'

          export const authMiddleware = async (ctx, next) => {
            const session = await authConfig.getSession(ctx.request)

            // Check if this route requires authentication
            const isProtected = checkProtected(ctx.pathname, authConfig)
            const isPublic = checkPublic(ctx.pathname, authConfig)

            if (isProtected && !isPublic && !session.isAuthenticated) {
              // Redirect to login with return URL
              const loginUrl = authConfig.loginUrl ?? '/login'
              const returnTo = encodeURIComponent(ctx.pathname)
              redirect(\`\${loginUrl}?returnTo=\${returnTo}\`)
            }

            // Add session to context — available in all downstream middleware,
            // loaders, and server functions as ctx.session and ctx.user
            return {
              session,
              user: session.user,
            }
          }

          function checkProtected(pathname, config) {
            if (!config.protectedRoutes) return false
            if (typeof config.protectedRoutes === 'function') {
              return config.protectedRoutes(pathname)
            }
            return config.protectedRoutes.some(pattern => matchPattern(pattern, pathname))
          }

          function checkPublic(pathname, config) {
            if (!config.publicRoutes) return false
            return config.publicRoutes.some(pattern => matchPattern(pattern, pathname))
          }

          function matchPattern(pattern, pathname) {
            if (pattern.endsWith('/*')) {
              return pathname.startsWith(pattern.slice(0, -2))
            }
            return pattern === pathname
          }
        `
      }

      if (id === '\0eigen:auth-session') {
        const isClient = this.environment?.name === 'client'

        if (isClient) {
          // Client: read session from serialized data
          return `
            import { createContext, useContext, useState, useEffect } from 'react'

            const SessionContext = createContext(null)

            export function SessionProvider({ children, initialSession }) {
              const [session, setSession] = useState(initialSession)

              return (
                <SessionContext.Provider value={{ session, setSession }}>
                  {children}
                </SessionContext.Provider>
              )
            }

            export function useSession() {
              const ctx = useContext(SessionContext)
              if (!ctx) throw new Error('useSession must be used within SessionProvider')
              return ctx.session
            }

            export function useUser() {
              const session = useSession()
              return session?.user ?? null
            }

            export function useIsAuthenticated() {
              const session = useSession()
              return session?.isAuthenticated ?? false
            }
          `
        }

        // Server: session comes from middleware context
        return `
          export function getSession(ctx) {
            return ctx.session ?? null
          }

          export function getUser(ctx) {
            return ctx.user ?? null
          }

          export function requireUser(ctx) {
            const user = ctx.user
            if (!user) {
              throw new Response('Unauthorized', { status: 401 })
            }
            return user
          }
        `
      }
    },
  }
}
```

---

## Using auth in loaders and server functions

With the auth middleware in place, every loader and server function receives the typed user:

```typescript
// src/pages/dashboard/index.tsx
import { defineLoader } from 'eigen/helpers'
import { requireUser } from 'eigen/auth/session'

export const loader = defineLoader('/dashboard', async ({ params, ctx }) => {
  // ctx.user is typed as User | null (from the auth middleware)
  // requireUser throws 401 if not authenticated
  const user = requireUser(ctx)

  // user is now typed as User (non-null)
  const dashboard = await db.query(
    'SELECT * FROM dashboards WHERE org_id = $1',
    [user.organizationId],
  )

  return { dashboard: dashboard.rows, userName: user.name }
})
```

```typescript
// Server function with auth
import { createServerFn } from 'eigen/server'
import { requireUser } from 'eigen/auth/session'

export const updateProfile = createServerFn({ method: 'POST' })
  .handler(async ({ data, context }) => {
    const user = requireUser(context)

    await db.query(
      'UPDATE users SET name = $1 WHERE id = $2',
      [data.name, user.id],
    )

    return { success: true }
  })
```

---

## Client-side auth: the `useSession` hook

The session needs to be available in client components without prop drilling. The framework serializes a *safe subset* of the session into the HTML (no secret tokens) and provides context hooks:

```typescript
// In the SSR pipeline — serialize session (minus sensitive fields)
function serializeSessionForClient<TUser>(session: Session<TUser>): object {
  return {
    user: session.user,          // Safe: user profile data
    isAuthenticated: session.isAuthenticated,
    expiresAt: session.expiresAt,
    // NOT included: sessionId, tokens, secrets
  }
}

// Injected into HTML alongside __EIGEN_DATA__
const clientSession = serializeSessionForClient(ctx.session)
template.replace(
  '</head>',
  `<script>window.__EIGEN_SESSION__=${JSON.stringify(clientSession)}</script></head>`,
)
```

In the client entry, the `SessionProvider` wraps the app:

```tsx
// src/entry-client.tsx
import { SessionProvider } from 'eigen/auth/session'

const initialSession = (window as any).__EIGEN_SESSION__

hydrateRoot(
  document.getElementById('root')!,
  <SessionProvider initialSession={initialSession}>
    <App />
  </SessionProvider>,
)
```

Components use the hooks:

```tsx
// src/components/UserMenu.tsx
'use client'

import { useUser, useIsAuthenticated } from 'eigen/auth/session'

export function UserMenu() {
  const user = useUser()
  const isAuthenticated = useIsAuthenticated()

  if (!isAuthenticated) {
    return <a href="/login">Sign in</a>
  }

  return (
    <div>
      <span>Welcome, {user.name}</span>
      <a href="/settings">Settings</a>
      <form action="/api/logout" method="POST">
        <button type="submit">Sign out</button>
      </form>
    </div>
  )
}
```

---

## Route-level access control

Beyond "authenticated or not," routes often need role-based or permission-based access control. The framework provides a declarative convention:

```tsx
// src/pages/admin/users.tsx
import type { RouteAccess } from 'eigen/auth'

// Declarative access control — checked by the auth middleware
export const access: RouteAccess = {
  roles: ['admin'],
  // Or a custom check:
  // check: (user) => user.organizationId === 'org_123',
}

export const loader = defineLoader('/admin/users', async ({ ctx }) => {
  // If we get here, the user is guaranteed to be an admin
  // (the auth middleware already checked)
  return db.query('SELECT * FROM users')
})
```

The types:

```typescript
// packages/eigen/auth.ts

export interface RouteAccess<TUser = unknown> {
  /** Required roles (any match grants access) */
  roles?: string[]
  /** Required permissions (all must match) */
  permissions?: string[]
  /** Custom access check function */
  check?: (user: TUser) => boolean | Promise<boolean>
}
```

The auth middleware reads the `access` export from the matched route:

```typescript
// In the auth middleware — after session resolution
if (match.route.access) {
  const access = match.route.access
  const user = session.user

  if (!user) redirect(loginUrl)

  if (access.roles && !access.roles.includes((user as any).role)) {
    throw new Response('Forbidden', { status: 403 })
  }

  if (access.check) {
    const allowed = await access.check(user)
    if (!allowed) throw new Response('Forbidden', { status: 403 })
  }
}
```

---

## CSRF protection for server functions

Server functions (Part 14) accept POST requests from the client. Without CSRF protection, a malicious site could trigger server functions on behalf of an authenticated user.

The framework handles this automatically:

```typescript
// In the auth middleware — generate CSRF token
const csrfToken = generateCSRFToken(session.sessionId)

// Include it in the serialized session for client-side use
return {
  session,
  user: session.user,
  csrfToken,
}
```

```typescript
// In the server function RPC endpoint — validate CSRF
server.middlewares.use(async (req, res, next) => {
  if (!req.url?.startsWith('/_eigen/fn/')) return next()

  // Verify CSRF token on all mutation requests
  const csrfToken = req.headers['x-eigen-csrf']
  const sessionToken = parseCookie(req.headers.cookie, 'session')

  if (!csrfToken || !validateCSRFToken(csrfToken, sessionToken)) {
    res.writeHead(403)
    res.end(JSON.stringify({ error: 'Invalid CSRF token' }))
    return
  }

  next()
})
```

The client-side server function stub (generated by the `transform` hook) automatically includes the CSRF token:

```typescript
// Generated client stub
export const updateProfile = async (args) => {
  const csrfToken = window.__EIGEN_SESSION__?.csrfToken
  const res = await fetch('/_eigen/fn/b4e2a1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Eigen-CSRF': csrfToken ?? '',
    },
    body: JSON.stringify(args),
  })
  // ...
}
```

Developers never think about CSRF — the framework handles token generation, injection, and validation transparently.

---

## Integrating with auth libraries

The `AuthConfig.getSession` function is the integration point. Any auth library that can resolve a session from a `Request` object works:

### Better Auth

```typescript
// src/auth.config.ts
import { betterAuth } from 'better-auth'

const auth = betterAuth({ /* ... */ })

export const authConfig: AuthConfig<User> = {
  async getSession(request) {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return { user: null, sessionId: null, isAuthenticated: false, expiresAt: null }
    return {
      user: session.user,
      sessionId: session.session.id,
      isAuthenticated: true,
      expiresAt: new Date(session.session.expiresAt).getTime(),
    }
  },
}
```

### Auth.js (NextAuth)

```typescript
import { getSession as getAuthJsSession } from '@auth/core'

export const authConfig: AuthConfig<User> = {
  async getSession(request) {
    const session = await getAuthJsSession(request, authOptions)
    // ... map to Eigen's Session type
  },
}
```

### Custom JWT

```typescript
import { jwtVerify } from 'jose'

export const authConfig: AuthConfig<User> = {
  async getSession(request) {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return { user: null, sessionId: null, isAuthenticated: false, expiresAt: null }

    const { payload } = await jwtVerify(token, secret)
    return {
      user: payload as User,
      sessionId: null,
      isAuthenticated: true,
      expiresAt: (payload.exp ?? 0) * 1000,
    }
  },
}
```

The framework doesn't care which strategy you use. It provides the typed pipeline — `getSession` → middleware context → `ctx.user` in loaders → `useSession()` in components — and the application provides the strategy.

---

## Generated type declarations

The auth plugin generates types so the session and user are correctly typed throughout:

```typescript
// Generated in node_modules/.eigen/eigen-auth.d.ts
declare module 'eigen/auth/session' {
  import type { User } from '/src/auth.config'
  import type { Session } from 'eigen/auth'

  export function useSession(): Session<User>
  export function useUser(): User | null
  export function useIsAuthenticated(): boolean

  export function getSession(ctx: Record<string, unknown>): Session<User>
  export function getUser(ctx: Record<string, unknown>): User | null
  export function requireUser(ctx: Record<string, unknown>): User
}
```

The `User` type from the application's `auth.config.ts` flows through to every hook and helper. Hover over `useUser()` in your IDE and you see your application's `User` type — not a generic `unknown`.

---

## What to observe

1. **Visit a protected route without a session.** The auth middleware redirects to `/login?returnTo=/dashboard` before any loader runs.

2. **Log in, then check `window.__EIGEN_SESSION__`** in the browser console. The user profile is there, but no session tokens or secrets.

3. **Hover over `ctx.user` in a loader.** TypeScript shows your application's `User` type with all its properties — not `unknown` or `any`.

4. **Call a server function from a different origin** (simulate CSRF). The request is rejected with 403 before the handler runs.

5. **Add a `roles: ['admin']` access control** to a route. Visit it as a non-admin user. You get a 403 instead of a redirect — the framework distinguishes between "not authenticated" (redirect to login) and "not authorized" (403 forbidden).

---

## Key insight

The framework's auth contribution is *plumbing, not policy*. It provides the pipeline that carries auth state from the HTTP request through middleware, into loaders and server functions, across the SSR/client serialization boundary, and into React components via context hooks. The application plugs in a `getSession` function and a `User` type — everything else is handled.

This separation means the framework works with any auth provider (Better Auth, Auth.js, Lucia, custom JWT, Salesforce SSO, SAML) without coupling to any of them. The middleware context accumulation pattern from Part 13 is the foundation — auth is its most important application.

The CSRF protection is an example of something the framework *should* handle because it's tied to the server function transport mechanism (Part 14). The framework generates the RPC endpoints, so it's responsible for securing them. If it didn't, every application would need to implement CSRF protection independently, and most would get it wrong.
