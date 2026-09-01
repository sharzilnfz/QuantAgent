import { promises as fs } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "../app.js";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const repoRoot = resolve(__dirname, "../../../..");
const outputDir = resolve(repoRoot, "artifacts/verify-committee");

interface StepResult {
  step: string;
  method: string;
  url: string;
  statusCode: number;
  expectedStatus: number;
  passed: boolean;
  durationMs: number;
  payloadFile: string;
}

async function runVerification() {
  console.log("================================================================================");
  console.log("           THE COMMITTEE (QUANTAGENT) FASTIFY API ROUTE VERIFICATION            ");
  console.log("================================================================================\n");

  await fs.mkdir(outputDir, { recursive: true });

  const app = await buildApp();
  const results: StepResult[] = [];
  let sessionCookie = "";

  async function testRoute(
    stepName: string,
    method: "GET" | "POST" | "PUT",
    url: string,
    payload?: unknown,
    expectedStatus = 200,
    saveFileName?: string
  ) {
    const startTime = performance.now();
    const headers: Record<string, string> = {};
    const cookies: Record<string, string> = {};
    if (sessionCookie) {
      cookies["committee_session"] = sessionCookie;
    }

    const res = await app.inject({
      method,
      url,
      payload: payload ? (payload as any) : undefined,
      cookies,
      headers,
    });
    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
    const passed = res.statusCode === expectedStatus;

    console.log(`[${passed ? "✓ PASS" : "✗ FAIL"}] ${stepName}: ${method} ${url} -> ${res.statusCode} (${durationMs}ms)`);

    let parsedBody: any = null;
    const rawText = res.body;
    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      parsedBody = rawText;
    }

    const fileName = saveFileName || `${stepName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    const filePath = join(outputDir, fileName);

    const fileContent = {
      step: stepName,
      method,
      url,
      statusCode: res.statusCode,
      expectedStatus,
      passed,
      durationMs,
      timestamp: new Date().toISOString(),
      requestPayload: payload ?? null,
      responseHeaders: res.headers,
      responseBody: parsedBody,
    };

    await fs.writeFile(filePath, JSON.stringify(fileContent, null, 2), "utf-8");

    results.push({
      step: stepName,
      method,
      url,
      statusCode: res.statusCode,
      expectedStatus,
      passed,
      durationMs,
      payloadFile: fileName,
    });

    return { res, parsedBody };
  }

  // 1. Health check
  await testRoute("01-Health-Check", "GET", "/health", undefined, 200, "01-health.json");

  // 2. Auth Login (using seeded demo account)
  const loginRes = await testRoute(
    "02-Auth-Login",
    "POST",
    "/auth/login",
    { email: "demo@committee.local", password: "demo-committee" },
    200,
    "02-auth-login.json"
  );
  if (loginRes.res.cookies) {
    const sess = loginRes.res.cookies.find((c) => c.name === "committee_session");
    if (sess) {
      sessionCookie = sess.value;
      console.log(`  -> Authenticated session cookie established: ${sessionCookie.slice(0, 10)}...`);
    }
  }

  // 3. Auth Me
  await testRoute("03-Auth-Me", "GET", "/auth/me", undefined, 200, "03-auth-me.json");

  // 4. Portfolio State
  await testRoute("04-Portfolio-State", "GET", "/portfolio", undefined, 200, "04-portfolio.json");

  // 5. Portfolio History
  await testRoute("05-Portfolio-History", "GET", "/portfolio/history", undefined, 200, "05-portfolio-history.json");

  // 6. Experiments Suite (AAPL)
  await testRoute("06-Experiments-Suite-AAPL", "GET", "/experiments/suite?symbol=AAPL", undefined, 200, "06-experiments-suite-aapl.json");

  // 7. Experiments Suite (NVDA)
  await testRoute("07-Experiments-Suite-NVDA", "GET", "/experiments/suite?symbol=NVDA", undefined, 200, "07-experiments-suite-nvda.json");

  // 8. Experiments Suite (SPY)
  await testRoute("08-Experiments-Suite-SPY", "GET", "/experiments/suite?symbol=SPY", undefined, 200, "08-experiments-suite-spy.json");

  // 9. Experiments Multi-Asset Suite
  await testRoute("09-Experiments-Multi-Asset-Suite", "GET", "/experiments/multi-asset/suite?universe=AAPL,NVDA,SPY", undefined, 200, "09-experiments-multi-asset-suite.json");

  // 10. Experiments Variance Sweep
  await testRoute("10-Experiments-Variance-Sweep", "GET", "/experiments/variance-sweep?symbol=AAPL&windowSize=25&runs=3", undefined, 200, "10-experiments-variance-sweep.json");

  // 11. Signals Radar
  await testRoute("11-Signals-Radar", "GET", "/signals/radar?symbols=AAPL,NVDA,SPY", undefined, 200, "11-signals-radar.json");

  // 12. Signals Evaluate (On-demand deliberation)
  await testRoute(
    "12-Signals-Evaluate",
    "POST",
    "/signals/evaluate",
    { symbol: "AAPL", debateEnabled: true },
    200,
    "12-signals-evaluate.json"
  );

  // 13. Agents Config GET
  await testRoute("13-Agents-Config-GET", "GET", "/agents/config", undefined, 200, "13-agents-config-get.json");

  // 14. Agents Config PUT
  await testRoute(
    "14-Agents-Config-PUT",
    "PUT",
    "/agents/config",
    { consensusThreshold: 0.65, debateMaxRounds: 3 },
    200,
    "14-agents-config-put.json"
  );

  // 15. Agents Config Reset
  await testRoute("15-Agents-Config-Reset", "POST", "/agents/config/reset", {}, 200, "15-agents-config-reset.json");

  // 16. Daemon Status
  await testRoute("16-Daemon-Status", "GET", "/daemon/status", undefined, 200, "16-daemon-status.json");

  // 17. Daemon Run Cycle
  await testRoute("17-Daemon-Run-Cycle", "POST", "/daemon/run-cycle", {}, 200, "17-daemon-run-cycle.json");

  // 18. Auth Logout
  await testRoute("18-Auth-Logout", "POST", "/auth/logout", undefined, 204, "18-auth-logout.json");

  // 19. Summary
  const allPassed = results.every((r) => r.passed);
  const summary = {
    verifiedAt: new Date().toISOString(),
    totalEndpoints: results.length,
    passedCount: results.filter((r) => r.passed).length,
    failedCount: results.filter((r) => !r.passed).length,
    allPassed,
    results,
  };

  await fs.writeFile(join(outputDir, "verification-summary.json"), JSON.stringify(summary, null, 2), "utf-8");

  console.log("\n--------------------------------------------------------------------------------");
  console.log(`Verification Complete: ${summary.passedCount}/${summary.totalEndpoints} endpoints passed.`);
  console.log(`Saved artifacts to: ${outputDir}`);
  console.log("--------------------------------------------------------------------------------\n");

  await app.close();
  process.exit(allPassed ? 0 : 1);
}

runVerification().catch((err) => {
  console.error("Verification execution failed:", err);
  process.exit(1);
});
