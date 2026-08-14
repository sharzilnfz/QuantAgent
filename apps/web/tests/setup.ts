import "@testing-library/jest-dom/vitest";

/**
 * jsdom ships neither `ResizeObserver` (Recharts' ResponsiveContainer needs it)
 * nor `matchMedia` (the theme provider reads it). Minimal stubs, installed once
 * for the whole suite.
 *
 * Note the consequence for chart assertions: jsdom gives the container a width
 * of 0, so Recharts renders no SVG marks. That is by design here — the chart
 * ships a table-view twin (a hard dataviz requirement: a tooltip must never be
 * the only way to read a value), and the tests assert against that twin, which
 * is the same data the plot draws.
 */
if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  Object.defineProperty(globalThis, "ResizeObserver", {
    writable: true,
    configurable: true,
    value: ResizeObserverStub,
  });
}

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
