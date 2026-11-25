import {
  asEnergy,
  researchDone,
  SOLAR_PER_BATTERY_TILE,
  type EnergyState,
  type PowerKind,
} from "./energy.ts";
import {
  asPlant,
  openingWorks,
  waveDamage,
  type Ledger,
  type ServiceId,
  type ServicePlant,
  type Works,
} from "./engine.ts";

export const MAP_SIZE = 16;
const SEA_X = 13;
const PEOPLE_PER_HOME_UNIT = 1_200;
const SHOP_JOBS = 500;
const SHOP_RESIDENTS = 10_000;
const MACHINES_PER_CAMPUS = 4_000;
const AUTO_PLANTS_PER_HALL = 2;
const OFFICE_JOBS_PER_TOWER = 450;
const MAX_OFFICES = 10;

export type Terrain = "sea" | "river" | "land";
export type Zone = "residential" | "commercial" | "industrial" | "none";
export type BuildingKind =
  | "empty"
  | "house"
  | "shop"
  | "office"
  | "dock"
  | "power"
  | "solar"
  | "battery"
  | "tidal"
  | "water"
  | "waste"
  | "data"
  | "hall"
  | "school"
  | "clinic"
  | "park"
  | "bridge";

export type MapTile = {
  x: number;
  y: number;
  terrain: Terrain;
  zone: Zone;
  kind: BuildingKind;
  density: number;
  automated: boolean;
  staged: boolean;
  /** Protesters or blockades on this square during a protest wave. */
  protest: boolean;
  label: string;
};

export type CityMapModel = {
  width: number;
  height: number;
  tiles: MapTile[];
  counts: {
    homes: number;
    homeUnits: number;
    shops: number;
    offices: number;
    emptyOffices: number;
    /** Squares with protesters or blockades. */
    protests: number;
    /** Shops shut after looting. */
    looted: number;
    docks: number;
    power: number;
    water: number;
    waste: number;
    data: number;
    automatedPlants: number;
    oil: number;
    solar: number;
    tidal: number;
    batteries: number;
  };
};

type Point = readonly [number, number];

const WATER_SLOTS: readonly Point[] = [
  [0, 6],
  [1, 6],
  [2, 6],
  [3, 6],
  [4, 6],
  [5, 5],
  [6, 5],
  [7, 5],
  [8, 5],
  [9, 5],
  [10, 5],
  [11, 5],
  [12, 5],
  [0, 5],
  [1, 5],
  [2, 5],
  [3, 5],
  [4, 5],
];

const POWER_SLOTS: readonly Point[] = [
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 0],
  [4, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [3, 1],
  [4, 1],
  [0, 2],
  [1, 2],
  [2, 2],
  [3, 2],
  [4, 2],
  [0, 3],
  [1, 3],
  [2, 3],
  [3, 3],
  [4, 3],
  [0, 4],
  [1, 4],
  [2, 4],
  [3, 4],
  [4, 4],
];

const WASTE_SLOTS: readonly Point[] = [
  [5, 0],
  [6, 0],
  [7, 0],
  [8, 0],
  [5, 1],
  [6, 1],
  [7, 1],
  [8, 1],
  [5, 2],
  [6, 2],
  [7, 2],
  [8, 2],
  [5, 3],
  [6, 3],
  [7, 3],
  [8, 3],
  [5, 4],
  [6, 4],
  [7, 4],
  [8, 4],
];

const DATA_SLOTS: readonly Point[] = [
  [10, 0],
  [11, 0],
  [12, 0],
  [10, 1],
  [11, 1],
  [12, 1],
  [10, 2],
  [11, 2],
  [12, 2],
  [10, 3],
  [11, 3],
  [12, 3],
  [9, 0],
  [9, 1],
  [9, 2],
  [9, 3],
];

const PARKS: readonly Point[] = [
  [1, 8],
  [4, 8],
  [6, 7],
];
const SCHOOLS: readonly Point[] = [
  [2, 11],
  [6, 14],
];
const CLINICS: readonly Point[] = [[5, 9]];
const HALL: Point = [8, 8];
const DOCKS: readonly Point[] = [
  [12, 9],
  [12, 10],
  [12, 11],
  [12, 12],
  [13, 9],
  [13, 10],
  [13, 11],
  [14, 10],
];
const BRIDGES: readonly Point[] = [
  [3, 7],
  [9, 6],
];

