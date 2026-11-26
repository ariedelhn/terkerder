/**
 * Four advisors who read the ledger and give one or two tips each.
 * Every number in a tip comes from the ledger or the engine's own rules; nothing is invented.
 */
import {
  FIRM_AI,
  LEVY_TAKE,
  POLICE,
  SECTORS,
  TECHS,
  UNREST_LINES,
  asPolice,
  crowdingPenalty,
  housingPressure,
  serviceOutlook,
  waveDamage,
  type Ledger,
  type SectorId,
} from "./engine.ts";
import { RESEARCH, kindUnlocked, oilCount, oilShare, researchStatus } from "./energy.ts";
import { formatInt, formatMarks, formatPct, formatSignedPct } from "./format.ts";
import { policeCost } from "./events.ts";

export type AdvisorId = "stability" | "robot" | "energy" | "treasury";
export type AdvisorStatus = "calm" | "watch" | "alert";

export type Advisor = {
  id: AdvisorId;
  name: string;
  role: string;
  status: AdvisorStatus;
  tips: string[];
};

const pct0 = (n: number) => `${Math.round(n * 100)}%`;
const years = (n: number) => `${n} year${n === 1 ? "" : "s"}`;

/** Highest protest line below today's stability that has not already been crossed. Null if none is left. */
export function nextProtestLine(ledger: Pick<Ledger, "stability" | "unrest">): number | null {
  const fired = new Set(ledger.unrest?.fired ?? []);
  const line = UNREST_LINES.find((value) => value < ledger.stability && !fired.has(value));
  return line ?? null;
}

function worst(a: AdvisorStatus, b: AdvisorStatus): AdvisorStatus {
  const rank = { calm: 0, watch: 1, alert: 2 } as const;
  return rank[a] >= rank[b] ? a : b;
}

export function stabilityAdvice(ledger: Ledger): Advisor {
  const s = Math.round(ledger.stability);
  const unrest = ledger.unrest ?? { fired: [], cooldown: 0, wave: null, calmed: [] };
  const wave = unrest.wave && unrest.wave.yearsLeft > 0 ? unrest.wave : null;
  const police = asPolice(ledger.policies.police);
  const line = nextProtestLine(ledger);
  const gap = line == null ? null : Math.max(0, ledger.stability - line);
  const pressure = housingPressure(ledger);
  const youth = ledger.jobs?.youthUnemployment ?? 0;
  const tips: string[] = [];
  let status: AdvisorStatus = "calm";

  if (wave) {
    status = "alert";
    const dmg = waveDamage(wave, police);
    tips.push(
      `A protest wave set off at line ${wave.line} is still running: ${pct0(dmg.share)} of shop, office, freight, and building output is lost, with ${wave.yearsLeft} more year${wave.yearsLeft === 1 ? "" : "s"} to go.`,
    );
    if (police !== "strong") {
      const extra = policeCost("strong", ledger) - policeCost(police, ledger);
      tips.push(
        `Strong police would cut the damage by ${pct0(1 - POLICE.strong.damage / POLICE[police].damage)} and end it a year sooner, for ${formatMarks(extra)} more a year and a little goodwill.`,
      );
    }
  } else if (police === "strong") {
    const saved = policeCost("strong", ledger) - policeCost("normal", ledger);
    tips.push(
      `No wave is running. Strong police cost ${formatMarks(saved)} a year more than normal and wear on goodwill. Go back to normal until the next wave.`,
    );
    status = worst(status, "watch");
  }

  if (line != null && gap != null) {
    if (gap <= 3 && unrest.cooldown <= 0) status = worst(status, "alert");
    else if (gap <= 6) status = worst(status, "watch");
    if (tips.length < 2) {
      tips.push(
        unrest.cooldown > 0
          ? `Stability ${s}. The next protest line is ${line}, ${Math.round(gap)} points away. The streets are tired: no new wave for ${years(unrest.cooldown)}.`
          : `Stability ${s}. The next protest line is ${line}. A fall of ${Math.max(1, Math.ceil(gap))} points sets off a new wave.`,
      );
    }
  }

  if (pressure > 1) {
    status = worst(status, pressure > 1.03 ? "alert" : "watch");
    tips.push(
      `Homes are overfull: ${pct0(pressure)} of what the city's homes hold, costing ${crowdingPenalty(pressure).toFixed(1)} stability a year. Public works or Site machines build homes faster.`,
    );
  }
  if (youth > 0.2) {
    status = worst(status, youth > 0.3 ? "alert" : "watch");
    tips.push(
      `Youth unemployment is ${formatPct(youth)}. Young people with nothing to do are the first in the streets. Public hiring or retraining gives them work.`,
    );
  }
  if (s < 50) status = worst(status, s < 35 ? "alert" : "watch");
  if (tips.length === 0) {
    tips.push(`Stability ${s}. No protest line is close and homes have room. Keep it that way.`);
  }
  return {
    id: "stability",
    name: "Marisol Reyes",
    role: "Stability chief",
    status,
    tips: tips.slice(0, 2),
  };
}

