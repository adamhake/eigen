import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { Source_Code_Pro } from "next/font/google";
import "./global.css";

const sourceCodePro = Source_Code_Pro({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={sourceCodePro.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen" suppressHydrationWarning>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