/** Tidal stations sit in the sea along the shore, clear of the piers and the river mouth. */
const TIDAL_SLOTS: readonly Point[] = [
  [13, 3],
  [13, 4],
  [13, 2],
  [13, 13],
  [13, 14],
  [13, 12],
  [13, 1],
  [13, 15],
];

const PLANT_SLOTS: Record<ServiceId, readonly Point[]> = {
  power: POWER_SLOTS,
  water: WATER_SLOTS,
  waste: WASTE_SLOTS,
};

const PLANT_LABEL: Record<ServiceId, string> = {
  power: "Power plant",
  water: "Water works",
  waste: "Waste plant",
};

function keyOf(x: number, y: number): string {
  return `${x},${y}`;
}

function pointSet(points: readonly Point[]): Set<string> {
  return new Set(points.map(([x, y]) => keyOf(x, y)));
}

const PARK_SET = pointSet(PARKS);
const SCHOOL_SET = pointSet(SCHOOLS);
const CLINIC_SET = pointSet(CLINICS);
const DOCK_SET = pointSet(DOCKS);
const BRIDGE_SET = pointSet(BRIDGES);
const HALL_KEY = keyOf(HALL[0], HALL[1]);

export function isSea(x: number, _y: number): boolean {
  return x >= SEA_X;
}

export function isRiver(x: number, y: number): boolean {
  if (x < 0 || x >= SEA_X) return false;
  if (x <= 4 && y === 7) return true;
  if (x >= 5 && x <= 12 && y === 6) return true;
  if ((x === 11 || x === 12) && y === 7) return true;
  return false;
}

export function zoneAt(x: number, y: number): Zone {
  if (isSea(x, y) || isRiver(x, y)) return "none";
  if (x <= 4 && y <= 6) return "industrial";
  if (x >= 5 && x <= 12 && y <= 5) return "industrial";
  if (x <= 7 && y >= 8) return "residential";
  if (x >= 5 && x <= 7 && y === 7) return "residential";
  if (x >= 8 && x <= 10 && y >= 7) return "commercial";
  if (x >= 11 && x <= 12 && y >= 8) return "commercial";
  return "none";
}

export function terrainAt(x: number, y: number): Terrain {
  if (isSea(x, y)) return "sea";
  if (isRiver(x, y)) return "river";
  return "land";
}

function reservedKey(x: number, y: number): boolean {
  const key = keyOf(x, y);
  return (
    PARK_SET.has(key) ||
    SCHOOL_SET.has(key) ||
    CLINIC_SET.has(key) ||
    DOCK_SET.has(key) ||
    key === HALL_KEY
  );
}

function collectLots(zone: Zone, exclude: (x: number, y: number) => boolean): Point[] {
  const lots: Point[] = [];
  for (let y = 0; y < MAP_SIZE; y += 1) {
    for (let x = 0; x < MAP_SIZE; x += 1) {
      if (zoneAt(x, y) !== zone) continue;
      if (exclude(x, y)) continue;
      lots.push([x, y]);
    }
  }
  return lots;
}

function nearer(ax: number, ay: number, bx: number, by: number, tx: number, ty: number): number {
  const da = (ax - tx) * (ax - tx) + (ay - ty) * (ay - ty);
  const db = (bx - tx) * (bx - tx) + (by - ty) * (by - ty);
  if (da !== db) return da - db;
  if (ay !== by) return ay - by;
  return ax - bx;
}

const HOME_LOTS: readonly Point[] = collectLots("residential", (x, y) => reservedKey(x, y)).sort(
  (a, b) => nearer(a[0], a[1], b[0], b[1], 8, 8),
);

const SHOP_LOTS: readonly Point[] = collectLots("commercial", (x, y) => reservedKey(x, y)).sort(
  (a, b) => nearer(a[0], a[1], b[0], b[1], 12, 10),
);

function worksOf(ledger: Ledger): Works {
  const fallback = openingWorks();
  return {
    power: asPlant(ledger.works?.power, fallback.power),
    water: asPlant(ledger.works?.water, fallback.water),
    waste: asPlant(ledger.works?.waste, fallback.waste),
  };
}

function energyOf(ledger: Ledger, works: Works): EnergyState {
  return asEnergy(ledger.energy, works.power);
}

export function batteryTiles(energy: EnergyState): number {
  if (!researchDone(energy, "batteries")) return 0;
  const solar = energy.fleet.solar.crew + energy.fleet.solar.auto;
  return Math.ceil(solar / SOLAR_PER_BATTERY_TILE);
}

