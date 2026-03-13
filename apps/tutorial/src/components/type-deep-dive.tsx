import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import type { ReactNode } from "react";

export function TypeDeepDive({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Accordions type="single" collapsible className="border-fd-primary/30 bg-fd-primary/5 rounded-lg not-prose">
      <Accordion title={title} className="border-none px-1 [&>h3]:text-fd-primary [&>h3]:text-sm [&>h3]:font-medium">
        <div className="prose prose-sm dark:prose-invert max-w-none text-fd-muted-foreground [&_code]:text-fd-primary [&_code]:bg-fd-primary/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:before:content-none [&_code]:after:content-none [&_pre]:bg-fd-background [&_pre]:border [&_pre]:border-fd-border">
          {children}
        </div>
      </Accordion>
    </Accordions>
  );
}
