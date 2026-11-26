/**
 * Derived story beats for the UI: protest cutscene tiers and the zombie game over.
 * Nothing here changes the ledger. `advance` stays pure, so tests and balance runs can go past stability 0;
 * the UI reads `isGameOver` and stops the player there.
 */
import { POLICE, asPolice, waveDamage, type Ledger, type UnrestWave } from "./engine.ts";

export type ProtestTier = 1 | 2 | 3 | 4;

/** Which illustration a wave gets, by the stability line that set it off. 70–65 → 1, 60–55 → 2, 50–35 → 3, 30 and below → 4. */
export function protestTier(line: number): ProtestTier {
  if (line >= 65) return 1;
  if (line >= 55) return 2;
  if (line >= 35) return 3;
  return 4;
}

export const PROTEST_TITLES: Record<ProtestTier, { title: string; kicker: string }> = {
  1: { title: "Marchers fill Harbor Avenue", kicker: "Peaceful protest" },
  2: { title: "General strike: the city grinds to a halt", kicker: "Strikes and barricades" },
  3: { title: "Riots break out downtown", kicker: "Looting and clashes" },
  4: { title: "Curfew: the city goes dark", kicker: "State of emergency" },
};

/** The wave that broke out at the year just closed, if any. */
export function newWave(ledger: Ledger): UnrestWave | null {
  const wave = ledger.unrest?.wave ?? null;
  if (!wave || wave.started !== ledger.year) return null;
  return wave;
}

export type ProtestDispatch = {
  tier: ProtestTier;
  title: string;
  kicker: string;
  line: number;
  /** Share of shop, office, freight, and building output lost each year of the wave, after police. */
  outputHit: number;
  /** Share of shop jobs closed by looting at the start, after police. */
  shopsClosed: number;
  years: number;
  police: "low" | "normal" | "strong";
};

/** The cutscene for a wave that started this year, or null if none did (or the city already fell). */
export function protestDispatch(ledger: Ledger): ProtestDispatch | null {
  if (isGameOver(ledger)) return null;
  const wave = newWave(ledger);
  if (!wave) return null;
  const police = asPolice(ledger.policies?.police);
  const damage = waveDamage(wave, police);
  const tier = protestTier(wave.line);
  return {
    tier,
    ...PROTEST_TITLES[tier],
    line: wave.line,
    outputHit: damage.share,
    shopsClosed: damage.closed,
    years: wave.length,
    police,
  };
}

/** The city has fallen once a closed year leaves stability at 0. */
export function isGameOver(ledger: Pick<Ledger, "stability" | "hasClosedYear">): boolean {
  return ledger.hasClosedYear && ledger.stability <= 0;
}

export type FinalTally = {
  yearsSurvived: number;
  finalYear: number;
  peakPopulation: number;
  finalPopulation: number;
  unemployment: number;
  protestWaves: number;
  debt: number;
  treasury: number;
};

export function protestWaveCount(ledger: Pick<Ledger, "events">): number {
  return (ledger.events ?? []).filter((event) => event.label.startsWith("Protest wave")).length;
}

export function finalTally(ledger: Ledger): FinalTally {
  const first = ledger.history[0]?.year ?? ledger.year;
  const peak = Math.max(ledger.population, ...ledger.history.map((mark) => mark.population));
  return {
    yearsSurvived: Math.max(0, ledger.year - first),
    finalYear: ledger.year,
    peakPopulation: peak,
    finalPopulation: ledger.population,
    unemployment: ledger.unemployment,
    protestWaves: protestWaveCount(ledger),
    debt: ledger.debt,
    treasury: ledger.treasury,
  };
}

/** Yearly police bill at a level, at today's pay (same formula the engine books). */
export function policeCost(level: "low" | "normal" | "strong", ledger: Pick<Ledger, "population" | "wageScale">): number {
  return Math.round(ledger.population * POLICE[level].perCapita * Math.max(ledger.wageScale ?? 1, 0.2));
}
