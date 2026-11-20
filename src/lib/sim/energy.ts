/**
 * Energy research tree and the city's power fleet.
 *
 * The city opens with oil plants that burn imported fuel. Research unlocks
 * solar farms, grid batteries, tidal turbines, larger plants, and cheaper
 * upkeep. Money here is in census coins; the engine scales it by the price index.
 */

export type PowerKind = "oil" | "solar" | "tidal";
export const POWER_KINDS: readonly PowerKind[] = ["oil", "solar", "tidal"];

export type ResearchId = "solar" | "upkeep" | "batteries" | "tidal" | "large" | "works";
export const RESEARCH_IDS: readonly ResearchId[] = ["solar", "upkeep", "batteries", "tidal", "large", "works"];

export type FleetCount = { crew: number; auto: number };
export type Fleet = Record<PowerKind, FleetCount>;

export type EnergyState = {
  /** Built power plants by type. Totals match works.power plants/auto. */
  fleet: Fleet;
  /** Type of the power plant(s) staged in works.power. */
  stagedKind: PowerKind;
  /** Years of funding each project has received. Done when it reaches the project's years. */
  research: Record<ResearchId, number>;
  /** Project funded at the next year close. */
  active: ResearchId | null;
  /** Real price of imported oil. 1 at the census. */
  oilPrice: number;
  /** Oil plants to close at the next year close (0 or 1). */
  retire: number;
};

/** Automated power plants run harder: more output for a tenth of the crew. */
export const AUTO_POWER_BOOST = 1.2;
export const AUTO_UPKEEP_SHARE = 0.5;
export const AUTO_CREW_SHARE = 0.1;
/** Solar counts for this share of its nameplate without storage, and more with batteries. */
export const SOLAR_FIRM = 0.5;
export const SOLAR_FIRM_BATTERY = 0.85;
/** Battery bank upkeep per solar farm, once batteries are researched. */
export const BATTERY_UPKEEP = 300_000;
export const SOLAR_PER_BATTERY_TILE = 3;
export const MAX_TIDAL = 8;
/** Large plants: oil and tidal output up, oil fuel up by less. */
export const LARGE_OUTPUT = 1.45;
export const LARGE_FUEL = 1.15;
/** Long-life plants: upkeep of every city plant falls by this share. */
export const UPKEEP_CUT = 0.3;
/** Efficient works: water and waste plants hold this much more. */
export const WORKS_BOOST = 1.4;
/** Real oil price drifts up a little each year and swings with world markets. */
export const OIL_DRIFT = 0.02;
export const OIL_SWING = 0.08;

export type PowerType = {
  id: PowerKind;
  name: string;
  plural: string;
  /** Firm megawatts from one staffed plant before research. */
  mw: number;
  buildCost: number;
  /** Yearly upkeep, without fuel. */
  upkeep: number;
  /** Yearly imported fuel at the census oil price. */
  fuel: number;
  crew: number;
  /** Plants of this type that can be staged in one year. */
  maxStage: number;
  needs: ResearchId | null;
  detail: string;
};

export const POWER_TYPES: Record<PowerKind, PowerType> = {
  oil: {
    id: "oil",
    name: "Oil plant",
    plural: "oil plants",
    mw: 55,
    buildCost: 96_000_000,
    upkeep: 1_500_000,
    fuel: 2_700_000,
    crew: 48,
    maxStage: 1,
    needs: null,
    detail: "Burns imported oil. Steady output, but the fuel bill follows world oil prices.",
  },
  solar: {
    id: "solar",
    name: "Solar farm",
    plural: "solar farms",
    mw: 36,
    buildCost: 28_000_000,
    upkeep: 800_000,
    fuel: 0,
    crew: 10,
    maxStage: 3,
    needs: "solar",
    detail: "No fuel and cheap to build. Without grid batteries a farm counts for half its panels. Up to three a year.",
  },
  tidal: {
    id: "tidal",
    name: "Tidal station",
    plural: "tidal stations",
    mw: 80,
    buildCost: 170_000_000,
    upkeep: 2_400_000,
    fuel: 0,
    crew: 30,
    maxStage: 1,
    needs: "tidal",
    detail: "Turbines in the harbor current. Expensive to build, steady, and no fuel. The shore has room for eight.",
  },
};

export type ResearchDef = {
  id: ResearchId;
  name: string;
  /** Years of funding needed. */
  years: number;
  /** Yearly cost at census prices. */
  cost: number;
  needs: ResearchId | null;
  unlocks: string;
};

