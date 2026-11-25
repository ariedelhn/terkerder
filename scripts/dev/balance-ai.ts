// Balance runs for the AI-adoption mechanics. Run: node --experimental-strip-types scripts/dev/balance-ai.ts [years]
import {
  advance,
  openingState,
  serviceOutlook,
  setResearch,
  stagePower,
  stageService,
  toggleTech,
  TECHS,
  jobsGap,
  housingPressure,
  type Ledger,
  type Policies,
} from "../../src/lib/sim/engine.ts";
import { kindUnlocked, RESEARCH_IDS, researchStatus, stageRoom } from "../../src/lib/sim/energy.ts";

type Plan = {
  name: string;
  build: boolean;
  each: (s: Ledger) => Ledger;
};

function setPol(s: Ledger, patch: Partial<Policies> & Record<string, unknown>): Ledger {
  return { ...s, policies: { ...s.policies, ...patch } as Policies };
}

function keepUp(s: Ledger, auto: boolean): Ledger {
  let state = s;
  for (const id of ["power", "water", "waste"] as const) {
    const out = serviceOutlook(state, id);
    if (out.nextCover >= 1.03) continue;
    if (id === "power") {
      const e = state.energy;
      const kind = kindUnlocked(e, "tidal") && stageRoom(e, "tidal") > 0 ? "tidal" : kindUnlocked(e, "solar") ? "solar" : "oil";
      state = stagePower(state, kind, auto ? "auto" : "crew");
      if (kind === "solar" && out.nextCover < 0.97) state = stagePower(state, kind, auto ? "auto" : "crew");
    } else {
      state = stageService(state, id, auto ? "auto" : "crew");
    }
  }
  if (!state.energy.active) {
    const next = RESEARCH_IDS.find((id) => researchStatus(state.energy, id) === "open");
    if (next) state = setResearch(state, next);
  }
  return state;
}

/** What a careful player does with the budget: raise tax when the reserve runs thin, ease it when flush. */
function fiscal(s: Ledger): Ledger {
  const net = s.taxRevenue - s.spending;
  if (s.treasury < 120_000_000 && net < 0 && s.policies.tax !== "high") return setPol(s, { tax: s.policies.tax === "low" ? "mid" : "high" });
  if (s.treasury > 700_000_000 && net > 0 && s.policies.tax === "high") return setPol(s, { tax: "mid" });
  return s;
}

function techOn(s: Ledger, ids: string[]): Ledger {
  let state = s;
  for (const id of ids) {
    const t = state.techs[id as keyof typeof state.techs];
    if (t && !t.on) state = toggleTech(state, id as never);
  }
  return state;
}

const ALL = TECHS.map((t) => t.id as string);

const plans: Plan[] = [
  {
    name: "careful",
    build: true,
    each: (s) => {
      let st = s;
      if (s.year === 3) st = setPol(st, { retrain: true, publicHiring: "some", aiLevy: true });
      if (s.unemployment > 0.085 && !st.policies.stipend) st = setPol(st, { stipend: true });
      if (s.unemployment < 0.06 && st.policies.stipend) st = setPol(st, { stipend: false });
      st = fiscal(st);
      return keepUp(st, false);
    },
  },
  {
    name: "careful+react",
    build: true,
    each: (s) => {
      let st = s;
      if (s.year === 3) st = setPol(st, { retrain: true, publicHiring: "some", aiLevy: true });
      if (s.unemployment > 0.085 && !st.policies.stipend) st = setPol(st, { stipend: true });
      if (s.unemployment < 0.06 && st.policies.stipend) st = setPol(st, { stipend: false });
      // Strong police only while a wave is on; normal once it ends.
      st = setPol(st, { police: s.unrest.wave != null ? "strong" : "normal" });
      // When the books keep sinking into debt, drop the optional programs before the protests start.
      const sinking = s.debt > 150_000_000 && s.taxRevenue < s.spending;
      if (sinking) st = setPol(st, { publicHiring: "off", retrain: false });
      else if (s.debt === 0 && s.treasury > 300_000_000 && s.year > 3) st = setPol(st, { publicHiring: "some", retrain: true });
      st = fiscal(st);
      return keepUp(st, false);
    },
  },
  {
    name: "moderate",
    build: true,
    each: (s) => {
      let st = s;
      if (s.year === 3) st = setPol(st, { retrain: true });
      if (s.year === 10) st = techOn(st, ["food", "transport", "services"]);
      if (s.year === 12) st = setPol(st, { stipend: true, publicHiring: "some" });
      return keepUp(st, s.year > 15);
    },
  },
  {
    name: "alan",
    build: true,
    each: (s) => {
      let st = s;
      if (s.year === 3) st = techOn(st, ["transport", "food"]);
      if (s.year === 5) st = setPol(techOn(st, ["services", "energy", "housing"]), { stipend: true });
      if (s.year === 8) st = techOn(st, ["government", "office"]);
      if (s.year === 12) st = techOn(st, ALL.filter((id) => id !== "education"));
      if (s.year === 20) st = techOn(st, ALL);
      if (s.year === 30) st = setPol(st, { tax: "low", gates: "open" });
      return keepUp(st, true);
    },
  },
  {
    name: "alan+share",
    build: true,
    each: (s) => {
      let st = s;
      if (s.year === 3) st = setPol(techOn(st, ["transport", "food"]), { retrain: true });
      if (s.year === 5) st = setPol(techOn(st, ["services", "energy", "housing"]), { stipend: true, publicHiring: "big" });
      if (s.year === 8) st = setPol(techOn(st, ["government", "office"]), { ownership: "citizens" });
      if (s.year === 12) st = techOn(st, ALL.filter((id) => id !== "education"));
      if (s.year === 20) st = techOn(st, ALL);
      if (s.year === 30) st = setPol(st, { tax: "low", gates: "open" });
      return keepUp(st, true);
    },
  },
  {
    name: "alan+dividend",
    build: true,
    each: (s) => {
      let st = s;
      if (s.year === 3) st = techOn(st, ["transport", "food"]);
      if (s.year === 5) st = setPol(techOn(st, ["services", "energy", "housing"]), { stipend: true, dividend: true });
      if (s.year === 8) st = techOn(st, ["government", "office"]);
      if (s.year === 12) st = techOn(st, ALL.filter((id) => id !== "education"));
      if (s.year === 20) st = techOn(st, ALL);
      if (s.year === 30) st = setPol(st, { tax: "low", gates: "open" });
      return keepUp(st, true);
    },
  },
  {
    // Alan's current game: staffed plants, little automation, open borders, and reacting to trouble.
    name: "open-borders",
    build: true,
    each: (s) => {
      let st = s;
      if (s.year === 3) st = setPol(st, { gates: "open", retrain: true });
      if (s.unemployment > 0.085 && !st.policies.stipend) st = setPol(st, { stipend: true });
      if (s.unemployment < 0.06 && st.policies.stipend) st = setPol(st, { stipend: false });
      st = setPol(st, { police: s.unrest.wave != null ? "strong" : "normal" });
      st = fiscal(st);
      return keepUp(st, false);
    },
  },
  { name: "open-borders-nothing", build: true, each: (s) => keepUp(s.year === 3 ? setPol(s, { gates: "open" }) : s, false) },
  { name: "firms-nothing", build: false, each: (s) => s },
  { name: "firms-nothing+build", build: true, each: (s) => keepUp(s, false) },
];

