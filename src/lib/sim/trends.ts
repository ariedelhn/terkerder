import { PARTICIPATION, type StatuteEvent, type YearMark } from "./engine.ts";

export type SeriesId =
  | "unemployment"
  | "population"
  | "avgWage"
  | "wagePerCapita"
  | "employed"
  | "taxRevenue"
  | "treasury"
  | "reserveChange"
  | "books"
  | "priceIndex"
  | "profit"
  | "stability";

export type ChartRow = {
  year: number;
  value: number;
  pace: number | null;
  /** People looking for work. Only set on the population chart. */
  eligible: number | null;
};

/** Wage bill divided by every resident, not just people with a job. */
export function wagePerCapita(mark: YearMark): number {
  if (mark.population <= 0) return 0;
  return (mark.avgWage * mark.employed) / mark.population;
}

export function readSeries(mark: YearMark, id: SeriesId): number {
  if (id === "wagePerCapita") return wagePerCapita(mark);
  if (id === "reserveChange" || id === "books") return 0;
  if (id === "priceIndex") return mark.priceIndex ?? 100;
  if (id === "profit") return mark.profit ?? 0;
  return mark[id];
}

/** Actual series, plus the counterfactual pace anchored on the year before it starts. */
export function chartRows(history: YearMark[], pace: YearMark[] | null, id: SeriesId): ChartRow[] {
  if (id === "reserveChange") return reserveRows(history, pace);
  const paceByYear = new Map<number, number>();
  for (const mark of pace ?? []) paceByYear.set(mark.year, readSeries(mark, id));
  const firstPaceYear = pace && pace.length > 0 ? pace[0]!.year : null;
  return history.map((mark) => {
    const value = readSeries(mark, id);
    let paceValue: number | null = null;
    if (firstPaceYear != null && mark.year === firstPaceYear - 1) paceValue = value;
    else if (paceByYear.has(mark.year)) paceValue = paceByYear.get(mark.year) ?? null;
    const eligible =
      id === "population" ? (mark.laborForce ?? Math.round(mark.population * PARTICIPATION)) : null;
    return { year: mark.year, value, pace: paceValue, eligible };
  });
}

function reserveRows(history: YearMark[], pace: YearMark[] | null): ChartRow[] {
  const paceByYear = new Map<number, number>();
  const paceMarks = pace ?? [];
  for (let index = 1; index < paceMarks.length; index += 1) {
    const mark = paceMarks[index]!;
    const prev = paceMarks[index - 1]!;
    paceByYear.set(mark.year, mark.treasury - prev.treasury);
  }
  return history.map((mark, index) => {
    const prev = index === 0 ? null : history[index - 1];
    const value = prev ? mark.treasury - prev.treasury : 0;
    const paceValue = index === 0 ? (paceByYear.size > 0 ? 0 : null) : (paceByYear.get(mark.year) ?? null);
    return { year: mark.year, value, pace: paceValue, eligible: null };
  });
}

/** Latest actual-minus-pace gap. Ignores the anchor year, where the two lines meet. */
export function latestGap(rows: ChartRow[], pace: YearMark[] | null): number | null {
  if (!pace?.length) return null;
  const years = new Set(pace.map((mark) => mark.year));
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]!;
    if (!years.has(row.year) || row.pace == null) continue;
    return row.value - row.pace;
  }
  return null;
}

export function statuteGroups(events: StatuteEvent[], limit = 5): { year: number; labels: string[] }[] {
  const groups: { year: number; labels: string[] }[] = [];
  for (const event of events) {
    const last = groups[groups.length - 1];
    if (last && last.year === event.year) last.labels.push(event.label);
    else groups.push({ year: event.year, labels: [event.label] });
  }
  return groups.slice(-limit).reverse();
}
