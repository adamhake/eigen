import { rehypeCodeDefaultOptions } from "fumadocs-core/mdx-plugins";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { transformerTwoslash } from "fumadocs-twoslash";
import { createFileSystemTypesCache } from "fumadocs-twoslash/cache-fs";
import { z } from "zod";

// You can customise Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.dev/docs/mdx/collections
export const docs = defineDocs({
  dir: "./src/content",
  docs: {
    schema: pageSchema.extend({
      concepts: z.array(z.string()).optional(),
    }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

// In dev, fumadocs-mdx re-imports this file whenever it changes. Each transformerTwoslash()
// owns a native `tsc --api` child process that is never disposed, so keep one instance per
// process instead of leaking a compiler on every config reload. The filesystem cache
// (.next/cache/twoslash) means the compiler only starts when a twoslash block changes.
const twoslashKey = Symbol.for("eigen.twoslash");
const twoslash = ((globalThis as Record<symbol, unknown>)[twoslashKey] ??= transformerTwoslash({
  typesCache: createFileSystemTypesCache(),
})) as ReturnType<typeof transformerTwoslash>;

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      ...rehypeCodeDefaultOptions,
      // Vite's own theme: calm, low-saturation syntax colours that suit the palette.
      themes: { light: "vitesse-light", dark: "vitesse-dark" },
      // Hover-to-see-types on blocks marked `twoslash` (opt-in per block). Types come from
      // the native TypeScript 7 API; modules resolve from this app's node_modules, plus any
      // hidden `// @filename:` files above a block's `// ---cut---`.
      transformers: [...(rehypeCodeDefaultOptions.transformers ?? []), twoslash],
      // Twoslash popups can't lazy-load languages, so preload the ones they render.
      langs: ["js", "jsx", "ts", "tsx"],
    },
  },
});
