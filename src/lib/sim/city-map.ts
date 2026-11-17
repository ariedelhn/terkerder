import {
  asPlant,
  openingWorks,
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

export type Terrain = "sea" | "river" | "land";
export type Zone = "residential" | "commercial" | "industrial" | "none";
export type BuildingKind =
  | "empty"
  | "house"
  | "shop"
  | "dock"
  | "power"
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
    docks: number;
    power: number;
    water: number;
    waste: number;
    data: number;
    automatedPlants: number;
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

  const shopsWanted = shopCount(ledger);
  for (let i = 0; i < shopsWanted; i += 1) {
    const [x, y] = SHOP_LOTS[i]!;
    place(x, y, { kind: "shop", density: 1, label: "Shops" });
  }

  const works = worksOf(ledger);
  let automatedPlants = 0;
  for (const id of ["power", "water", "waste"] as const) {
    const slots = PLANT_SLOTS[id];
    const { staffed, automated, staged, stagedAuto } = plantKind(id, works[id]);
    let slot = 0;
    const put = (flags: { automated: boolean; staged: boolean }, label: string) => {
      const point = slots[slot];
      if (!point) return;
      const [x, y] = point;
      place(x, y, {
        kind: id,
        density: 1,
        automated: flags.automated,
        staged: flags.staged,
        label,
      });
      slot += 1;
      if (flags.automated && !flags.staged) automatedPlants += 1;
    };
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
      docks: DOCKS.length,
      power: works.power.plants + works.power.auto,
      water: works.water.plants + works.water.auto,
      waste: works.waste.plants + works.waste.auto,
      data: dataWanted,
      automatedPlants,
    },
  };
}

export const MAP_LAYOUT = {
  homeLots: HOME_LOTS.length,
  shopLots: SHOP_LOTS.length,
  powerSlots: POWER_SLOTS.length,
  waterSlots: WATER_SLOTS.length,
  wasteSlots: WASTE_SLOTS.length,
  dataSlots: DATA_SLOTS.length,
  peoplePerHomeUnit: PEOPLE_PER_HOME_UNIT,
};
