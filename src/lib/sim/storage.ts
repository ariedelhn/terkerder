import {
  asOwnership,
  asPublicHiring,
  asPolice,
  ensureTrail,
  type Gates,
  type Ledger,
  type Policies,
  type SectorId,
  type StatuteEvent,
  type TaxBand,
  type TechId,
  type TechState,
  type YearMark,
} from "./engine.ts";

const KEY = "vesper-ledger-v1";

const TAX: readonly TaxBand[] = ["low", "mid", "high"];
const GATES: readonly Gates[] = ["open", "steady", "tight"];
const TECHS: readonly TechId[] = [
  "housing",
  "transport",
  "food",
  "energy",
  "services",
  "government",
  "health",
  "education",
  "law",
  "office",
];
const SECTORS: readonly SectorId[] = [
  "housing",
  "transport",
  "food",
  "energy",
  "services",
  "government",
  "health",
  "education",
  "law",
  "office",
];

/**
 * Cities saved before the office sector existed: desk jobs were counted inside services,
 * transport, food, and government. Carve the same shares out so headcount is unchanged.
 */
const OFFICE_CARVE: Partial<Record<SectorId, number>> = {
  services: 2800 / 7800,
  transport: 400 / 5200,
  food: 400 / 6400,
  government: 400 / 3600,
};

