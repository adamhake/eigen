# Part 29: Route Metadata and SEO — Head Management, Sitemaps, and Structured Data

*In this installment, we add the metadata layer — route-specific `<head>` content, dynamic Open Graph tags, JSON-LD structured data, and build-time generation of sitemaps and robots.txt. This is how frameworks enable SEO without requiring developers to manually manage `<head>` tags.*

**Concepts introduced:** `generateMetadata` convention, `transformIndexHtml` for head injection, streaming `<head>` updates, dynamic OG tags from loader data, JSON-LD structured data, sitemap.xml generation from the route tree, robots.txt generation, canonical URLs, the `<Head>` component pattern vs. the metadata export pattern.

**Suggested placement:** After Runtime Validation (Part 17), before Edge Runtimes. Metadata depends on routes, loaders, and SSR being in place, and is a prerequisite for proper deployment (sitemaps feed into adapter output).

---

## The metadata convention

Each page can export a `metadata` object or an async `generateMetadata` function that receives the same params and data as the component:

```tsx
// src/pages/posts/[id].tsx
import type { MetadataFn } from 'eigen/metadata'

export const generateMetadata: MetadataFn<'/posts/:id'> = async ({ params, data }) => {
  // data comes from the loader — no double-fetching
  return {
    title: `${data.title} | My Blog`,
    description: data.body.slice(0, 160),
    openGraph: {
      title: data.title,
      description: data.body.slice(0, 160),
      type: 'article',
      publishedTime: data.createdAt,
      images: [{ url: data.coverImage, width: 1200, height: 630 }],
    },
    alternates: {
      canonical: `https://myblog.com/posts/${params.id}`,
    },
    robots: { index: true, follow: true },
  }
}
```

For static metadata (no loader data needed):

```tsx
// src/pages/about.tsx
export const metadata = {
  title: 'About Us | My Blog',
  description: 'Learn about our team and mission.',
}
```

### The metadata type

```typescript
// packages/eigen/metadata.ts

export interface RouteMetadata {
  title?: string
  description?: string
  robots?: {
    index?: boolean
    follow?: boolean
    noarchive?: boolean
  }
  openGraph?: {
    title?: string
    description?: string
    type?: 'website' | 'article' | 'product'
    images?: Array<{ url: string; width?: number; height?: number; alt?: string }>
    publishedTime?: string
    locale?: string
    siteName?: string
  }
  twitter?: {
    card?: 'summary' | 'summary_large_image' | 'player'
    title?: string
    description?: string
    image?: string
    creator?: string
  }
  alternates?: {
    canonical?: string
    languages?: Record<string, string>
  }
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>
  other?: Record<string, string>  // Arbitrary <meta> tags
}

export type MetadataFn<TPath extends string = string> = (context: {
  params: RouteParams<TPath>
  data: unknown
  pathname: string
}) => Promise<RouteMetadata> | RouteMetadata
```

---

## Head injection via `transformIndexHtml` and SSR

### Static metadata (build-time)

For pages with static `metadata` exports, the plugin can inject the tags via `transformIndexHtml`:

```typescript
transformIndexHtml(html, ctx) {
  // For dev, inject default/fallback metadata
  const defaultTags = `
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta charset="utf-8" />
  `
  return html.replace('</head>', `${defaultTags}</head>`)
}
```

### Dynamic metadata (request-time)

For pages with `generateMetadata`, the SSR pipeline calls it after the loader and injects the result into the HTML before streaming begins:

```typescript
// In entry-server.tsx — metadata-aware rendering
export async function render(pathname: string, request: Request) {
  const match = matchRoute(pathname)
  if (!match) return { html: '<h1>404</h1>', status: 404, data: null, head: '' }

  // Run loader
  let data = null
  if (match.route.loader) {
    data = await match.route.loader({ params: match.params })
  }

  // Generate metadata from loader data
  let headTags = ''
  if (match.route.generateMetadata) {
    const meta = await match.route.generateMetadata({
      params: match.params,
      data,
      pathname,
    })
    headTags = renderMetadataToHTML(meta)
  } else if (match.route.metadata) {
    headTags = renderMetadataToHTML(match.route.metadata)
  }

  const html = renderToString(<App pathname={pathname} data={data} />)
  return { html, status: 200, data, head: headTags }
}

