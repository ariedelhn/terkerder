import assert from "node:assert/strict";
import test from "node:test";
import { openingState, type Ledger } from "./engine.ts";
import {
  MAP_SIZE,
  buildCityMap,
  dataCenterCount,
  homeUnits,
  isRiver,
  isSea,
  machineCount,
  zoneAt,
  type BuildingKind,
} from "./city-map.ts";

function tileAt(ledger: Ledger, x: number, y: number) {
  return buildCityMap(ledger).tiles[y * MAP_SIZE + x]!;
}

function ofKind(ledger: Ledger, kind: BuildingKind) {
  return buildCityMap(ledger).tiles.filter((tile) => tile.kind === kind);
}

function keys(tiles: { x: number; y: number }[]): string[] {
  return tiles.map((tile) => `${tile.x},${tile.y}`);
}

test("the dock town has a sea on the right, a river west to east, and pre-made zones", () => {
  const map = buildCityMap(openingState());
  assert.equal(map.width, 16);
  assert.equal(map.height, 16);
  assert.equal(map.tiles.length, 256);

  for (let y = 0; y < MAP_SIZE; y += 1) {
    assert.equal(tileAt(openingState(), 15, y).terrain, "sea");
    assert.equal(tileAt(openingState(), 14, y).terrain, "sea");
    assert.ok(isSea(13, y));
    assert.equal(zoneAt(15, y), "none");
  }

  const river = map.tiles.filter((tile) => tile.terrain === "river");
  assert.ok(river.some((tile) => tile.x === 0));
  assert.ok(river.some((tile) => tile.x === 12));
  assert.ok(isRiver(0, 7));
  assert.ok(isRiver(12, 6));
  assert.ok(river.every((tile) => tile.x < 13));

  assert.equal(zoneAt(2, 12), "residential");
  assert.equal(zoneAt(1, 15), "residential");
  assert.equal(zoneAt(2, 2), "industrial");
  assert.equal(zoneAt(10, 10), "commercial");
  assert.equal(zoneAt(12, 14), "commercial");
  assert.ok(ofKind(openingState(), "dock").length >= 4);
  assert.ok(ofKind(openingState(), "dock").some((tile) => tile.terrain === "sea"));
  assert.ok(ofKind(openingState(), "hall").length === 1);
  assert.ok(ofKind(openingState(), "park").length >= 1);
});

test("the layout is deterministic and does not use randomness", () => {
  const state = openingState();
  const first = buildCityMap(state);
  const second = buildCityMap(state);
  assert.deepEqual(first, second);
  assert.deepEqual(buildCityMap(structuredClone(state)), first);
});

test("opening plants, homes, and shops appear, and there are no data centers yet", () => {
  const state = openingState();
  const map = buildCityMap(state);
  assert.equal(map.counts.power, 4);
  assert.equal(map.counts.water, 3);
  assert.equal(map.counts.waste, 3);
  assert.equal(ofKind(state, "power").length, 4);
  assert.equal(ofKind(state, "water").length, 3);
  assert.equal(ofKind(state, "waste").length, 3);
  assert.ok(ofKind(state, "power").every((tile) => tile.zone === "industrial" && !tile.automated));
  assert.ok(ofKind(state, "water").every((tile) => tile.zone === "industrial"));
  assert.ok(ofKind(state, "house").length >= 40);
  assert.ok(map.counts.shops >= 6);
  assert.equal(map.counts.data, 0);
  assert.equal(dataCenterCount(state), 0);
  assert.ok(homeUnits(state.population) > 0);
  assert.ok(ofKind(state, "house").every((tile) => tile.zone === "residential"));
  assert.ok(ofKind(state, "shop").every((tile) => tile.zone === "commercial"));
});

test("growing the population densifies homes from the center without moving them", () => {
  const open = openingState();
  const later: Ledger = { ...open, population: open.population * 2 };
  const before = ofKind(open, "house");
  const after = ofKind(later, "house");
  assert.ok(after.length >= before.length);
  assert.ok(buildCityMap(later).counts.homeUnits > buildCityMap(open).counts.homeUnits);
  for (const home of before) {
    const next = tileAt(later, home.x, home.y);
    assert.equal(next.kind, "house");
    assert.ok(next.density >= home.density);
  }
});

test("new plants append in a fixed order and existing plants stay put", () => {
  const open = openingState();
  const start = ofKind(open, "power");
  assert.equal(start.length, 4);
  const expanded: Ledger = {
    ...open,
    works: {
      ...open.works,
      power: { plants: 4, auto: 1, staged: 1, stagedAuto: false },
    },
  };
  const plants = ofKind(expanded, "power");
  assert.equal(plants.length, 6);
  assert.deepEqual(keys(plants.slice(0, 4)), keys(start));
  const auto = plants.filter((tile) => tile.automated && !tile.staged);
  const staged = plants.filter((tile) => tile.staged);
  assert.equal(auto.length, 1);
  assert.equal(staged.length, 1);
  assert.equal(auto[0]?.zone, "industrial");
});

test("data centers appear as automation grows, on a stable campus", () => {
  const open = openingState();
  assert.equal(machineCount(open), 0);
  const some: Ledger = {
    ...open,
    sectors: open.sectors.map((sector) =>
      sector.id === "food" ? { ...sector, automatons: 500 } : sector,
    ),
  };
  const more: Ledger = {
    ...open,
    sectors: open.sectors.map((sector) =>
      sector.id === "food" || sector.id === "transport" || sector.id === "services"
        ? { ...sector, automatons: 4_000 }
        : sector,
    ),
  };
  const first = ofKind(some, "data");
  const second = ofKind(more, "data");
  assert.ok(first.length >= 1);
  assert.ok(second.length > first.length);
  assert.ok(first.every((tile) => tile.zone === "industrial"));
  for (const hall of first) {
    const next = tileAt(more, hall.x, hall.y);
    assert.equal(next.kind, "data");
  }
});

test("a ledger without works still draws the opening plants", () => {
  const loose = { ...openingState(), works: undefined } as unknown as Ledger;
  const map = buildCityMap(loose);
  assert.equal(map.counts.power, 4);
  assert.equal(map.counts.water, 3);
  assert.equal(map.counts.waste, 3);
});
