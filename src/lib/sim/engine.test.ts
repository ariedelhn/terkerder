import assert from "node:assert/strict";
import test from "node:test";
import { advance, borrow, dueThisYear, INFLATION_TARGET, interestRemaining, nextLoanRate, openingState, plantJobs, prepay, PRICE_CENSUS, serviceOutlook, stageService, toggleTech, utilityJobs, yearInflation, type Ledger, type TechId } from "./engine.ts";

function line(state: Ledger): string {
  const u = (state.unemployment * 100).toFixed(1);
  const wage = Math.round(state.avgWage);
  const tax = (state.taxRevenue / 1e6).toFixed(1);
  const spend = (state.spending / 1e6).toFixed(1);
  const reserve = (state.treasury / 1e6).toFixed(1);
  const infl = ((state.inflation ?? 0) * 100).toFixed(1);
  const cpi = Math.round(state.priceIndex);
  const real = Math.round(state.realWage);
  return `y${state.year} u=${u}% infl=${infl}% cpi=${cpi} wage=${wage} real=${real} tax=${tax}m spend=${spend}m rsv=${reserve}m stab=${state.stability} pop=${state.population} emp=${state.employed}`;
}

function run(start: Ledger, years: number): Ledger[] {
  const out: Ledger[] = [start];
  let state = start;
  for (let i = 0; i < years; i += 1) {
    state = advance(state);
    out.push(state);
  }
  return out;
}

function sane(state: Ledger): void {
  assert.ok(Number.isFinite(state.unemployment));
  assert.ok(state.unemployment >= 0 && state.unemployment <= 1);
  assert.ok(Number.isFinite(state.avgWage) && state.avgWage >= 0);
  assert.ok(Number.isFinite(state.taxRevenue));
  assert.ok(Number.isFinite(state.treasury));
  assert.ok(state.stability >= 0 && state.stability <= 100);
  assert.equal(
    state.sectors.reduce((sum, sector) => sum + sector.employed, 0),
    state.employed,
  );
}

test("opening census is a low-unemployment harbor city", () => {
  const state = openingState();
  assert.equal(state.year, 1);
  assert.equal(state.population, 72_000);
  assert.ok(state.unemployment > 0.04 && state.unemployment < 0.09);
  assert.ok(state.avgWage > 35_000 && state.avgWage < 50_000);
  assert.ok(state.taxRevenue > 300_000_000);
  sane(state);
});

test("unemployment counts people looking, not every resident", () => {
  const state = openingState();
  const ages = state.ages;
  assert.equal(ages.children + ages.teens + ages.adults + ages.seniors, state.population);
  assert.equal(ages.looking.children, 0);
  const looking = ages.looking.teens + ages.looking.adults + ages.looking.seniors;
  assert.equal(looking, state.laborForce);
  assert.ok(state.laborForce < state.population * 0.7);
  const unemployed = state.laborForce - state.employed;
  assert.ok(Math.abs(state.unemployment - unemployed / state.laborForce) < 1e-9);
  assert.notEqual(Math.round(state.unemployment * state.population), unemployed);
});

test("higher tax trims jobs and open gates add them", () => {
  const high = advance({ ...openingState(), policies: { ...openingState().policies, tax: "high" } });
  const low = advance({ ...openingState(), policies: { ...openingState().policies, tax: "low" } });
  assert.ok(low.employed > high.employed);
  const open = advance({ ...openingState(), policies: { ...openingState().policies, gates: "open" } });
  const tight = advance({ ...openingState(), policies: { ...openingState().policies, gates: "tight" } });
  assert.ok(open.employed > tight.employed);
  assert.ok(open.unemployment < tight.unemployment);
});

test("automation cheapens goods and creates a profit", () => {
  const plain = advance(openingState());
  const staged = toggleTech(openingState(), "food");
  const next = advance(staged);
  const machines = next.sectors.find((sector) => sector.id === "food");
  const before = plain.sectors.find((sector) => sector.id === "food");
  assert.ok(machines && before && machines.automatons > 200);
  assert.ok(machines.employed < before.employed);
  assert.ok(next.unemployment > plain.unemployment);
  assert.ok(next.priceIndex < 100);
  assert.ok(next.profit > 1_000_000);
  assert.ok(next.realWage > next.avgWage);
});

