import assert from "node:assert/strict";
import test from "node:test";
import type { YearMark } from "./engine.ts";
import { chartRows, latestGap, statuteGroups } from "./trends.ts";

function mark(year: number, unemployment: number): YearMark {
  return {
    year,
    unemployment,
    avgWage: 40_000,
    taxRevenue: 0,
    spending: 0,
    stability: 70,
    population: 72_000,
    treasury: 0,
    employed: 40_000,
  };
}

test("pace line anchors on the year before the statute", () => {
  const history = [mark(1, 0.05), mark(2, 0.12), mark(3, 0.15)];
  const pace = [mark(2, 0.06), mark(3, 0.07)];
  const rows = chartRows(history, pace, "unemployment");
  assert.equal(rows[0]!.pace, 0.05);
  assert.equal(rows[1]!.pace, 0.06);
  assert.equal(rows[1]!.value, 0.12);
  assert.equal(rows[2]!.pace, 0.07);
  assert.ok(Math.abs((latestGap(rows, pace) ?? 0) - 0.08) < 1e-9);
});

test("wage per person divides the wage bill by every resident", () => {
  const history = [mark(1, 0.05)];
  history[0]!.avgWage = 40_000;
  history[0]!.employed = 40_000;
  history[0]!.population = 80_000;
  const rows = chartRows(history, null, "wagePerCapita");
  assert.equal(rows[0]!.value, 20_000);
});

test("statutes group by year, newest first", () => {
  const groups = statuteGroups([
    { year: 2, label: "Automation began · Harbor" },
    { year: 2, label: "Tax cut to low" },
    { year: 5, label: "Retraining began" },
  ]);
  assert.equal(groups[0]!.year, 5);
  assert.deepEqual(groups[1]!.labels, ["Automation began · Harbor", "Tax cut to low"]);
});
