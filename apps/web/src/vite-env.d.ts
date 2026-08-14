/// <reference types="vite/client" />

/**
 * `@types/node` is not a dependency of `@committee/web` (the scaffold's
 * `tsconfig.json` listed it under `types` but it was never installed, and this
 * app must not grow dependencies for a single `process.env` read).
 *
 * The only Node global the app's TypeScript program touches is `process.env`,
 * in `vite.config.ts` — so it gets a minimal ambient declaration here instead
 * of pulling in the whole Node typings surface. Nothing under `src/` may use
 * Node APIs: this is browser code.
 *
 * If `@types/node` is ever added to this package, delete this block and put
 * `"node"` back in `tsconfig.json`'s `types` array.
 */
declare const process: {
  env: Record<string, string | undefined>;
};
