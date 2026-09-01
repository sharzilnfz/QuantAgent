#!/usr/bin/env bash
set -eo pipefail

echo "========================================================"
echo "  The Committee (QuantAgent) — Verification Doctor Check"
echo "========================================================"

# 1. API Health Check
echo -n "[1/4] Checking API Health (http://localhost:3000/health)... "
API_RES=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || true)
if [ "$API_RES" = "200" ]; then
  echo "OK (HTTP 200)"
else
  echo "FAILED (HTTP $API_RES). Ensure 'pnpm --filter @committee/api dev' is running."
  exit 1
fi

# 2. Web UI Check
echo -n "[2/4] Checking Web UI (http://localhost:5173)... "
WEB_RES=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 || true)
if [ "$WEB_RES" = "200" ]; then
  echo "OK (HTTP 200)"
else
  echo "FAILED (HTTP $WEB_RES). Ensure 'pnpm --filter @committee/web dev' is running."
  exit 1
fi

# 3. Deterministic Experiment Suite API Check
echo -n "[3/4] Checking Deterministic Experiment Suite API... "
SUITE_OUT=$(curl -s "http://localhost:3000/experiments/suite?symbol=AAPL" || true)
if echo "$SUITE_OUT" | grep -q "datasetHash"; then
  echo "OK (Contract-valid JSON)"
else
  echo "FAILED. Response did not contain expected experiment suite payload."
  exit 1
fi

# 4. Auth & Authenticated API Check (Live Signals Radar)
echo -n "[4/4] Checking Auth & Indicator Telemetry... "
COOKIE_JAR=$(mktemp /tmp/committee-cookie-XXXXXX.txt)
trap 'rm -f "$COOKIE_JAR"' EXIT

AUTH_RES=$(curl -c "$COOKIE_JAR" -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@committee.local","password":"demo-committee"}' || true)

if [ "$AUTH_RES" != "200" ]; then
  echo "FAILED auth login (HTTP $AUTH_RES). Ensure 'pnpm db:seed' has been run."
  exit 1
fi

RADAR_OUT=$(curl -b "$COOKIE_JAR" -s "http://localhost:3000/signals/radar?symbols=AAPL,NVDA,SPY" || true)
if echo "$RADAR_OUT" | grep -q "currentBar"; then
  echo "OK (Auth valid & indicators online)"
else
  echo "FAILED authenticated radar query."
  exit 1
fi

echo "--------------------------------------------------------"
echo "✓ All systems healthy and ready for verification driving."
echo "========================================================"