function renderMetadataToHTML(meta: RouteMetadata): string {
  const tags: string[] = []

  if (meta.title) tags.push(`<title>${escapeHtml(meta.title)}</title>`)
  if (meta.description) tags.push(`<meta name="description" content="${escapeHtml(meta.description)}" />`)

  if (meta.openGraph) {
    const og = meta.openGraph
    if (og.title) tags.push(`<meta property="og:title" content="${escapeHtml(og.title)}" />`)
    if (og.description) tags.push(`<meta property="og:description" content="${escapeHtml(og.description)}" />`)
    if (og.type) tags.push(`<meta property="og:type" content="${og.type}" />`)
    if (og.images) {
      for (const img of og.images) {
        tags.push(`<meta property="og:image" content="${escapeHtml(img.url)}" />`)
        if (img.width) tags.push(`<meta property="og:image:width" content="${img.width}" />`)
        if (img.height) tags.push(`<meta property="og:image:height" content="${img.height}" />`)
      }
    }
  }

  if (meta.twitter) {
    const tw = meta.twitter
    if (tw.card) tags.push(`<meta name="twitter:card" content="${tw.card}" />`)
    if (tw.title) tags.push(`<meta name="twitter:title" content="${escapeHtml(tw.title)}" />`)
    if (tw.image) tags.push(`<meta name="twitter:image" content="${escapeHtml(tw.image)}" />`)
  }

  if (meta.alternates?.canonical) {
    tags.push(`<link rel="canonical" href="${escapeHtml(meta.alternates.canonical)}" />`)
  }

  if (meta.robots) {
    const directives = []
    if (meta.robots.index === false) directives.push('noindex')
    if (meta.robots.follow === false) directives.push('nofollow')
    if (directives.length) tags.push(`<meta name="robots" content="${directives.join(', ')}" />`)
  }

  if (meta.structuredData) {
    const items = Array.isArray(meta.structuredData) ? meta.structuredData : [meta.structuredData]
    for (const item of items) {
      tags.push(`<script type="application/ld+json">${JSON.stringify(item)}</script>`)
    }
  }

  return tags.join('\n    ')
}
```

The server injects these tags:

```typescript
const finalHtml = template
  .replace('<!--ssr-outlet-->', appHtml)
  .replace('</head>', `    ${headTags}\n</head>`)
```

---

## JSON-LD structured data

Structured data helps search engines understand page content. The framework makes it easy to include:

```tsx
// src/pages/posts/[id].tsx
export const generateMetadata: MetadataFn<'/posts/:id'> = async ({ data, params }) => ({
  title: data.title,
  structuredData: {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.title,
    author: { '@type': 'Person', name: data.author.name },
    datePublished: data.createdAt,
    image: data.coverImage,
    publisher: {
      '@type': 'Organization',
      name: 'My Blog',
      logo: { '@type': 'ImageObject', url: 'https://myblog.com/logo.png' },
    },
  },
})
```

---

## Build-time sitemap generation

The route plugin knows all routes. At build time, it generates a sitemap:

```typescript
// In the SSG/build plugin's closeBundle hook
async function generateSitemap(routes: DiscoveredRoute[], baseUrl: string): Promise<string> {
  const entries: string[] = []

  for (const route of routes) {
    if (route.path.includes(':')) {
      // Dynamic route — need generateStaticParams to enumerate URLs
      if (route.generateStaticParams) {
        const paramSets = await route.generateStaticParams()
        for (const params of paramSets) {
          const url = route.path.replace(/:(\w+)/g, (_, k) => params[k])
          entries.push(`  <url><loc>${baseUrl}${url}</loc></url>`)
        }
      }
    } else {
      entries.push(`  <url><loc>${baseUrl}${route.path}</loc><priority>0.8</priority></url>`)
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`
}
```

And a `robots.txt`:

```typescript
function generateRobotsTxt(baseUrl: string): string {
  return `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml`
}
```

Both are written to the client output directory during the build.

---

## Nested layout metadata merging

With nested layouts (Part 12), metadata from parent layouts merges with child page metadata. A root layout might set the site name and default OG image; a page overrides the title and description:

```typescript
// Root layout metadata
export const metadata = {
  openGraph: { siteName: 'My Blog', locale: 'en_US' },
  twitter: { card: 'summary_large_image' as const },
}

// Page metadata (merged on top of root)
export const generateMetadata = async ({ data }) => ({
  title: data.title,           // Overrides root
  openGraph: { title: data.title },  // Merges with root's siteName/locale
})

// Result: { title: 'Post Title', openGraph: { siteName: 'My Blog', locale: 'en_US', title: 'Post Title' }, twitter: { card: 'summary_large_image' } }
```

The merge is a deep merge — child properties override parent properties, but parent properties that the child doesn't set are preserved.

---

## Key insight

Metadata is a route-level concern that the framework orchestrates. The plugin discovers `metadata` exports during route scanning (extending the same `load` hook from Part 2), the SSR pipeline calls `generateMetadata` with loader data (no double-fetching), and the build system generates sitemaps from the route tree. The developer writes metadata as typed objects; the framework renders them to HTML tags, injects them into `<head>`, and generates the SEO artifacts.

---

## What's next

The next module covers **image optimization** — responsive images, format conversion, blur placeholders, and CDN/DAM integration with services like Cloudinary.
