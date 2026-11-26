import assert from "node:assert/strict";
import test from "node:test";
import { advance, openingState, waveFor, type Ledger } from "./engine.ts";
import { finalTally, isGameOver, newWave, protestDispatch, protestTier, protestWaveCount } from "./events.ts";
import { reviveLedger } from "./storage.ts";

function closed(): Ledger {
  return advance(openingState());
}

test("protest tiers follow the stability line that set the wave off", () => {
  assert.equal(protestTier(70), 1);
  assert.equal(protestTier(65), 1);
  assert.equal(protestTier(60), 2);
  assert.equal(protestTier(55), 2);
  assert.equal(protestTier(50), 3);
  assert.equal(protestTier(35), 3);
  assert.equal(protestTier(30), 4);
  assert.equal(protestTier(5), 4);
});

test("a dispatch shows only for a wave that broke out in the year just closed", () => {
  const city = closed();
  assert.equal(protestDispatch(city), null);
  const wave = waveFor(48, "normal", city.year, 50);
  const fresh: Ledger = { ...city, stability: 48, unrest: { ...city.unrest, wave } };
  const dispatch = protestDispatch(fresh);
  assert.ok(dispatch);
  assert.equal(dispatch.tier, 3);
  assert.equal(dispatch.line, 50);
  assert.equal(dispatch.years, wave.length);
  assert.ok(dispatch.outputHit > 0 && dispatch.outputHit <= 0.15);
  // Last year's wave is old news.
  const old: Ledger = { ...fresh, unrest: { ...fresh.unrest, wave: { ...wave, started: city.year - 1 } } };
  assert.equal(newWave(old), null);
  assert.equal(protestDispatch(old), null);
  // No cutscene once the city has fallen: the zombies take over.
  assert.equal(protestDispatch({ ...fresh, stability: 0 }), null);
});

test("game over only after a closed year at stability 0", () => {
  const opening = openingState();
  assert.equal(isGameOver({ ...opening, stability: 0 }), false);
  const city = closed();
  assert.equal(isGameOver(city), false);
  assert.equal(isGameOver({ ...city, stability: 0 }), true);
  assert.equal(isGameOver({ ...city, stability: 0.4 }), false);
});

test("advance stays pure past stability 0 so balance runs keep going", () => {
  const fallen: Ledger = { ...closed(), stability: 0 };
  const next = advance(fallen);
  assert.equal(next.year, fallen.year + 1);
  assert.ok(next.stability >= 0 && next.stability <= 100);
});

test("an old save at stability 0 revives and reads as game over with a full tally", () => {
  let city = closed();
  city = advance(city);
  const raw = JSON.parse(
    JSON.stringify({
      ...city,
      stability: 0,
      events: [...city.events, { year: city.year, label: "Protest wave · below 70" }, { year: city.year, label: "Protest wave · below 40" }],
    }),
  );
  const revived = reviveLedger(raw);
  assert.ok(revived);
  assert.equal(isGameOver(revived), true);
  const tally = finalTally(revived);
  assert.equal(tally.yearsSurvived, revived.year - revived.history[0].year);
  assert.ok(tally.peakPopulation >= revived.population);
  assert.equal(tally.protestWaves, 2);
  assert.equal(protestWaveCount({ events: [] }), 0);
  assert.equal(tally.debt, revived.debt);
  assert.equal(tally.treasury, revived.treasury);
});