test("resident ownership pays out machine profit", () => {
  const firms = advance(toggleTech(openingState(), "food"));
  const citizens = advance(
    toggleTech({ ...openingState(), policies: { ...openingState().policies, ownership: "citizens" } }, "food"),
  );
  assert.ok(citizens.spend.dividend > firms.spend.dividend);
  assert.ok(citizens.stability >= firms.stability - 2);
});

test("retraining later opens work the layoffs closed", () => {
  const bare = toggleTech(openingState(), "transport");
  const taught = toggleTech(
    { ...openingState(), policies: { ...openingState().policies, retrain: true } },
    "transport",
  );
  const without = run(bare, 5).at(-1)!;
  const withTrain = run(taught, 5).at(-1)!;
  assert.ok(withTrain.unemployment < without.unemployment);
  assert.ok(withTrain.transition.retraining > 0);
});

test("an overdrawn reserve takes the next loan", () => {
  const broke = { ...openingState(), treasury: -200_000_000 };
  const next = advance(broke);
  assert.ok(next.loans.length >= 2);
  assert.ok(next.treasury >= 0);
  assert.ok(next.bulletin.includes("was taken") || next.bulletin.includes("were taken"));
});

test("a quiet city eventually outgrows power, water, or waste", () => {
  const path = run(openingState(), 22);
  const last = path[path.length - 1]!;
  const worst = Math.min(last.covers.power, last.covers.water, last.covers.waste);
  assert.ok(worst < 0.98, `coverage ${worst}`);
  assert.ok(last.stability < path[0]!.stability, `stability ${last.stability}`);
});

test("next year turns tight before this year does", () => {
  const state = openingState();
  const water = serviceOutlook(state, "water");
  assert.ok(water.cover > 1);
  assert.ok(water.nextCover < water.cover);
  assert.ok(water.nextDemand > water.demand);
});

test("a second loan costs more, and paying one back drops the rate", () => {
  const first = borrow(openingState());
  const second = borrow(first);
  assert.equal(first.loans[0]?.rate, 0.07);
  assert.equal(second.loans[1]?.rate, 0.075);
  assert.ok(nextLoanRate(second.loans.length) > nextLoanRate(first.loans.length));
  const paid = prepay(second, second.loans[1]!.id, second.loans[1]!.balance);
  assert.equal(paid.loans.length, 1);
  assert.equal(nextLoanRate(paid.loans.length), 0.075);
  const piled = Array.from({ length: 6 }, () => 0).reduce((state) => borrow(state), openingState());
  assert.equal(piled.loans.length, 6);
  assert.equal(piled.debt, 80_000_000 * 6);
});

test("a loan pays down principal over ten years", () => {
  let state = borrow(openingState());
  const firstDue = dueThisYear(state.loans[0]!);
  assert.ok(firstDue.interest > firstDue.principal * 0.8);
  assert.ok(firstDue.principal > 1_000_000);
  const interestAtStart = interestRemaining(state.loans[0]!);
  state = advance(state);
  assert.ok(state.loans[0]!.balance < 80_000_000);
  assert.ok(state.spend.principal > 1_000_000);
  const prepaid = prepay(state, state.loans[0]!.id, 20_000_000);
  assert.ok(interestRemaining(prepaid.loans[0]!) < interestRemaining(state.loans[0]!));
  let left = prepaid;
  for (let year = 0; year < 12 && left.loans.length > 0; year += 1) left = advance(left);
  assert.equal(left.loans.length, 0);
  assert.ok(interestAtStart > 5_000_000);
});

