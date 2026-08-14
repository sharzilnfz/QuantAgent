import { describe, expect, it } from "vitest";

import { parseArgs } from "../src/ingest/cli.js";

describe("ingest CLI argument parsing", () => {
  it("parses the documented invocation", () => {
    const args = parseArgs([
      "--symbols",
      "aapl,msft",
      "--from",
      "2024-01-01",
      "--to",
      "2024-03-01",
      "--timeframe",
      "1Day",
    ]);
    expect(args).toEqual({
      symbols: ["AAPL", "MSFT"],
      from: "2024-01-01",
      to: "2024-03-01",
      timeframe: "1Day",
      dryRun: false,
    });
  });

  it("supports --flag=value form and --dry-run", () => {
    const args = parseArgs(["--symbols=TSLA", "--from=2024-01-01", "--timeframe=1Hour", "--dry-run"]);
    expect(args.symbols).toEqual(["TSLA"]);
    expect(args.timeframe).toBe("1Hour");
    expect(args.dryRun).toBe(true);
  });

  it("defaults --to to now and --timeframe to 1Day", () => {
    const args = parseArgs(["--symbols", "AAPL", "--from", "2024-01-01"]);
    expect(args.timeframe).toBe("1Day");
    expect(Number.isNaN(Date.parse(args.to))).toBe(false);
  });

  it("requires --symbols and --from", () => {
    expect(() => parseArgs(["--from", "2024-01-01"])).toThrow(/--symbols/);
    expect(() => parseArgs(["--symbols", "AAPL"])).toThrow(/--from/);
  });

  it("rejects an unknown timeframe", () => {
    expect(() =>
      parseArgs(["--symbols", "AAPL", "--from", "2024-01-01", "--timeframe", "5Min"]),
    ).toThrow();
  });
});
