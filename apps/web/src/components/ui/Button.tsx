/**
 * Pressable primitive.
 *
 * `active:scale-[0.97]` at 150ms ease-out is the point of this component: the
 * press must be felt instantly, so the interface reads as listening. The
 * transition names `transform` explicitly (never `all`), and the hover wash is
 * gated behind `(hover: hover)` so a tap on touch hardware doesn't leave a
 * stuck hover state.
 */
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium " +
  "transition-[transform,background-color,color,border-color] duration-150 ease-out " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--series-1)] text-white [@media(hover:hover)]:hover:brightness-110",
  ghost:
    "border border-hairline bg-transparent text-ink-2 " +
    "[@media(hover:hover)]:hover:bg-surface-well [@media(hover:hover)]:hover:text-ink",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className, type = "button", children, ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cn(base, variants[variant], className)} {...rest}>
      {children}
    </button>
  );
});
