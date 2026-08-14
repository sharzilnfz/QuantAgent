/**
 * The one surface primitive. Everything on the dashboard sits on a card:
 * chart surface color, a hairline ring (never a heavy border), generous
 * padding. No shadow — depth here comes from the surface/page contrast, which
 * survives both themes; a shadow tuned for light mode disappears in dark.
 */
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function Card({
  children,
  className,
  as: Element = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Element
      className={cn(
        "rounded-xl border border-hairline bg-surface",
        className,
      )}
    >
      {children}
    </Element>
  );
}

/**
 * Card header. `title` is the heading; `actions` sit opposite it on the same
 * baseline. `description` is a quiet second line — sentence case, no colon.
 */
export function CardHeader({
  title,
  description,
  actions,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
      <div className="min-w-0">
        <h2 id={id} className="text-sm font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-xs text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("px-5 pb-5 pt-4", className)}>{children}</div>;
}