test("an automated plant hires fewer people and costs less to run", () => {
  const staffed = advance(stageService(openingState(), "waste", "crew"));
  const automated = advance(stageService(openingState(), "waste", "auto"));
  assert.equal(staffed.works.waste.plants, 4);
  assert.equal(automated.works.waste.auto, 1);
  assert.ok(automated.works.waste.plants === 3);
  assert.ok(plantJobs("waste", automated.works.waste) < plantJobs("waste", staffed.works.waste));
  assert.ok(automated.spend.services < staffed.spend.services);
  assert.ok(utilityJobs(automated.works) < utilityJobs(staffed.works));
  assert.ok(automated.events.some((event) => event.label === "Automated waste plant opened"));
});

test("building waste adds capacity and costs the reserve", () => {
  let state = openingState();
  const before = state.works.waste.plants;
  state = advance(state);
  const idle = state.treasury;
  let built = openingState();
  built = { ...built, works: { ...built.works, waste: { ...built.works.waste, staged: 1 } } };
  built = advance(built);
  assert.equal(built.works.waste.plants, before + 1);
  assert.ok(built.covers.waste > state.covers.waste);
  assert.ok(built.treasury < idle);
  assert.ok(built.events.some((event) => event.label === "Waste plant opened"));
});

test("a loan adds cash now and interest next year", () => {
  const borrowed = borrow(openingState());
  assert.equal(borrowed.debt, 80_000_000);
  assert.ok(borrowed.treasury > openingState().treasury);
  const next = advance(borrowed);
  assert.ok(next.spend.interest > 5_000_000);
  assert.ok(next.debt < borrowed.debt);
  const paid = prepay({ ...next, treasury: next.treasury + 80_000_000 }, next.loans[0]!.id, next.loans[0]!.balance);
  assert.equal(paid.debt, 0);
});

test("quiet path unemployment moves both ways and stays off zero", () => {
  const path = run(openingState(), 18);
  const rates = path.map((state) => state.unemployment);
  let ups = 0;
  let downs = 0;
  for (let index = 1; index < rates.length; index += 1) {
    const delta = rates[index]! - rates[index - 1]!;
    if (delta >= 0.003) ups += 1;
    if (delta <= -0.003) downs += 1;
  }
  console.log(
    "QUIET BAND",
    rates.map((rate) => (rate * 100).toFixed(1)).join(" "),
  );
  assert.ok(ups >= 3, `up years ${ups}`);
  assert.ok(downs >= 3, `down years ${downs}`);
  assert.ok(Math.min(...rates) > 0.025, `floor ${Math.min(...rates)}`);
  // Firms' own AI and its power-hungry data centers push a city that never builds a plant a little higher,
  // and once its stability slides, protest blockades cost it jobs too.
  assert.ok(Math.max(...rates) < 0.17, `peak ${Math.max(...rates)}`);
  const jobs = path.map((state) => state.employed);
  let jobUp = 0;
  let jobDown = 0;
  for (let index = 1; index < jobs.length; index += 1) {
    if (jobs[index]! > jobs[index - 1]!) jobUp += 1;
    if (jobs[index]! < jobs[index - 1]!) jobDown += 1;
  }
  assert.ok(jobUp >= 1 && jobDown >= 1, `jobs up ${jobUp} down ${jobDown}`);
});

test("quiet path stays solvent and steady", () => {
  const path = run(openingState(), 10);
  for (const state of path) sane(state);
  const last = path[path.length - 1]!;
  console.log("QUIET");
  for (const state of path) console.log(line(state));
  assert.ok(last.unemployment < 0.12, `quiet unemployment ${last.unemployment}`);
  assert.ok(last.stability >= 60, `quiet stability ${last.stability}`);
  assert.ok(last.treasury > 0, `quiet treasury ${last.treasury}`);
});

test("dock automation raises unemployment, then cheapens goods", () => {
  const path = run(openingState("docks"), 4);
  console.log("DOCKS");
  for (const step of path) console.log(line(step), step.bulletin);
  const year4 = path[4]!;
  assert.ok(year4.unemployment > path[0]!.unemployment + 0.025);
  const transport = year4.sectors.find((sector) => sector.id === "transport");
  assert.ok(transport && transport.employed < 5200 * 0.55);
  assert.ok(year4.priceIndex < 98);
  assert.ok(year4.profit > 1_000_000);
  assert.ok(year4.stability >= 70);
  sane(year4);
});

