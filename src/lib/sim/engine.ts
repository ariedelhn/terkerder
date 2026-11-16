import {
  formatInt,
  formatMarks,
  formatPct,
  stabilityWord,
} from "./format.ts";

export const BASE_POP = 72_000;
export const PARTICIPATION = 0.6;
export const STANDING_PER_CAPITA = 5_400;
export const STIPEND_PER = 11_000;
export const DIVIDEND_PER = 1_200;
export const WORKS_AT_BASE = 26_000_000;
export const RETRAIN_AT_BASE = 18_000_000;
export const OPEN_TREASURY = 84_000_000;
export const OPEN_STABILITY = 72;
/** One machine produces this many human-years of goods. */
export const AUTOMATON_OUTPUT = 10;
/** Tax collected on machine profits, by who owns them. */
export const PROFIT_TAKE = { firms: 0.12, city: 0.42, citizens: 0.55 } as const;
/** Share of machine profits paid to residents when they own the machines. */
export const CITIZEN_PAYOUT = 0.45;

export type Ownership = keyof typeof PROFIT_TAKE;

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
  | "law";
export type TechId =
  | "housing"
  | "transport"
  | "food"
  | "energy"
  | "services"
  | "government"
  | "health"
  | "education"
  | "law";

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

export function plantJobs(id: ServiceId, plant: ServicePlant): number {
  const crew = PLANT_CREW[id];
  return Math.round(plant.plants * crew + plant.auto * crew * AUTO_JOB_SHARE);
}

