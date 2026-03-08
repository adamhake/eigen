# Part 30: Image Optimization — Responsive Images, Formats, and DAM Integration

*In this installment, we build an image optimization pipeline — a Vite plugin that processes images at build time and a React component that serves responsive, format-optimized images with blur placeholders. We also integrate with external DAMs like Cloudinary for on-the-fly transformations.*

**Concepts introduced:** The `load` hook for image processing, `sharp` for build-time image transforms, responsive `srcset` generation, WebP/AVIF format conversion, blur placeholder generation (LQIP — Low Quality Image Placeholder), the `<Image>` component, `transformIndexHtml` for preload hints, DAM URL transformation for Cloudinary/Imgix, image CDN patterns, the `resolveId` hook for virtual image modules.

**Suggested placement:** After Route Metadata (Part 29). Images appear in OG tags, content, and structured data — the metadata module is a natural predecessor.

---

## The problem: images on the modern web

Serving unoptimized images is the single biggest performance mistake on the web. A 4MB JPEG hero image that's 4000px wide served to a 375px phone screen wastes bandwidth, delays LCP, and tanks Core Web Vitals.

`next/image` solved this by providing a component that automatically generates responsive variants, converts to modern formats, and lazy-loads with blur placeholders. We'll build the same for Eigen.

---

## Architecture: two approaches

### Approach 1: Build-time optimization (local images)

For images in the project's `src/` or `public/` directories, the Vite plugin processes them at build time using `sharp`:

```typescript
// plugins/eigen-images.ts
import type { Plugin } from 'vite'
import sharp from 'sharp'

const IMAGE_REGEX = /\.(jpg|jpeg|png|webp|avif|gif)$/
const WIDTHS = [640, 750, 828, 1080, 1200, 1920, 2048]

interface ProcessedImage {
  src: string
  srcSet: string
  width: number
  height: number
  blurDataURL: string  // Base64 tiny blur placeholder
  format: string
}

export default function eigenImages(): Plugin {
  const processedCache = new Map<string, ProcessedImage>()

  return {
    name: 'eigen-images',

    // Intercept image imports and return metadata + optimized variants
    async resolveId(id, importer) {
      if (id.endsWith('?eigen-image')) {
        return `\0eigen-image:${id.replace('?eigen-image', '')}`
      }
    },

    async load(id) {
      if (!id.startsWith('\0eigen-image:')) return

      const imagePath = id.replace('\0eigen-image:', '')

      if (processedCache.has(imagePath)) {
        const cached = processedCache.get(imagePath)!
        return `export default ${JSON.stringify(cached)}`
      }

      const image = sharp(imagePath)
      const metadata = await image.metadata()
      const { width: origWidth, height: origHeight } = metadata

      // Generate blur placeholder (10px wide, base64)
      const blurBuffer = await image
        .resize(10)
        .blur(3)
        .toBuffer()
      const blurDataURL = `data:image/jpeg;base64,${blurBuffer.toString('base64')}`

      // Generate responsive variants at build time
      const variants: string[] = []
      for (const w of WIDTHS) {
        if (w > (origWidth ?? 0)) continue

        // WebP variant
        const webpPath = imagePath.replace(IMAGE_REGEX, `-${w}w.webp`)
        await image.clone().resize(w).webp({ quality: 80 }).toFile(webpPath)
        variants.push(`${webpPath} ${w}w`)
      }

      const result: ProcessedImage = {
        src: imagePath,
        srcSet: variants.join(', '),
        width: origWidth ?? 0,
        height: origHeight ?? 0,
        blurDataURL,
        format: 'webp',
      }

      processedCache.set(imagePath, result)
      return `export default ${JSON.stringify(result)}`
    },
  }
}
```

Usage in a component:

```tsx
// Import with the ?eigen-image query to trigger processing
import heroImage from '../images/hero.jpg?eigen-image'
import { Image } from 'eigen/image'

export default function HomePage() {
  return (
    <Image
      src={heroImage}
      alt="Hero banner"
      sizes="100vw"
      priority  // Skip lazy loading for above-the-fold images
    />
  )
}
```

### Approach 2: DAM / Image CDN integration (external images)

For images hosted on a DAM (Cloudinary, Imgix, Sanity, Contentful), the optimization happens on the CDN — the framework generates URLs with transformation parameters:

