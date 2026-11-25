import assert from "node:assert/strict";
import test from "node:test";
import {
  advance,
  blankAdoption,
  jobsGap,
  jobsGapSeries,
  nextAdoption,
  openingState,
  publicHires,
  serviceOutlook,
  stageService,
  type Ledger,
  type Policies,
  type YearMark,
} from "./engine.ts";
import { buildCityMap } from "./city-map.ts";
import { reviveLedger } from "./storage.ts";
import { jobsGapRows } from "./trends.ts";

function withPolicies(state: Ledger, patch: Partial<Policies>): Ledger {
  return { ...state, policies: { ...state.policies, ...patch } };
}

function years(start: Ledger, count: number, each: (s: Ledger) => Ledger = (s) => s): Ledger[] {
  const out: Ledger[] = [start];
  let state = start;
  for (let i = 0; i < count; i += 1) {
    state = advance(each(state));
    out.push(state);
  }
  return out;
}

function adoptFor(count: number, policies: Pick<Policies, "ownership" | "aiLevy">, u = 0.05) {
  let adoption = blankAdoption();
  for (let year = 1; year <= count; year += 1) adoption = nextAdoption(adoption, year, policies, u);
  return adoption;
}

test("firms adopt AI on their own: office work first, hands-on work slower, government never", () => {
  const firms = adoptFor(20, { ownership: "firms", aiLevy: false });
  assert.ok(firms.office > 0.25, `office ${firms.office}`);
  assert.ok(firms.office > firms.transport);
  assert.ok(firms.transport > firms.health);
  assert.ok(firms.health > 0 && firms.health < 0.1);
  assert.equal(firms.government, 0);
  assert.equal(firms.law, 0);
  // Early years are slow: the tools are not mature yet.
  const early = adoptFor(3, { ownership: "firms", aiLevy: false });
  assert.ok(early.office < 0.05, `early office ${early.office}`);
  // It never passes the ceiling.
  const late = adoptFor(200, { ownership: "firms", aiLevy: false });
  assert.ok(late.office <= 0.55 + 1e-9);
});

test("city or resident ownership and the AI levy slow firm adoption", () => {
  const firms = adoptFor(15, { ownership: "firms", aiLevy: false });
  const city = adoptFor(15, { ownership: "city", aiLevy: false });
  const citizens = adoptFor(15, { ownership: "citizens", aiLevy: false });
  const levy = adoptFor(15, { ownership: "firms", aiLevy: true });
  assert.ok(city.office < firms.office && city.office > 0);
  assert.ok(citizens.office < city.office && citizens.office > 0);
  assert.ok(levy.office < firms.office * 0.75);
  // A slack labor market slows firms down; a tight one speeds them up.
  const slack = adoptFor(15, { ownership: "firms", aiLevy: false }, 0.2);
  const tight = adoptFor(15, { ownership: "firms", aiLevy: false }, 0.02);
  assert.ok(slack.office < firms.office && firms.office < tight.office);
});

test("a do-nothing city sees firm AI take jobs without any player automation", () => {
  const run = years(openingState(), 25);
  const end = run[run.length - 1]!;
  assert.ok(end.ai.adoption.office > 0.3);
  assert.ok(end.jobs.aiJobs > 1000, `ai jobs ${end.jobs.aiJobs}`);
  assert.ok(Object.values(end.techs).every((tech) => !tech.on));
  for (const state of run) {
    assert.ok(Number.isFinite(state.jobs.youthUnemployment));
    assert.ok(Number.isFinite(state.stability));
  }
});

/** Keeps the lights and water on so a run measures AI, not blackouts. */
function keepUp(state: Ledger): Ledger {
  let next = state;
  for (const id of ["power", "water", "waste"] as const) {
    if (serviceOutlook(next, id).nextCover < 1.03) next = stageService(next, id, "crew");
  }
  return next;
}

test("attrition: unemployment rises gradually and youth unemployment runs above the total", () => {
  const run = years(openingState(), 30, keepUp);
  for (let i = 1; i < run.length; i += 1) {
    const jump = run[i]!.unemployment - run[i - 1]!.unemployment;
    assert.ok(jump < 0.03, `year ${run[i]!.year} unemployment jumped ${jump}`);
  }
  for (const state of run.slice(1)) {
    assert.ok(state.jobs.youthUnemployment >= state.unemployment, `year ${state.year}`);
    assert.ok(state.jobs.youthUnemployment <= 1);
  }
  const end = run[run.length - 1]!;
  assert.ok(end.jobs.frozen > 0, "firms leave openings unfilled");
  assert.ok(end.jobs.youthUnemployment > end.unemployment * 1.5);
  assert.equal(typeof end.history[end.history.length - 1]!.youthUnemployment, "number");
});