export function robotAdvice(ledger: Ledger): Advisor {
  const tips: string[] = [];
  let status: AdvisorStatus = "calm";
  const adoption = ledger.ai?.adoption ?? ({} as Record<SectorId, number>);
  const levy = ledger.policies.aiLevy === true;

  // Firm AI: the sector furthest along.
  const furthest = SECTORS.map((sector) => ({ sector, share: adoption[sector.id] ?? 0 }))
    .filter((row) => row.share > 0.001)
    .sort((a, b) => b.share - a.share)[0];
  const aiJobs = ledger.jobs?.aiJobs ?? 0;
  const frozen = ledger.jobs?.frozen ?? 0;

  if (furthest) {
    const ceiling = FIRM_AI[furthest.sector.id].ceiling;
    tips.push(
      `Beep. Firms have handed ${pct0(furthest.share)} of ${furthest.sector.name.toLowerCase().replace(/ work$/, "")} jobs to my cousins, out of a ${pct0(ceiling)} ceiling. City-wide: ${formatInt(aiJobs)} jobs, ${formatInt(frozen)} not refilled this year.`,
    );
    if (aiJobs > ledger.laborForce * 0.08) status = "alert";
    else if (furthest.share > 0.1 || frozen > ledger.laborForce * 0.01) status = "watch";
  }

  if (levy) {
    tips.push(
      `AI levy: ON. Firms adopt at half speed and the city takes ${pct0(LEVY_TAKE)} more of machine profit${ledger.profit > 0 ? ` (machine profit ${formatMarks(ledger.profit)})` : ""}. Calculated: slower, safer.`,
    );
  } else {
    tips.push(
      `AI levy: OFF. Switching it on halves how fast firms hand work to AI and taxes ${pct0(LEVY_TAKE)} more of machine profit. My circuits recommend it while jobs are scarce.`,
    );
    if (furthest && furthest.share > 0.05) status = worst(status, "watch");
  }

  // Sectors where people still do all the work and the player could switch on machines.
  const manual = TECHS.filter((tech) => !ledger.techs[tech.id]?.on)
    .map((tech) => ({ tech, snap: ledger.sectors.find((row) => row.id === tech.sectorId) }))
    .filter((row) => row.snap && row.snap.employed > 0)
    .sort((a, b) => b.snap!.employed - a.snap!.employed)[0];
  const automated = TECHS.filter((tech) => ledger.techs[tech.id]?.on);
  if (automated.length > 0 && ledger.unemployment > 0.1) {
    status = worst(status, ledger.unemployment > 0.15 ? "alert" : "watch");
    tips.push(
      `${automated.length} sector${automated.length === 1 ? "" : "s"} automated and unemployment is ${formatPct(ledger.unemployment)}. Each machine makes ten times the goods, but the humans it replaced need retraining or a dividend.`,
    );
  } else if (manual) {
    const name = SECTORS.find((s) => s.id === manual.tech.sectorId)!.name;
    tips.push(
      `Most human labor: ${name.toLowerCase()}, ${formatInt(manual.snap!.employed)} people. ${manual.tech.name} would hand it to machines at ten times the goods. Those crews would need new jobs first.`,
    );
  }

  return { id: "robot", name: "B0-LT “Bolt”", role: "Automation droid", status, tips: tips.slice(0, 2) };
}

