/**
 * Loading / empty / error states.
 *
 * Sprint 1 data is sparse, so "empty" is the state most viewers will actually
 * see — it has to read as *intentional*, not broken. Each empty state gets a
 * quiet mark, a plain-language line about why it's empty, and a hint about what
 * will fill it. No exclamation marks, no red, no shrug.
 */
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * Skeleton block. Used only for a FIRST load — a refetch holds the previous
 * render at reduced opacity instead (see `Stale`), so there is no skeleton
 * flash and no layout jump on refresh.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-surface-well", className)}
    />
  );
}

/** Wraps content that is refetching: dim it, never unmount it. */
export function Stale({ isStale, children }: { isStale: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "transition-opacity duration-200 ease-out",
        isStale ? "opacity-60" : "opacity-100",
      )}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  icon,
  className,
}: {
  title: string;
  detail: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg",
        "border border-dashed border-hairline px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? <div className="text-ink-3">{icon}</div> : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-ink-2">{detail}</p>
    </div>
  );
}

/**
 * Error state. Says what failed and offers the one action worth offering.
 * The icon + heading carry the meaning; the status color only reinforces it.
 */
export function ErrorState({
  title = "Something went wrong",
  detail,
  onRetry,
  className,
}: {
  title?: string;
  detail: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border border-hairline",
        "bg-surface-well px-4 py-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <WarningIcon className="h-4 w-4 text-[var(--status-critical)]" />
        <p className="text-sm font-medium text-ink">{title}</p>
      </div>
      <p className="text-xs leading-relaxed text-ink-2">{detail}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "mt-1 rounded-md border border-hairline px-2.5 py-1 text-xs font-medium text-ink-2",
            "transition-[transform,color,background-color] duration-150 ease-out active:scale-[0.97]",
            "[@media(hover:hover)]:hover:text-ink",
          )}
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

/** Full-page loader for the pre-session boot, before any layout exists. */
export function FullPageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="h-5 w-5 text-ink-3" />
        <p className="text-xs text-ink-2">{label}</p>
      </div>
    </div>
  );
}

/**
 * A faster-spinning spinner makes a load *feel* faster at identical load time,
 * so this runs at 700ms rather than the sluggish 1s default.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      style={{ animationDuration: "700ms" }}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 9v4m0 3.5h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
