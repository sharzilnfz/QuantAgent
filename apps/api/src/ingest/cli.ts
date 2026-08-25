/**
 * CLI entrypoint for spec 04 ingestion.
 *
 *   pnpm --filter @committee/api exec tsx src/ingest/cli.ts \
 *     --symbols AAPL,MSFT --from 2024-01-01 --to 2024-03-01 --timeframe 1Day
 *
 * (The spec names this `ingest:prices`. The npm-script alias is intentionally
 * NOT added here — `apps/api/package.json` is shared with three other agents
 * this sprint. Add
 *     "ingest:prices": "tsx src/ingest/cli.ts"
 * to its "scripts" when the package file is next touched.)
 *
 * Flags:
 *   --symbols   CSV of tickers                       (required)
 *   --from      ISO date/datetime, inclusive         (required)
 *   --to        ISO date/datetime, inclusive         (default: now)
 *   --timeframe 1Day | 1Hour                         (default: 1Day)
 *   --dry-run   fetch + normalize, write nothing
 */
import { Timeframe } from "@committee/contracts";

import { MarketDataIngestor } from "./market-data-ingestor.js";
import { InMemoryPriceBarStore } from "./store.js";

interface Args {
  symbols: string[];
  from: string;
  to: string;
  timeframe: "1Day" | "1Hour";
  dryRun: boolean;
}

export function parseArgs(argv: readonly string[]): Args {
  const flags = new Map<string, string>();
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token?.startsWith("--")) continue;
    const eq = token.indexOf("=");
    if (eq !== -1) {
      flags.set(token.slice(2, eq), token.slice(eq + 1));
      continue;
    }
    const name = token.slice(2);
    if (name === "dry-run") {
      dryRun = true;
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags.set(name, next);
      i += 1;
    } else {
      flags.set(name, "true");
    }
  }

  const symbols = (flags.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length === 0) throw new Error("--symbols is required (CSV of tickers)");

  const from = flags.get("from");
  if (!from) throw new Error("--from is required (ISO date)");

  const timeframe = Timeframe.parse(flags.get("timeframe") ?? "1Day");

  return {
    symbols,
    from,
    to: flags.get("to") ?? new Date().toISOString(),
    timeframe,
    dryRun,
  };
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }

  const store = args.dryRun ? new InMemoryPriceBarStore() : undefined;
  const result = await MarketDataIngestor.ingest(
    {
      symbols: args.symbols,
      from: args.from,
      to: args.to,
      timeframe: args.timeframe,
    },
    store ? { store } : {},
  );

  console.log(JSON.stringify(result, null, 2));

  const failed = result.symbols.filter((s) => s.error);
  if (failed.length === result.symbols.length) return 1;
  return failed.length > 0 ? 3 : 0;
}

// Run only when executed directly, not when imported by a test.
const invokedDirectly =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  /[\\/]ingest[\\/]cli\.(ts|js)$/.test(process.argv[1]);

if (invokedDirectly) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.stack : String(error));
      process.exitCode = 1;
    });
}