const years = Number(process.argv[2] ?? 50);
const verbose = process.argv.includes("-v");
for (const plan of plans) {
  let s = openingState();
  const rows: Ledger[] = [];
  for (let y = 1; y < years; y += 1) {
    s = plan.each(s);
    s = advance(s);
    rows.push(s);
    if (verbose && (s.year % 5 === 0)) {
      const a = s.jobs;
      const gap = jobsGap(s.history);
      console.log(
        `  ${plan.name} y${s.year} u=${(s.unemployment * 100).toFixed(1)} yu=${((a.youthUnemployment ?? 0) * 100).toFixed(1)} stab=${s.stability} rsv=${(s.treasury / 1e6).toFixed(0)}m debt=${(s.debt / 1e6).toFixed(0)}m infl=${(s.inflation * 100).toFixed(1)} cpi=${Math.round(s.priceIndex)} pop=${s.population} ai=${a.aiJobs} frz=${a.frozen} pub=${a.publicJobs} desk=${a.officeJobless} down=${a.downshift} gap=${gap?.gap} el=${gap?.elasticity.toFixed(2)} office=${(s.ai.adoption.office*100).toFixed(0)}%`,
      );
    }
  }
  const stab = rows.map((r) => r.stability);
  const avg = stab.reduce((a, b) => a + b, 0) / stab.length;
  const last = rows[rows.length - 1]!;
  const youth = rows.map((r) => r.jobs.youthUnemployment);
  const gapNow = jobsGap(last.history);
  const maxInfl = Math.max(...rows.map((r) => r.inflation));
  const avgInfl = rows.reduce((a, r) => a + r.inflation, 0) / rows.length;
  const maxU = Math.max(...rows.map((r) => r.unemployment));
  const waves = rows.filter((r) => r.unrest.wave && r.unrest.wave.started === r.year).length;
  const crowd = Math.max(...rows.map((r) => housingPressure(r)));
  console.log(
    `${plan.name.padEnd(20)} stab avg ${avg.toFixed(1)} min ${Math.min(...stab)} end ${last.stability} | u end ${(last.unemployment * 100).toFixed(1)}% max ${(maxU * 100).toFixed(1)}% youth end ${(last.jobs.youthUnemployment * 100).toFixed(1)}% max ${(Math.max(...youth) * 100).toFixed(1)}% | gap ${gapNow?.gap ?? "-"} (${(((gapNow?.gap ?? 0) / last.laborForce) * 100).toFixed(1)}% LF) | rsv ${(last.treasury / 1e6).toFixed(0)}m debt ${(last.debt / 1e6).toFixed(0)}m | infl avg ${(avgInfl * 100).toFixed(1)}% max ${(maxInfl * 100).toFixed(1)}% cpi ${Math.round(last.priceIndex)} | pop ${last.population} | waves ${waves} | homes max ${(crowd * 100).toFixed(0)}%`,
  );
}
