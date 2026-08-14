/** Tiny class-name joiner. Falsy entries drop out. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
