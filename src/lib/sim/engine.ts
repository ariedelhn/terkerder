import {
  formatInt,
  formatMarks,
  formatPct,
  stabilityWord,
} from "./format.ts";
import {
  asEnergy,
  buildCost as powerBuildCost,
  commitFleet,
  freshEnergy,
  fuelBill,
  kindUnlocked,
  nextOilPrice,
  oilInflation,
  plantMw,
  retireFleet,
  retireTarget,
  powerCapacity,
  powerJobs,
  powerUpkeep,
  researchBill,
  researchDef,
  stageRoom,
  tickResearch,
  upkeepFactor,
  worksFactor,
  chooseResearch,
  POWER_TYPES,
  type EnergyState,
  type PowerKind,
  type ResearchId,
} from "./energy.ts";

export type { EnergyState, PowerKind, ResearchId } from "./energy.ts";

export const BASE_POP = 72_000;
export const PARTICIPATION = 0.6;
export const STANDING_PER_CAPITA = 5_200;
export const STIPEND_PER = 11_000;
export const DIVIDEND_PER = 1_200;
export const WORKS_AT_BASE = 26_000_000;
export const RETRAIN_AT_BASE = 18_000_000;
export const OPEN_TREASURY = 84_000_000;
export const OPEN_STABILITY = 72;
/** Census inflation, and the rate a balanced city tends toward. */
export const INFLATION_TARGET = 0.02;
/** Opening price level. The index is cumulative and starts here. */
export const PRICE_CENSUS = 100;
/** Share of this year's inflation that shows up in nominal pay the same year.
 * Near the 2% target most of the rise is passed through; high inflation still erodes real pay. */
export const WAGE_PASS_THROUGH = 0.85;
/** One machine produces this many human-years of goods. */
export const AUTOMATON_OUTPUT = 10;
/**
 * AI that firms adopt on their own is a drop-in replacement for a worker, not a rebuilt line:
 * each job it takes makes about twice the goods, not ten times.
 */
export const FIRM_AI_OUTPUT = 2;
/** Tax collected on machine profits, by who owns them. */
export const PROFIT_TAKE = { firms: 0.12, city: 0.42, citizens: 0.55 } as const;
/** Share of machine profits paid to residents when they own the machines. */
export const CITIZEN_PAYOUT = 0.45;

export type Ownership = keyof typeof PROFIT_TAKE;

export const OWNERSHIP_IDS: readonly Ownership[] = ["firms", "city", "citizens"];

/** Missing or damaged ownership falls back to firms so the books stay numeric. */
export function asOwnership(value: unknown): Ownership {
  return value === "city" || value === "citizens" || value === "firms" ? value : "firms";
}

export const TAX_RATES = { low: 0.22, mid: 0.26, high: 0.31 } as const;

export type TaxBand = keyof typeof TAX_RATES;
export type Gates = "open" | "steady" | "tight";
export type CharterId = "census" | "safety" | "docks";

export type SectorId =
  | "housing"
  | "transport"
  | "food"
  | "energy"
  | "services"
  | "government"
  | "health"
  | "education"
  | "law"
  | "office";
export type TechId =
  | "housing"
  | "transport"
  | "food"
  | "energy"
  | "services"
  | "government"
  | "health"
  | "education"
  | "law"
  | "office";

/** How hard the city hires into health, schools, and city hall to soak up displaced workers. */
export type PublicHiring = "off" | "some" | "big";

export const PUBLIC_HIRING_IDS: readonly PublicHiring[] = ["off", "some", "big"];

export function asPublicHiring(value: unknown): PublicHiring {
  return value === "some" || value === "big" ? value : "off";
}

export type Policies = {
  tax: TaxBand;
  gates: Gates;
  stipend: boolean;
  dividend: boolean;
  works: boolean;
  retrain: boolean;
  wageFloor: boolean;
  /** Who receives the profit the machines create. */
  ownership: Ownership;
  /** Public jobs in health, education, and government for displaced workers. Missing on older saves. */
  publicHiring: PublicHiring;
  /** A levy on AI that firms adopt on their own. Halves their pace. Missing on older saves. */
  aiLevy: boolean;
};

export type TechState = { on: boolean; activeYears: number };

export type SectorSnap = {
  id: SectorId;
  employed: number;
  wage: number;
  prevEmployed: number | null;
  /** Machines that replaced workers. Each one makes ten times the goods. */
  automatons: number;
};

export type Transition = {
  /** Adults still out of the automated industries. */
  laidOff: number;
  /** People moving into the new jobs. Zero unless retraining is on. */
  retraining: number;
  /** Jobs that exist only because the machines exist. */
  tenders: number;
};

export type SpendParts = {
  standing: number;
  stipend: number;
  dividend: number;
  works: number;
  retrain: number;
  services: number;
  interest: number;
  construction: number;
  principal: number;
  /** Energy research funded this year. Missing on older saves. */
  research: number;
  /** Wages of the extra public jobs hired to soak up displaced workers. Missing on older saves. */
  publicJobs: number;
};

export type ServiceId = "power" | "water" | "waste";

export type ServicePlant = {
  plants: number;
  auto: number;
  staged: number;
  stagedAuto: boolean;
};

export type Works = Record<ServiceId, ServicePlant>;

export type ServiceCover = Record<ServiceId, number>;

export const LOAN_SIZE = 80_000_000;
export const LOAN_RATE = 0.07;
export const LOAN_STEP = 0.005;
export const LOAN_TERM = 10;

export type CityLoan = {
  id: string;
  name: string;
  rate: number;
  original: number;
  balance: number;
  paid: number;
  term: number;
  payment: number;
};

/** Crew on one staffed plant. Automated plants keep a tenth of that. */
export const PLANT_CREW: Record<ServiceId, number> = {
  power: 48,
  water: 36,
  waste: 42,
};
export const AUTO_JOB_SHARE = 0.1;
export const AUTO_COST_SHARE = 0.5;

export const SERVICES: readonly {
  id: ServiceId;
  name: string;
  unit: string;
  perResident: number;
  perJob: number;
  plant: number;
  opening: number;
  buildCost: number;
  yearlyCost: number;
  detail: string;
}[] = [
  {
    id: "power",
    name: "Power",
    unit: "MW",
    perResident: 0.00155,
    perJob: 0.00105,
    plant: 55,
    opening: 4,
    buildCost: 96_000_000,
    yearlyCost: 4_200_000,
    detail: "A shortfall cuts shifts. A staffed plant hires a crew. An automated one hires about a tenth of that.",
  },
  {
    id: "water",
    name: "Water",
    unit: "ML",
    perResident: 0.00018,
    perJob: 0.00004,
    plant: 5.5,
    opening: 3,
    buildCost: 72_000_000,
    yearlyCost: 3_000_000,
    detail: "A shortfall slows arrivals. A staffed works hires a crew. Automation keeps a tenth of those jobs.",
  },
  {
    id: "waste",
    name: "Waste",
    unit: "t",
    perResident: 0.00105,
    perJob: 0.00032,
    plant: 32,
    opening: 3,
    buildCost: 64_000_000,
    yearlyCost: 2_600_000,
    detail: "Overflow brings protests. A staffed plant hires a crew. An automated plant costs half as much to run.",
  },
];

export function openingWorks(): Works {
  return {
    power: { plants: 4, auto: 0, staged: 0, stagedAuto: false },
    water: { plants: 3, auto: 0, staged: 0, stagedAuto: false },
    waste: { plants: 3, auto: 0, staged: 0, stagedAuto: false },
  };
}

export function asPlant(raw: Partial<ServicePlant> | undefined, fallback?: ServicePlant): ServicePlant {
  const base = fallback ?? { plants: 0, auto: 0, staged: 0, stagedAuto: false };
  return {
    plants: typeof raw?.plants === "number" ? raw.plants : base.plants,
    auto: typeof raw?.auto === "number" ? raw.auto : 0,
    staged: typeof raw?.staged === "number" ? raw.staged : 0,
    stagedAuto: raw?.stagedAuto === true,
  };
}

export function plantUnits(plant: ServicePlant): number {
  return plant.plants + plant.auto;
}

export function plantJobs(id: ServiceId, plant: ServicePlant, energy?: EnergyState | null): number {
  if (id === "power" && energy) return powerJobs(energy);
  const crew = PLANT_CREW[id];
  return Math.round(plant.plants * crew + plant.auto * crew * AUTO_JOB_SHARE);
}

export function utilityJobs(works: Works, energy?: EnergyState | null): number {
  return SERVICES.reduce((sum, def) => sum + plantJobs(def.id, asPlant(works[def.id]), energy), 0);
}

/** Fixed yearly payment on a fully amortizing loan. */
export function loanPayment(principal: number, rate: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  if (rate <= 0) return Math.round(principal / years);
  const growth = (1 + rate) ** years;
  return Math.round((principal * rate * growth) / (growth - 1));
}

export function nextLoanRate(openLoans: number): number {
  const raw = LOAN_RATE + Math.max(0, openLoans) * LOAN_STEP;
  return Math.round(raw * 10000) / 10000;
}