export function utilityJobs(works: Works): number {
  return SERVICES.reduce((sum, def) => sum + plantJobs(def.id, asPlant(works[def.id])), 0);
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

function loanName(loans: CityLoan[]): string {
  const used = new Set(loans.map((loan) => loan.name));
  let code = 65;
  while (used.has(String.fromCharCode(code)) && code < 90) code += 1;
  return String.fromCharCode(code);
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

export function serviceCover(id: ServiceId, pop: number, jobs: number, plants: number, year = 1, machines = 0): number {
  const demand = serviceDemand(id, pop, jobs, year, machines);
  if (demand <= 0) return 1;
  return serviceCapacity(id, plants) / demand;
}

export function coverOf(pop: number, jobs: number, works: Works, year = 1, machines = 0): ServiceCover {
  return {
    power: serviceCover("power", pop, jobs, plantUnits(asPlant(works.power)), year, machines),
    water: serviceCover("water", pop, jobs, plantUnits(asPlant(works.water)), year, machines),
    waste: serviceCover("waste", pop, jobs, plantUnits(asPlant(works.waste)), year, machines),
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
  const plant = asPlant(state.works[id]);
  const machines = machineCount(state);
  const demand = serviceDemand(id, state.population, state.employed, state.year, machines);
  const capacity = serviceCapacity(id, plantUnits(plant));
  const cover = demand <= 0 ? 1 : capacity / demand;
  const nextPop = nextPopulation(state);
  const nextJobs = Math.round(state.employed * (nextPop / Math.max(1, state.population)));
  const nextDemand = serviceDemand(id, nextPop, nextJobs, state.year + 1, machines + stagedMachines(state));
  const nextCapacity = serviceCapacity(id, plantUnits(plant) + (plant.staged > 0 ? 1 : 0));
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
  /** 100 is the opening census. Lower means cheaper goods. */
  priceIndex?: number;
  profit?: number;
  realWage?: number;
};

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
  /** 100 at the opening census. Falls when machines make goods abundant. */
  priceIndex: number;
  /** Profit left after wages. Taxed, or paid out, depending on ownership. */
  profit: number;
  /** Wage divided by the price index. What a paycheck buys. */
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
    baseSlots: 5200,
    baseWage: 46_200,
    exposure: 0.8,
    tech: "transport",
  },
  {
    id: "food",
    name: "Food chain",
    detail: "Agriculture, food factories, and grocery stores.",
    baseSlots: 6400,
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
    baseSlots: 7800,
    baseWage: 36_400,
    exposure: 0.4,
    tech: "services",
  },
  {
    id: "government",
    name: "Government",
    detail: "Permits, the tax desk, and city administration.",
    baseSlots: 3600,
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
  profit: number;
  realWage: number;
  transition: Transition;
};

function displacedShare(sector: SectorDef, techs: Record<TechId, TechState>): number {
  return intensityOf(sector, techs);
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

/** 1.00 is the census. Machines make goods abundant and the index falls. */
function priceRatio(techs: Record<TechId, TechState>): number {
  let base = 0;
  let output = 0;
  for (const sector of SECTORS) {
    const gone = displacedShare(sector, techs);
    const humans = sector.baseSlots * (1 - gone);
    const machines = gone > 0 && gone < 0.98 ? sector.baseSlots * gone : 0;
    base += sector.baseSlots;
    output += humans + machines * AUTOMATON_OUTPUT;
  }
  if (base <= 0) return 1;
  return clamp(1 / Math.pow(output / base, 0.35), 0.55, 1.08);
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

function desiredSlots(
  pop: number,
  policies: Policies,
  techs: Record<TechId, TechState>,
  year: number,
  climate?: number,
): number[] {
  const forces = yearForces(year);
  const cheap = clamp(1 - priceRatio(techs), 0, 0.45);
  const absorb = absorption(techs, policies);
  let displacedJobs = 0;
  let machineTotal = 0;
  const ownMachines = SECTORS.map((sector) => {
    const scale = peopleScale(pop, JOB_ELASTICITY[sector.id]);
    const gone = displacedShare(sector, techs);
    const machines = sector.baseSlots * scale * gone;
    displacedJobs += sector.baseSlots * scale * gone;
    machineTotal += machines;
    return machines;
  });
  return SECTORS.map((sector, index) => {
    const gone = displacedShare(sector, techs);
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
    if (sector.id === "services") slots += machineTotal * 0.05;
    if (
      absorb > 0 &&
      (sector.id === "services" || sector.id === "health" || sector.id === "education")
    ) {
      slots += (displacedJobs * absorb) / 3;
    }
    return Math.max(0, slots * (climate ?? 1));
  });
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
  serviceSpend: { services: number; interest: number; principal: number; construction: number };
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
  const shock = priceRatio(args.techs);
  if (shock < 0.97) participation -= (0.97 - shock) * 0.03;
  if (args.policies.retrain && shock < 0.98) participation += 0.006;
  participation = clamp(participation, 0.55, 0.68);

  const ages = cityAges(args.pop, participation);
  const laborForce = Math.max(1, lookingCount(ages));
  const wantedRaw = desiredSlots(args.pop, args.policies, args.techs, args.year, args.climate);
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

  const sectors: SectorSnap[] = SECTORS.map((sector, index) => {
    const gone = displacedShare(sector, args.techs);
    const humans = employedCounts[index] ?? 0;
    const automatons = gone <= 0 || gone >= 0.98 ? 0 : Math.round((humans * gone) / (1 - gone));
    const premium = 1 + gone * 0.28;
    const wage =
      Math.round((sector.baseWage * relative * premium * forces.pay) / 100) * 100;
    const prev = args.prevEmployed?.get(sector.id);
    return {
      id: sector.id,
      employed: humans,
      wage,
      prevEmployed: prev ?? null,
      automatons,
    };
  });

  const wageBill = sectors.reduce((sum, sector) => sum + sector.employed * sector.wage, 0);
  const avgWage = employed > 0 ? wageBill / employed : 0;
  const priceIndex = priceRatio(args.techs);
  const automatons = sectors.reduce((sum, sector) => sum + sector.automatons, 0);
  const outputUnits = sectors.reduce(
    (sum, sector) => sum + sector.employed + sector.automatons * AUTOMATON_OUTPUT,
    0,
  );
  const goods = outputUnits * avgWage * priceIndex;
  const profit = Math.max(0, Math.round(goods - wageBill));
  let humanBase = 0;
  for (let index = 0; index < SECTORS.length; index += 1) {
    const sector = SECTORS[index]!;
    const snap = sectors[index]!;
    let activity = 1;
    if (sector.id === "transport") activity *= forces.trade;
    if (sector.id === "transport" && args.policies.gates === "open") activity *= 1.05;
    if (sector.id === "transport" && args.policies.gates === "tight") activity *= 0.97;
    if (sector.id === "housing") activity *= forces.slot.housing;
    humanBase += snap.employed * snap.wage * activity;
  }
  const band = args.policies.tax === "high" ? 1.12 : args.policies.tax === "low" ? 0.88 : 1;
  const profitTax = Math.round(profit * PROFIT_TAKE[args.policies.ownership] * band);
  const taxRevenue = Math.round(humanBase * TAX_RATES[args.policies.tax]) + profitTax;
  const unemployed = Math.max(0, laborForce - employed);
  const costs = programCosts(args.pop, unemployed);
  let dividend = args.policies.dividend ? costs.dividend : 0;
  if (args.policies.ownership === "citizens") dividend += Math.round(profit * CITIZEN_PAYOUT);
  const spend: SpendParts = {
    standing: costs.standing,
    stipend: args.policies.stipend ? costs.stipend : 0,
    dividend,
    works: args.policies.works ? costs.works : 0,
    retrain: args.policies.retrain ? costs.retrain : 0,
    services: args.serviceSpend.services,
    interest: args.serviceSpend.interest,
    construction: args.serviceSpend.construction,
    principal: args.serviceSpend.principal,
  };
  const spending =
    spend.standing +
    spend.stipend +
    spend.dividend +
    spend.works +
    spend.retrain +
    spend.services +
    spend.interest +
    spend.principal +
    spend.construction;
  return {
    sectors,
    employed,
    laborForce,
    ages,
    unemployed,
    unemployment: unemployed / laborForce,
    avgWage,
    taxRevenue,
    spending,
    spend,
    wanted,
    automatons,
    priceIndex,
    profit,
    realWage: priceIndex > 0 ? avgWage / priceIndex : avgWage,
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
  return scaleTo(prev, employedTarget);
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
  });
  const openingWorksState = openingWorks();
  const openingCovers = coverOf(BASE_POP, census.employed, openingWorksState);
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
    priceIndex: Math.round(census.priceIndex * 100),
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
  if (state.avgWage > 43_000) growth += 0.001;
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

export function serviceBill(works: Works): Record<ServiceId, number> {
  const bill: Record<ServiceId, number> = { power: 0, water: 0, waste: 0 };
  for (const def of SERVICES) {
    const plant = asPlant(works[def.id]);
    bill[def.id] = Math.round(def.yearlyCost * plant.plants + def.yearlyCost * AUTO_COST_SHARE * plant.auto);
  }
  return bill;
}

export function snapshot(state: Ledger): YearMark {
  const bill = serviceBill(state.works);
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
    powerCost: bill.power,
    waterCost: bill.water,
    wasteCost: bill.waste,
  };
}

type TrailInput = Omit<
  Ledger,
  "history" | "events" | "enacted" | "enactedTech" | "shadow" | "pace" | "ages" | "works" | "loans" | "debt" | "crime" | "protest" | "covers"
> &
  Partial<
    Pick<
      Ledger,
      "history" | "events" | "enacted" | "enactedTech" | "shadow" | "pace" | "ages" | "works" | "loans" | "debt" | "crime" | "protest" | "covers"
    >
  >;

/** Fill the trend trail for a city saved before charts existed. */
export function ensureTrail(state: TrailInput): Ledger {
  const enactedRaw = state.enacted ?? (state.hasClosedYear ? state.policies : { ...NEUTRAL });
  const policies = { ...state.policies, ownership: state.policies.ownership ?? "firms" };
  const enacted = { ...enactedRaw, ownership: enactedRaw.ownership ?? policies.ownership };
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
  const loans = state.loans ?? loansFromBalance(state.debt ?? 0);
  const debt = debtOf(loans);
  const covers = state.covers ?? coverOf(state.population, state.employed, works);
  const history = (state.history?.length ? state.history : []).map((mark, index, all) => {
    if (typeof mark.laborForce === "number") return mark;
    const isCurrent = index === all.length - 1 && mark.year === state.year;
    return {
      ...mark,
      laborForce: isCurrent ? state.laborForce : Math.round(mark.population * PARTICIPATION),
    };
  });
  const shadowLoans = state.shadow ? (state.shadow.loans ?? loansFromBalance(state.shadow.debt ?? 0)) : [];
  const withBooks: Ledger = {
    ...state,
    policies,
    priceIndex: state.priceIndex ?? 100,
    profit: state.profit ?? 0,
    realWage: state.realWage ?? state.avgWage,
    transition: state.transition ?? { laidOff: 0, retraining: 0, tenders: 0 },
    history,
    events: state.events ?? [],
    enacted,
    enactedTech,
    ages,
    works,
    loans,
    debt,
    crime: state.crime ?? crimeIndex(state.unemployment, worstCover(covers), state.policies.stipend || state.policies.dividend),
    protest: state.protest ?? false,
    covers,
    spend: { ...emptySpend(), ...state.spend },
    shadow: state.shadow
      ? {
          ...state.shadow,
          policies: { ...state.shadow.policies, ownership: state.shadow.policies.ownership ?? "firms" },
          loans: shadowLoans,
          debt: debtOf(shadowLoans),
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
  const toggles: readonly [keyof Policies, string][] = [
    ["stipend", "Jobless stipend"],
    ["dividend", "Citizen dividend"],
    ["works", "Public works"],
    ["retrain", "Retraining"],
    ["wageFloor", "Wage floor"],
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

function serviceOpex(works: Works): number {
  const bill = serviceBill(works);
  return bill.power + bill.water + bill.waste;
}

function serviceCapex(works: Works): number {
  return SERVICES.reduce((sum, def) => sum + def.buildCost * asPlant(works[def.id]).staged, 0);
}

function commitWorks(works: Works): Works {
  const next = {} as Works;
  for (const def of SERVICES) {
    const plant = asPlant(works[def.id]);
    next[def.id] = {
      plants: plant.plants + (plant.staged > 0 && !plant.stagedAuto ? 1 : 0),
      auto: plant.auto + (plant.staged > 0 && plant.stagedAuto ? 1 : 0),
      staged: plant.staged,
      stagedAuto: plant.stagedAuto,
    };
  }
  return next;
}

function clearStaged(works: Works): Works {
  const next = {} as Works;
  for (const def of SERVICES) {
    const plant = asPlant(works[def.id]);
    next[def.id] = { plants: plant.plants, auto: plant.auto, staged: 0, stagedAuto: false };
  }
  return next;
}

function plantLabels(works: Works): string[] {
  const labels: string[] = [];
  for (const def of SERVICES) {
    const plant = asPlant(works[def.id]);
    if (plant.staged <= 0) continue;
    labels.push(plant.stagedAuto ? `Automated ${def.name.toLowerCase()} plant opened` : `${def.name} plant opened`);
  }
  return labels;
}

export function stageService(state: Ledger, id: ServiceId, kind: "crew" | "auto" = "crew"): Ledger {
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

function coverOverdraft(
  treasury: number,
  loans: CityLoan[],
): { treasury: number; loans: CityLoan[]; taken: CityLoan[] } {
  const taken: CityLoan[] = [];
  let cash = treasury;
  let book = loans;
  while (cash < 0 && taken.length < 6) {
    const loan = makeLoan(book);
    book = [...book, loan];
    cash += LOAN_SIZE;
    taken.push(loan);
  }
  return { treasury: cash, loans: book, taken };
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

function applyUtilityJobs<T extends { employed: number; laborForce: number; unemployment: number }>(
  econ: T,
  works: Works,
): T {
  const extra = utilityJobs(works) - utilityJobs(openingWorks());
  const employed = clamp(econ.employed + extra, 0, econ.laborForce);
  const laborForce = Math.max(1, econ.laborForce);
  return { ...econ, employed, unemployment: (laborForce - employed) / laborForce };
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
  const builtWorks = book ? commitWorks(state.works) : state.works;
  const opened = book ? plantLabels(state.works) : [];
  const jobsForDemand = state.employed;
  const billed = serviceLoans(state.loans ?? []);
  const machines = machineCount(state) + stagedMachines({ techs });
  const covers = coverOf(population, jobsForDemand, builtWorks, state.year + 1, machines);
  const needsMet = policies.stipend || policies.dividend || policies.ownership === "citizens";
  const protest = willProtest(covers, state.unemployment, state.stability, needsMet);
  const gentle = !deepening && statuteLabels(state, techs).length === 0 && !protest && worstCover(covers) >= 0.95;
  const prevEmployed = new Map(state.sectors.map((sector) => [sector.id, sector.employed]));
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
      services: serviceOpex(builtWorks),
      interest: billed.interest,
      principal: billed.principal,
      construction: book ? serviceCapex(state.works) : 0,
    },
  });
  const withCrews = applyUtilityJobs(econ, builtWorks);
  let treasury = state.treasury + withCrews.taxRevenue - withCrews.spending;
  let loans = billed.loans;
  const rescue = coverOverdraft(treasury, loans);
  treasury = rescue.treasury;
  loans = rescue.loans;
  const crime = crimeIndex(withCrews.unemployment, worstCover(covers), needsMet);
  const stability = nextStability(
    { ...state, policies, crime, protest, covers },
    withCrews,
    treasury,
    newTechNames.length,
    techs,
    rescue.taken.length > 0,
  );
  const nextView = { ...withCrews, stability, treasury };
  const year = state.year + 1;
  const labels = book ? [...statuteLabels(state, techs), ...opened, ...(protest ? ["Protest"] : [])] : [];
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
    works: clearStaged(builtWorks),
    priceIndex: Math.round(withCrews.priceIndex * 100),
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
          opened,
          loans: rescue.taken.map((loan) => `Loan ${loan.name} at ${(loan.rate * 100).toFixed(1)}%`),
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
  city?: { protest: boolean; covers: ServiceCover; opened: string[]; loans?: string[] },
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
  if (next.priceIndex < 0.97) sentences.push("Prices fell. Goods got cheaper.");
  else if (next.priceIndex > 1.03) sentences.push("Prices rose.");

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
  if (city?.protest) cityLines.push("A protest broke out. Some firms left.");
  else if (city) {
    const short = SERVICES.find((def) => city.covers[def.id] < 0.98);
    if (short) cityLines.push(`${short.name} does not cover the city.`);
  }
  const loanLine = sentences.find((line) => line.includes("taken to cover")) ?? "";
  const priceLine = sentences.find((line) => line.startsWith("Prices")) ?? "";
  const picked = [...cityLines, lead, jobless, priceLine, money, loanLine, stable].filter(
    (line, index, all) => line && all.indexOf(line) === index,
  );
  return picked.slice(0, 5).join(" ");
}

function nextStability(
  prev: Ledger,
  econ: Project,
  treasury: number,
  newTechCount: number,
  techs: Record<TechId, TechState>,
  rescued = false,
): number {
  const u = econ.unemployment;
  const price = econ.priceIndex;
  let delta = 0;
  const needs = prev.policies.stipend || prev.policies.dividend || prev.policies.ownership === "citizens";
  if (u > 0.09) delta += (0.09 - u) * (needs ? 28 : 52);
  else if (u < 0.045) delta += 0.4;
  delta += clamp((1 - price) * 26, 0, 11);

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
  if (rescued) delta -= 1.5;
  if (newTechCount > 0 && econ.automatons === 0) delta -= newTechCount;
  if (treasury < 0) delta -= 2.4 + Math.min(5, -treasury / 10_000_000);
  if (econ.avgWage < prev.avgWage * 0.97) delta -= 1;
  if (econ.avgWage > prev.avgWage * 1.04 && u < 0.12) delta += 0.4;
  const worst = worstCover(prev.covers ?? { power: 1, water: 1, waste: 1 });
  if (worst < 0.98) delta -= (0.98 - worst) * 45;
  if (prev.crime > 22) delta -= (prev.crime - 22) * 0.09;
  if (prev.protest) delta -= 5;
  delta = clamp(delta, -12, 8);
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
): string {
  const sector = sectorDef(sectorId);
  const tech = techs[sector.tech];
  const status = techStatus(tech);
  if (status === "off") return "No automation";
  if (status === "staged") return "Staged for next year";
  const share = intensityOf(sector, techs);
  if (share < 0.22) return `Automated · year ${tech.activeYears} · light`;
  if (share < 0.45) return `Automated · year ${tech.activeYears} · partial`;
  return `Automated · year ${tech.activeYears} · heavy`;
}

export function formatBalance(tax: number, spending: number): string {
  return formatMarks(tax - spending);
}