export const RESEARCH: readonly ResearchDef[] = [
  {
    id: "solar",
    name: "Solar farms",
    years: 3,
    cost: 6_000_000,
    needs: null,
    unlocks: "Build solar farms: no fuel, cheap, up to three a year.",
  },
  {
    id: "upkeep",
    name: "Long-life plants",
    years: 2,
    cost: 5_000_000,
    needs: null,
    unlocks: "Every power, water, and waste plant costs 30% less to keep running.",
  },
  {
    id: "batteries",
    name: "Grid batteries",
    years: 3,
    cost: 8_000_000,
    needs: "solar",
    unlocks: "Battery banks store solar. Each farm counts for 85% of its panels instead of 50%.",
  },
  {
    id: "large",
    name: "Large plants",
    years: 3,
    cost: 9_000_000,
    needs: "upkeep",
    unlocks: "Bigger turbines. Oil and tidal plants make 45% more power, so you build less often.",
  },
  {
    id: "tidal",
    name: "Tidal turbines",
    years: 4,
    cost: 10_000_000,
    needs: "upkeep",
    unlocks: "Build tidal stations in the harbor: big, steady, and no fuel.",
  },
  {
    id: "works",
    name: "Efficient water and waste",
    years: 3,
    cost: 7_000_000,
    needs: "large",
    unlocks: "Water and waste plants handle 40% more.",
  },
];

export function researchDef(id: ResearchId): ResearchDef {
  return RESEARCH.find((item) => item.id === id)!;
}

function isResearchId(value: unknown): value is ResearchId {
  return typeof value === "string" && (RESEARCH_IDS as readonly string[]).includes(value);
}

