import { Info, Lightbulb, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type CalloutType = "info" | "tip" | "warn" | "warning";

const variants = {
  info: { color: "var(--color-fd-info)", Icon: Info },
  tip: { color: "var(--color-fd-primary)", Icon: Lightbulb },
  warning: { color: "var(--color-fd-warning)", Icon: TriangleAlert },
} as const;

/**
 * Brand callout: a softly tinted card in the callout's colour, with no side bar
 * or drop shadow, and body text at prose line-height.
 */
export function Callout({
  type = "info",
  title,
  children,
}: {
  type?: CalloutType;
  title?: ReactNode;
  children?: ReactNode;
}) {
  const { color, Icon } = variants[type === "warn" ? "warning" : type];
  return (
    <div
      role="note"
      style={{ "--callout-color": color } as React.CSSProperties}
      className="my-6 grid grid-cols-[auto_1fr] gap-x-3 rounded-xl border border-(--callout-color)/25 bg-(--callout-color)/6 px-5 py-4"
    >
      <Icon aria-hidden className="mt-[0.3em] size-[1.1em] text-(--callout-color)" strokeWidth={2.25} />
      <div className="min-w-0">
        {title && <p className="my-0! font-semibold text-fd-foreground">{title}</p>}
        <div
          className={cn(
            "prose-no-margin text-[0.95rem] leading-7 text-fd-foreground/85 empty:hidden",
            title && "mt-1.5",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
