import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import type { ReactNode } from "react";

import { withInlineCode } from "@/components/mdx/inline-code";

/** Shared body styling for collapsible asides: prose line-height, default code chips. */
// (The wrapper is `not-prose`, so inline-code chips are restyled here to match the page.)
export const asideBody = [
  "prose max-w-none text-[0.95rem] leading-7 text-fd-foreground/85",
  "[&_:not(pre)>code]:rounded-md [&_:not(pre)>code]:border [&_:not(pre)>code]:border-fd-border [&_:not(pre)>code]:bg-fd-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:text-[0.85em] [&_:not(pre)>code]:text-fd-foreground",
  "[&_pre]:border [&_pre]:border-fd-border [&_pre]:bg-fd-background",
].join(" ");

export function TypeDeepDive({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Accordions
      type="single"
      collapsible
      className="not-prose my-6 rounded-xl border-fd-primary/25 bg-fd-primary/5 shadow-none"
    >
      <Accordion
        title={withInlineCode(title)}
        className="border-none px-1 [&>h3]:text-[0.95rem] [&>h3]:font-medium [&>h3]:text-fd-primary"
      >
        <div className={asideBody}>{children}</div>
      </Accordion>
    </Accordions>
  );
}
