/**
 * Labelled text input. The label is a real <label for>, the error is wired via
 * `aria-describedby` + `aria-invalid`, and the error slot is always in the DOM
 * so validation text never shoves the form down the page when it appears.
 */
import { useId } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Field({ label, error, className, ...rest }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-ink-2">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "block w-full rounded-lg border bg-surface-well px-3 py-2 text-sm text-ink",
          "placeholder:text-ink-3 transition-colors duration-150 ease-out",
          error ? "border-[var(--status-critical)]" : "border-hairline",
          className,
        )}
        {...rest}
      />
      <p id={errorId} className="mt-1 min-h-4 text-xs text-[var(--status-critical)]">
        {error}
      </p>
    </div>
  );
}