test("all technologies without a stipend strain stability", () => {
  let state = openingState();
  const ids: TechId[] = ["housing", "transport", "food", "energy", "services", "government", "health", "education", "law"];
  for (const id of ids) state = toggleTech(state, id);
  const path = run(state, 6);
  console.log("ALL TECH");
  for (const step of path) console.log(line(step));
  const last = path[path.length - 1]!;
  assert.ok(last.unemployment > 0.28, `all-tech unemployment ${last.unemployment}`);
  assert.ok(last.stability < 55, `all-tech stability ${last.stability}`);
  sane(last);
});

test("quiet path records history and no statute marks", () => {
  const path = run(openingState(), 4);
  const last = path[4]!;
  assert.equal(last.history.length, 5);
  assert.equal(last.history[0]!.year, 1);
  assert.equal(last.history[4]!.unemployment, last.unemployment);
  assert.equal(last.history[4]!.population, last.population);
  assert.deepEqual(last.events, []);
  assert.equal(last.pace, null);
});

test("dock statute is marked on the year it takes effect", () => {
  const start = openingState("docks");
  assert.equal(start.events.length, 0);
  assert.equal(start.history.length, 1);
  const year2 = advance(start);
  assert.deepEqual(
    year2.events.map((event) => event.label),
    ["Tax cut to low", "Gates opened", "Automation began · Transport"],
  );
  assert.ok(year2.events.every((event) => event.year === 2));
  assert.equal(year2.pace?.length, 1);
  assert.equal(year2.pace?.[0]?.year, 2);
  assert.notEqual(
    Math.round((year2.pace?.[0]?.unemployment ?? 0) * 1000),
    Math.round(year2.unemployment * 1000),
  );

  const held = advance(year2);
  assert.equal(held.events.length, year2.events.length);
  assert.equal(held.pace?.length, 2);
  assert.equal(held.pace?.[1]?.year, 3);

  const changed = {
    ...held,
    policies: { ...held.policies, stipend: true },
  };
  const year4 = advance(changed);
  assert.equal(year4.year, 4);
  assert.ok(year4.events.some((event) => event.year === 4 && event.label === "Jobless stipend began"));
  assert.equal(year4.events.filter((event) => event.year === 2).length, 3);
  assert.equal(year4.pace?.length, 1);
  assert.equal(year4.pace?.[0]?.year, 4);
});

test("a staged crane that is cancelled leaves no mark", () => {
  let state = toggleTech(openingState(), "transport");
  state = toggleTech(state, "transport");
  const year2 = advance(state);
  assert.deepEqual(year2.events, []);
  assert.equal(year2.pace, null);
});

test("safety charter marks the programs on year two", () => {
  const year2 = advance(openingState("safety"));
  assert.deepEqual(
    year2.events.map((event) => event.label),
    ["Tax raised to high", "Jobless stipend began", "Public works began"],
  );
});

test("a city saved before charts still gains a trail", () => {
  const legacy: Partial<Ledger> = { ...openingState("docks") };
  delete legacy.history;
  delete legacy.events;
  delete legacy.enacted;
  delete legacy.enactedTech;
  delete legacy.shadow;
  delete legacy.pace;
  const next = advance(legacy as Ledger);
  assert.equal(next.history[0]?.year, 1);
  assert.equal(next.history.length, 2);
  assert.ok(next.events.some((event) => event.label === "Automation began · Transport"));
});