/** A, B, … Z, then AA, AB, and so on, so names never collide. */
export function loanLetters(index: number): string {
  let n = index;
  let name = "";
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

function loanName(loans: CityLoan[]): string {
  const used = new Set(loans.map((loan) => loan.name));
  let index = 0;
  while (used.has(loanLetters(index))) index += 1;
  return loanLetters(index);
}

export function makeLoan(loans: CityLoan[], principal = LOAN_SIZE): CityLoan {
  const rate = nextLoanRate(loans.length);
  return {
    id: `loan-${Date.now()}-${loans.length}`,
    name: loanName(loans),
    rate,
    original: principal,
    balance: principal,
    paid: 0,
    term: LOAN_TERM,
    payment: loanPayment(principal, rate, LOAN_TERM),
  };
}

export function debtOf(loans: CityLoan[]): number {
  return loans.reduce((sum, loan) => sum + loan.balance, 0);
}

/** This year's bill. The last year clears whatever rounding is left. */
export function dueThisYear(loan: CityLoan): { interest: number; principal: number } {
  const yearsLeft = loan.term - loan.paid;
  if (yearsLeft <= 0 || loan.balance <= 0) return { interest: 0, principal: 0 };
  const interest = Math.round(loan.balance * loan.rate);
  if (yearsLeft === 1) return { interest, principal: loan.balance };
  const principal = Math.min(loan.balance, Math.max(0, loan.payment - interest));
  return { interest, principal };
}

export function interestRemaining(loan: CityLoan): number {
  let balance = loan.balance;
  let left = loan.term - loan.paid;
  let interest = 0;
  while (left > 0 && balance > 0) {
    const due =
      left === 1
        ? { interest: Math.round(balance * loan.rate), principal: balance }
        : {
            interest: Math.round(balance * loan.rate),
            principal: Math.min(balance, Math.max(0, loan.payment - Math.round(balance * loan.rate))),
          };
    interest += due.interest;
    balance -= due.principal;
    left -= 1;
  }
  return interest;
}

export function serviceLoans(loans: CityLoan[]): { interest: number; principal: number; loans: CityLoan[] } {
  let interest = 0;
  let principal = 0;
  const next: CityLoan[] = [];
  for (const loan of loans) {
    const due = dueThisYear(loan);
    interest += due.interest;
    principal += due.principal;
    const balance = loan.balance - due.principal;
    if (balance > 1 && loan.paid + 1 < loan.term) {
      next.push({ ...loan, balance, paid: loan.paid + 1 });
    }
  }
  return { interest, principal, loans: next };
}

export function serviceDemand(id: ServiceId, pop: number, jobs: number, year = 1, machines = 0): number {
  const def = SERVICES.find((item) => item.id === id)!;
  const appetite = 1 + Math.max(0, year - 1) * 0.012;
  const machine =
    id === "power" ? machines * 0.014 : id === "water" ? machines * 0.00028 : machines * 0.0015;
  return (def.perResident * pop + def.perJob * jobs + machine) * appetite;
}

export function serviceCapacity(id: ServiceId, plants: number): number {
  const def = SERVICES.find((item) => item.id === id)!;
  return def.plant * plants;
}

/** Built capacity. Power depends on the plant mix and research; water and waste on research. */
export function capacityOf(id: ServiceId, works: Works, energy?: EnergyState | null): number {
  if (id === "power" && energy) return powerCapacity(energy);
  return serviceCapacity(id, plantUnits(asPlant(works[id]))) * (id === "power" ? 1 : worksFactor(energy));
}

/** Capacity one staged plant (or batch) adds next year. */
export function stagedCapacity(id: ServiceId, works: Works, energy?: EnergyState | null): number {
  const plant = asPlant(works[id]);
  if (id === "power" && energy) {
    const target = energy.retire > 0 ? retireTarget(energy) : null;
    const lost = target ? plantMw(energy, "oil", target.auto) : 0;
    const added = plant.staged > 0 ? plant.staged * plantMw(energy, energy.stagedKind, plant.stagedAuto) : 0;
    return added - lost;
  }
  if (plant.staged <= 0) return 0;
  return serviceCapacity(id, 1) * (id === "power" ? 1 : worksFactor(energy));
}

export function serviceCover(id: ServiceId, pop: number, jobs: number, plants: number, year = 1, machines = 0): number {
  const demand = serviceDemand(id, pop, jobs, year, machines);
  if (demand <= 0) return 1;
  return serviceCapacity(id, plants) / demand;
}

function coverFrom(id: ServiceId, capacity: number, pop: number, jobs: number, year: number, machines: number): number {
  const demand = serviceDemand(id, pop, jobs, year, machines);
  if (demand <= 0) return 1;
  return capacity / demand;
}

export function coverOf(
  pop: number,
  jobs: number,
  works: Works,
  year = 1,
  machines = 0,
  energy?: EnergyState | null,
): ServiceCover {
  return {
    power: coverFrom("power", capacityOf("power", works, energy), pop, jobs, year, machines),
    water: coverFrom("water", capacityOf("water", works, energy), pop, jobs, year, machines),
    waste: coverFrom("waste", capacityOf("waste", works, energy), pop, jobs, year, machines),
  };
}

export type ServiceOutlook = {
  demand: number;
  capacity: number;
  cover: number;
  nextDemand: number;
  nextCover: number;
};

/** This year's use, and next year's coverage if no new plant opens. */
export function serviceOutlook(state: Ledger, id: ServiceId): ServiceOutlook {
  const machines = machineCount(state);
  const demand = serviceDemand(id, state.population, state.employed, state.year, machines);
  const energy = state.energy ?? null;
  const capacity = capacityOf(id, state.works, energy);
  const cover = demand <= 0 ? 1 : capacity / demand;
  const nextPop = nextPopulation(state);
  const nextJobs = Math.round(state.employed * (nextPop / Math.max(1, state.population)));
  const nextDemand = serviceDemand(id, nextPop, nextJobs, state.year + 1, machines + stagedMachines(state));
  const nextCapacity = capacity + stagedCapacity(id, state.works, energy);
  const nextCover = nextDemand <= 0 ? 1 : nextCapacity / nextDemand;
  return { demand, capacity, cover, nextDemand, nextCover };
}

export function crimeIndex(unemployment: number, worstCover: number, needsMet = true): number {
  const fromJobs = Math.max(0, unemployment - 0.04) * 220;
  const fromShortage = Math.max(0, 1 - worstCover) * 55;
  const fromNeed = !needsMet && unemployment > 0.07 ? (unemployment - 0.07) * 90 : 0;
  return clamp(Math.round(fromJobs + fromShortage + fromNeed), 0, 100);
}

export function willProtest(
  covers: ServiceCover,
  unemployment: number,
  stability: number,
  needsMet = false,
): boolean {
  if (covers.waste < 0.9 || covers.power < 0.88 || covers.water < 0.9) return true;
  if (needsMet) return false;
  return stability < 42 && unemployment > 0.16;
}

export type YearMark = {
  year: number;
  unemployment: number;
  avgWage: number;
  taxRevenue: number;
  spending: number;
  stability: number;
  population: number;
  treasury: number;
  employed: number;
  /** People looking for work. Missing on cities saved before ages were counted. */
  laborForce?: number;
  /** Yearly running cost of each utility. Missing on years saved before the split. */
  powerCost?: number;
  waterCost?: number;
  wasteCost?: number;
  /** 100 is the opening census. Cumulative price level. */
  priceIndex?: number;
  profit?: number;
  realWage?: number;
  /** Yearly inflation rate, e.g. 0.02 for 2%. */
  inflation?: number;
  /** Real price of imported oil, 1 at the census. */
  oilPrice?: number;
  /** Real output in census coins. Drives the expected-jobs line. Missing on older years. */
  output?: number;
  /** Unemployment among teens and people in their early twenties. */
  youthUnemployment?: number;
  /** Jobs firms have handed to AI on their own. */
  aiJobs?: number;
  /** Extra public jobs filled to soak up displaced workers. */
  publicJobs?: number;
};

export type AiState = {
  /** Share of each sector's jobs firms have handed to AI on their own, 0 up to that sector's ceiling. */
  adoption: Record<SectorId, number>;
  /** Young entrants shut out because firms stopped refilling jobs. Fades as those cohorts age. */
  youthGap: number;
};

export type JobsView = {
  /** Teens and people in their early twenties who are looking for work. */
  youthLooking: number;
  youthUnemployed: number;
  youthUnemployment: number;
  /** Jobs firms have handed to AI on their own, at today's city size. */
  aiJobs: number;
  /** Positions that came open this year and were not refilled because AI took the work. */
  frozen: number;
  /** Extra public jobs filled in health, education, and government. */
  publicJobs: number;
  /** Displaced office workers who took lower-paid service and shop work. */
  downshift: number;
  /** Displaced office workers still without work. They are louder than most. */
  officeJobless: number;
  /** Real output in census coins. */
  output: number;
};

/**
 * How far and how fast firms hand each sector's work to AI on their own, at full maturity.
 * Desk work goes first and furthest; hands-on and public work much later or never.
 * Government and police are city jobs: only the player automates those.
 */
export const FIRM_AI: Record<SectorId, { ceiling: number; speed: number }> = {
  office: { ceiling: 0.55, speed: 0.05 },
  services: { ceiling: 0.3, speed: 0.018 },
  transport: { ceiling: 0.3, speed: 0.015 },
  food: { ceiling: 0.28, speed: 0.013 },
  energy: { ceiling: 0.22, speed: 0.01 },
  housing: { ceiling: 0.14, speed: 0.006 },
  health: { ceiling: 0.1, speed: 0.004 },
  education: { ceiling: 0.08, speed: 0.003 },
  government: { ceiling: 0, speed: 0 },
  law: { ceiling: 0, speed: 0 },
};
/** Firms adopt slower when they keep less of the profit. */
export const OWNER_AI_PACE: Record<Ownership, number> = { firms: 1, city: 0.75, citizens: 0.65 };
/** The AI levy halves firm adoption and taxes a further slice of machine profit. */
export const LEVY_PACE = 0.5;
export const LEVY_TAKE = 0.06;
/** Share of unfilled positions that would have gone to young entrants. */
export const ENTRY_SHARE = 0.55;
/** Share of last year's shut-out youth who are still young and still shut out. */
export const YOUTH_GAP_FADE = 0.7;
/** Share of looking adults who are in their early twenties. */
const YOUNG_ADULT_SHARE = 0.11;
/** Share of displaced office workers who go after service and shop jobs. */
export const DOWNSHIFT_SHARE = 0.4;
/** Public hiring: share of displaced workers absorbed, a floor, and a cap as a share of the labor force. */
export const PUBLIC_HIRING: Record<Exclude<PublicHiring, "off">, { share: number; floor: number; cap: number }> = {
  some: { share: 0.3, floor: 350, cap: 0.035 },
  big: { share: 0.6, floor: 800, cap: 0.075 },
};
const PUBLIC_SPLIT: Partial<Record<SectorId, number>> = { health: 0.45, education: 0.35, government: 0.2 };
/** Benefits and supervision on top of each public wage. */
export const PUBLIC_JOB_OVERHEAD = 1.1;
/** Measured real output counts one machine as this many worker-years: what it makes keeps getting cheaper. */
export const AI_GDP_WEIGHT = 3;
/** Jobs per unit of output growth when there is too little pre-AI history to measure it. */
export const OKUN_ELASTICITY = 1;
const PRIVATE_SECTORS: ReadonlySet<SectorId> = new Set<SectorId>(["housing", "transport", "food", "energy", "services", "office"]);

export function blankAdoption(): Record<SectorId, number> {
  return {
    housing: 0,
    transport: 0,
    food: 0,
    energy: 0,
    services: 0,
    government: 0,
    health: 0,
    education: 0,
    law: 0,
    office: 0,
  };
}

export function freshAi(): AiState {
  return { adoption: blankAdoption(), youthGap: 0 };
}

/** Accept saved AI state or start fresh, clamping damaged numbers so the books stay numeric. */
export function asAi(raw: unknown): AiState {
  const base = freshAi();
  if (typeof raw !== "object" || raw === null) return base;
  const record = raw as Record<string, unknown>;
  const adoption = base.adoption;
  const rawAdoption = typeof record.adoption === "object" && record.adoption !== null ? (record.adoption as Record<string, unknown>) : {};
  for (const id of Object.keys(adoption) as SectorId[]) {
    const value = rawAdoption[id];
    adoption[id] = typeof value === "number" && Number.isFinite(value) ? clampNum(value, 0, FIRM_AI[id].ceiling) : 0;
  }
  const gap = record.youthGap;
  return { adoption, youthGap: typeof gap === "number" && Number.isFinite(gap) && gap > 0 ? gap : 0 };
}

function clampNum(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** How capable and cheap AI is for firms. Slow at first, half way by year 10, near full by 20. */
export function aiMaturity(year: number): number {
  return 1 / (1 + Math.exp(-(year - 10) / 3.5));
}

/**
 * One year of firms handing work to AI on their own. Tight labor and high wages push them faster;
 * a slack market slows them. Sharing the profit, or the levy, slows them too.
 */
export function nextAdoption(
  adoption: Record<SectorId, number>,
  year: number,
  policies: Pick<Policies, "ownership" | "aiLevy">,
  prevUnemployment: number,
): Record<SectorId, number> {
  const next = blankAdoption();
  const owner = OWNER_AI_PACE[asOwnership(policies.ownership)];
  const levy = policies.aiLevy ? LEVY_PACE : 1;
  const u = Number.isFinite(prevUnemployment) ? prevUnemployment : 0.06;
  const labor = 1 + clampNum((0.06 - u) * 5, -0.35, 0.25);
  const pace = aiMaturity(year) * owner * levy * labor;
  for (const id of Object.keys(next) as SectorId[]) {
    const { ceiling, speed } = FIRM_AI[id];
    const share = clampNum(adoption[id] ?? 0, 0, ceiling);
    if (ceiling <= 0) continue;
    const room = 1 - share / ceiling;
    next[id] = clampNum(share + speed * pace * room, 0, ceiling);
  }
  return next;
}

/** Public jobs wanted this year for a given number of displaced workers. */
export function publicHires(mode: PublicHiring, displaced: number, pop: number): number {
  if (mode === "off") return 0;
  const rule = PUBLIC_HIRING[mode];
  const scale = Math.max(0.2, pop / BASE_POP);
  const cap = rule.cap * BASE_POP * PARTICIPATION * scale;
  return Math.round(Math.min(cap, Math.max(rule.floor * scale, Math.max(0, displaced) * rule.share)));
}

export type JobsGap = { expected: number; actual: number; gap: number; elasticity: number };

/**
 * Jobs the city "should" have given how much its real output grew, Okun-style.
 * The elasticity is measured on early years before AI took a real share of output; with too little
 * of that history it defaults to 1, since the game has no other source of productivity growth.
 * Capped at full employment: growth cannot promise more jobs than there are people looking.
 */
export function jobsGapSeries(history: readonly YearMark[]): (JobsGap & { year: number })[] {
  const marks = history.filter((mark) => typeof mark.output === "number" && (mark.output ?? 0) > 0);
  if (marks.length === 0) return [];
  const anchor = marks[0]!;
  const y0 = anchor.output!;
  const e0 = Math.max(1, anchor.employed);
  let elasticity = OKUN_ELASTICITY;
  const early = marks.filter((mark) => (mark.aiJobs ?? 0) < mark.employed * 0.01 && mark.year > anchor.year);
  const sample = early.filter((mark) => Math.abs(Math.log(mark.output! / y0)) > 0.02);
  if (sample.length >= 3) {
    let num = 0;
    let den = 0;
    for (const mark of sample) {
      const ly = Math.log(mark.output! / y0);
      num += ly * Math.log(Math.max(1, mark.employed) / e0);
      den += ly * ly;
    }
    if (den > 0) elasticity = clampNum(num / den, 0.6, 1.2);
  }
  return marks.map((mark) => {
    const looking = mark.laborForce ?? Math.round(mark.population * PARTICIPATION);
    const raw = e0 * Math.pow(mark.output! / y0, elasticity);
    const expected = Math.round(Math.min(raw, looking * 0.97));
    return { year: mark.year, expected, actual: mark.employed, gap: expected - mark.employed, elasticity };
  });
}

/** Latest missing-jobs gap, or null when there is no output history yet. */
export function jobsGap(history: readonly YearMark[]): JobsGap | null {
  const series = jobsGapSeries(history);
  return series.length > 0 ? series[series.length - 1]! : null;
}

export type AgeId = "children" | "teens" | "adults" | "seniors";

export type Ages = Record<AgeId, number> & {
  looking: Record<AgeId, number>;
};

/** Headcount shares. They sum to 1 and, with the looking rates, to a 60% labor force. */
const AGE_SHARE: Record<AgeId, number> = {
  children: 0.18,
  teens: 0.08,
  adults: 0.6,
  seniors: 0.14,
};

const TEEN_LOOK = 0.4;
const SENIOR_LOOK = 0.1;
const ADULT_LOOK =
  (PARTICIPATION - AGE_SHARE.teens * TEEN_LOOK - AGE_SHARE.seniors * SENIOR_LOOK) / AGE_SHARE.adults;

export const AGE_BANDS: readonly { id: AgeId; label: string; detail: string }[] = [
  { id: "children", label: "Children", detail: "Under 15. Not counted." },
  { id: "teens", label: "Teens", detail: "15–19. Some are looking." },
  { id: "adults", label: "Adults", detail: "20–64. Most are looking." },
  { id: "seniors", label: "Seniors", detail: "65 and older. A few still work." },
];

/** Split residents into ages, then decide who is looking. That sum is the labor force. */
export function cityAges(pop: number, participation: number): Ages {
  const children = Math.round(pop * AGE_SHARE.children);
  const teens = Math.round(pop * AGE_SHARE.teens);
  const seniors = Math.round(pop * AGE_SHARE.seniors);
  const adults = Math.max(0, pop - children - teens - seniors);
  const teenLooking = Math.round(teens * TEEN_LOOK);
  const seniorLooking = Math.round(seniors * SENIOR_LOOK);
  const baseLooking = teenLooking + Math.round(adults * ADULT_LOOK) + seniorLooking;
  const target = clamp(Math.round(pop * participation), 1, Math.max(1, pop));
  let adultLooking = Math.round(adults * ADULT_LOOK) + (target - baseLooking);
  adultLooking = clamp(adultLooking, Math.round(adults * 0.7), Math.round(adults * 0.98));
  return {
    children,
    teens,
    adults,
    seniors,
    looking: { children: 0, teens: teenLooking, adults: adultLooking, seniors: seniorLooking },
  };
}

export function lookingCount(ages: Ages): number {
  return ages.looking.teens + ages.looking.adults + ages.looking.seniors;
}

export type StatuteEvent = {
  year: number;
  label: string;
};

export type Ledger = {
  version: 1;
  year: number;
  population: number;
  treasury: number;
  stability: number;
  unemployment: number;
  avgWage: number;
  taxRevenue: number;
  spending: number;
  spend: SpendParts;
  employed: number;
  laborForce: number;
  ages: Ages;
  sectors: SectorSnap[];
  policies: Policies;
  techs: Record<TechId, TechState>;
  works: Works;
  /** Power plant mix, energy research, and the oil price. */
  energy: EnergyState;
  /** AI that firms adopt on their own, and the young people it shuts out. */
  ai: AiState;
  /** This year's AI and labor detail: youth jobless, frozen hiring, public jobs, downshift. */
  jobs: JobsView;
  /** 100 at the opening census. Cumulative price level. */
  priceIndex: number;
  /** Yearly inflation rate, e.g. 0.02 for 2%. */
  inflation: number;
  /** Nominal wage scale vs the census. Lags the price level. */
  wageScale: number;
  /** Profit left after wages. Taxed, or paid out, depending on ownership. */
  profit: number;
  /** Nominal wage divided by the price index / 100. What a paycheck buys. */
  realWage: number;
  transition: Transition;
  loans: CityLoan[];
  debt: number;
  crime: number;
  protest: boolean;
  covers: ServiceCover;
  bulletin: string;
  hasClosedYear: boolean;
  deltas: {
    unemployment: number | null;
    avgWage: number | null;
    taxRevenue: number | null;
    stability: number | null;
  };
  /** Closed years, including the opening census. */
  history: YearMark[];
  /** Statutes on the year they took effect, not the year they were switched. */
  events: StatuteEvent[];
  /** Rules that produced the current year's books. Edits stay on `policies` until the next close. */
  enacted: Policies;
  enactedTech: Record<TechId, boolean>;
  /**
   * City carried forward under the statutes from before the latest change.
   * Null until a statute actually takes effect.
   */
  shadow: Ledger | null;
  /** KPI path of `shadow`, one mark per year since the latest statute. */
  pace: YearMark[] | null;
};

type SectorDef = {
  id: SectorId;
  name: string;
  detail: string;
  baseSlots: number;
  baseWage: number;
  exposure: number;
  tech: TechId;
};

export const SECTORS: readonly SectorDef[] = [
  {
    id: "housing",
    name: "Housing",
    detail: "Construction and real estate.",
    baseSlots: 4200,
    baseWage: 42_800,
    exposure: 0.55,
    tech: "housing",
  },
  {
    id: "transport",
    name: "Transportation",
    detail: "Public transit, private carriers, and logistics.",
    baseSlots: 4800,
    baseWage: 46_200,
    exposure: 0.8,
    tech: "transport",
  },
  {
    id: "food",
    name: "Food chain",
    detail: "Agriculture, food factories, and grocery stores.",
    baseSlots: 6000,
    baseWage: 31_200,
    exposure: 0.48,
    tech: "food",
  },
  {
    id: "energy",
    name: "Energy",
    detail: "Fossil fuels and renewables.",
    baseSlots: 2800,
    baseWage: 52_000,
    exposure: 0.7,
    tech: "energy",
  },
  {
    id: "services",
    name: "Services",
    detail: "Shops, repairs, and private services.",
    baseSlots: 5000,
    baseWage: 36_400,
    exposure: 0.4,
    tech: "services",
  },
  {
    id: "government",
    name: "Government",
    detail: "Permits, the tax desk, and city administration.",
    baseSlots: 3200,
    baseWage: 44_600,
    exposure: 0.35,
    tech: "government",
  },
  {
    id: "health",
    name: "Health",
    detail: "Clinics, care, and public health.",
    baseSlots: 4800,
    baseWage: 40_200,
    exposure: 0.22,
    tech: "health",
  },
  {
    id: "education",
    name: "Education",
    detail: "Schools and training.",
    baseSlots: 3400,
    baseWage: 38_800,
    exposure: 0.28,
    tech: "education",
  },
  {
    id: "law",
    name: "Law enforcement",
    detail: "Police and the courts.",
    baseSlots: 2400,
    baseWage: 41_000,
    exposure: 0.18,
    tech: "law",
  },
  {
    id: "office",
    name: "Office work",
    detail: "Professional and business services, finance, and tech. The desk jobs.",
    baseSlots: 3800,
    baseWage: 52_000,
    exposure: 0.62,
    tech: "office",
  },
];

export const TECHS: readonly {
  id: TechId;
  name: string;
  sectorId: SectorId;
  detail: string;
}[] = [
  {
    id: "housing",
    name: "Site machines",
    sectorId: "housing",
    detail: "Machines take heavy construction. Each one makes ten times the goods. Homes get cheaper. Crews are fired, and the profit goes to whoever owns the machines.",
  },
  {
    id: "transport",
    name: "Auto freight",
    sectorId: "transport",
    detail: "Yards and routes run with far fewer crews. Freight gets cheaper, and the profit is real. The people who lost the shift need a way to buy it.",
  },
  {
    id: "food",
    name: "Food lines",
    sectorId: "food",
    detail: "Factories and packing lines replace crews. Food gets cheaper for everyone else. The laid-off adults do not eat the surplus unless someone pays them.",
  },
  {
    id: "energy",
    name: "Plant controls",
    sectorId: "energy",
    detail: "Controls run the plants. Output jumps. The wage bill collapses, and so does most of the tax from this industry.",
  },
  {
    id: "services",
    name: "Service desks",
    sectorId: "services",
    detail: "Routine service moves to machines. Customers pay less. Workers in the industry lose the shift.",
  },
  {
    id: "government",
    name: "Clerk models",
    sectorId: "government",
    detail: "Filing and routine permits move to models. The tax desk keeps some people. The rest of the city gets faster service.",
  },
  {
    id: "health",
    name: "Care assistants",
    sectorId: "health",
    detail: "Notes and routing are automated. Hands-on care mostly stays. A mild cut, and cheaper basic care.",
  },
  {
    id: "education",
    name: "School tutors",
    sectorId: "education",
    detail: "Drills and grading move to tutors. Classrooms keep teachers. Fees and class sizes ease.",
  },
  {
    id: "law",
    name: "Case systems",
    sectorId: "law",
    detail: "Paperwork is automated. Patrols stay. The smallest job loss, and a little more capacity on the street.",
  },
  {
    id: "office",
    name: "Office models",
    sectorId: "office",
    detail: "AI drafts, codes, books, and answers. Firms stop replacing the people who leave, and the newest hires are the first not taken on.",
  },
];

export const CHARTERS: readonly {
  id: CharterId;
  name: string;
  detail: string;
}[] = [
  {
    id: "census",
    name: "Opening census",
    detail: "Mid tax, steady gates, no programs, no automation.",
  },
  {
    id: "safety",
    name: "Safety first",
    detail: "High tax, a jobless stipend, and public works. No automation.",
  },
  {
    id: "docks",
    name: "Dock statute",
    detail: "Low tax, open gates, freight automation staged. No stipend.",
  },
];

const NEUTRAL: Policies = {
  tax: "mid",
  gates: "steady",
  stipend: false,
  dividend: false,
  works: false,
  retrain: false,
  wageFloor: false,
  ownership: "firms",
  publicHiring: "off",
  aiLevy: false,
};

const OPEN_EMPLOYED = SECTORS.reduce((sum, sector) => sum + sector.baseSlots, 0);
const OPEN_LF = Math.round(BASE_POP * PARTICIPATION);
const OPEN_TIGHTNESS = OPEN_EMPLOYED / OPEN_LF;
const OPEN_WAGE_FACTOR = 0.74 + OPEN_TIGHTNESS * 0.34;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function emptySpend(): SpendParts {
  return {
    standing: 0,
    stipend: 0,
    dividend: 0,
    works: 0,
    retrain: 0,
    services: 0,
    interest: 0,
    construction: 0,
    principal: 0,
    research: 0,
    publicJobs: 0,
  };
}

export function freshTechs(): Record<TechId, TechState> {
  const techs = {} as Record<TechId, TechState>;
  for (const tech of TECHS) techs[tech.id] = { on: false, activeYears: 0 };
  return techs;
}

function policiesFor(charter: CharterId): Policies {
  if (charter === "safety") {
    return { ...NEUTRAL, tax: "high", stipend: true, works: true };
  }
  if (charter === "docks") {
    return { ...NEUTRAL, tax: "low", gates: "open" };
  }
  return { ...NEUTRAL };
}

function techsFor(charter: CharterId): Record<TechId, TechState> {
  const techs = freshTechs();
  if (charter === "docks") techs.transport = { on: true, activeYears: 0 };
  return techs;
}

function ramp(years: number): number {
  if (years <= 0) return 0;
  if (years === 1) return 0.4;
  if (years === 2) return 0.72;
  return 1;
}

function intensityOf(sector: SectorDef, techs: Record<TechId, TechState>): number {
  const tech = techs[sector.tech];
  if (!tech.on || tech.activeYears <= 0) return 0;
  return sector.exposure * ramp(tech.activeYears);
}

function scaleOf(pop: number): number {
  return pop / BASE_POP;
}

/** Jobs do not all scale with headcount. The port has limited berths. */
const JOB_ELASTICITY: Record<SectorId, number> = {
  housing: 0.84,
  transport: 0.74,
  food: 0.95,
  energy: 0.7,
  services: 0.96,
  government: 0.9,
  health: 1.04,
  education: 1.02,
  law: 0.88,
  office: 1,
};

function peopleScale(pop: number, elasticity: number): number {
  const ratio = Math.max(0.2, pop / BASE_POP);
  return Math.pow(ratio, elasticity);
}

function wave(year: number, salt: number): number {
  const s =
    Math.sin(year * 0.62 + salt) * 0.55 +
    Math.sin(year * 0.27 + salt * 1.9) * 0.32 +
    Math.sin(year * 1.11 + salt * 0.47) * 0.16;
  return clamp(s / 0.78, -1, 1);
}

type YearForces = {
  slot: Record<SectorId, number>;
  participation: number;
  friction: number;
  migration: number;
  trade: number;
  pay: number;
};

/**
 * Pressures that move the city even when statutes do not.
 * Year 1 is the census: flat, so the opening books stay a clean baseline.
 */
function flatSlots(): Record<SectorId, number> {
  return {
    housing: 1,
    transport: 1,
    food: 1,
    energy: 1,
    services: 1,
    government: 1,
    health: 1,
    education: 1,
    law: 1,
    office: 1,
  };
}

function yearForces(year: number): YearForces {
  if (year <= 1) {
    return {
      slot: flatSlots(),
      participation: 0,
      friction: 0.032,
      migration: 0,
      trade: 1,
      pay: 1,
    };
  }
  const freight = wave(year, 0.4);
  const housing = wave(year, 2.15);
  const food = wave(year, 3.7);
  const energy = wave(year, 5.05);
  const services = wave(year, 1.25);
  const entry = wave(year, 6.6);
  const quits = wave(year, 7.8);
  const migrants = wave(year, 8.9);
  const pay = wave(year, 4.35);

  return {
    slot: {
      housing: clamp(1 + housing * 0.09, 0.86, 1.14),
      transport: clamp(1 + freight * 0.055, 0.9, 1.1),
      food: clamp(1 + food * 0.045, 0.92, 1.08),
      energy: clamp(1 + energy * 0.04, 0.93, 1.07),
      services: clamp(1 + services * 0.03, 0.94, 1.06),
      government: clamp(1 + wave(year, 9.2) * 0.015, 0.97, 1.03),
      health: clamp(1 + wave(year, 1.8) * 0.02, 0.96, 1.05),
      education: clamp(1 + wave(year, 2.8) * 0.015, 0.97, 1.04),
      law: clamp(1 + wave(year, 4.1) * 0.02, 0.96, 1.04),
      office: clamp(1 + wave(year, 10.3) * 0.03, 0.95, 1.05),
    },
    participation: entry * 0.011,
    friction: clamp(0.034 + quits * 0.012, 0.028, 0.05),
    migration: migrants * 0.0015,
    trade: clamp(1 + freight * 0.045, 0.94, 1.06),
    pay: clamp(1 + pay * 0.02, 0.975, 1.025),
  };
}

export function programCosts(pop: number, unemployed: number): SpendParts {
  const scale = scaleOf(pop);
  return {
    standing: Math.round(pop * STANDING_PER_CAPITA),
    stipend: Math.round(unemployed * STIPEND_PER),
    dividend: Math.round(pop * DIVIDEND_PER),
    works: Math.round(WORKS_AT_BASE * scale),
    retrain: Math.round(RETRAIN_AT_BASE * scale),
    services: 0,
    interest: 0,
    construction: 0,
    principal: 0,
    research: 0,
    publicJobs: 0,
  };
}

export function worksJobCount(pop: number): number {
  const scale = scaleOf(pop);
  return Math.round(1500 * scale) + Math.round(700 * scale);
}

type Project = {
  sectors: SectorSnap[];
  employed: number;
  laborForce: number;
  ages: Ages;
  unemployed: number;
  unemployment: number;
  avgWage: number;
  taxRevenue: number;
  spending: number;
  spend: SpendParts;
  wanted: number;
  automatons: number;
  priceIndex: number;
  inflation: number;
  wageScale: number;
  /** Automation abundance, 1 at the census. Used as a disinflationary force, not the CPI. */
  goodsRatio: number;
  profit: number;
  realWage: number;
  transition: Transition;
  jobs: JobsView;
  youthGap: number;
};

/** Share of a sector's work done by machines: the player's automation or firms' own AI, whichever is further along. */
function displacedShare(
  sector: SectorDef,
  techs: Record<TechId, TechState>,
  adoption?: Record<SectorId, number> | null,
): number {
  return Math.max(intensityOf(sector, techs), adoption?.[sector.id] ?? 0);
}

/** Goods per machine in a sector: the player's rebuilt lines make ten workers' worth, firms' drop-in AI about two. */
function machineOutput(
  sector: SectorDef,
  techs: Record<TechId, TechState>,
  adoption?: Record<SectorId, number> | null,
): number {
  const gone = displacedShare(sector, techs, adoption);
  if (gone <= 0) return AUTOMATON_OUTPUT;
  const firm = firmOnlyShare(sector, techs, adoption) / gone;
  return firm * FIRM_AI_OUTPUT + (1 - firm) * AUTOMATON_OUTPUT;
}

/** Share of a sector's jobs firms took on their own, beyond what the player automated. */
function firmOnlyShare(
  sector: SectorDef,
  techs: Record<TechId, TechState>,
  adoption?: Record<SectorId, number> | null,
): number {
  return Math.max(0, (adoption?.[sector.id] ?? 0) - intensityOf(sector, techs));
}

/** Share of displaced workers who have a new job. Grows over several years, only if retraining is on. */
function absorption(techs: Record<TechId, TechState>, policies: Policies): number {
  if (!policies.retrain) return 0;
  let years = 0;
  let weight = 0;
  for (const sector of SECTORS) {
    const tech = techs[sector.tech];
    if (!tech?.on || tech.activeYears <= 0) continue;
    years += tech.activeYears * sector.baseSlots;
    weight += sector.baseSlots;
  }
  if (weight <= 0) return 0;
  const avgYears = years / weight;
  return (1 - Math.pow(0.7, avgYears)) * 0.55;
}

/** 1.00 is the census. Machines make goods abundant; this is a disinflationary force, not the CPI. */
export function priceRatio(techs: Record<TechId, TechState>, adoption?: Record<SectorId, number> | null): number {
  let base = 0;
  let output = 0;
  for (const sector of SECTORS) {
    const gone = displacedShare(sector, techs, adoption);
    const humans = sector.baseSlots * (1 - gone);
    const machines = gone > 0 && gone < 0.98 ? sector.baseSlots * gone : 0;
    base += sector.baseSlots;
    output += humans + machines * machineOutput(sector, techs, adoption);
  }
  if (base <= 0) return 1;
  return clamp(1 / Math.pow(output / base, 0.35), 0.55, 1.08);
}

export type PriceDrivers = {
  prevInflation: number;
  unemployment: number;
  covers: ServiceCover;
  goodsRatio: number;
  prevGoodsRatio: number;
  gdp: number;
  deficit: number;
  transfers: number;
  moneyFinancing: number;
  /** Inflation pushed by imported oil prices. */
  oilShock?: number;
};

/** This year's inflation rate. A balanced city stays near the 2% target. */
export function yearInflation(input: PriceDrivers): number {
  const prev = Number.isFinite(input.prevInflation) ? input.prevInflation : INFLATION_TARGET;
  const inertia = clamp(0.55 + clamp((prev - 0.04) * 2, 0, 0.3), 0.45, 0.85);
  const expected = inertia * prev + (1 - inertia) * INFLATION_TARGET;

  const u = input.unemployment;
  const nairu = 0.05;
  let phillips = 0.25 * (nairu - u);
  if (u < 0.03) phillips += (0.03 - u) * 0.6;
  phillips = clamp(phillips, -0.015, 0.025);

  const gdp = Math.max(input.gdp, 1);
  const deficitRatio = input.deficit / gdp;
  const transferRatio = Math.max(0, input.transfers) / gdp;
  const moneyRatio = Math.max(0, input.moneyFinancing) / gdp;
  let demand = 0.14 * deficitRatio + 0.22 * moneyRatio + 0.07 * transferRatio;
  if (deficitRatio > 0.15) demand += 0.35 * (deficitRatio - 0.15);
  if (moneyRatio > 0.1) demand += 0.3 * (moneyRatio - 0.1);

  const covers = input.covers;
  const shortfall =
    Math.max(0, 1 - (covers.power ?? 1)) +
    Math.max(0, 1 - (covers.water ?? 1)) +
    Math.max(0, 1 - (covers.waste ?? 1));
  const supply = 0.07 * shortfall;

  const abundanceLevel = (input.goodsRatio - 1) * 0.02;
  const abundanceDelta = Math.min(0, input.goodsRatio - input.prevGoodsRatio) * 0.1;

  const oil = Number.isFinite(input.oilShock) ? (input.oilShock ?? 0) : 0;

  return clamp(expected + phillips + demand + supply + oil + abundanceLevel + abundanceDelta, -0.08, 1.2);
}

export function nextPriceIndex(prev: number, inflation: number): number {
  const base = Number.isFinite(prev) && prev > 0 ? prev : PRICE_CENSUS;
  return clamp(base * (1 + inflation), 20, 1_000_000);
}

export function wagePassThrough(inflation: number): number {
  if (inflation > 0.05) return 0.5;
  if (inflation > 0.035) return 0.65;
  return WAGE_PASS_THROUGH;
}

export function nextWageScale(prev: number, inflation: number): number {
  const base = Number.isFinite(prev) && prev > 0 ? prev : 1;
  return Math.max(0.2, base * (1 + wagePassThrough(inflation) * inflation));
}


function machineCount(state: Pick<Ledger, "sectors">): number {
  return state.sectors.reduce((sum, sector) => sum + (sector.automatons ?? 0), 0);
}

function stagedMachines(state: Pick<Ledger, "techs">): number {
  let extra = 0;
  for (const sector of SECTORS) {
    const tech = state.techs[sector.tech];
    if (tech?.on && tech.activeYears <= 0) extra += Math.round(sector.baseSlots * sector.exposure * 0.4);
  }
  return extra;
}

type Demand = {
  slots: number[];
  /** Public jobs added to each sector by the public hiring lever. */
  sponge: number[];
  displaced: number;
  officeDisplaced: number;
  downshift: number;
  absorb: number;
};

function desiredSlots(
  pop: number,
  policies: Policies,
  techs: Record<TechId, TechState>,
  year: number,
  climate?: number,
  works?: Works,
  energy?: EnergyState | null,
  adoption?: Record<SectorId, number> | null,
): Demand {
  const forces = yearForces(year);
  const cheap = clamp(1 - priceRatio(techs, adoption), 0, 0.45);
  const absorb = absorption(techs, policies);
  let displacedJobs = 0;
  let machineTotal = 0;
  let officeDisplaced = 0;
  const ownMachines = SECTORS.map((sector) => {
    const scale = peopleScale(pop, JOB_ELASTICITY[sector.id]);
    const gone = displacedShare(sector, techs, adoption);
    const machines = sector.baseSlots * scale * gone;
    displacedJobs += sector.baseSlots * scale * gone;
    if (sector.id === "office") officeDisplaced = sector.baseSlots * scale * gone;
    machineTotal += machines;
    return machines;
  });
  // Displaced desk workers go after shop and service jobs; some get them.
  const downshift = officeDisplaced * DOWNSHIFT_SHARE * (1 - absorb);
  const hires = publicHires(asPublicHiring(policies.publicHiring), displacedJobs, pop);
  const sponge = SECTORS.map((sector) => hires * (PUBLIC_SPLIT[sector.id] ?? 0));
  const slots = SECTORS.map((sector, index) => {
    const gone = displacedShare(sector, techs, adoption);
    let slots = sector.baseSlots * peopleScale(pop, JOB_ELASTICITY[sector.id]) * forces.slot[sector.id];
    slots *= 1 - gone;
    if (policies.tax === "high") slots *= 0.98;
    if (policies.tax === "low") slots *= 1.015;
    if (sector.id === "transport") {
      if (policies.gates === "open") slots *= 1.08;
      if (policies.gates === "tight") slots *= 0.95;
    } else if (policies.gates === "open") {
      slots *= 1.03;
    } else if (policies.gates === "tight") {
      slots *= 0.985;
    }
    if (
      policies.wageFloor &&
      (sector.id === "transport" || sector.id === "services" || sector.id === "government")
    ) {
      slots *= 0.96;
    }
    if (gone < 0.2) slots *= 1 + cheap * 0.22;
    const people = scaleOf(pop);
    if (sector.id === "housing" && policies.works) slots += 1500 * people;
    if (sector.id === "health" && policies.works) slots += 400 * people;
    if (sector.id === "education" && policies.works) slots += 300 * people;
    if (sector.id === "government" && policies.retrain) slots += 420 * people;
    slots += (ownMachines[index] ?? 0) * 0.02;
    if (sector.id === "services") slots += machineTotal * 0.05 + downshift * 0.5;
    if (policies.aiLevy && PRIVATE_SECTORS.has(sector.id)) slots *= 0.99;
    slots += sponge[index] ?? 0;
    if (
      absorb > 0 &&
      (sector.id === "services" || sector.id === "health" || sector.id === "education")
    ) {
      slots += (displacedJobs * absorb) / 3;
    }
    // City plants are real jobs: power crews in energy, water and waste in government.
    if (works) {
      if (sector.id === "energy") slots += plantJobs("power", asPlant(works.power), energy);
      if (sector.id === "government") {
        slots += plantJobs("water", asPlant(works.water));
        slots += plantJobs("waste", asPlant(works.waste));
      }
    }
    return Math.max(0, slots * (climate ?? 1));
  });
  return { slots, sponge, displaced: displacedJobs, officeDisplaced, downshift, absorb };
}

function sumOf(values: readonly number[]): number {
  return values.reduce((sum, n) => sum + n, 0);
}

/** Largest-remainder split so the parts add up to `total`. */
function scaleTo(weights: readonly number[], total: number): number[] {
  const safeTotal = Math.max(0, Math.round(total));
  const weight = sumOf(weights);
  if (safeTotal === 0 || weight <= 0) return weights.map(() => 0);
  const raw = weights.map((n) => (n * safeTotal) / weight);
  const floors = raw.map((n) => Math.floor(n));
  let left = safeTotal - sumOf(floors);
  const order = raw
    .map((n, index) => ({ index, frac: n - Math.floor(n) }))
    .sort((a, b) => b.frac - a.frac);
  for (const item of order) {
    if (left <= 0) break;
    floors[item.index] = (floors[item.index] ?? 0) + 1;
    left -= 1;
  }
  return floors;
}

function project(args: {
  pop: number;
  policies: Policies;
  techs: Record<TechId, TechState>;
  year: number;
  prevEmployed: Map<SectorId, number> | null;
  prevUnemployment: number | null;
  /** When false, unemployment may jump. Statutes and new automation steps use that. */
  gentle: boolean;
  climate: number;
  serviceSpend: { services: number; interest: number; principal: number; construction: number; research?: number };
  works: Works;
  energy?: EnergyState | null;
  oilShock?: number;
  /** Last year's cumulative price index (100 at census). */
  priceLevel?: number;
  /** Last year's nominal wage scale (1 at census). */
  wageScale?: number;
  prevInflation?: number;
  prevTechs?: Record<TechId, TechState>;
  covers?: ServiceCover;
  treasury?: number;
  /** Opening census: keep prices at 100 and inflation at the target. */
  freezePrices?: boolean;
  /** Firms' own AI this year, and last year's, for frozen hiring. */
  adoption?: Record<SectorId, number> | null;
  prevAdoption?: Record<SectorId, number> | null;
  prevYouthGap?: number;
}): Project {
  const forces = yearForces(args.year);
  let participation = PARTICIPATION + forces.participation;
  const priorU = args.prevUnemployment;
  if (priorU != null) {
    if (priorU < 0.05) participation += 0.008;
    else if (priorU < 0.065) participation += 0.003;
    if (priorU > 0.14) participation -= 0.014;
    else if (priorU > 0.1) participation -= 0.006;
  }
  if (args.policies.stipend && (priorU ?? 0) > 0.08) participation += 0.004;
  if (args.policies.gates === "open") participation += 0.004;
  if (args.policies.gates === "tight") participation -= 0.006;
  const shock = priceRatio(args.techs, args.adoption);
  if (shock < 0.97) participation -= (0.97 - shock) * 0.03;
  if (args.policies.retrain && shock < 0.98) participation += 0.006;
  participation = clamp(participation, 0.55, 0.68);

  const ages = cityAges(args.pop, participation);
  const laborForce = Math.max(1, lookingCount(ages));
  const demand = desiredSlots(
    args.pop,
    args.policies,
    args.techs,
    args.year,
    args.climate,
    args.works,
    args.energy,
    args.adoption,
  );
  const wantedRaw = demand.slots;
  const wanted = Math.round(sumOf(wantedRaw));
  const fillCap = Math.max(0, Math.round(laborForce * (1 - forces.friction)));
  const structuralTotal = Math.min(wanted, fillCap, laborForce);
  const structuralU = (laborForce - structuralTotal) / laborForce;

  let employedTarget = structuralTotal;
  if (args.gentle && priorU != null && args.prevEmployed) {
    const sway = wave(args.year, 11.7);
    const cap = clamp(0.009 + sway * 0.007, 0.004, 0.018);
    const uStar = clamp(structuralU, priorU - cap, priorU + cap);
    employedTarget = clamp(Math.round(laborForce * (1 - uStar)), 0, laborForce);
  }

  const prevCounts = args.prevEmployed
    ? SECTORS.map((sector) => args.prevEmployed?.get(sector.id) ?? 0)
    : null;
  const employedCounts = blendEmployment(wantedRaw, prevCounts, structuralTotal, employedTarget);
  const employed = sumOf(employedCounts);
  const tightness = employed / laborForce;
  let factor = clamp(0.74 + tightness * 0.34, 0.66, 1.36);
  if (args.policies.wageFloor) factor = Math.max(factor, OPEN_WAGE_FACTOR * 1.08);
  const relative = factor / OPEN_WAGE_FACTOR;

  // Overqualified desk workers crowd into shops and services and push that pay down.
  const servicesIndex = SECTORS.findIndex((sector) => sector.id === "services");
  const servicesSlots = Math.max(1, wantedRaw[servicesIndex] ?? 1);
  const downPay = 1 - clamp((demand.downshift / servicesSlots) * 0.5, 0, 0.18);
  const sectors: SectorSnap[] = SECTORS.map((sector, index) => {
    const gone = displacedShare(sector, args.techs, args.adoption);
    const humans = employedCounts[index] ?? 0;
    const automatons = gone <= 0 || gone >= 0.98 ? 0 : Math.round((humans * gone) / (1 - gone));
    const premium = 1 + intensityOf(sector, args.techs) * 0.28;
    const squeeze = sector.id === "services" ? downPay : 1;
    const wage =
      Math.round((sector.baseWage * relative * premium * squeeze * forces.pay * (args.wageScale ?? 1)) / 100) * 100;
    const prev = args.prevEmployed?.get(sector.id);
    return {
      id: sector.id,
      employed: humans,
      wage,
      prevEmployed: prev ?? null,
      automatons,
    };
  });

  const wageBill0 = sectors.reduce((sum, sector) => sum + sector.employed * sector.wage, 0);
  const goodsRatio = priceRatio(args.techs, args.adoption);
  const spongeFilled = SECTORS.map((_, index) => {
    const want = wantedRaw[index] ?? 0;
    const sponge = demand.sponge[index] ?? 0;
    if (sponge <= 0 || want <= 0) return 0;
    return sponge * Math.min(1, (employedCounts[index] ?? 0) / want);
  });
  const publicJobs = Math.round(sumOf(spongeFilled));
  const automatons = sectors.reduce((sum, sector) => sum + sector.automatons, 0);
  const outputUnits = sectors.reduce(
    (sum, sector, index) => sum + sector.employed + sector.automatons * machineOutput(SECTORS[index]!, args.techs, args.adoption),
    0,
  );
  const prevPrice = args.priceLevel ?? PRICE_CENSUS;
  const prevWageScale = args.wageScale ?? 1;
  const priceLevel0 = prevPrice;
  function booksFor(
    wageSectors: SectorSnap[],
    wageScale: number,
    priceIndex: number,
  ): { avgWage: number; profit: number; taxRevenue: number; spend: SpendParts; spending: number } {
    const wageBill = wageSectors.reduce((sum, sector) => sum + sector.employed * sector.wage, 0);
    const avgWage = employed > 0 ? wageBill / employed : 0;
    const goods =
      outputUnits * avgWage * (priceIndex / (PRICE_CENSUS * Math.max(wageScale, 0.2)));
    const profit = Math.max(0, Math.round(goods - wageBill));
    let humanBase = 0;
    for (let index = 0; index < SECTORS.length; index += 1) {
      const sector = SECTORS[index]!;
      const snap = wageSectors[index]!;
      let activity = 1;
      if (sector.id === "transport") activity *= forces.trade;
      if (sector.id === "transport" && args.policies.gates === "open") activity *= 1.05;
      if (sector.id === "transport" && args.policies.gates === "tight") activity *= 0.97;
      if (sector.id === "housing") activity *= forces.slot.housing;
      humanBase += snap.employed * snap.wage * activity;
    }
    const band = args.policies.tax === "high" ? 1.12 : args.policies.tax === "low" ? 0.88 : 1;
    const ownership = asOwnership(args.policies.ownership);
    const levy = args.policies.aiLevy ? LEVY_TAKE : 0;
    const profitTax = Math.round(profit * (PROFIT_TAKE[ownership] + levy) * band);
    const taxRevenue = Math.round(humanBase * TAX_RATES[args.policies.tax]) + profitTax;
    const unemployed = Math.max(0, laborForce - employed);
    const cola = priceIndex / PRICE_CENSUS;
    const costs = programCosts(args.pop, unemployed);
    let dividend = args.policies.dividend ? Math.round(costs.dividend * cola) : 0;
    if (ownership === "citizens") dividend += Math.round(profit * CITIZEN_PAYOUT);
    const spend: SpendParts = {
      // Standing services are mostly public pay, so they rise with wages rather than with every price.
      standing: Math.round(costs.standing * Math.max(wageScale, 0.2)),
      stipend: args.policies.stipend ? Math.round(costs.stipend * cola) : 0,
      dividend,
      works: args.policies.works ? Math.round(costs.works * cola) : 0,
      retrain: args.policies.retrain ? Math.round(costs.retrain * cola) : 0,
      services: Math.round(args.serviceSpend.services * cola),
      interest: args.serviceSpend.interest,
      construction: Math.round(args.serviceSpend.construction * cola),
      principal: args.serviceSpend.principal,
      research: Math.round((args.serviceSpend.research ?? 0) * cola),
      publicJobs: Math.round(
        wageSectors.reduce((sum, sector, index) => sum + (spongeFilled[index] ?? 0) * sector.wage, 0) * PUBLIC_JOB_OVERHEAD,
      ),
    };
    const spending = spendTotal(spend);
    return { avgWage, profit, taxRevenue, spend, spending };
  }

  const first = booksFor(sectors, prevWageScale, priceLevel0);
  const unemployment = first && employed >= 0 ? (laborForce - employed) / laborForce : 0;
  const unemployed = Math.max(0, laborForce - employed);
  let inflation = args.prevInflation ?? INFLATION_TARGET;
  let priceIndex = priceLevel0;
  let wageScale = prevWageScale;
  let pricedSectors = sectors;
  let priced = first;

  if (!args.freezePrices) {
    const covers = args.covers ?? { power: 1, water: 1, waste: 1 };
    const gap = (args.treasury ?? 0) + first.taxRevenue - first.spending;
    const moneyFinancing = gap < 0 ? Math.min(8, Math.ceil(-gap / LOAN_SIZE)) * LOAN_SIZE : 0;
    inflation = yearInflation({
      prevInflation: args.prevInflation ?? INFLATION_TARGET,
      unemployment,
      covers,
      goodsRatio,
      prevGoodsRatio: priceRatio(args.prevTechs ?? args.techs, args.prevAdoption ?? args.adoption),
      gdp: wageBill0 + first.profit,
      deficit: first.spending - first.taxRevenue,
      transfers: first.spend.stipend + first.spend.dividend + first.spend.works,
      moneyFinancing,
      oilShock: args.oilShock,
    });
    priceIndex = nextPriceIndex(priceLevel0, inflation);
    wageScale = nextWageScale(prevWageScale, inflation);
    const wageLift = wageScale / Math.max(prevWageScale, 1e-9);
    pricedSectors = sectors.map((sector) => ({
      ...sector,
      wage: Math.round((sector.wage * wageLift) / 100) * 100,
    }));
    priced = booksFor(pricedSectors, wageScale, priceIndex);
  }

  // Firms stop refilling the jobs AI now does. Most of those openings would have gone to young entrants.
  const scaleNow = (sector: SectorDef) => sector.baseSlots * peopleScale(args.pop, JOB_ELASTICITY[sector.id]);
  let frozen = 0;
  let aiJobs = 0;
  for (const sector of SECTORS) {
    const now = firmOnlyShare(sector, args.techs, args.adoption);
    const before = Math.max(0, (args.prevAdoption?.[sector.id] ?? args.adoption?.[sector.id] ?? 0) - intensityOf(sector, args.techs));
    aiJobs += scaleNow(sector) * now;
    frozen += scaleNow(sector) * Math.max(0, now - before);
  }
  const youthLooking = ages.looking.teens + Math.round(ages.looking.adults * YOUNG_ADULT_SHARE);
  const youthGap = Math.min(
    youthLooking * 0.6,
    Math.max(0, (args.prevYouthGap ?? 0) * YOUTH_GAP_FADE + frozen * ENTRY_SHARE),
  );
  const youthBase = youthLooking * clamp(unemployment * 1.8 + 0.015, 0, 0.9);
  const youthUnemployed = Math.round(Math.min(unemployed, youthLooking * 0.95, youthBase + youthGap));
  const officeShare = demand.displaced > 0 ? demand.officeDisplaced / demand.displaced : 0;
  const officeJobless = Math.round(
    clamp(
      demand.officeDisplaced * (1 - demand.absorb) - demand.downshift * 0.5 - publicJobs * officeShare,
      0,
      unemployed * 0.5,
    ),
  );
  const output = Math.round(
    sectors.reduce((sum, sector, index) => {
      const def = SECTORS[index]!;
      const each = Math.min(AI_GDP_WEIGHT, machineOutput(def, args.techs, args.adoption));
      return sum + (sector.employed + sector.automatons * each) * def.baseWage;
    }, 0),
  );
  const jobs: JobsView = {
    youthLooking,
    youthUnemployed,
    youthUnemployment: youthLooking > 0 ? youthUnemployed / youthLooking : 0,
    aiJobs: Math.round(aiJobs),
    frozen: Math.round(frozen),
    publicJobs,
    downshift: Math.round(demand.downshift),
    officeJobless,
    output,
  };

  return {
    jobs,
    youthGap,
    sectors: pricedSectors,
    employed,
    laborForce,
    ages,
    unemployed,
    unemployment,
    avgWage: priced.avgWage,
    taxRevenue: priced.taxRevenue,
    spending: priced.spending,
    spend: priced.spend,
    wanted,
    automatons,
    priceIndex,
    inflation,
    wageScale,
    goodsRatio,
    profit: priced.profit,
    realWage: priceIndex > 0 ? priced.avgWage / (priceIndex / PRICE_CENSUS) : priced.avgWage,
    transition: {
      laidOff: Math.round(automatons * (args.policies.retrain ? 0.45 : 0.82)),
      retraining: args.policies.retrain ? Math.round(automatons * absorption(args.techs, args.policies)) : 0,
      tenders: Math.round(automatons * 0.08),
    },
  };
}

/** Move job counts toward this year's demand, without inventing a sector mix. */
function blendEmployment(
  rawSlots: number[],
  prev: number[] | null,
  structuralTotal: number,
  employedTarget: number,
): number[] {
  if (!prev) return scaleTo(rawSlots, employedTarget);
  const previousTotal = sumOf(prev);
  if (Math.abs(structuralTotal - previousTotal) < 1) return scaleTo(rawSlots, employedTarget);
  const speed = (employedTarget - previousTotal) / (structuralTotal - previousTotal);
  if (speed >= 0 && speed <= 1) {
    const blended = rawSlots.map((slots, index) => prev[index]! + (slots - prev[index]!) * speed);
    return scaleTo(blended, employedTarget);
  }
  if (speed > 1) return scaleTo(rawSlots, employedTarget);
  // Total moves against demand (more people hired from a growing labor force while demand dips):
  // still drift the mix halfway toward demand so new plant crews and frozen sectors show up.
  const halfway = rawSlots.map((slots, index) => prev[index]! + (slots - prev[index]!) * 0.5);
  return scaleTo(halfway, employedTarget);
}

function openingBulletin(charter: CharterId, census: Project): string {
  const line = `Opening census. ${formatInt(census.employed)} people are at work and unemployment is ${formatPct(census.unemployment)}.`;
  if (charter === "safety") {
    return `${line} High tax, a stipend, and public works are staged. They take effect when you advance the year.`;
  }
  if (charter === "docks") {
    return `${line} Freight automation is staged, with a low tax and open gates. They take effect when you advance the year.`;
  }
  return `${line} Nothing is automated. Trade, turnover, and new workers still move the figures every year.`;
}

export function openingState(charter: CharterId = "census"): Ledger {
  const census = project({
    pop: BASE_POP,
    policies: NEUTRAL,
    techs: freshTechs(),
    year: 1,
    prevEmployed: null,
    prevUnemployment: null,
    gentle: false,
    climate: 1,
    serviceSpend: { services: 0, interest: 0, principal: 0, construction: 0 },
    works: openingWorks(),
    energy: freshEnergy(),
    priceLevel: PRICE_CENSUS,
    wageScale: 1,
    prevInflation: INFLATION_TARGET,
    freezePrices: true,
  });
  const openingWorksState = openingWorks();
  const openingEnergy = freshEnergy(openingWorksState.power.plants, openingWorksState.power.auto);
  const openingCovers = coverOf(BASE_POP, census.employed, openingWorksState, 1, 0, openingEnergy);
  const base: Ledger = {
    version: 1,
    year: 1,
    population: BASE_POP,
    treasury: OPEN_TREASURY,
    stability: OPEN_STABILITY,
    unemployment: census.unemployment,
    avgWage: census.avgWage,
    taxRevenue: census.taxRevenue,
    spending: 0,
    spend: emptySpend(),
    employed: census.employed,
    laborForce: census.laborForce,
    ages: census.ages,
    sectors: census.sectors,
    policies: policiesFor(charter),
    techs: techsFor(charter),
    works: openingWorksState,
    energy: openingEnergy,
    ai: freshAi(),
    jobs: census.jobs,
    priceIndex: census.priceIndex,
    inflation: INFLATION_TARGET,
    wageScale: 1,
    profit: census.profit,
    realWage: Math.round(census.realWage),
    transition: census.transition,
    loans: [],
    debt: 0,
    crime: crimeIndex(census.unemployment, worstCover(openingCovers)),
    protest: false,
    covers: openingCovers,
    bulletin: openingBulletin(charter, census),
    hasClosedYear: false,
    deltas: {
      unemployment: null,
      avgWage: null,
      taxRevenue: null,
      stability: null,
    },
    history: [],
    events: [],
    enacted: { ...NEUTRAL },
    enactedTech: blankTechFlags(),
    shadow: null,
    pace: null,
  };
  return { ...base, history: [snapshot(base)] };
}

function nextPopulation(state: Ledger): number {
  const u = state.unemployment;
  let growth = 0.0035;
  growth += (state.stability - OPEN_STABILITY) * 0.00009;
  growth -= Math.max(0, u - 0.08) * 0.05;
  if (u < 0.07) growth += 0.002;
  if (state.policies.gates === "open") growth += 0.008;
  if (state.policies.gates === "tight") growth -= 0.005;
  if (state.realWage > 43_000) growth += 0.001;
  growth += yearForces(state.year + 1).migration;
  const water = state.covers?.water ?? 1;
  if (water < 1) growth -= (1 - water) * 0.015;
  growth = clamp(growth, -0.02, 0.022);
  return clamp(Math.round(state.population * (1 + growth)), 12_000, 5_000_000);
}

function tickTechs(techs: Record<TechId, TechState>): Record<TechId, TechState> {
  const next = { ...techs };
  for (const tech of TECHS) {
    const current = techs[tech.id];
    if (current?.on) next[tech.id] = { on: true, activeYears: current.activeYears + 1 };
  }
  return next;
}

const SECTOR_SHORT: Record<SectorId, string> = {
  housing: "Housing",
  transport: "Transport",
  food: "Food",
  energy: "Energy",
  services: "Services",
  government: "Government",
  health: "Health",
  education: "Education",
  law: "Law enforcement",
  office: "Office",
};

function blankTechFlags(): Record<TechId, boolean> {
  const flags = {} as Record<TechId, boolean>;
  for (const tech of TECHS) flags[tech.id] = false;
  return flags;
}

function enactedTechMap(techs: Record<TechId, TechState>): Record<TechId, boolean> {
  const flags = {} as Record<TechId, boolean>;
  for (const tech of TECHS) flags[tech.id] = (techs[tech.id]?.activeYears ?? 0) > 0;
  return flags;
}

/** Yearly running cost of each utility at census prices. Power includes imported fuel. */
export function serviceBill(works: Works, energy?: EnergyState | null): Record<ServiceId, number> {
  const bill: Record<ServiceId, number> = { power: 0, water: 0, waste: 0 };
  const upkeep = upkeepFactor(energy);
  for (const def of SERVICES) {
    if (def.id === "power" && energy) {
      bill.power = powerUpkeep(energy) + fuelBill(energy);
      continue;
    }
    const plant = asPlant(works[def.id]);
    bill[def.id] = Math.round(
      (def.yearlyCost * plant.plants + def.yearlyCost * AUTO_COST_SHARE * plant.auto) * (def.id === "power" ? 1 : upkeep),
    );
  }
  return bill;
}

export function snapshot(state: Ledger): YearMark {
  const bill = serviceBill(state.works, state.energy);
  return {
    year: state.year,
    unemployment: state.unemployment,
    avgWage: state.avgWage,
    taxRevenue: state.taxRevenue,
    spending: state.spending,
    stability: state.stability,
    population: state.population,
    treasury: state.treasury,
    employed: state.employed,
    laborForce: state.laborForce,
    priceIndex: state.priceIndex,
    profit: state.profit,
    realWage: state.realWage,
    inflation: state.inflation,
    oilPrice: state.energy?.oilPrice ?? 1,
    output: state.jobs?.output,
    youthUnemployment: state.jobs?.youthUnemployment,
    aiJobs: state.jobs?.aiJobs ?? 0,
    publicJobs: state.jobs?.publicJobs ?? 0,
    powerCost: bill.power,
    waterCost: bill.water,
    wasteCost: bill.waste,
  };
}

type TrailInput = Omit<
  Ledger,
  "history" | "events" | "enacted" | "enactedTech" | "shadow" | "pace" | "ages" | "works" | "loans" | "debt" | "crime" | "protest" | "covers" | "inflation" | "wageScale" | "energy" | "ai" | "jobs"
> &
  Partial<
    Pick<
      Ledger,
      "history" | "events" | "enacted" | "enactedTech" | "shadow" | "pace" | "ages" | "works" | "loans" | "debt" | "crime" | "protest" | "covers" | "inflation" | "wageScale" | "energy" | "ai" | "jobs"
    >
  >;

/** Policies from any save: missing or damaged new levers fall back to off. */
export function cleanPolicies(raw: Policies): Policies {
  return {
    ...raw,
    ownership: asOwnership(raw.ownership),
    publicHiring: asPublicHiring(raw.publicHiring),
    aiLevy: raw.aiLevy === true,
  };
}

/** Labor detail for a city saved before AI adoption existed: youth from the usual ratio, nothing frozen. */
function asJobs(raw: Partial<JobsView> | undefined, state: Pick<Ledger, "unemployment" | "laborForce" | "employed" | "sectors"> & { ages?: Ages }): JobsView {
  const num = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
  const u = Number.isFinite(state.unemployment) ? state.unemployment : 0;
  const looking = state.ages?.looking;
  const youthLooking = looking
    ? looking.teens + Math.round(looking.adults * YOUNG_ADULT_SHARE)
    : Math.round((state.laborForce || 0) * 0.15);
  const unemployed = Math.max(0, (state.laborForce || 0) - (state.employed || 0));
  const youthUnemployed = Math.round(Math.min(unemployed, youthLooking * clamp(u * 1.8 + 0.015, 0, 0.9)));
  const output = (state.sectors ?? []).reduce((sum, sector) => {
    const def = SECTORS.find((item) => item.id === sector.id);
    return sum + ((sector.employed || 0) + (sector.automatons || 0) * AI_GDP_WEIGHT) * (def?.baseWage ?? 40_000);
  }, 0);
  const base: JobsView = {
    youthLooking,
    youthUnemployed,
    youthUnemployment: youthLooking > 0 ? youthUnemployed / youthLooking : 0,
    aiJobs: 0,
    frozen: 0,
    publicJobs: 0,
    downshift: 0,
    officeJobless: 0,
    output: Math.round(output),
  };
  if (!raw || typeof raw !== "object") return base;
  return {
    youthLooking: num(raw.youthLooking, base.youthLooking),
    youthUnemployed: num(raw.youthUnemployed, base.youthUnemployed),
    youthUnemployment: clamp(num(raw.youthUnemployment, base.youthUnemployment), 0, 1),
    aiJobs: num(raw.aiJobs, 0),
    frozen: num(raw.frozen, 0),
    publicJobs: num(raw.publicJobs, 0),
    downshift: num(raw.downshift, 0),
    officeJobless: num(raw.officeJobless, 0),
    output: num(raw.output, base.output),
  };
}

/** Fill the trend trail for a city saved before charts existed. */
export function ensureTrail(state: TrailInput): Ledger {
  const enactedRaw = state.enacted ?? (state.hasClosedYear ? state.policies : { ...NEUTRAL });
  const policies = cleanPolicies(state.policies);
  const enacted = cleanPolicies({ ...enactedRaw, ownership: enactedRaw.ownership ?? policies.ownership });
  const enactedTech =
    state.enactedTech ?? (state.hasClosedYear ? enactedTechMap(state.techs) : blankTechFlags());
  const ages =
    state.ages ??
    cityAges(state.population, state.laborForce / Math.max(1, state.population));
  const works = {
    power: asPlant(state.works?.power, openingWorks().power),
    water: asPlant(state.works?.water, openingWorks().water),
    waste: asPlant(state.works?.waste, openingWorks().waste),
  };
  const energy = asEnergy(state.energy, works.power);
  const loans = state.loans ?? loansFromBalance(state.debt ?? 0);
  const debt = debtOf(loans);
  const covers = state.covers ?? coverOf(state.population, state.employed, works, state.year, 0, energy);
  const history = (state.history?.length ? state.history : []).map((mark, index, all) => {
    const isCurrent = index === all.length - 1 && mark.year === state.year;
    const laborForce =
      typeof mark.laborForce === "number"
        ? mark.laborForce
        : isCurrent
          ? state.laborForce
          : Math.round(mark.population * PARTICIPATION);
    return {
      ...mark,
      laborForce,
      inflation: mark.inflation ?? INFLATION_TARGET,
      priceIndex: mark.priceIndex ?? PRICE_CENSUS,
    };
  });
  const shadowLoans = state.shadow ? (state.shadow.loans ?? loansFromBalance(state.shadow.debt ?? 0)) : [];
  const withBooks: Ledger = {
    ...state,
    policies,
    priceIndex: state.priceIndex ?? PRICE_CENSUS,
    inflation: state.inflation ?? INFLATION_TARGET,
    wageScale: state.wageScale ?? 1,
    profit: state.profit ?? 0,
    realWage: state.realWage ?? state.avgWage,
    transition: state.transition ?? { laidOff: 0, retraining: 0, tenders: 0 },
    history,
    events: state.events ?? [],
    enacted,
    enactedTech,
    ages,
    works,
    energy,
    ai: asAi(state.ai),
    jobs: asJobs(state.jobs, state),
    loans,
    debt,
    crime: state.crime ?? crimeIndex(state.unemployment, worstCover(covers), state.policies.stipend || state.policies.dividend),
    protest: state.protest ?? false,
    covers,
    spend: { ...emptySpend(), ...state.spend },
    shadow: state.shadow
      ? {
          ...state.shadow,
          policies: cleanPolicies(state.shadow.policies),
          ai: asAi(state.shadow.ai),
          jobs: asJobs(state.shadow.jobs, state.shadow),
          loans: shadowLoans,
          debt: debtOf(shadowLoans),
          inflation: state.shadow.inflation ?? INFLATION_TARGET,
          wageScale: state.shadow.wageScale ?? 1,
          priceIndex: state.shadow.priceIndex ?? PRICE_CENSUS,
          energy: asEnergy(
            state.shadow.energy,
            asPlant(state.shadow.works?.power, openingWorks().power),
          ),
        }
      : null,
    pace: state.pace ?? null,
  };
  if (withBooks.history.length > 0) return withBooks;
  return { ...withBooks, history: [snapshot(withBooks)] };
}

function holdTechs(state: Ledger): Record<TechId, TechState> {
  const next = freshTechs();
  for (const tech of TECHS) {
    if (!state.enactedTech[tech.id]) continue;
    next[tech.id] = { on: true, activeYears: state.techs[tech.id].activeYears + 1 };
  }
  return next;
}

function statuteLabels(state: Ledger, nextTechs: Record<TechId, TechState>): string[] {
  const prev = state.enacted;
  const next = state.policies;
  const labels: string[] = [];
  if (prev.tax !== next.tax) {
    const raised = TAX_RATES[next.tax] > TAX_RATES[prev.tax];
    labels.push(`Tax ${raised ? "raised" : "cut"} to ${next.tax}`);
  }
  if (prev.gates !== next.gates) {
    const word = next.gates === "open" ? "opened" : next.gates === "tight" ? "tightened" : "steadied";
    labels.push(`Gates ${word}`);
  }
  if (prev.ownership !== next.ownership) {
    const who = next.ownership === "city" ? "the city" : next.ownership === "citizens" ? "residents" : "firms";
    labels.push(`Machine profits to ${who}`);
  }
  if (asPublicHiring(prev.publicHiring) !== asPublicHiring(next.publicHiring)) {
    const mode = asPublicHiring(next.publicHiring);
    labels.push(mode === "off" ? "Public hiring ended" : mode === "big" ? "Big public hiring began" : "Public hiring began");
  }
  const toggles: readonly [keyof Policies, string][] = [
    ["stipend", "Jobless stipend"],
    ["dividend", "Citizen dividend"],
    ["works", "Public works"],
    ["retrain", "Retraining"],
    ["wageFloor", "Wage floor"],
    ["aiLevy", "AI levy"],
  ];
  for (const [key, name] of toggles) {
    if (Boolean(prev[key]) === Boolean(next[key])) continue;
    labels.push(`${name} ${next[key] ? "began" : "ended"}`);
  }
  for (const tech of TECHS) {
    const now = nextTechs[tech.id].activeYears > 0;
    if (!state.enactedTech[tech.id] && now) {
      labels.push(`Automation began · ${SECTOR_SHORT[tech.sectorId]}`);
    }
  }
  return labels;
}

function worstCover(covers: ServiceCover): number {
  return Math.min(covers.power, covers.water, covers.waste);
}

function businessClimate(covers: ServiceCover, protest: boolean): number {
  let factor = 1;
  if (covers.power < 1) factor *= 0.88 + 0.12 * covers.power;
  if (covers.water < 0.95) factor *= 0.97 + 0.03 * covers.water;
  if (protest) factor *= 0.96;
  return factor;
}

function serviceOpex(works: Works, energy: EnergyState): number {
  const bill = serviceBill(works, energy);
  return bill.power + bill.water + bill.waste;
}

function serviceCapex(works: Works, energy: EnergyState): number {
  return SERVICES.reduce((sum, def) => {
    const staged = asPlant(works[def.id]).staged;
    if (def.id === "power") return sum + powerBuildCost(energy.stagedKind, staged);
    return sum + def.buildCost * Math.min(1, staged);
  }, 0);
}

function commitWorks(works: Works, energy: EnergyState): { works: Works; energy: EnergyState } {
  const next = {} as Works;
  const retired = retireFleet(energy);
  let fleet = retired.energy;
  const closed = retired.closed;
  for (const def of SERVICES) {
    const plant = asPlant(works[def.id]);
    const count = def.id === "power" ? plant.staged : Math.min(1, plant.staged);
    const lostCrew = def.id === "power" && closed && !closed.auto ? 1 : 0;
    const lostAuto = def.id === "power" && closed && closed.auto ? 1 : 0;
    next[def.id] = {
      plants: Math.max(0, plant.plants - lostCrew) + (count > 0 && !plant.stagedAuto ? count : 0),
      auto: Math.max(0, plant.auto - lostAuto) + (count > 0 && plant.stagedAuto ? count : 0),
      staged: plant.staged,
      stagedAuto: plant.stagedAuto,
    };
    if (def.id === "power" && count > 0) fleet = commitFleet(fleet, energy.stagedKind, count, plant.stagedAuto);
  }
  return { works: next, energy: fleet };
}

function clearStaged(works: Works): Works {
  const next = {} as Works;
  for (const def of SERVICES) {
    const plant = asPlant(works[def.id]);
    next[def.id] = { plants: plant.plants, auto: plant.auto, staged: 0, stagedAuto: false };
  }
  return next;
}

function plantLabels(works: Works, energy?: EnergyState | null): string[] {
  const labels: string[] = [];
  if (energy && energy.retire > 0 && retireTarget(energy)) labels.push("Oil plant closed");
  for (const def of SERVICES) {
    const plant = asPlant(works[def.id]);
    if (plant.staged <= 0) continue;
    if (def.id === "power" && energy) {
      const type = POWER_TYPES[energy.stagedKind];
      const what = plant.staged > 1 ? `${plant.staged} ${type.plural}` : type.name.toLowerCase();
      const label = plant.stagedAuto ? `Automated ${what}` : what.charAt(0).toUpperCase() + what.slice(1);
      labels.push(`${label} opened`);
      continue;
    }
    labels.push(plant.stagedAuto ? `Automated ${def.name.toLowerCase()} plant opened` : `${def.name} plant opened`);
  }
  return labels;
}

export function stageService(state: Ledger, id: ServiceId, kind: "crew" | "auto" = "crew"): Ledger {
  if (id === "power" && state.energy) return stagePower(state, state.energy.stagedKind ?? "oil", kind);
  const current = asPlant(state.works[id]);
  const wantAuto = kind === "auto";
  const same = current.staged > 0 && current.stagedAuto === wantAuto;
  return {
    ...state,
    works: {
      ...state.works,
      [id]: {
        plants: current.plants,
        auto: current.auto,
        staged: same ? 0 : 1,
        stagedAuto: same ? false : wantAuto,
      },
    },
  };
}

/**
 * Stage a power plant of one type. Tapping the same choice again adds another
 * (solar allows three a year) and then cancels. Locked types are ignored.
 */
export function stagePower(state: Ledger, kind: PowerKind, mode: "crew" | "auto" = "crew"): Ledger {
  const energy = asEnergy(state.energy, asPlant(state.works.power));
  const room = stageRoom(energy, kind);
  const current = asPlant(state.works.power);
  const wantAuto = mode === "auto";
  const same = current.staged > 0 && current.stagedAuto === wantAuto && energy.stagedKind === kind;
  if (!same && (room <= 0 || !kindUnlocked(energy, kind))) return state;
  const staged = same ? (current.staged < room ? current.staged + 1 : 0) : 1;
  return {
    ...state,
    energy: { ...energy, stagedKind: staged > 0 ? kind : energy.stagedKind },
    works: {
      ...state.works,
      power: {
        plants: current.plants,
        auto: current.auto,
        staged,
        stagedAuto: staged > 0 ? wantAuto : false,
      },
    },
  };
}

/** Stage (or cancel) closing one oil plant at the next year close. */
export function retireOil(state: Ledger): Ledger {
  const energy = asEnergy(state.energy, asPlant(state.works.power));
  if (energy.retire > 0) return { ...state, energy: { ...energy, retire: 0 } };
  if (!retireTarget(energy)) return state;
  return { ...state, energy: { ...energy, retire: 1 } };
}

/** Fund an energy research project at the next year close, or stop funding with null. */
export function setResearch(state: Ledger, id: ResearchId | null): Ledger {
  const energy = asEnergy(state.energy, asPlant(state.works.power));
  return { ...state, energy: chooseResearch(energy, id) };
}

export function borrow(state: Ledger): Ledger {
  const loans = [...state.loans, makeLoan(state.loans)];
  return { ...state, loans, debt: debtOf(loans), treasury: state.treasury + LOAN_SIZE };
}

export function prepay(state: Ledger, id: string, amount: number): Ledger {
  const loan = state.loans.find((item) => item.id === id);
  if (!loan) return state;
  const cash = Math.max(0, state.treasury);
  const pay = Math.min(amount, loan.balance, cash);
  if (pay < 1_000_000 && pay < loan.balance) return state;
  const balance = loan.balance - pay;
  const yearsLeft = Math.max(1, loan.term - loan.paid);
  const loans =
    balance <= 1
      ? state.loans.filter((item) => item.id !== id)
      : state.loans.map((item) =>
          item.id === id ? { ...item, balance, payment: loanPayment(balance, item.rate, yearsLeft) } : item,
        );
  return { ...state, loans, debt: debtOf(loans), treasury: state.treasury - pay };
}

const MAX_EMERGENCY_LOANS_PER_YEAR = 8;
const MAX_AUTO_LOANS = 10;

function coverOverdraft(
  treasury: number,
  loans: CityLoan[],
): { treasury: number; loans: CityLoan[]; taken: CityLoan[] } {
  const taken: CityLoan[] = [];
  let cash = treasury;
  let book = loans;
  // Borrow enough to close a normal hole, but do not silently pile on unlimited debt.
  while (cash < 0 && taken.length < MAX_EMERGENCY_LOANS_PER_YEAR && book.length < MAX_AUTO_LOANS) {
    const loan = makeLoan(book);
    book = [...book, loan];
    cash += LOAN_SIZE;
    taken.push(loan);
  }
  return { treasury: cash, loans: book, taken };
}

function spendTotal(spend: SpendParts): number {
  return (
    spend.standing +
    spend.stipend +
    spend.dividend +
    spend.works +
    spend.retrain +
    spend.services +
    spend.interest +
    spend.principal +
    spend.construction +
    (spend.research ?? 0) +
    (spend.publicJobs ?? 0)
  );
}

/** Cut optional outlays when even emergency loans cannot close the books. */
function trimDiscretionary(spend: SpendParts, need: number): { spend: SpendParts; cut: string[] } {
  const next = { ...spend };
  const cut: string[] = [];
  let left = Math.max(0, need);
  const order: readonly { key: keyof SpendParts; label: string }[] = [
    { key: "research", label: "Research paused" },
    { key: "construction", label: "Plant construction halted" },
    { key: "dividend", label: "Dividend suspended" },
    { key: "works", label: "Public works suspended" },
    { key: "publicJobs", label: "Public hiring frozen" },
    { key: "stipend", label: "Stipend suspended" },
    { key: "retrain", label: "Retraining suspended" },
  ];
  for (const item of order) {
    if (left <= 0) break;
    const have = next[item.key];
    if (have <= 0) continue;
    const take = Math.min(have, left);
    next[item.key] = have - take;
    left -= take;
    cut.push(item.label);
  }
  return { spend: next, cut };
}

function loansFromBalance(debt: number): CityLoan[] {
  const loans: CityLoan[] = [];
  let left = Math.max(0, debt);
  while (left > 1_000) {
    const principal = Math.min(LOAN_SIZE, left);
    loans.push(makeLoan(loans, principal));
    left -= principal;
  }
  return loans;
}

function settle(
  state: Ledger,
  policies: Policies,
  techs: Record<TechId, TechState>,
  book: boolean,
): Ledger {
  const population = nextPopulation({ ...state, policies });
  const newTechNames = TECHS.filter(
    (tech) => state.techs[tech.id].activeYears === 0 && techs[tech.id].activeYears === 1,
  ).map((tech) => tech.name);
  const deepening = TECHS.some(
    (tech) => ramp(techs[tech.id].activeYears) > ramp(state.techs[tech.id].activeYears),
  );
  const energy0 = asEnergy(state.energy, asPlant(state.works.power));
  const committed = book ? commitWorks(state.works, energy0) : { works: state.works, energy: energy0 };
  const builtWorks = committed.works;
  const opened = book ? plantLabels(state.works, energy0) : [];
  const oilPrice = nextOilPrice(energy0.oilPrice, state.year + 1);
  const oilShock = oilInflation(committed.energy, oilPrice);
  const researchCost = book ? researchBill(energy0) : 0;
  // Research finishes at this close; its effects count from the new year.
  const priced = { ...committed.energy, oilPrice };
  const jobsForDemand = state.employed;
  const billed = serviceLoans(state.loans ?? []);
  const machines = machineCount(state) + stagedMachines({ techs });
  const covers = coverOf(population, jobsForDemand, builtWorks, state.year + 1, machines, priced);
  const needsMet = policies.stipend || policies.dividend || policies.ownership === "citizens";
  const protest = willProtest(covers, state.unemployment, state.stability, needsMet);
  const gentle = !deepening && statuteLabels(state, techs).length === 0 && !protest && worstCover(covers) >= 0.95;
  const prevEmployed = new Map(state.sectors.map((sector) => [sector.id, sector.employed]));
  const ai0 = asAi(state.ai);
  const adoption = nextAdoption(ai0.adoption, state.year + 1, policies, state.unemployment);
  const econ = project({
    pop: population,
    policies,
    techs,
    year: state.year + 1,
    prevEmployed,
    prevUnemployment: state.unemployment,
    gentle,
    climate: businessClimate(covers, protest),
    serviceSpend: {
      services: serviceOpex(builtWorks, priced),
      interest: billed.interest,
      principal: billed.principal,
      construction: book ? serviceCapex(state.works, energy0) : 0,
      research: researchCost,
    },
    works: builtWorks,
    energy: priced,
    oilShock,
    priceLevel: state.priceIndex ?? PRICE_CENSUS,
    wageScale: state.wageScale ?? 1,
    prevInflation: state.inflation ?? INFLATION_TARGET,
    prevTechs: state.techs,
    covers,
    treasury: state.treasury,
    adoption,
    prevAdoption: ai0.adoption,
    prevYouthGap: ai0.youthGap,
  });
  let withCrews = econ;
  let treasury = state.treasury + withCrews.taxRevenue - withCrews.spending;
  let loans = billed.loans;
  const rescue = coverOverdraft(treasury, loans);
  treasury = rescue.treasury;
  loans = rescue.loans;
  let openedPlants = opened;
  let finalWorks = builtWorks;
  let finalEnergy = priced;
  let researchFunded = researchCost > 0;
  let austerity: string[] = [];
  if (treasury < 0) {
    const trimmed = trimDiscretionary(withCrews.spend, -treasury);
    austerity = trimmed.cut;
    const cancelledBuild = withCrews.spend.construction > 0 && trimmed.spend.construction < withCrews.spend.construction;
    if (cancelledBuild) {
      finalWorks = state.works;
      finalEnergy = { ...energy0, oilPrice, retire: 0 };
      openedPlants = [];
    }
    if (withCrews.spend.research > 0 && trimmed.spend.research < withCrews.spend.research) researchFunded = false;
    withCrews = { ...withCrews, spend: trimmed.spend, spending: spendTotal(trimmed.spend) };
    treasury = state.treasury + withCrews.taxRevenue - withCrews.spending + rescue.taken.length * LOAN_SIZE;
  }
  const researched = book ? tickResearch(finalEnergy, researchFunded) : { energy: finalEnergy, finished: null };
  finalEnergy = researched.energy;
  const researchLabels = researched.finished ? [`Research done · ${researchDef(researched.finished).name}`] : [];
  const crime = crimeIndex(withCrews.unemployment, worstCover(covers), needsMet);
  const stability = nextStability(
    { ...state, policies, crime, protest, covers },
    withCrews,
    treasury,
    newTechNames.length,
    techs,
    {
      rescued: rescue.taken.length > 0,
      taken: rescue.taken.length,
      debt: debtOf(loans),
      austerity: austerity.length > 0,
    },
  );
  const nextView = { ...withCrews, stability, treasury };
  const year = state.year + 1;
  const labels = book
    ? [
        ...statuteLabels(state, techs),
        ...openedPlants,
        ...researchLabels,
        ...(protest ? ["Protest"] : []),
        ...(austerity.length > 0 ? ["Austerity"] : []),
      ]
    : [];
  const built: Ledger = {
    version: 1,
    year,
    population,
    treasury,
    stability,
    unemployment: withCrews.unemployment,
    avgWage: withCrews.avgWage,
    taxRevenue: withCrews.taxRevenue,
    spending: withCrews.spending,
    spend: withCrews.spend,
    employed: withCrews.employed,
    laborForce: withCrews.laborForce,
    ages: withCrews.ages,
    sectors: withCrews.sectors,
    policies,
    techs,
    works: clearStaged(finalWorks),
    energy: finalEnergy,
    ai: { adoption, youthGap: withCrews.youthGap },
    jobs: withCrews.jobs,
    priceIndex: withCrews.priceIndex,
    inflation: withCrews.inflation,
    wageScale: withCrews.wageScale,
    profit: withCrews.profit,
    realWage: Math.round(withCrews.realWage),
    transition: withCrews.transition,
    loans,
    debt: debtOf(loans),
    crime,
    protest,
    covers,
    bulletin: book
      ? writeBulletin(state, nextView, newTechNames, {
          protest,
          covers,
          opened: openedPlants,
          loans: rescue.taken.map((loan) => `Loan ${loan.name} at ${(loan.rate * 100).toFixed(1)}%`),
          austerity,
          research: researched.finished ? researchDef(researched.finished).name : null,
          oil: { from: energy0.oilPrice, to: oilPrice, share: oilShock !== 0 || energy0.fleet.oil.crew + energy0.fleet.oil.auto > 0 },
        })
      : "",
    hasClosedYear: true,
    deltas: {
      unemployment: withCrews.unemployment - state.unemployment,
      avgWage: withCrews.avgWage - state.avgWage,
      taxRevenue: withCrews.taxRevenue - state.taxRevenue,
      stability: stability - state.stability,
    },
    history: [],
    events: [],
    enacted: policies,
    enactedTech: enactedTechMap(techs),
    shadow: null,
    pace: null,
  };
  if (!book) return built;
  return {
    ...built,
    history: [...state.history, snapshot(built)],
    events: [...state.events, ...labels.map((label) => ({ year, label }))],
  };
}

export function advance(input: Ledger): Ledger {
  const state = ensureTrail(input);
  const techs = tickTechs(state.techs);
  const labels = statuteLabels(state, techs);
  const closed = settle(state, state.policies, techs, true);
  if (labels.length > 0) {
    const shadow = settle(state, state.enacted, holdTechs(state), false);
    return { ...closed, shadow, pace: [snapshot(shadow)] };
  }
  if (state.shadow && state.pace) {
    const shadowState = ensureTrail({ ...state.shadow, shadow: null, pace: null });
    const shadow = settle(shadowState, shadowState.policies, tickTechs(shadowState.techs), false);
    return { ...closed, shadow, pace: [...state.pace, snapshot(shadow)] };
  }
  return closed;
}

function listNames(names: string[]): string {
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function yearCause(
  prev: Ledger,
  next: Project,
  worst: { name: string; delta: number } | null,
): string {
  const du = next.unemployment - prev.unemployment;
  const dJobs = next.employed - prev.employed;
  const dSeekers = next.laborForce - prev.laborForce;
  const forces = yearForces(prev.year + 1);

  if (du >= 0.004) {
    if (worst && worst.delta < 0) {
      const explained = -worst.delta / Math.max(1, next.laborForce);
      if (explained >= Math.max(0.004, du * 0.5)) {
        return `${worst.name} cut ${formatInt(-worst.delta)} jobs.`;
      }
    }
    if (dSeekers > dJobs + 60) return "More people came looking for work than firms hired.";
    if (forces.slot.housing < 0.97) return "Construction slowed.";
    if (forces.slot.transport < 0.985) return "Freight traffic was thin.";
    if (forces.slot.food < 0.985) return "Food orders were light.";
    if (forces.friction >= 0.042) return "More people were between jobs.";
    if (prev.population > BASE_POP * 1.2) {
      return "The city is not adding shifts as fast as it adds people.";
    }
    return "Hiring fell short of the people already looking for work.";
  }
  if (du <= -0.004) {
    if (forces.slot.transport > 1.02) return "Freight traffic was heavy.";
    if (forces.slot.housing > 1.035) return "Construction sites took on crews.";
    if (forces.slot.food > 1.02) return "Food plants had a full order book.";
    if (dSeekers < 40 && dJobs > dSeekers) return "Fewer new workers entered the labor force.";
    if (forces.friction <= 0.032) return "People stayed in the jobs they had.";
    if (dJobs > 80) return "Firms hired more people than joined the labor force.";
    return "Openings were easier to fill than last year.";
  }
  return "Trade, hiring, and new workers roughly cancelled out.";
}

function writeBulletin(
  prev: Ledger,
  next: Project & { stability: number; treasury: number },
  newTechNames: string[],
  city?: {
    protest: boolean;
    covers: ServiceCover;
    opened: string[];
    loans?: string[];
    austerity?: string[];
    research?: string | null;
    oil?: { from: number; to: number; share: boolean };
  },
): string {
  let worst: { name: string; delta: number } | null = null;
  for (const sector of next.sectors) {
    if (sector.prevEmployed == null) continue;
    const delta = sector.employed - sector.prevEmployed;
    if (!worst || delta < worst.delta) {
      const def = SECTORS.find((item) => item.id === sector.id);
      worst = { name: def?.name ?? sector.id, delta };
    }
  }

  const sentences: string[] = [];
  const du = next.unemployment - prev.unemployment;
  if (newTechNames.length > 0) {
    sentences.push(`${listNames(newTechNames)} entered service.`);
  }

  const cause =
    newTechNames.length > 0 && du >= 0.004 ? "" : yearCause(prev, next, worst);
  if (du >= 0.004) {
    sentences.push(`Unemployment rose to ${formatPct(next.unemployment)}. ${cause}`.trim());
  } else if (du <= -0.004) {
    sentences.push(`Unemployment fell to ${formatPct(next.unemployment)}. ${cause}`.trim());
  } else {
    sentences.push(`Unemployment held near ${formatPct(next.unemployment)}. ${cause}`.trim());
  }

  const revRatio = prev.taxRevenue > 0 ? next.taxRevenue / prev.taxRevenue : 1;
  if (next.spending > next.taxRevenue + 1_500_000) {
    sentences.push("Spending ran ahead of the take.");
  } else if (revRatio < 0.97) {
    sentences.push("Tax revenue slipped.");
  } else if (revRatio > 1.045) {
    sentences.push("Tax revenue rose.");
  } else if (newTechNames.length > 0) {
    sentences.push("Tax revenue held as output per worker rose.");
  }

  if (next.treasury < 0 && prev.treasury >= 0) {
    sentences.push("The reserve is overdrawn.");
  }
  if (city?.loans?.length) {
    sentences.push(
      city.loans.length === 1
        ? `${city.loans[0]} was taken to cover the reserve.`
        : `${listNames(city.loans)} were taken to cover the reserve.`,
    );
  }
  const infl = next.inflation;
  if (infl <= -0.003) sentences.push(`Prices fell ${formatPct(-infl)}.`);
  else if (infl >= 0.003) sentences.push(`Prices rose ${formatPct(infl)}.`);
  else sentences.push("Prices held nearly steady.");

  const word = stabilityWord(next.stability);
  const sd = next.stability - prev.stability;
  if (sd <= -4) sentences.push(`Stability fell to ${next.stability}, ${word}.`);
  else if (sd >= 3) sentences.push(`Stability rose to ${next.stability}, ${word}.`);
  else sentences.push(`Stability is ${next.stability}, ${word}.`);

  const lead = sentences[0] ?? "";
  const jobless = sentences.find((line) => line.startsWith("Unemployment")) ?? "";
  const money = sentences.find(
    (line) =>
      line.startsWith("Spending") ||
      line.startsWith("Tax") ||
      line.startsWith("The reserve"),
  );
  const stable = sentences.find((line) => line.startsWith("Stability")) ?? "";
  const cityLines: string[] = [];
  if (city?.opened.length) cityLines.push(`${listNames(city.opened.map((line) => line.replace(" opened", "")))} opened.`);
  if (city?.research) cityLines.push(`${city.research} research is done.`);
  if (city?.austerity?.length) cityLines.push(`${city.austerity[0]}.`);
  if (city?.oil?.share && city.oil.from > 0) {
    const move = city.oil.to / city.oil.from - 1;
    if (move >= 0.07) cityLines.push(`Oil import prices jumped ${formatPct(move)}.`);
    else if (move <= -0.07) cityLines.push(`Oil import prices fell ${formatPct(-move)}.`);
  }
  if (city?.protest) cityLines.push("A protest broke out. Some firms left.");
  else if (city) {
    const short = SERVICES.find((def) => city.covers[def.id] < 0.98);
    if (short) cityLines.push(`${short.name} does not cover the city.`);
  }
  const loanLine = sentences.find((line) => line.includes("taken to cover")) ?? "";
  const priceLine = sentences.find((line) => line.startsWith("Prices")) ?? "";
  const jobsNow = next.jobs;
  let aiLine = "";
  if (jobsNow && jobsNow.frozen >= 40) {
    aiLine = `Firms left ${formatInt(jobsNow.frozen)} openings unfilled as AI took the work.`;
    if (jobsNow.youthUnemployment >= 0.2) {
      aiLine = `${aiLine.slice(0, -1)}; ${formatPct(jobsNow.youthUnemployment)} of young people looking have no job.`;
    }
  }
  let gapLine = "";
  if (jobsNow) {
    const gap = jobsGap([
      ...prev.history,
      {
        year: prev.year + 1,
        unemployment: next.unemployment,
        avgWage: next.avgWage,
        taxRevenue: next.taxRevenue,
        spending: next.spending,
        stability: next.stability,
        population: prev.population,
        treasury: next.treasury,
        employed: next.employed,
        laborForce: next.laborForce,
        output: jobsNow.output,
        aiJobs: jobsNow.aiJobs,
      },
    ]);
    if (gap && gap.gap >= next.laborForce * 0.03) {
      gapLine = `Output growth says the city should have ${formatInt(gap.gap)} more jobs than it does.`;
    }
  }
  const picked = [...cityLines, lead, jobless, aiLine, priceLine, money, loanLine, gapLine, stable].filter(
    (line, index, all) => line && all.indexOf(line) === index,
  );
  return picked.slice(0, 6).join(" ");
}

function nextStability(
  prev: Ledger,
  econ: Project,
  treasury: number,
  newTechCount: number,
  techs: Record<TechId, TechState>,
  fiscal: { rescued: boolean; taken: number; debt: number; austerity?: boolean } = {
    rescued: false,
    taken: 0,
    debt: 0,
  },
): number {
  const u = econ.unemployment;
  const price = econ.goodsRatio;
  let delta = 0;
  const needs = prev.policies.stipend || prev.policies.dividend || prev.policies.ownership === "citizens";
  if (u > 0.09) delta += (0.09 - u) * (needs ? 28 : 64);
  else if (u < 0.045) delta += 0.4;

  // Cheaper goods help people who can still buy them. Without a stipend,
  // dividend, or resident ownership, the unemployed do not get that bonus.
  const priceGain = clamp(Math.max(0, 1 - price) * 26, 0, 11);
  // A stipend pays the bills, not for a reason to get up. With many people idle, cheap goods count for less.
  if (needs) delta += priceGain * (1 - clamp((u - 0.1) * 1.5, 0, 0.25));
  else {
    delta += priceGain * clamp(1 - u, 0, 1);
    if (u > 0.08 && price < 0.98) delta -= (0.98 - price) * (u - 0.08) * 28;
  }

  // Young people shut out of first jobs, and displaced desk workers, are loud and organized.
  const jobs = econ.jobs;
  if (jobs) {
    const yu = jobs.youthUnemployment;
    if (yu > 0.18) delta -= Math.min(needs ? 2.5 : 5, (yu - 0.18) * (needs ? 6 : 14));
    const desk = jobs.officeJobless / Math.max(1, econ.laborForce);
    delta -= Math.min(needs ? 1.5 : 3.5, desk * (needs ? 24 : 45));
  }
  if (prev.policies.stipend) delta += 4.2 + (u > 0.08 ? Math.min(3.2, (u - 0.08) * 24) : 0);
  if (prev.policies.dividend) delta += 3.6;
  if (prev.policies.ownership === "citizens" && econ.profit > 0) delta += 2.4;
  if (prev.policies.works) delta += 1.1;
  const anyLive = TECHS.some((tech) => techs[tech.id].activeYears > 0);
  if (prev.policies.retrain && anyLive) delta += 1.6;
  if (prev.policies.wageFloor && u < 0.1) delta += 0.6;
  if (prev.policies.wageFloor && u > 0.16) delta -= 1.2;
  if (prev.policies.tax === "high") delta -= 1.6;
  if (prev.policies.tax === "low" && !prev.policies.works && !prev.policies.stipend) delta -= 0.4;
  if (prev.policies.gates === "open" && u > 0.15) delta -= 1.7;
  if (prev.policies.gates === "tight" && u > 0.11) delta += 0.8;
  const goods = (econ.automatons * AUTOMATON_OUTPUT) / Math.max(1, econ.laborForce);
  if (price >= 0.98) delta += clamp(goods * 1.2, 0, 2);
  if (newTechCount > 0) {
    if (needs) delta -= Math.min(2, newTechCount * 0.2);
    else delta -= Math.min(7, newTechCount * 0.7 + Math.max(0, u - 0.07) * 20);
  }
  if (fiscal.rescued) delta -= 2 + Math.min(10, fiscal.taken * 2);
  if (fiscal.austerity) delta -= 6;
  if (fiscal.debt > LOAN_SIZE) {
    delta -= Math.min(18, (fiscal.debt - LOAN_SIZE) / 50_000_000);
  }
  if (treasury < 0) delta -= 4 + Math.min(12, -treasury / 8_000_000);
  const prevReal = prev.realWage || prev.avgWage;
  if (econ.realWage < prevReal * 0.97) delta -= 1;
  if (econ.realWage > prevReal * 1.04 && u < 0.12) delta += 0.4;
  const infl = econ.inflation;
  if (infl > 0.035) {
    const excess = infl - 0.035;
    delta -= excess * 70 + excess * excess * 350;
  }
  if (infl < -0.01) {
    const gap = -0.01 - infl;
    delta -= gap * 35 + (u > 0.08 ? gap * 25 : 0);
  }
  const worst = worstCover(prev.covers ?? { power: 1, water: 1, waste: 1 });
  if (worst < 0.98) delta -= (0.98 - worst) * 45;
  if (prev.crime > 22) delta -= (prev.crime - 22) * 0.09;
  if (prev.protest) delta -= 5;
  const shock =
    newTechCount >= 3 ||
    fiscal.rescued ||
    fiscal.taken >= 2 ||
    fiscal.austerity ||
    fiscal.debt > 400_000_000 ||
    treasury < 0 ||
    infl > 0.1;
  delta = clamp(delta, shock ? -20 : -12, 8);
  return clamp(Math.round(prev.stability + delta), 0, 100);
}

export function toggleTech(state: Ledger, id: TechId): Ledger {
  const current = state.techs[id];
  if (current.activeYears > 0) return state;
  return {
    ...state,
    techs: {
      ...state.techs,
      [id]: { on: !current.on, activeYears: 0 },
    },
  };
}

export function sectorDef(id: SectorId): SectorDef {
  const found = SECTORS.find((sector) => sector.id === id);
  if (!found) throw new Error(`Unknown sector ${id}`);
  return found;
}

export function techStatus(tech: TechState): "off" | "staged" | "live" {
  if (tech.activeYears > 0) return "live";
  if (tech.on) return "staged";
  return "off";
}

/** Shown under a sector: how hard automation is biting, in plain words. */
export function automationLabel(
  sectorId: SectorId,
  techs: Record<TechId, TechState>,
  adoption?: Record<SectorId, number> | null,
): string {
  const sector = sectorDef(sectorId);
  const tech = techs[sector.tech];
  const status = techStatus(tech);
  const firm = firmOnlyShare(sector, techs, adoption);
  const firmText = `Firms' own AI does ${formatPct(firm)} of the work`;
  if (status === "off") return firm >= 0.005 ? firmText : FIRM_AI[sectorId].ceiling > 0 ? "No AI yet" : "No automation";
  if (status === "staged") return firm >= 0.005 ? `${firmText} · automation staged` : "Staged for next year";
  const share = intensityOf(sector, techs);
  if (share < 0.22) return `Automated · year ${tech.activeYears} · light`;
  if (share < 0.45) return `Automated · year ${tech.activeYears} · partial`;
  return `Automated · year ${tech.activeYears} · heavy`;
}

export function formatBalance(tax: number, spending: number): string {
  return formatMarks(tax - spending);
}
