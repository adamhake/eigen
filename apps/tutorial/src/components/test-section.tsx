import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import type { ReactNode } from "react";

export function TestSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Accordions type="single" collapsible className="border-emerald-500/30 bg-emerald-500/5 rounded-lg not-prose">
      <Accordion title={title} className="border-none px-1 [&>h3]:text-emerald-600 dark:[&>h3]:text-emerald-400 [&>h3]:text-sm [&>h3]:font-medium">
        <div className="prose prose-sm dark:prose-invert max-w-none text-fd-muted-foreground [&_code]:text-emerald-600 dark:[&_code]:text-emerald-400 [&_code]:bg-emerald-500/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:before:content-none [&_code]:after:content-none [&_pre]:bg-fd-background [&_pre]:border [&_pre]:border-fd-border [&_figure]:bg-fd-background [&_figure]:rounded-lg [&_pre_code]:text-inherit [&_pre_code]:bg-transparent [&_pre_code]:p-0">
          {children}
        </div>
      </Accordion>
    </Accordions>
  );
}