test("staffed plant crews sit in a sector and count toward tax", () => {
  const open = openingState();
  sane(open);
  assert.equal(
    open.sectors.reduce((sum, sector) => sum + sector.employed, 0),
    open.employed,
  );
  // Opening plants are on the books, not an invisible baseline of 40,600.
  assert.ok(open.employed > 40_600, `opening employed ${open.employed}`);

  const idle = advance(openingState());
  const built = advance(stageService(openingState(), "waste", "crew"));
  sane(built);
  const wageBill = (state: Ledger, id: "government") => {
    const sector = state.sectors.find((item) => item.id === id)!;
    return sector.employed * sector.wage;
  };
  const idleGov = idle.sectors.find((sector) => sector.id === "government")!;
  const builtGov = built.sectors.find((sector) => sector.id === "government")!;
  assert.equal(
    built.sectors.reduce((sum, sector) => sum + sector.employed, 0),
    built.employed,
  );
  assert.ok(builtGov.employed > idleGov.employed, `government jobs ${builtGov.employed} vs ${idleGov.employed}`);
  assert.ok(wageBill(built, "government") > wageBill(idle, "government"));
});

test("loan names stay unique past Z", () => {
  let state = openingState();
  for (let i = 0; i < 30; i += 1) state = borrow(state);
  const names = state.loans.map((loan) => loan.name);
  assert.equal(names.length, 30);
  assert.equal(new Set(names).size, 30);
  assert.ok(names.includes("Z"));
  assert.ok(names.includes("AA"));
  assert.ok(names.includes("AD"));
});

test("emergency borrowing covers a large deficit and unique names stay unique", () => {
  const start = openingState("safety");
  const broke = {
    ...start,
    treasury: -1_000_000_000,
    policies: { ...start.policies, dividend: true, retrain: true },
  };
  const next = advance(broke);
  assert.ok(next.loans.length >= 8, `loans ${next.loans.length}`);
  assert.equal(new Set(next.loans.map((loan) => loan.name)).size, next.loans.length);
  assert.ok(next.treasury > -1_000_000_000, `treasury ${next.treasury}`);
  assert.ok(next.stability < 70, `stability ${next.stability}`);
  assert.ok(next.events.some((event) => event.label === "Austerity"));
});

test("a deep deficit run hurts stability instead of holding near 90", () => {
  let state = openingState("safety");
  state = {
    ...state,
    policies: { ...state.policies, dividend: true, retrain: true, wageFloor: true },
  };
  for (let i = 0; i < 15; i += 1) {
    for (const id of ["power", "water", "waste"] as const) {
      if (state.works[id].staged === 0) state = stageService(state, id, "auto");
    }
    state = advance(state);
  }
  sane(state);
  assert.ok(state.stability <= 55, `deficit stability ${state.stability}`);
  assert.ok(state.debt > 400_000_000, `debt ${state.debt}`);
  assert.equal(new Set(state.loans.map((loan) => loan.name)).size, state.loans.length);
});

test("mass automation without a safety net drops stability in the first live year", () => {
  let bare = openingState();
  let supported = openingState();
  supported = { ...supported, policies: { ...supported.policies, stipend: true } };
  const ids: TechId[] = [
    "housing",
    "transport",
    "food",
    "energy",
    "services",
    "government",
    "health",
    "education",
    "law",
  ];
  for (const id of ids) {
    bare = toggleTech(bare, id);
    supported = toggleTech(supported, id);
  }
  const bareYear2 = advance(bare);
  const heldYear2 = advance(supported);
  sane(bareYear2);
  assert.ok(bareYear2.unemployment > 0.15);
  assert.ok(bareYear2.stability <= 65, `unsupported year-2 stability ${bareYear2.stability}`);
  assert.ok(bareYear2.stability < 72);
  assert.ok(heldYear2.stability > bareYear2.stability, `stipend ${heldYear2.stability} vs ${bareYear2.stability}`);
});

test("damaged ownership does not NaN the books", () => {
  const damaged = {
    ...openingState(),
    policies: { ...openingState().policies, ownership: "nope" as Ledger["policies"]["ownership"] },
  };
  const next = advance(toggleTech(damaged, "food"));
  assert.ok(Number.isFinite(next.taxRevenue), `tax ${next.taxRevenue}`);
  assert.ok(Number.isFinite(next.treasury), `treasury ${next.treasury}`);
  assert.equal(next.enacted.ownership, "firms");
});