export function energyAdvice(ledger: Ledger): Advisor {
  const tips: string[] = [];
  let status: AdvisorStatus = "calm";
  const energy = ledger.energy;
  const power = serviceOutlook(ledger, "power");
  const prior = [...ledger.history].reverse().find((mark) => mark.year < ledger.year && typeof mark.oilPrice === "number");
  const oilChange = prior?.oilPrice ? energy.oilPrice / prior.oilPrice - 1 : null;
  const oil = oilCount(energy);

  if (power.nextCover < 1) {
    status = "alert";
    tips.push(
      `The grid comes up short next year: plants cover ${pct0(power.nextCover)} of demand. Stage a power plant in City before you advance, or the lights go out.`,
    );
  } else if (power.nextCover < 1.1) {
    status = "watch";
    tips.push(
      `Power margin is thin: plants cover ${pct0(power.nextCover)} of next year's demand. One more plant buys room to grow.`,
    );
  }

  if (oil > 0 && oilChange != null && oilChange > 0.1) {
    status = worst(status, oilChange > 0.2 ? "alert" : "watch");
    tips.push(
      `Oil jumped ${formatSignedPct(oilChange)} this year, to ${energy.oilPrice.toFixed(2)}× the census price. Our ${oil} oil plant${oil === 1 ? "" : "s"} carry ${pct0(oilShare(energy))} of the grid.`,
    );
  }

  const clean = kindUnlocked(energy, "solar") || kindUnlocked(energy, "tidal");
  if (oil > 0 && clean && power.nextCover > 1.15) {
    tips.push(
      `We have ${pct0(power.nextCover - 1)} spare power and clean plants unlocked. Closing an oil plant now saves its fuel and protects us from the next price spike.`,
    );
  } else if (oil > 0 && !clean && tips.length < 2) {
    tips.push(`Every plant we close needs a replacement. Finish Solar farms or Tidal turbines before you close oil.`);
  }

  const active = energy.active ? RESEARCH.find((item) => item.id === energy.active) : null;
  if (active) {
    tips.push(`Research: ${active.name}, ${energy.research[active.id] ?? 0} of ${years(active.years)} funded.`);
  } else {
    const open = RESEARCH.filter((item) => researchStatus(energy, item.id) === "open");
    if (open.length > 0) {
      tips.push(
        `No research is funded. Open now: ${open[0].name} (${years(open[0].years)}, ${formatMarks(open[0].cost)} a year)${open.length > 1 ? ` and ${open.length - 1} more` : ""}.`,
      );
    }
  }
  if (tips.length === 0) tips.push(`The grid is steady: ${pct0(power.nextCover)} cover next year.`);
  return { id: "energy", name: "Tomás Brandt", role: "Energy chief", status, tips: tips.slice(0, 2) };
}

export function treasuryAdvice(ledger: Ledger): Advisor {
  const tips: string[] = [];
  let status: AdvisorStatus = "calm";
  const balance = ledger.taxRevenue - ledger.spending;
  if (ledger.hasClosedYear) {
    if (balance < 0) {
      const runway = ledger.treasury > 0 ? Math.floor(ledger.treasury / -balance) : 0;
      status = ledger.treasury + balance < 0 ? "alert" : "watch";
      tips.push(
        `We ran a deficit of ${formatMarks(-balance)} last year. ${ledger.treasury > 0 ? `At that pace the reserve of ${formatMarks(ledger.treasury)} lasts about ${years(runway)}.` : "The reserve is already empty."}`,
      );
    } else {
      tips.push(`A surplus of ${formatMarks(balance)} last year. The reserve stands at ${formatMarks(ledger.treasury)}.`);
    }
  }
  if (ledger.treasury < 0) {
    status = "alert";
    tips.push(`The reserve is overdrawn at ${formatMarks(ledger.treasury)}. Borrow in City or cut a program before the next close.`);
  }
  if (ledger.debt > 0) {
    if (ledger.debt > Math.max(0, ledger.taxRevenue)) status = worst(status, "watch");
    tips.push(`City debt is ${formatMarks(ledger.debt)} across ${ledger.loans.length} loan${ledger.loans.length === 1 ? "" : "s"}. Prepaying when there is a surplus saves the interest.`);
  }
  if (ledger.inflation > 0.05) {
    status = worst(status, ledger.inflation > 0.1 ? "alert" : "watch");
    tips.push(`Prices rose ${formatSignedPct(ledger.inflation)} this year. Wages lag prices, so paychecks buy less.`);
  } else if (ledger.inflation < -0.01) {
    status = worst(status, "watch");
    tips.push(`Prices fell ${formatSignedPct(ledger.inflation)}. Falling prices mean weak spending; people hold off buying.`);
  }
  if (tips.length === 0) tips.push(`The books are open for year ${ledger.year}. Reserve ${formatMarks(ledger.treasury)}, no debt.`);
  return { id: "treasury", name: "Felix Moreau", role: "Treasurer", status, tips: tips.slice(0, 2) };
}

export function advisors(ledger: Ledger): Advisor[] {
  return [stabilityAdvice(ledger), robotAdvice(ledger), energyAdvice(ledger), treasuryAdvice(ledger)];
}