const OLD_TECH: Record<string, TechId> = {
  cranes: "transport",
  clerks: "government",
  cells: "food",
  assist: "health",
  robots: "housing",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTechState(value: unknown): value is TechState {
  return isRecord(value) && typeof value.on === "boolean" && typeof value.activeYears === "number";
}

function isPolicies(value: unknown): value is Policies {
  return asPolicies(value) !== null;
}

/** Accept a policy block, filling in a safe ownership default when it is missing or damaged. */
export function asPolicies(value: unknown): Policies | null {
  if (!isRecord(value)) return null;
  if (!TAX.includes(value.tax as TaxBand)) return null;
  if (!GATES.includes(value.gates as Gates)) return null;
  if (typeof value.stipend !== "boolean") return null;
  if (typeof value.dividend !== "boolean") return null;
  if (typeof value.works !== "boolean") return null;
  if (typeof value.retrain !== "boolean") return null;
  if (typeof value.wageFloor !== "boolean") return null;
  return {
    tax: value.tax as TaxBand,
    gates: value.gates as Gates,
    stipend: value.stipend,
    dividend: value.dividend,
    works: value.works,
    retrain: value.retrain,
    wageFloor: value.wageFloor,
    ownership: asOwnership(value.ownership),
    publicHiring: asPublicHiring(value.publicHiring),
    aiLevy: value.aiLevy === true,
    police: asPolice(value.police),
  };
}

export function isLedger(value: unknown): value is Ledger {
  if (!isRecord(value) || value.version !== 1) return false;
  if (!isPolicies(value.policies)) return false;
  const techs = value.techs;
  if (!isRecord(techs)) return false;
  if (!TECHS.every((id) => isTechState(techs[id]))) return false;
  if (!Array.isArray(value.sectors) || value.sectors.length !== SECTORS.length) return false;
  const ids = value.sectors.map((sector) => (isRecord(sector) ? sector.id : null));
  if (!SECTORS.every((id) => ids.includes(id))) return false;
  return (
    typeof value.year === "number" &&
    typeof value.population === "number" &&
    typeof value.treasury === "number" &&
    typeof value.stability === "number" &&
    typeof value.unemployment === "number" &&
    typeof value.bulletin === "string"
  );
}

function isYearMark(value: unknown): value is YearMark {
  return (
    isRecord(value) &&
    typeof value.year === "number" &&
    typeof value.unemployment === "number" &&
    typeof value.population === "number" &&
    typeof value.stability === "number"
  );
}

function isEvent(value: unknown): value is StatuteEvent {
  return isRecord(value) && typeof value.year === "number" && typeof value.label === "string";
}

function isFlagMap(value: unknown): value is Record<TechId, boolean> {
  if (!isRecord(value)) return false;
  return TECHS.every((id) => typeof value[id] === "boolean");
}

function migrateCity(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.techs)) return value;
  if (isTechState(value.techs.housing)) return value;
  if (!isTechState(value.techs.cranes) && !isTechState(value.techs.transport)) return value;
  const techs: Record<string, TechState> = {};
  for (const id of TECHS) techs[id] = { on: false, activeYears: 0 };
  for (const [oldId, newId] of Object.entries(OLD_TECH)) {
    const tech = value.techs[oldId];
    if (isTechState(tech)) techs[newId] = { on: tech.on, activeYears: tech.activeYears };
  }
  const oldSectors = Array.isArray(value.sectors) ? value.sectors : [];
  const oldEmployed = oldSectors.reduce((sum, sector) => {
    if (!isRecord(sector) || typeof sector.employed !== "number") return sum;
    return sum + sector.employed;
  }, 0);
  const weights = [4200, 4800, 6000, 2800, 5000, 3200, 4800, 3400, 2400, 3800];
  const weightSum = weights.reduce((sum, n) => sum + n, 0);
  const total = oldEmployed > 0 ? oldEmployed : 40600;
  const sectors = SECTORS.map((id, index) => ({
    id,
    employed: Math.round((total * weights[index]!) / weightSum),
    wage: 40000,
    prevEmployed: null,
    automatons: 0,
  }));
  let enactedTech: unknown = value.enactedTech;
  if (isRecord(value.enactedTech) && typeof value.enactedTech.cranes === "boolean") {
    const flags: Record<string, boolean> = {};
    for (const id of TECHS) flags[id] = false;
    for (const [oldId, newId] of Object.entries(OLD_TECH)) {
      if (value.enactedTech[oldId] === true) flags[newId] = true;
    }
    enactedTech = flags;
  }
  const shadow = isRecord(value.shadow) ? migrateCity({ ...value.shadow, shadow: null, pace: null }) : value.shadow;
  return { ...value, techs, sectors, enactedTech, shadow };
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Add the office sector and its automation switch to a city saved before they existed. */
export function addOffice(value: unknown): unknown {
  if (!isRecord(value)) return value;
  let next: Record<string, unknown> = value;
  if (Array.isArray(value.sectors) && !value.sectors.some((sector) => isRecord(sector) && sector.id === "office")) {
    let moved = 0;
    let movedPrev = 0;
    let anyPrev = false;
    let serviceWage = 36_400;
    const sectors = value.sectors.map((sector) => {
      if (!isRecord(sector)) return sector;
      const share = OFFICE_CARVE[sector.id as SectorId] ?? 0;
      if (sector.id === "services" && num(sector.wage) > 0) serviceWage = num(sector.wage);
      if (share <= 0) return sector;
      const take = Math.round(num(sector.employed) * share);
      moved += take;
      const prev = typeof sector.prevEmployed === "number" ? sector.prevEmployed : null;
      let prevEmployed: number | null = prev;
      if (prev != null) {
        anyPrev = true;
        const prevTake = Math.round(prev * share);
        movedPrev += prevTake;
        prevEmployed = prev - prevTake;
      }
      const automatons = num(sector.automatons);
      return {
        ...sector,
        employed: num(sector.employed) - take,
        prevEmployed,
        automatons: Math.round(automatons * (1 - share)),
      };
    });
    sectors.push({
      id: "office",
      employed: moved,
      wage: Math.round((serviceWage * (52_000 / 36_400)) / 100) * 100,
      prevEmployed: anyPrev ? movedPrev : null,
      automatons: 0,
    });
    next = { ...next, sectors };
  }
  if (isRecord(next.techs) && !isTechState(next.techs.office)) {
    next = { ...next, techs: { ...next.techs, office: { on: false, activeYears: 0 } } };
  }
  if (isRecord(next.enactedTech) && typeof next.enactedTech.office !== "boolean") {
    next = { ...next, enactedTech: { ...next.enactedTech, office: false } };
  }
  if (isRecord(next.shadow)) next = { ...next, shadow: addOffice(next.shadow) };
  return next;
}

