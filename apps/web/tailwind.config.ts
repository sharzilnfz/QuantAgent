import type { Config } from "tailwindcss";

/**
 * Colors are indirected through the CSS custom properties declared in
 * `src/index.css`, so light/dark swap in exactly one place and component code
 * is written against *roles* (`bg-surface`, `text-ink-2`) rather than raw hex.
 *
 * Because the values are `var(...)`, Tailwind's slash-opacity modifiers
 * (`bg-surface/50`) do not apply to these tokens — use an explicit token.
 */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "var(--surface-page)",
        surface: {
          DEFAULT: "var(--surface-1)",
          well: "var(--surface-2)",
        },
        ink: {
          DEFAULT: "var(--ink-1)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
        },
        grid: "var(--grid)",
        axis: "var(--axis)",
        hairline: "var(--hairline)",
        series: "var(--series-1)",
        meter: {
          fill: "var(--meter-fill)",
          track: "var(--meter-track)",
        },
        delta: {
          pos: "var(--delta-pos)",
          neg: "var(--delta-neg)",
        },
        status: {
          good: "var(--status-good)",
          critical: "var(--status-critical)",
          neutral: "var(--status-neutral)",
        },
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
