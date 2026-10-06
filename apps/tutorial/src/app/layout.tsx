import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { Lilex } from "next/font/google";
import localFont from "next/font/local";

import "./global.css";

const nebulaSans = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/nebula-sans/files/nebula-sans-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/nebula-sans/files/nebula-sans-latin-400-italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../node_modules/@fontsource/nebula-sans/files/nebula-sans-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/nebula-sans/files/nebula-sans-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/nebula-sans/files/nebula-sans-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-nebula-sans",
  display: "swap",
});

const lilex = Lilex({
  subsets: ["latin"],
  variable: "--font-lilex",
  display: "swap",
  // next/font has no fallback metrics for Lilex; any monospace fallback is close enough.
  adjustFontFallback: false,
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nebulaSans.variable} ${lilex.variable}`} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen" suppressHydrationWarning>
        <RootProvider theme={{ defaultTheme: "system", enableSystem: true }}>{children}</RootProvider>
      </body>
    </html>
  );
}
