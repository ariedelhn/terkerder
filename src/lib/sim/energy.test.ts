import assert from "node:assert/strict";
import test from "node:test";
import {
  advance,
  capacityOf,
  openingState,
  retireOil,
  serviceBill,
  serviceOutlook,
  setResearch,
  stagePower,
  type Ledger,
} from "./engine.ts";
import {
  AUTO_POWER_BOOST,
  LARGE_OUTPUT,
  POWER_TYPES,
  SOLAR_FIRM,
  SOLAR_FIRM_BATTERY,
  asEnergy,
  fuelBill,
  nextOilPrice,
  oilInflation,
  plantMw,
  powerCapacity,
  researchDone,
  type EnergyState,
  type ResearchId,
} from "./energy.ts";
import { reviveLedger } from "./storage.ts";
import { buildCityMap } from "./city-map.ts";

function finite(state: Ledger): void {
  for (const value of [
    state.treasury,
    state.stability,
    state.unemployment,
    state.priceIndex,
    state.inflation,
    state.spending,
    state.taxRevenue,
    state.energy.oilPrice,
    capacityOf("power", state.works, state.energy),
  ]) {
    assert.ok(Number.isFinite(value), `not finite: ${value}`);
  }
}

function withResearch(state: Ledger, done: ResearchId[]): Ledger {
  const research = { ...state.energy.research };
  const years: Record<ResearchId, number> = { solar: 3, upkeep: 2, batteries: 3, large: 3, tidal: 4, works: 3 };
  for (const id of done) research[id] = years[id];
  return { ...state, energy: { ...state.energy, research } };
}

test("a new city runs on four staffed oil plants with nothing researched", () => {
  const state = openingState();
  assert.deepEqual(state.energy.fleet.oil, { crew: 4, auto: 0 });
  assert.equal(state.energy.fleet.solar.crew + state.energy.fleet.tidal.crew, 0);
  assert.equal(state.energy.oilPrice, 1);
  assert.equal(state.energy.active, null);
  assert.equal(capacityOf("power", state.works, state.energy), 4 * POWER_TYPES.oil.mw);
  // Census running cost matches the old flat 4.2M a plant.
  assert.equal(serviceBill(state.works, state.energy).power, 4 * 4_200_000);
});

test("research is funded yearly, takes several years, and unlocks solar", () => {
  let state = openingState();
  assert.equal(stagePower(state, "solar", "crew").works.power.staged, 0, "solar is locked before research");
  assert.equal(setResearch(state, "batteries").energy.active, null, "batteries need solar first");
  state = setResearch(state, "solar");
  assert.equal(state.energy.active, "solar");
  state = advance(state);
  assert.ok(state.spend.research > 5_000_000, `paid ${state.spend.research}`);
  assert.equal(state.energy.research.solar, 1);
  assert.ok(!researchDone(state.energy, "solar"));
  state = advance(advance(state));
  assert.ok(researchDone(state.energy, "solar"));
  assert.equal(state.energy.active, null);
  assert.ok(state.events.some((event) => event.label === "Research done · Solar farms"));
  const next = advance(state);
  assert.equal(next.spend.research, 0, "nothing is billed once the project is done");
  const staged = stagePower(state, "solar", "crew");
  assert.equal(staged.works.power.staged, 1);
  assert.equal(staged.energy.stagedKind, "solar");
});

test("stopping funding pauses progress and switching keeps what was paid for", () => {
  let state = setResearch(openingState(), "upkeep");
  state = advance(state);
  assert.equal(state.energy.research.upkeep, 1);
  state = setResearch(state, "solar");
  state = advance(state);
  assert.equal(state.energy.research.upkeep, 1);
  assert.equal(state.energy.research.solar, 1);
  state = setResearch(state, null);
  const idle = advance(state);
  assert.equal(idle.spend.research, 0);
  assert.equal(idle.energy.research.solar, 1);
});

test("oil fuel follows the oil price, drifts up over decades, and pushes inflation when it jumps", () => {
  const energy = openingState().energy;
  const cheap = fuelBill(energy, 1);
  const dear = fuelBill(energy, 1.5);
  assert.equal(cheap, 4 * POWER_TYPES.oil.fuel);
  assert.ok(Math.abs(dear - cheap * 1.5) < 2);
  let price = 1;
  for (let year = 2; year <= 41; year += 1) price = nextOilPrice(price, year);
  assert.ok(price > 1.4 && price < 3, `oil after 40 years ${price}`);
  assert.ok(oilInflation(energy, 1.1) > 0);
  assert.ok(oilInflation(energy, 0.9) < 0);
  const solarOnly: EnergyState = {
    ...energy,
    fleet: { oil: { crew: 0, auto: 0 }, solar: { crew: 6, auto: 0 }, tidal: { crew: 0, auto: 0 } },
  };
  assert.equal(oilInflation(solarOnly, 1.5), 0, "a grid without oil ignores oil prices");
  assert.equal(fuelBill(solarOnly, 2), 0);
});

test("an oil-only city pays more for power over time than at the census", () => {
  let state = openingState();
  const start = serviceBill(state.works, state.energy).power;
  for (let i = 0; i < 30; i += 1) state = advance(state);
  finite(state);
  assert.ok(state.energy.oilPrice > 1.2);
  assert.ok(serviceBill(state.works, state.energy).power > start * 1.15);
});

