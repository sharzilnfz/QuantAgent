import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDatasetFixture } from "./generator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DATA_DIR = path.resolve(__dirname, "../data");

export interface SeedCliArgs {
  tickers: string[];
  startYear: number;
  endYear: number;
  outputDir: string;
}

export function parseSeedArgs(argv: readonly string[]): SeedCliArgs {
  const flags = new Map<string, string>();

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token?.startsWith("-")) continue;

    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      if (eq !== -1) {
        flags.set(token.slice(2, eq), token.slice(eq + 1));
        continue;
      }
      const name = token.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("-")) {
        flags.set(name, next);
        i += 1;
      } else {
        flags.set(name, "true");
      }
      continue;
    }

    if (token.startsWith("-")) {
      const name = token.slice(1);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("-")) {
        flags.set(name, next);
        i += 1;
      } else {
        flags.set(name, "true");
      }
    }
  }

  const tickerRaw = flags.get("ticker") ?? flags.get("t") ?? flags.get("symbols") ?? "AAPL,NVDA,SPY";
  const tickers = tickerRaw === "all"
    ? ["AAPL", "NVDA", "SPY"]
    : tickerRaw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

  if (tickers.length === 0) {
    throw new Error("Missing required argument: --ticker <TICKER>");
  }

  const yearRaw = flags.get("year") ?? flags.get("y");
  let startYear = 2023;
  let endYear = 2024;

  if (yearRaw) {
    if (yearRaw.includes("-")) {
      const [sy, ey] = yearRaw.split("-").map(Number);
      if (sy) startYear = sy;
      if (ey) endYear = ey;
    } else if (yearRaw.includes(",")) {
      const years = yearRaw.split(",").map(Number).filter((n) => Number.isFinite(n));
      startYear = Math.min(...years);
      endYear = Math.max(...years);
    } else {
      const y = Number(yearRaw);
      if (Number.isFinite(y)) {
        startYear = y;
        endYear = y;
      }
    }
  }

  const outputDir = flags.get("output") ?? flags.get("o") ?? DEFAULT_DATA_DIR;

  return {
    tickers,
    startYear,
    endYear,
    outputDir,
  };
}

export async function runSeed(args: SeedCliArgs): Promise<void> {
  if (!fs.existsSync(args.outputDir)) {
    fs.mkdirSync(args.outputDir, { recursive: true });
  }

  console.log(`\n🌱 Seeding frozen dataset fixtures for [${args.tickers.join(", ")}] (${args.startYear}-${args.endYear})...`);

  for (const ticker of args.tickers) {
    console.log(`   Fetching/generating ${ticker}...`);
    const fixture = await generateDatasetFixture(ticker, args.startYear, args.endYear);
    const destPath = path.join(args.outputDir, `${ticker.toUpperCase()}.json`);

    fs.writeFileSync(destPath, JSON.stringify(fixture, null, 2), "utf-8");
    console.log(`   ✓ Saved ${fixture.bars.length} daily bars and ${fixture.news.length} news items -> ${destPath}`);
  }

  console.log(`\n✨ Seeding completed successfully!\n`);
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseSeedArgs(argv);
    await runSeed(args);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

// Run only when invoked directly from CLI
const invokedDirectly =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  /[\\/]seed-cli\.(ts|js)$/.test(process.argv[1]);

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