const POWER_LABEL: Record<PowerKind, string> = {
  oil: "Oil plant",
  solar: "Solar farm",
  tidal: "Tidal station",
};

const POWER_TILE: Record<PowerKind, BuildingKind> = {
  oil: "power",
  solar: "solar",
  tidal: "tidal",
};

export function machineCount(ledger: Ledger): number {
  return (ledger.sectors ?? []).reduce((sum, sector) => sum + (sector.automatons ?? 0), 0);
}

export function dataCenterCount(ledger: Ledger): number {
  const machines = machineCount(ledger);
  const works = worksOf(ledger);
  const autoPlants = works.power.auto + works.water.auto + works.waste.auto;
  if (machines <= 0 && autoPlants <= 0) return 0;
  const sectorsOn = (ledger.sectors ?? []).filter((sector) => (sector.automatons ?? 0) > 0).length;
  return Math.min(
    DATA_SLOTS.length,
    sectorsOn +
      Math.floor(machines / MACHINES_PER_CAMPUS) +
      Math.floor(autoPlants / AUTO_PLANTS_PER_HALL),
  );
}

export function shopCount(ledger: Ledger): number {
  const services = (ledger.sectors ?? []).find((sector) => sector.id === "services");
  const employed = services?.employed ?? 0;
  const raw = Math.round(employed / SHOP_JOBS + ledger.population / SHOP_RESIDENTS);
  return Math.max(6, Math.min(SHOP_LOTS.length, raw));
}

/**
 * Office towers sit at the back of the shopping district. A tower empties as firms hand its desk
 * work to AI: the building stays, the lights go out.
 */
export function officeTowers(ledger: Ledger): { total: number; busy: number } {
  const office = (ledger.sectors ?? []).find((sector) => sector.id === "office");
  if (!office) return { total: 0, busy: 0 };
  const employed = Math.max(0, office.employed ?? 0);
  const size = employed + Math.max(0, office.automatons ?? 0);
  const total = Math.max(2, Math.min(MAX_OFFICES, Math.round(size / OFFICE_JOBS_PER_TOWER)));
  const busy = Math.max(0, Math.min(total, Math.round((employed / Math.max(1, size)) * total)));
  return { total, busy };
}

export function homeUnits(population: number): number {
  return Math.max(0, Math.round(population / PEOPLE_PER_HOME_UNIT));
}

function densityFor(index: number, units: number, lots: number): number {
  if (units <= 0 || index >= lots) return 0;
  if (units <= lots) return index < units ? 1 : 0;
  if (units <= lots * 2) return index < units - lots ? 2 : 1;
  const triple = Math.min(lots, units - lots * 2);
  if (index < triple) return 3;
  return 2;
}

function houseLabel(density: number): string {
  if (density <= 0) return "Residential lot";
  if (density === 1) return "Houses";
  if (density === 2) return "Housing block";
  return "Dense housing";
}

function plantKind(
  id: ServiceId,
  plant: ServicePlant,
): { staffed: number; automated: number; staged: boolean; stagedAuto: boolean } {
  return {
    staffed: plant.plants,
    automated: plant.auto,
    staged: plant.staged > 0,
    stagedAuto: plant.stagedAuto,
  };
}

function emptyTile(x: number, y: number): MapTile {
  const terrain = terrainAt(x, y);
  const zone = zoneAt(x, y);
  let kind: BuildingKind = "empty";
  let label =
    zone === "residential"
      ? "Residential lot"
      : zone === "commercial"
        ? "Shop lot"
        : zone === "industrial"
          ? "Industrial lot"
          : "Land";
  if (terrain === "sea") {
    label = "Sea";
  } else if (terrain === "river") {
    kind = BRIDGE_SET.has(keyOf(x, y)) ? "bridge" : "empty";
    label = kind === "bridge" ? "Bridge" : "River";
  }
  return {
    x,
    y,
    terrain,
    zone,
    kind,
    density: 0,
    automated: false,
    staged: false,
    protest: false,
    label,
  };
}