export function reviveLedger(parsed: unknown): Ledger | null {
  const migrated = addOffice(migrateCity(parsed));
  if (!isLedger(migrated)) return null;
  const loose = migrated as Ledger & {
    history?: unknown;
    events?: unknown;
    pace?: unknown;
    shadow?: unknown;
    enacted?: unknown;
    enactedTech?: unknown;
  };
  const shadow = loose.shadow && isLedger(loose.shadow) ? { ...loose.shadow, shadow: null, pace: null } : null;
  const policies = asPolicies(migrated.policies);
  if (!policies) return null;
  const enacted = asPolicies(loose.enacted) ?? undefined;
  return ensureTrail({
    ...migrated,
    policies,
    history: Array.isArray(loose.history) && loose.history.every(isYearMark) ? loose.history : [],
    events: Array.isArray(loose.events) && loose.events.every(isEvent) ? loose.events : [],
    shadow,
    pace: shadow && Array.isArray(loose.pace) && loose.pace.every(isYearMark) ? loose.pace : null,
    enacted,
    enactedTech: isFlagMap(loose.enactedTech) ? loose.enactedTech : undefined,
  });
}

export function loadLedger(): Ledger | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return reviveLedger(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLedger(ledger: Ledger): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ledger));
  } catch {
    // The ledger still runs for this visit if storage is full or blocked.
  }
}

// Spelled this way in v1; also read the corrected key so a later rename does not drop saves.
const SAVES_KEY = "terkerderr-saves-v1";
const SAVES_KEY_ALIAS = "terkerder-saves-v1";
export const MAX_SAVES = 8;

export type CitySave = {
  id: string;
  savedAt: number;
  note: string;
  year: number;
  reserve: number;
  net: number | null;
  stability: number;
  ledger: Ledger;
};

function clipNote(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 20);
}

function asSaves(raw: string | null): CitySave[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  const slots: CitySave[] = [];
  for (const item of parsed) {
    if (!isRecord(item) || typeof item.id !== "string") continue;
    const ledger = reviveLedger(item.ledger);
    if (!ledger) continue;
    slots.push({
      id: item.id,
      savedAt: typeof item.savedAt === "number" ? item.savedAt : 0,
      note: clipNote(item.note),
      year: ledger.year,
      reserve: ledger.treasury,
      net: ledger.hasClosedYear ? ledger.taxRevenue - ledger.spending : null,
      stability: Math.round(ledger.stability),
      ledger,
    });
  }
  return slots;
}

export function loadSaves(): CitySave[] {
  try {
    const primary = asSaves(localStorage.getItem(SAVES_KEY));
    if (primary.length > 0) return primary;
    return asSaves(localStorage.getItem(SAVES_KEY_ALIAS));
  } catch {
    return [];
  }
}

function writeSaves(saves: CitySave[]): void {
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
}

export function rememberCity(ledger: Ledger, note = ""): { saves: CitySave[]; full: boolean } {
  const existing = loadSaves();
  if (existing.length >= MAX_SAVES) return { saves: existing, full: true };
  const ledgerCopy = reviveLedger(JSON.parse(JSON.stringify(ledger)));
  if (!ledgerCopy) return { saves: existing, full: false };
  const slot: CitySave = {
    id: `save-${Date.now()}`,
    savedAt: Date.now(),
    note: clipNote(note),
    year: ledgerCopy.year,
    reserve: ledgerCopy.treasury,
    net: ledgerCopy.hasClosedYear ? ledgerCopy.taxRevenue - ledgerCopy.spending : null,
    stability: Math.round(ledgerCopy.stability),
    ledger: ledgerCopy,
  };
  const saves = [slot, ...existing];
  try {
    writeSaves(saves);
  } catch {
    return { saves: existing, full: true };
  }
  return { saves, full: false };
}

export function forgetSave(id: string): CitySave[] {
  const saves = loadSaves().filter((slot) => slot.id !== id);
  try {
    writeSaves(saves);
  } catch {
    return loadSaves();
  }
  return saves;
}