```typescript
// packages/eigen/image-providers.ts

export interface ImageProvider {
  name: string
  buildURL(src: string, options: ImageTransformOptions): string
}

export interface ImageTransformOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'webp' | 'avif' | 'auto'
  fit?: 'cover' | 'contain' | 'fill'
  blur?: number
}

export const cloudinaryProvider: ImageProvider = {
  name: 'cloudinary',
  buildURL(src: string, opts: ImageTransformOptions): string {
    // Cloudinary URL transformation API
    // https://res.cloudinary.com/demo/image/upload/w_800,f_auto,q_80/sample.jpg
    const transforms: string[] = []
    if (opts.width) transforms.push(`w_${opts.width}`)
    if (opts.height) transforms.push(`h_${opts.height}`)
    if (opts.quality) transforms.push(`q_${opts.quality}`)
    if (opts.format === 'auto') transforms.push('f_auto')
    else if (opts.format) transforms.push(`f_${opts.format}`)
    if (opts.fit) transforms.push(`c_${opts.fit === 'cover' ? 'fill' : opts.fit}`)

    const transformStr = transforms.join(',')
    // Insert transforms into Cloudinary URL
    return src.replace('/upload/', `/upload/${transformStr}/`)
  },
}

export const imgixProvider: ImageProvider = {
  name: 'imgix',
  buildURL(src: string, opts: ImageTransformOptions): string {
    const params = new URLSearchParams()
    if (opts.width) params.set('w', String(opts.width))
    if (opts.height) params.set('h', String(opts.height))
    if (opts.quality) params.set('q', String(opts.quality))
    if (opts.format === 'auto') params.set('auto', 'format')
    else if (opts.format) params.set('fm', opts.format)
    if (opts.fit) params.set('fit', opts.fit === 'cover' ? 'crop' : opts.fit)
    return `${src}?${params.toString()}`
  },
}
```

---

## The `<Image>` component

```tsx
// packages/eigen/image.tsx
import type { ProcessedImage } from './types'
import type { ImageProvider, ImageTransformOptions } from './image-providers'

interface ImageProps {
  /** Local processed image or external URL string */
  src: ProcessedImage | string
  alt: string
  width?: number
  height?: number
  sizes?: string
  /** Skip lazy loading (for above-the-fold images) */
  priority?: boolean
  /** Image provider for external URLs */
  provider?: ImageProvider
  /** CSS class */
  className?: string
  /** Quality override (1-100) */
  quality?: number
}

const DEFAULT_SIZES = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
const WIDTHS = [640, 750, 828, 1080, 1200, 1920]

export function Image({
  src,
  alt,
  width,
  height,
  sizes = DEFAULT_SIZES,
  priority = false,
  provider,
  className,
  quality = 80,
}: ImageProps) {
  // Local processed image
  if (typeof src === 'object') {
    return (
      <div
        className={className}
        style={{
          position: 'relative',
          overflow: 'hidden',
          aspectRatio: `${src.width} / ${src.height}`,
        }}
      >
        {/* Blur placeholder — shown while the real image loads */}
        {!priority && (
          <img
            src={src.blurDataURL}
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(20px)',
              transform: 'scale(1.1)',
            }}
          />
        )}
        <img
          src={src.src}
          srcSet={src.srcSet}
          sizes={sizes}
          alt={alt}
          width={src.width}
          height={src.height}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          style={{
            position: 'relative',
            width: '100%',
            height: 'auto',
          }}
        />
      </div>
    )
  }

  // External image with provider (Cloudinary, Imgix, etc.)
  if (provider) {
    const srcSet = WIDTHS
      .map(w => `${provider.buildURL(src, { width: w, quality, format: 'auto' })} ${w}w`)
      .join(', ')

    return (
      <img
        src={provider.buildURL(src, { width: width ?? 1200, quality, format: 'auto' })}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'async' : 'async'}
        className={className}
      />
    )
  }

  // Plain external image (no optimization)
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      className={className}
    />
  )
}
```

---

## Preload hints for priority images

Above-the-fold images should be preloaded for faster LCP. The framework injects preload hints into `<head>`:

```typescript
// In the SSR pipeline, when a page has priority images
function generateImagePreloads(metadata: RouteMetadata): string {
  const preloads: string[] = []

  // Preload OG images (they're often the hero image)
  if (metadata.openGraph?.images?.[0]) {
    const img = metadata.openGraph.images[0]
    preloads.push(
      `<link rel="preload" as="image" href="${img.url}" imagesrcset="${generateSrcSet(img.url)}" imagesizes="100vw" />`,
    )
  }

  return preloads.join('\n')
}
```

---

## Configuration

The image plugin is configured in the framework:

```typescript
// vite.config.ts
import eigen from 'eigen/plugin'
import { cloudinaryProvider } from 'eigen/image-providers'

export default defineConfig({
  plugins: [
    eigen({
      images: {
        provider: cloudinaryProvider,
        domains: ['res.cloudinary.com', 'images.ctfassets.net'],
        quality: 80,
        formats: ['webp', 'avif'],
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
      },
    }),
    react(),
  ],
})
```

---

## Key insight

Image optimization sits at the intersection of three Vite concerns: the `resolveId`/`load` hooks for processing image imports at build time, `transformIndexHtml` for injecting preload hints, and the component layer for rendering responsive `<img>` tags. For external images (Cloudinary, Imgix), no build-time processing is needed — the `<Image>` component generates CDN URLs with transformation parameters. The framework provides the component and the provider abstraction; the actual optimization happens either at build time (sharp) or at request time (CDN).

---

## What's next

The next module covers **platform integrations** — wiring up databases (Neon), analytics (PostHog), and other external services through the framework's plugin infrastructure.
