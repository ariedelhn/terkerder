import assert from "node:assert/strict";
import test from "node:test";
import { openingState } from "./engine.ts";
import { asPolicies, reviveLedger } from "./storage.ts";

test("missing or damaged ownership falls back to firms", () => {
  const base = openingState();
  const raw = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
  const policies = { ...(raw.policies as Record<string, unknown>) };
  delete policies.ownership;
  raw.policies = policies;
  const missing = reviveLedger(raw);
  assert.ok(missing);
  assert.equal(missing.policies.ownership, "firms");

  raw.policies = { ...policies, ownership: "nope" };
  const damaged = reviveLedger(raw);
  assert.ok(damaged);
  assert.equal(damaged.policies.ownership, "firms");
  assert.ok(Number.isFinite(damaged.taxRevenue));
});

test("asPolicies keeps valid ownership and rejects a broken tax band", () => {
  const good = asPolicies({
    tax: "mid",
    gates: "steady",
    stipend: false,
    dividend: false,
    works: false,
    retrain: false,
    wageFloor: false,
    ownership: "citizens",
  });
  assert.equal(good?.ownership, "citizens");
  assert.equal(asPolicies({ ...good, tax: "steep" }), null);
});

test("saves without inflation fields load at a 100 index and 2% inflation", () => {
  const raw = JSON.parse(JSON.stringify(openingState())) as Record<string, unknown>;
  delete raw.inflation;
  delete raw.wageScale;
  delete raw.priceIndex;
  const history = raw.history as Record<string, unknown>[];
  if (history?.[0]) {
    delete history[0].inflation;
  }
  const revived = reviveLedger(raw);
  assert.ok(revived);
  assert.equal(revived.inflation, 0.02);
  assert.equal(revived.wageScale, 1);
  assert.equal(revived.priceIndex, 100);
});
