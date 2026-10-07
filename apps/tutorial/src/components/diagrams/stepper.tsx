"use client";

import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Client half of a stepped diagram. The SVG itself is rendered on the server;
 * elements wrapped in `<At step={n}>` carry `data-from`/`data-until`, and this
 * frame writes a scoped <style> that fades them in or out for the current step.
 *
 * Step 0 is the overview: everything is visible, which is also what readers
 * without JavaScript (and print) get.
 */
export function StepperFrame({ steps, children }: { steps: string[]; children: ReactNode }) {
  const [step, setStep] = useState(0);
  const scope = `s${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const total = steps.length;

  const go = (n: number) => setStep(Math.max(0, Math.min(total, n)));

  let css = "";
  if (step > 0) {
    for (let s = 1; s <= total; s++) {
      // Not yet reached: hidden. Already passed: dimmed. Current: full strength.
      css += `.${scope} [data-from="${s}"]{opacity:${s > step ? 0 : s === step ? 1 : 0.38}}`;
      css += `.${scope} [data-until="${s}"]{${s < step ? "opacity:0" : ""}}`;
    }
  }

  return (
    <div
      className={scope}
      tabIndex={0}
      aria-roledescription="stepped diagram"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          go(step + 1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          go(step - 1);
        } else if (e.key === "Home" || e.key === "Escape") {
          go(0);
        }
      }}
    >
      <style>{`.${scope} [data-from],.${scope} [data-until]{transition:opacity .25s ease}@media (prefers-reduced-motion:reduce){.${scope} [data-from],.${scope} [data-until]{transition:none}}${css}`}</style>
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-fd-border pt-4">
        <div className="flex items-center gap-1">
          <StepButton label="Previous step" disabled={step === 0} onClick={() => go(step - 1)}>
            <ChevronLeft className="size-4" />
          </StepButton>
          <StepButton
            label={step === 0 ? "Start stepping" : "Next step"}
            disabled={step === total}
            onClick={() => go(step + 1)}
          >
            <ChevronRight className="size-4" />
          </StepButton>
          <StepButton label="Show everything" disabled={step === 0} onClick={() => go(0)}>
            <RotateCcw className="size-3.5" />
          </StepButton>
        </div>
        <div className="flex gap-1" aria-hidden>
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              onClick={() => go(i + 1)}
              className={cn(
                "h-1.5 w-5 rounded-full transition-colors",
                i + 1 === step ? "bg-fd-primary" : i + 1 < step ? "bg-fd-primary/40" : "bg-fd-muted-foreground/25",
              )}
            />
          ))}
        </div>
        <p
          aria-live="polite"
          className="m-0 min-w-0 basis-full text-sm leading-6 text-fd-foreground/85 sm:basis-auto sm:flex-1"
        >
          {step === 0 ? (
            <span className="text-fd-muted-foreground">Step through it with the arrows ({total} steps).</span>
          ) : (
            <>
              <span className="mr-2 font-mono text-xs text-fd-primary">
                {step}/{total}
              </span>
              {steps[step - 1]}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-lg border border-fd-border bg-fd-background text-fd-foreground transition-colors hover:bg-fd-accent disabled:opacity-35 disabled:hover:bg-fd-background"
    >
      {children}
    </button>
  );
}