test("public hiring soaks up displaced workers but costs the budget every year", () => {
  assert.equal(publicHires("off", 5000, 100_000), 0);
  const some = publicHires("some", 5000, 100_000);
  const big = publicHires("big", 5000, 100_000);
  assert.ok(some > 0 && big > some);
  assert.ok(publicHires("some", 0, 100_000) > 0, "a small floor even before displacement");

  const plain = years(openingState(), 22);
  const hired = years(openingState(), 22, (s) => (s.year === 2 ? withPolicies(s, { publicHiring: "big" }) : s));
  const a = plain[plain.length - 1]!;
  const b = hired[hired.length - 1]!;
  assert.equal(a.spend.publicJobs, 0);
  assert.ok(b.spend.publicJobs > 10_000_000, `cost ${b.spend.publicJobs}`);
  assert.ok(b.jobs.publicJobs > 0);
  assert.ok(b.unemployment < a.unemployment - 0.01, `${b.unemployment} vs ${a.unemployment}`);
  const health = (s: Ledger) => s.sectors.find((x) => x.id === "health")!.employed;
  assert.ok(health(b) > health(a));
});

test("missing-jobs gap: expected jobs follow output growth and cap at full employment", () => {
  const mark = (year: number, output: number, employed: number, aiJobs = 0): YearMark =>
    ({
      year,
      unemployment: 0.05,
      avgWage: 40_000,
      taxRevenue: 0,
      spending: 0,
      stability: 60,
      population: 100_000,
      treasury: 0,
      employed,
      laborForce: 50_000,
      output,
      aiJobs,
    }) as YearMark;
  const history = [
    mark(1, 100, 40_000),
    mark(2, 105, 42_000),
    mark(3, 110, 44_000),
    mark(4, 115, 46_000),
    mark(5, 140, 44_000, 5000),
  ];
  const series = jobsGapSeries(history);
  assert.equal(series.length, 5);
  assert.ok(Math.abs(series[0]!.elasticity - 1) < 0.05);
  const last = jobsGap(history)!;
  assert.equal(last.expected, 48_500, "40% more output would promise 56k jobs, capped at 97% of 50k");
  assert.equal(last.gap, 4_500);
  assert.equal(jobsGapSeries([]).length, 0);
  // Years saved before output was tracked are skipped.
  const old = [{ ...history[0]!, output: undefined }, ...history.slice(1)];
  assert.equal(jobsGapSeries(old)[0]!.year, 2);
  assert.equal(jobsGapRows(history).length, 5);
});

test("the gap opens as firms adopt AI and is reported in the year summary", () => {
  const run = years(openingState(), 30);
  const end = run[run.length - 1]!;
  const gap = jobsGap(end.history)!;
  assert.ok(gap.gap > 0.03 * (end.history[end.history.length - 1]!.laborForce ?? 1), `gap ${gap.gap}`);
  assert.ok(run.some((s) => s.bulletin.includes("unfilled")));
});

test("downward displacement: office workers crowd into services and push service pay down", () => {
  const base = openingState();
  const quiet = years(base, 20, (s) => withPolicies(s, { aiLevy: true, ownership: "citizens" }));
  const fast = years(base, 20);
  const q = quiet[quiet.length - 1]!;
  const f = fast[fast.length - 1]!;
  assert.ok(f.jobs.downshift > q.jobs.downshift);
  const jobless = (f.history[f.history.length - 1]!.laborForce ?? 0) - f.employed;
  assert.ok(f.jobs.officeJobless > 0 && f.jobs.officeJobless <= jobless * 0.5 + 1);
  const servicesPay = (s: Ledger) => s.sectors.find((x) => x.id === "services")!.wage / s.wageScale;
  assert.ok(servicesPay(f) < servicesPay(q), `${servicesPay(f)} vs ${servicesPay(q)}`);
});

test("office towers go dark on the map as firms adopt AI", () => {
  const start = buildCityMap(openingState()).counts;
  assert.ok(start.offices > 0);
  assert.equal(start.emptyOffices, 0);
  const run = years(openingState(), 30);
  const later = buildCityMap(run[run.length - 1]!).counts;
  assert.ok(later.emptyOffices > 0);
});

test("an old save without the office sector or new policies loads without NaN", () => {
  const base = openingState();
  const raw = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
  const sectors = raw.sectors as { id: string; employed: number }[];
  const office = sectors.find((s) => s.id === "office")!;
  const services = sectors.find((s) => s.id === "services")!;
  services.employed += office.employed;
  raw.sectors = sectors.filter((s) => s.id !== "office");
  for (const key of ["techs", "enactedTech"]) {
    const map = raw[key] as Record<string, unknown> | undefined;
    if (map) delete map.office;
  }
  const policies = { ...(raw.policies as Record<string, unknown>) };
  delete policies.publicHiring;
  delete policies.aiLevy;
  raw.policies = policies;
  delete raw.ai;
  delete raw.jobs;
  raw.history = (raw.history as Record<string, unknown>[]).map((m) => {
    const copy = { ...m };
    delete copy.output;
    delete copy.youthUnemployment;
    delete copy.aiJobs;
    delete copy.publicJobs;
    return copy;
  });

  const revived = reviveLedger(raw);
  assert.ok(revived);
  assert.ok(revived.sectors.some((s) => s.id === "office"));
  assert.equal(revived.sectors.reduce((sum, s) => sum + s.employed, 0), revived.employed);
  assert.equal(revived.policies.publicHiring, "off");
  assert.equal(revived.policies.aiLevy, false);
  const run = years(revived, 5);
  for (const state of run) {
    assert.ok(Number.isFinite(state.unemployment));
    assert.ok(Number.isFinite(state.treasury));
    assert.ok(Number.isFinite(state.jobs.youthUnemployment));
    assert.ok(Number.isFinite(state.ai.adoption.office));
  }
});