test("opening census starts at a 100 price index and 2% inflation", () => {
  const state = openingState();
  assert.equal(state.priceIndex, PRICE_CENSUS);
  assert.equal(state.inflation, INFLATION_TARGET);
  assert.equal(state.wageScale, 1);
  assert.equal(state.realWage, Math.round(state.avgWage));
  assert.ok(state.bulletin.includes("Opening census"));
});

test("a quiet city stays near 2% inflation without a stability shock", () => {
  const path = run(openingState(), 10);
  const rates = path.slice(1).map((state) => state.inflation);
  // The AI levy, on by default, trims the deficit a little, so one quiet year can dip just below zero.
  assert.ok(rates.every((rate) => rate > -0.005 && rate < 0.04), `quiet inflation ${rates}`);
  assert.ok(rates.some((rate) => rate >= 0.01 && rate <= 0.03));
  const last = path[path.length - 1]!;
  assert.ok(last.stability >= 60, `quiet stability ${last.stability}`);
  assert.ok(last.priceIndex > 100);
});

test("a year bulletin names the inflation rate", () => {
  const next = advance(openingState());
  assert.match(next.bulletin, /Prices (rose|fell) \d+\.\d+%/);
});

test("automation holds prices below a quiet city", () => {
  const quiet = advance(openingState());
  const food = advance(toggleTech(openingState(), "food"));
  assert.ok(food.priceIndex < quiet.priceIndex, `food ${food.priceIndex} vs quiet ${quiet.priceIndex}`);
  assert.ok(food.inflation < quiet.inflation);
  assert.ok(food.profit > 1_000_000);
});

test("stipend and dividend deficits can produce high inflation and cut real wages", () => {
  const start = {
    ...openingState(),
    policies: { ...openingState().policies, stipend: true, dividend: true, works: true },
  };
  const path = run(start, 7);
  const peak = Math.max(...path.map((state) => state.inflation));
  assert.ok(peak >= 0.08, `peak inflation ${peak}`);
  const last = path[path.length - 1]!;
  assert.ok(last.realWage < path[0]!.realWage, `real wage ${last.realWage} vs ${path[0]!.realWage}`);
  assert.ok(last.priceIndex > 130);
  assert.ok(last.stability < path[0]!.stability);
});

test("mass automation can push prices down in the first live years", () => {
  let state = openingState();
  const ids: TechId[] = ["housing", "transport", "food", "energy", "services", "government", "health", "education", "law"];
  for (const id of ids) state = toggleTech(state, id);
  const year2 = advance(state);
  const year3 = advance(year2);
  assert.ok(year2.inflation < 0, `year-2 inflation ${year2.inflation}`);
  assert.ok(year3.priceIndex < PRICE_CENSUS);
});

test("yearInflation stays near 2% when the city is balanced", () => {
  const balanced = yearInflation({
    prevInflation: INFLATION_TARGET,
    unemployment: 0.05,
    covers: { power: 1, water: 1, waste: 1 },
    goodsRatio: 1,
    prevGoodsRatio: 1,
    gdp: 2_000_000_000,
    deficit: 0,
    transfers: 0,
    moneyFinancing: 0,
  });
  assert.ok(Math.abs(balanced - INFLATION_TARGET) < 0.002, `balanced ${balanced}`);

  const financed = yearInflation({
    prevInflation: INFLATION_TARGET,
    unemployment: 0.05,
    covers: { power: 1, water: 1, waste: 1 },
    goodsRatio: 1,
    prevGoodsRatio: 1,
    gdp: 2_000_000_000,
    deficit: 400_000_000,
    transfers: 200_000_000,
    moneyFinancing: 160_000_000,
  });
  assert.ok(financed > 0.06, `financed ${financed}`);
  assert.ok(financed < 0.2, `financed ${financed}`);
});
