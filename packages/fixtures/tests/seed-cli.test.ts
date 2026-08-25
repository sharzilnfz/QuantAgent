import { describe, it, expect } from "vitest";
import { parseSeedArgs } from "../src/seed-cli.js";

describe("Seeding CLI Argument Parser", () => {
  it("parses ticker and year flags with long options", () => {
    const args = parseSeedArgs(["--ticker", "AAPL", "--year", "2024"]);
    expect(args.tickers).toEqual(["AAPL"]);
    expect(args.startYear).toBe(2024);
    expect(args.endYear).toBe(2024);
  });

  it("parses short options and year ranges", () => {
    const args = parseSeedArgs(["-t", "NVDA", "-y", "2023-2024"]);
    expect(args.tickers).toEqual(["NVDA"]);
    expect(args.startYear).toBe(2023);
    expect(args.endYear).toBe(2024);
  });

  it("parses comma-separated tickers and custom output", () => {
    const args = parseSeedArgs(["--ticker", "AAPL,NVDA", "-o", "/tmp/fixtures"]);
    expect(args.tickers).toEqual(["AAPL", "NVDA"]);
    expect(args.outputDir).toBe("/tmp/fixtures");
  });

  it("defaults to AAPL, NVDA, SPY for year 2023-2024 when no flags provided", () => {
    const args = parseSeedArgs([]);
    expect(args.tickers).toEqual(["AAPL", "NVDA", "SPY"]);
    expect(args.startYear).toBe(2023);
    expect(args.endYear).toBe(2024);
  });
});