test("new plant types add their own capacity, and research raises it", () => {
  const base = withResearch(openingState(), ["solar", "tidal", "upkeep"]);
  const e = base.energy;
  assert.equal(plantMw(e, "solar", false), POWER_TYPES.solar.mw * SOLAR_FIRM);
  assert.equal(plantMw(e, "tidal", false), POWER_TYPES.tidal.mw);
  assert.ok(Math.abs(plantMw(e, "oil", true) - POWER_TYPES.oil.mw * AUTO_POWER_BOOST) < 1e-9);

  // Solar can be staged three at a time; a fourth tap cancels.
  let staged = stagePower(base, "solar", "crew");
  staged = stagePower(staged, "solar", "crew");
  staged = stagePower(staged, "solar", "crew");
  assert.equal(staged.works.power.staged, 3);
  assert.equal(stagePower(staged, "solar", "crew").works.power.staged, 0);
  const look = serviceOutlook(staged, "power");
  assert.ok(Math.abs(look.nextCover * look.nextDemand - (look.capacity + 3 * POWER_TYPES.solar.mw * SOLAR_FIRM)) < 1e-6);

  const built = advance(staged);
  assert.equal(built.energy.fleet.solar.crew, 3);
  assert.equal(built.works.power.plants, 7);
  assert.equal(capacityOf("power", built.works, built.energy), 4 * 55 + 3 * POWER_TYPES.solar.mw * SOLAR_FIRM);
  assert.ok(built.spend.construction >= 3 * POWER_TYPES.solar.buildCost);
  finite(built);

  const stored = withResearch(built, ["batteries", "large"]);
  assert.ok(
    Math.abs(powerCapacity(stored.energy) - (4 * 55 * LARGE_OUTPUT + 3 * POWER_TYPES.solar.mw * SOLAR_FIRM_BATTERY)) < 1e-6,
  );

  const tidal = advance(stagePower(base, "tidal", "auto"));
  assert.equal(tidal.energy.fleet.tidal.auto, 1);
  assert.ok(Math.abs(capacityOf("power", tidal.works, tidal.energy) - (4 * 55 + 80 * AUTO_POWER_BOOST)) < 1e-6);
});

test("long-life plants cut upkeep and efficient works enlarge water and waste", () => {
  const plain = openingState();
  const better = withResearch(plain, ["upkeep", "large", "works"]);
  const a = serviceBill(plain.works, plain.energy);
  const b = serviceBill(better.works, better.energy);
  assert.ok(b.water < a.water && b.waste < a.waste);
  assert.ok(capacityOf("water", better.works, better.energy) > capacityOf("water", plain.works, plain.energy) * 1.3);
});

test("closing an oil plant happens at the year close and saves its fuel", () => {
  const state = withResearch(openingState(), ["solar"]);
  const staged = retireOil(state);
  assert.equal(staged.energy.retire, 1);
  assert.equal(retireOil(staged).energy.retire, 0, "tapping again keeps the plant");
  const next = advance(staged);
  assert.equal(next.energy.fleet.oil.crew, 3);
  assert.equal(next.works.power.plants, 3);
  assert.equal(next.energy.retire, 0);
  assert.ok(fuelBill(next.energy, 1) < fuelBill(state.energy, 1));
  assert.ok(next.events.some((event) => event.label === "Oil plant closed"));
});

test("old saves without energy load as an oil fleet with no research and keep playing", () => {
  const raw = JSON.parse(JSON.stringify(openingState())) as Record<string, unknown>;
  delete raw.energy;
  raw.works = {
    power: { plants: 6, auto: 2, staged: 0, stagedAuto: false },
    water: { plants: 3, auto: 0, staged: 0, stagedAuto: false },
    waste: { plants: 3, auto: 0, staged: 0, stagedAuto: false },
  };
  const spend = raw.spend as Record<string, unknown>;
  delete spend.research;
  const revived = reviveLedger(raw);
  assert.ok(revived);
  assert.deepEqual(revived.energy.fleet.oil, { crew: 6, auto: 2 });
  assert.equal(revived.energy.fleet.solar.crew, 0);
  assert.ok(Object.values(revived.energy.research).every((years) => years === 0));
  assert.equal(revived.energy.oilPrice, 1);
  assert.equal(revived.spend.research, 0);
  let state = revived;
  for (let i = 0; i < 5; i += 1) {
    state = advance(state);
    finite(state);
  }
  assert.equal(state.energy.fleet.oil.crew + state.energy.fleet.oil.auto, 8);
});

test("damaged energy data is cleaned up without NaN", () => {
  const energy = asEnergy(
    { fleet: { oil: { crew: "x", auto: -3 }, solar: { crew: 2.7, auto: null } }, oilPrice: Number.NaN, active: "warp", research: { solar: 99 } },
    { plants: 5, auto: 0 },
  );
  assert.equal(energy.fleet.oil.crew + energy.fleet.solar.crew, 5);
  assert.equal(energy.fleet.solar.crew, 2);
  assert.equal(energy.oilPrice, 1);
  assert.equal(energy.active, null);
  assert.equal(energy.research.solar, 3);
  assert.ok(Number.isFinite(powerCapacity(energy)));
});

test("the map draws oil, solar, battery, and tidal plants in their places", () => {
  let state = withResearch(openingState(), ["solar", "batteries", "upkeep", "tidal"]);
  state = stagePower(stagePower(state, "solar", "crew"), "solar", "crew");
  state = advance(state);
  state = advance(stagePower(state, "tidal", "crew"));
  const map = buildCityMap(state);
  const kinds = (kind: string) => map.tiles.filter((tile) => tile.kind === kind);
  assert.equal(kinds("power").length, 4);
  assert.equal(kinds("solar").length, 2);
  assert.equal(kinds("battery").length, 1);
  assert.equal(kinds("tidal").length, 1);
  assert.ok(kinds("tidal").every((tile) => tile.terrain === "sea"));
  assert.ok(kinds("solar").every((tile) => tile.zone === "industrial"));
  assert.equal(map.counts.solar, 2);
  assert.equal(map.counts.tidal, 1);
});
