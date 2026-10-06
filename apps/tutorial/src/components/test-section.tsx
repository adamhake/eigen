import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import type { ReactNode } from "react";

import { withInlineCode } from "@/components/mdx/inline-code";
import { asideBody } from "@/components/type-deep-dive";

export function TestSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Accordions
      type="single"
      collapsible
      className="not-prose my-6 rounded-xl border-fd-info/25 bg-fd-info/5 shadow-none"
    >
      <Accordion
        title={withInlineCode(title)}
        className="border-none px-1 [&>h3]:text-[0.95rem] [&>h3]:font-medium [&>h3]:text-fd-info"
      >
        <div className={`${asideBody} [&_figure]:rounded-lg [&_figure]:bg-fd-background`}>{children}</div>
      </Accordion>
    </Accordions>
  );
}