function isPowerKind(value: unknown): value is PowerKind {
  return typeof value === "string" && (POWER_KINDS as readonly string[]).includes(value);
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function blankResearch(): Record<ResearchId, number> {
  return { solar: 0, upkeep: 0, batteries: 0, tidal: 0, large: 0, works: 0 };
}

export function freshEnergy(oilCrew = 4, oilAuto = 0): EnergyState {
  return {
    fleet: {
      oil: { crew: oilCrew, auto: oilAuto },
      solar: { crew: 0, auto: 0 },
      tidal: { crew: 0, auto: 0 },
    },
    stagedKind: "oil",
    research: blankResearch(),
    active: null,
    oilPrice: 1,
    retire: 0,
  };
}

/**
 * Accept saved energy, or build it for a city saved before research existed:
 * every existing power plant becomes an oil plant and nothing is researched.
 * Fleet totals are reconciled to the power plant counts so jobs and bills agree.
 */
export function asEnergy(raw: unknown, power: { plants: number; auto: number }): EnergyState {
  const base = freshEnergy(0, 0);
  const record = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : null;
  const fleetRaw =
    record && typeof record.fleet === "object" && record.fleet !== null
      ? (record.fleet as Record<string, unknown>)
      : null;
  const fleet: Fleet = { ...base.fleet };
  if (fleetRaw) {
    for (const kind of POWER_KINDS) {
      const item = fleetRaw[kind];
      const row = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
      fleet[kind] = { crew: count(row.crew), auto: count(row.auto) };
    }
  }
  const research = blankResearch();
  const researchRaw =
    record && typeof record.research === "object" && record.research !== null
      ? (record.research as Record<string, unknown>)
      : null;
  if (researchRaw) {
    for (const def of RESEARCH) research[def.id] = Math.min(def.years, count(researchRaw[def.id]));
  }
  // Reconcile with the plant totals, which older saves and the jobs math rely on.
  const wantCrew = count(power.plants);
  const wantAuto = count(power.auto);
  for (const key of ["crew", "auto"] as const) {
    const want = key === "crew" ? wantCrew : wantAuto;
    let have = POWER_KINDS.reduce((sum, kind) => sum + fleet[kind][key], 0);
    if (have < want) {
      fleet.oil = { ...fleet.oil, [key]: fleet.oil[key] + (want - have) };
      have = want;
    }
    for (const kind of ["oil", "solar", "tidal"] as const) {
      if (have <= want) break;
      const take = Math.min(fleet[kind][key], have - want);
      fleet[kind] = { ...fleet[kind], [key]: fleet[kind][key] - take };
      have -= take;
    }
  }
  const oilRaw = record?.oilPrice;
  const oilPrice =
    typeof oilRaw === "number" && Number.isFinite(oilRaw) && oilRaw > 0 ? Math.min(5, Math.max(0.3, oilRaw)) : 1;
  const activeRaw = record?.active;
  const active = isResearchId(activeRaw) && research[activeRaw] < researchDef(activeRaw).years ? activeRaw : null;
  const stagedKind = isPowerKind(record?.stagedKind) ? (record!.stagedKind as PowerKind) : "oil";
  const oilPlants = fleet.oil.crew + fleet.oil.auto;
  const retire = record?.retire === 1 && oilPlants > 0 ? 1 : 0;
  return { fleet, stagedKind, research, active, oilPrice, retire };
}

export function researchDone(energy: EnergyState, id: ResearchId): boolean {
  return (energy.research[id] ?? 0) >= researchDef(id).years;
}

export function researchOpen(energy: EnergyState, id: ResearchId): boolean {
  const def = researchDef(id);
  if (researchDone(energy, id)) return false;
  return def.needs == null || researchDone(energy, def.needs);
}

export type ResearchStatus = "done" | "active" | "open" | "locked";

export function researchStatus(energy: EnergyState, id: ResearchId): ResearchStatus {
  if (researchDone(energy, id)) return "done";
  if (energy.active === id) return "active";
  return researchOpen(energy, id) ? "open" : "locked";
}

export function kindUnlocked(energy: EnergyState, kind: PowerKind): boolean {
  const needs = POWER_TYPES[kind].needs;
  return needs == null || researchDone(energy, needs);
}

/** Firm megawatts from one plant of this type. */
export function plantMw(energy: EnergyState, kind: PowerKind, auto: boolean): number {
  let mw = POWER_TYPES[kind].mw;
  if (kind === "solar") mw *= researchDone(energy, "batteries") ? SOLAR_FIRM_BATTERY : SOLAR_FIRM;
  if ((kind === "oil" || kind === "tidal") && researchDone(energy, "large")) mw *= LARGE_OUTPUT;
  if (auto) mw *= AUTO_POWER_BOOST;
  return mw;
}

export function powerCapacity(energy: EnergyState): number {
  let total = 0;
  for (const kind of POWER_KINDS) {
    const row = energy.fleet[kind];
    total += row.crew * plantMw(energy, kind, false) + row.auto * plantMw(energy, kind, true);
  }
  return total;
}

export function plantCrew(kind: PowerKind, auto: boolean): number {
  const crew = POWER_TYPES[kind].crew;
  return auto ? crew * AUTO_CREW_SHARE : crew;
}

export function powerJobs(energy: EnergyState): number {
  let jobs = 0;
  for (const kind of POWER_KINDS) {
    const row = energy.fleet[kind];
    jobs += row.crew * plantCrew(kind, false) + row.auto * plantCrew(kind, true);
  }
  return Math.round(jobs);
}

export function upkeepFactor(energy: EnergyState | null | undefined): number {
  return energy && researchDone(energy, "upkeep") ? 1 - UPKEEP_CUT : 1;
}

export function worksFactor(energy: EnergyState | null | undefined): number {
  return energy && researchDone(energy, "works") ? WORKS_BOOST : 1;
}

/** Yearly upkeep of one plant, without fuel, in census coins. */
export function plantUpkeep(energy: EnergyState, kind: PowerKind, auto: boolean): number {
  let cost = POWER_TYPES[kind].upkeep * (auto ? AUTO_UPKEEP_SHARE : 1);
  if (kind === "solar" && researchDone(energy, "batteries")) cost += BATTERY_UPKEEP;
  return cost * upkeepFactor(energy);
}

/** Yearly fuel for one plant at this oil price, in census coins. Fuel follows output. */
export function plantFuel(energy: EnergyState, kind: PowerKind, auto: boolean, oilPrice = energy.oilPrice): number {
  const fuel = POWER_TYPES[kind].fuel;
  if (fuel <= 0) return 0;
  const large = kind === "oil" && researchDone(energy, "large") ? LARGE_FUEL : 1;
  return fuel * large * (auto ? AUTO_POWER_BOOST : 1) * oilPrice;
}

export function powerUpkeep(energy: EnergyState): number {
  let total = 0;
  for (const kind of POWER_KINDS) {
    const row = energy.fleet[kind];
    total += row.crew * plantUpkeep(energy, kind, false) + row.auto * plantUpkeep(energy, kind, true);
  }
  return Math.round(total);
}

export function fuelBill(energy: EnergyState, oilPrice = energy.oilPrice): number {
  const row = energy.fleet.oil;
  return Math.round(row.crew * plantFuel(energy, "oil", false, oilPrice) + row.auto * plantFuel(energy, "oil", true, oilPrice));
}

/** Share of firm power that burns oil. 0 when there is no power at all. */
export function oilShare(energy: EnergyState): number {
  const total = powerCapacity(energy);
  if (total <= 0) return 0;
  const oil = energy.fleet.oil;
  return (oil.crew * plantMw(energy, "oil", false) + oil.auto * plantMw(energy, "oil", true)) / total;
}

function swing(year: number): number {
  const s =
    Math.sin(year * 0.83 + 9.6) * 0.55 +
    Math.sin(year * 0.31 + 3.456) * 0.3 +
    Math.sin(year * 1.37 + 0.672) * 0.15;
  return Math.max(-1, Math.min(1, s / 0.8));
}

/** Next year's real oil price. Year 2 is the first year that moves. */
export function nextOilPrice(prev: number, year: number): number {
  const base = Number.isFinite(prev) && prev > 0 ? prev : 1;
  if (year <= 1) return base;
  const next = base * (1 + OIL_DRIFT + OIL_SWING * swing(year));
  return Math.round(Math.min(4, Math.max(0.6, next)) * 1000) / 1000;
}

/** Inflation pushed by a change in oil prices, weighted by how much of the grid burns oil. */
export function oilInflation(energy: EnergyState, nextPrice: number): number {
  const prev = energy.oilPrice > 0 ? energy.oilPrice : 1;
  const change = nextPrice / prev - 1;
  return Math.max(-0.008, Math.min(0.012, oilShare(energy) * change * 0.06));
}

/** Cost this year of the funded project, in census coins. */
export function researchBill(energy: EnergyState): number {
  if (!energy.active || researchStatus(energy, energy.active) !== "active") return 0;
  if (!researchOpen(energy, energy.active)) return 0;
  return researchDef(energy.active).cost;
}

/** Fund a project (or stop with null). Locked and finished projects are ignored. */
export function chooseResearch(energy: EnergyState, id: ResearchId | null): EnergyState {
  if (id == null) return { ...energy, active: null };
  if (!researchOpen(energy, id)) return energy;
  return { ...energy, active: energy.active === id ? null : id };
}

/** One funded year. Returns the project that finished, if any. */
export function tickResearch(energy: EnergyState, funded: boolean): { energy: EnergyState; finished: ResearchId | null } {
  const id = energy.active;
  if (!funded || !id || !researchOpen(energy, id)) return { energy, finished: null };
  const years = (energy.research[id] ?? 0) + 1;
  const research = { ...energy.research, [id]: years };
  const done = years >= researchDef(id).years;
  return { energy: { ...energy, research, active: done ? null : id }, finished: done ? id : null };
}

export function buildCost(kind: PowerKind, plants: number): number {
  return POWER_TYPES[kind].buildCost * Math.max(0, plants);
}

export function tidalCount(energy: EnergyState): number {
  return energy.fleet.tidal.crew + energy.fleet.tidal.auto;
}

export function solarCount(energy: EnergyState): number {
  return energy.fleet.solar.crew + energy.fleet.solar.auto;
}

/** Plants of a type that can still be staged now. */
export function stageRoom(energy: EnergyState, kind: PowerKind): number {
  if (!kindUnlocked(energy, kind)) return 0;
  if (kind === "tidal") return Math.max(0, Math.min(POWER_TYPES.tidal.maxStage, MAX_TIDAL - tidalCount(energy)));
  return POWER_TYPES[kind].maxStage;
}

export function oilCount(energy: EnergyState): number {
  return energy.fleet.oil.crew + energy.fleet.oil.auto;
}

/** The oil plant a retirement would close: a staffed one first. */
export function retireTarget(energy: EnergyState): { auto: boolean } | null {
  if (energy.fleet.oil.crew > 0) return { auto: false };
  if (energy.fleet.oil.auto > 0) return { auto: true };
  return null;
}

/** Close the staged oil plant. Returns the new fleet and whether it was automated. */
export function retireFleet(energy: EnergyState): { energy: EnergyState; closed: { auto: boolean } | null } {
  const target = energy.retire > 0 ? retireTarget(energy) : null;
  if (!target) return { energy: { ...energy, retire: 0 }, closed: null };
  const row = energy.fleet.oil;
  const oil = target.auto ? { ...row, auto: row.auto - 1 } : { ...row, crew: row.crew - 1 };
  return { energy: { ...energy, retire: 0, fleet: { ...energy.fleet, oil } }, closed: target };
}

/** Add staged plants to the fleet. */
export function commitFleet(energy: EnergyState, kind: PowerKind, plants: number, auto: boolean): EnergyState {
  if (plants <= 0) return energy;
  const row = energy.fleet[kind];
  return {
    ...energy,
    fleet: {
      ...energy.fleet,
      [kind]: auto ? { ...row, auto: row.auto + plants } : { ...row, crew: row.crew + plants },
    },
  };
}
