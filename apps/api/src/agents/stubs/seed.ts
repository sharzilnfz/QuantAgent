/**
 * Deterministic, seeded pseudo-randomness for the stub agents.
 *
 * Stubs must be reproducible: the same (symbol, decisionTs, agent) always yields
 * the same number, so a downstream team can snapshot-test against a stub and a
 * replayed run id reproduces byte-identical output. FNV-1a, no state, no clock.
 */
export function seededUnitInterval(...parts: string[]): number {
  let hash = 0x811c9dc5;
  const seed = parts.join("|");
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 0xffffffff;
}

/** Round to 2dp so stub confidences read cleanly in logs and fixtures. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
