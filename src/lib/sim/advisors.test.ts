import assert from "node:assert/strict";
import test from "node:test";
import { advance, openingState, waveFor, type Ledger } from "./engine.ts";
import { advisors, energyAdvice, nextProtestLine, robotAdvice, stabilityAdvice, treasuryAdvice } from "./advisors.ts";

function closed(): Ledger {
  return advance(openingState());
}

test("four advisors, each with a status and one or two tips", () => {
  const list = advisors(closed());
  assert.deepEqual(list.map((a) => a.id), ["stability", "robot", "energy", "treasury"]);
  for (const advisor of list) {
    assert.ok(["calm", "watch", "alert"].includes(advisor.status));
    assert.ok(advisor.tips.length >= 1 && advisor.tips.length <= 2, advisor.id);
    for (const tip of advisor.tips) assert.ok(!/NaN|undefined|Infinity/.test(tip), tip);
  }
});

test("next protest line skips lines already crossed", () => {
  const city = closed();
  assert.equal(nextProtestLine({ ...city, stability: 72, unrest: { ...city.unrest, fired: [] } }), 70);
  assert.equal(nextProtestLine({ ...city, stability: 62, unrest: { ...city.unrest, fired: [70, 65] } }), 60);
  assert.equal(nextProtestLine({ ...city, stability: 4, unrest: { ...city.unrest, fired: [] } }), null);
});

test("stability chief warns about an active wave and offers strong police with its real cost", () => {
  const city = closed();
  const wave = waveFor(52, "normal", city.year, 55);
  const hot: Ledger = { ...city, stability: 52, unrest: { ...city.unrest, wave, fired: [70, 65, 60, 55] } };
  const advice = stabilityAdvice(hot);
  assert.equal(advice.status, "alert");
  assert.match(advice.tips[0], /line 55/);
  assert.match(advice.tips[1], /Strong police/);
  // Strong police with nothing to fight: go back to normal.
  const idle: Ledger = { ...city, stability: 80, policies: { ...city.policies, police: "strong" }, unrest: { ...city.unrest, wave: null } };
  assert.match(stabilityAdvice(idle).tips[0], /No wave is running/);
});

test("stability chief counts the points to the next line", () => {
  const city = closed();
  const near: Ledger = { ...city, stability: 72, unrest: { fired: [], cooldown: 0, wave: null, calmed: [] } };
  const advice = stabilityAdvice(near);
  assert.equal(advice.status, "alert");
  assert.ok(advice.tips.some((tip) => /next protest line is 70\. A fall of 2 points/.test(tip)));
});

test("droid reports the levy state and the biggest human workforce", () => {
  const city = closed();
  const on = robotAdvice({ ...city, policies: { ...city.policies, aiLevy: true } });
  assert.ok(on.tips.some((tip) => tip.startsWith("AI levy: ON")));
  const off = robotAdvice({ ...city, policies: { ...city.policies, aiLevy: false } });
  assert.ok(off.tips.some((tip) => tip.startsWith("AI levy: OFF")));
});

test("energy chief flags a grid short next year", () => {
  const city = closed();
  const short: Ledger = { ...city, population: city.population * 3, employed: city.employed * 3 };
  const advice = energyAdvice(short);
  assert.equal(advice.status, "alert");
  assert.match(advice.tips[0], /comes up short/);
});

test("treasurer reads deficits, overdrafts, and inflation from the books", () => {
  const city = closed();
  const broke: Ledger = { ...city, taxRevenue: 1_000_000, spending: 3_000_000, treasury: -500_000, inflation: 0.12 };
  const advice = treasuryAdvice(broke);
  assert.equal(advice.status, "alert");
  assert.match(advice.tips[0], /deficit of 2\.0m/);
  const flush: Ledger = { ...city, taxRevenue: 5_000_000, spending: 3_000_000, treasury: 9_000_000, debt: 0, loans: [], inflation: 0.02 };
  const calm = treasuryAdvice(flush);
  assert.equal(calm.status, "calm");
  assert.match(calm.tips[0], /surplus/);
});