/** Pure layout of the dock town from the current ledger. Geography is fixed so tiles stay put. */
export function buildCityMap(ledger: Ledger): CityMapModel {
  const tiles: MapTile[] = [];
  for (let y = 0; y < MAP_SIZE; y += 1) {
    for (let x = 0; x < MAP_SIZE; x += 1) {
      tiles.push(emptyTile(x, y));
    }
  }

  const at = (x: number, y: number): MapTile => tiles[y * MAP_SIZE + x]!;

  const place = (
    x: number,
    y: number,
    patch: Partial<Pick<MapTile, "kind" | "density" | "automated" | "staged" | "label">>,
  ) => {
    const tile = at(x, y);
    Object.assign(tile, patch);
  };

  for (const [x, y] of PARKS) place(x, y, { kind: "park", label: "Park" });
  for (const [x, y] of SCHOOLS) place(x, y, { kind: "school", label: "School" });
  for (const [x, y] of CLINICS) place(x, y, { kind: "clinic", label: "Clinic" });
  place(HALL[0], HALL[1], { kind: "hall", label: "City hall" });
  for (const [x, y] of DOCKS) {
    place(x, y, { kind: "dock", label: x >= SEA_X ? "Pier" : "Docks" });
  }

  const units = homeUnits(ledger.population);
  let homes = 0;
  for (let i = 0; i < HOME_LOTS.length; i += 1) {
    const density = densityFor(i, units, HOME_LOTS.length);
    if (density <= 0) continue;
    const [x, y] = HOME_LOTS[i]!;
    place(x, y, { kind: "house", density, label: houseLabel(density) });
    homes += 1;
  }

  const towers = officeTowers(ledger);
  const shopsWanted = Math.min(shopCount(ledger), SHOP_LOTS.length - towers.total);
  for (let i = 0; i < shopsWanted; i += 1) {
    const [x, y] = SHOP_LOTS[i]!;
    place(x, y, { kind: "shop", density: 1, label: "Shops" });
  }
  // Busy towers sit deepest in the district; the ones nearest the shops go dark first.
  for (let i = 0; i < towers.total; i += 1) {
    const [x, y] = SHOP_LOTS[SHOP_LOTS.length - 1 - i]!;
    const busy = i < towers.busy;
    place(x, y, {
      kind: "office",
      density: busy ? 1 : 0,
      label: busy ? "Offices" : "Empty offices · the desk work went to AI",
    });
  }

  const works = worksOf(ledger);
  const energy = energyOf(ledger, works);
  let automatedPlants = 0;
  const putter = (slots: readonly Point[], kind: BuildingKind) => {
    let slot = 0;
    return (flags: { automated: boolean; staged: boolean }, label: string) => {
      const point = slots[slot];
      if (!point) return;
      const [x, y] = point;
      place(x, y, { kind, density: 1, automated: flags.automated, staged: flags.staged, label });
      slot += 1;
      if (flags.automated && !flags.staged && kind !== "battery") automatedPlants += 1;
    };
  };

  // Power: oil, then solar and its battery banks share the north-west yard; tidal sits in the sea.
  const yard = { slot: 0 };
  const putYard = (kind: BuildingKind, flags: { automated: boolean; staged: boolean }, label: string) => {
    const point = POWER_SLOTS[yard.slot];
    if (!point) return;
    const [x, y] = point;
    place(x, y, { kind, density: 1, automated: flags.automated, staged: flags.staged, label });
    yard.slot += 1;
    if (flags.automated && !flags.staged && kind !== "battery") automatedPlants += 1;
  };
  const putTidal = putter(TIDAL_SLOTS, "tidal");
  const closing = energy.retire > 0 ? (energy.fleet.oil.crew > 0 ? "crew" : "auto") : null;
  for (let i = 0; i < energy.fleet.oil.crew; i += 1) {
    const last = closing === "crew" && i === energy.fleet.oil.crew - 1;
    putYard("power", { automated: false, staged: false }, `Oil plant · staffed${last ? " · closing at year end" : ""}`);
  }
  for (let i = 0; i < energy.fleet.oil.auto; i += 1) {
    const last = closing === "auto" && i === energy.fleet.oil.auto - 1;
    putYard("power", { automated: true, staged: false }, `Oil plant · automated${last ? " · closing at year end" : ""}`);
  }
  for (let i = 0; i < energy.fleet.solar.crew; i += 1) putYard("solar", { automated: false, staged: false }, "Solar farm · staffed");
  for (let i = 0; i < energy.fleet.solar.auto; i += 1) putYard("solar", { automated: true, staged: false }, "Solar farm · automated");
  const batteries = batteryTiles(energy);
  for (let i = 0; i < batteries; i += 1) putYard("battery", { automated: false, staged: false }, "Battery bank");
  for (let i = 0; i < energy.fleet.tidal.crew; i += 1) putTidal({ automated: false, staged: false }, "Tidal station · staffed");
  for (let i = 0; i < energy.fleet.tidal.auto; i += 1) putTidal({ automated: true, staged: false }, "Tidal station · automated");
  const power = works.power;
  if (power.staged > 0) {
    const kind = energy.stagedKind;
    const label = `${POWER_LABEL[kind]} · under construction${power.stagedAuto ? " · automated" : ""}`;
    for (let i = 0; i < power.staged; i += 1) {
      if (kind === "tidal") putTidal({ automated: power.stagedAuto, staged: true }, label);
      else putYard(POWER_TILE[kind], { automated: power.stagedAuto, staged: true }, label);
    }
  }

  for (const id of ["water", "waste"] as const) {
    const slots = PLANT_SLOTS[id];
    const { staffed, automated, staged, stagedAuto } = plantKind(id, works[id]);
    const put = putter(slots, id);
    for (let i = 0; i < staffed; i += 1)
      put({ automated: false, staged: false }, `${PLANT_LABEL[id]} · staffed`);
    for (let i = 0; i < automated; i += 1)
      put({ automated: true, staged: false }, `${PLANT_LABEL[id]} · automated`);
    if (staged) {
      put(
        { automated: stagedAuto, staged: true },
        `${PLANT_LABEL[id]} · under construction${stagedAuto ? " · automated" : ""}`,
      );
    }
  }

  // Protest waves: blockades in the shop district and on industrial roads, looted shops shut for now.
  const wave = ledger.unrest?.wave ?? null;
  const hurt = waveDamage(wave, ledger.policies?.police ?? "normal");
  let protests = 0;
  let looted = 0;
  if (wave && wave.yearsLeft > 0) {
    const shopTiles = tiles.filter((tile) => tile.kind === "shop" || tile.kind === "office");
    const shut = Math.max(1, Math.round(shopsWanted * hurt.closed * 3));
    for (let i = 0; i < Math.min(shut, shopsWanted); i += 1) {
      const [x, y] = SHOP_LOTS[i]!;
      place(x, y, { density: 0, label: "Shops · looted, closed for now" });
      looted += 1;
    }
    const marched = Math.max(3, Math.round(shopTiles.length * Math.min(0.7, hurt.share * 4 + 0.1)));
    for (let i = 0; i < Math.min(marched, shopTiles.length); i += 1) {
      const tile = shopTiles[i]!;
      tile.protest = true;
      tile.label = `${tile.label} · protest blockade`;
      protests += 1;
    }
    const roads = tiles.filter((tile) => tile.zone === "industrial" && tile.kind === "empty" && tile.terrain === "land");
    const blocked = Math.round(roads.length * Math.min(0.4, hurt.share * 2));
    for (let i = 0; i < blocked; i += 1) {
      // Spread blockades along the industrial district, not in one clump.
      const tile = roads[Math.floor((i * roads.length) / Math.max(1, blocked))]!;
      tile.protest = true;
      tile.label = "Road blockade";
      protests += 1;
    }
  }

  const dataWanted = dataCenterCount(ledger);
  for (let i = 0; i < dataWanted; i += 1) {
    const [x, y] = DATA_SLOTS[i]!;
    place(x, y, { kind: "data", density: 1, label: "Data center" });
  }

  return {
    width: MAP_SIZE,
    height: MAP_SIZE,
    tiles,
    counts: {
      homes,
      homeUnits: Math.min(units, HOME_LOTS.length * 3),
      shops: shopsWanted,
      offices: towers.busy,
      emptyOffices: towers.total - towers.busy,
      protests,
      looted,
      docks: DOCKS.length,
      power: works.power.plants + works.power.auto,
      water: works.water.plants + works.water.auto,
      waste: works.waste.plants + works.waste.auto,
      data: dataWanted,
      automatedPlants,
      oil: energy.fleet.oil.crew + energy.fleet.oil.auto,
      solar: energy.fleet.solar.crew + energy.fleet.solar.auto,
      tidal: energy.fleet.tidal.crew + energy.fleet.tidal.auto,
      batteries,
    },
  };
}

export const MAP_LAYOUT = {
  homeLots: HOME_LOTS.length,
  shopLots: SHOP_LOTS.length,
  powerSlots: POWER_SLOTS.length,
  tidalSlots: TIDAL_SLOTS.length,
  waterSlots: WATER_SLOTS.length,
  wasteSlots: WASTE_SLOTS.length,
  dataSlots: DATA_SLOTS.length,
  peoplePerHomeUnit: PEOPLE_PER_HOME_UNIT,
};
