import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Ledger, StatuteEvent } from "@/lib/sim/engine";
import { formatInt, formatMarks, formatPct, formatSignedInt, formatSignedMarks, formatSignedPct, formatSignedPoints, formatSignedPp } from "@/lib/sim/format";
import { bookChartRows, chartRows, latestGap, statuteGroups, type SeriesId } from "@/lib/sim/trends";

const SERIES: readonly { id: SeriesId; label: string; stroke: string }[] = [
  { id: "unemployment", label: "Unemployment", stroke: "var(--color-coral)" },
  { id: "population", label: "People", stroke: "var(--color-water)" },
  { id: "employed", label: "Jobs", stroke: "var(--color-ok)" },
  { id: "avgWage", label: "Wages", stroke: "var(--color-gold)" },
  { id: "taxRevenue", label: "Tax", stroke: "var(--color-violet)" },
  { id: "treasury", label: "Reserve", stroke: "var(--color-accent)" },
  { id: "reserveChange", label: "Reserve change", stroke: "var(--color-accent)" },
  { id: "books", label: "Books", stroke: "var(--color-ok)" },
  { id: "priceIndex", label: "Prices", stroke: "var(--color-water)" },
  { id: "inflation", label: "Inflation", stroke: "var(--color-coral)" },
  { id: "profit", label: "Profit", stroke: "var(--color-gold)" },
  { id: "stability", label: "Stability", stroke: "var(--color-danger)" },
];

function formatValue(id: SeriesId, n: number): string {
  if (id === "unemployment") return formatPct(n);
  if (id === "priceIndex") return String(Math.round(n));
  if (id === "inflation") return formatSignedPct(n);
  if (id === "taxRevenue" || id === "treasury" || id === "reserveChange" || id === "profit") return formatMarks(n);
  if (id === "stability") return String(Math.round(n));
  return formatInt(n);
}

function formatAxis(id: SeriesId, n: number): string {
  if (id === "unemployment") return `${Math.round(n * 100)}%`;
  if (id === "stability" || id === "priceIndex") return String(Math.round(n));
  if (id === "inflation") return `${Math.round(n * 100)}%`;
  if (id === "avgWage" || id === "wagePerCapita") return formatMarks(n);
  return formatMarks(n);
}

function unsigned(text: string): string {
  return text.replace(/^[+−]/, "");
}

function gapPhrase(id: SeriesId, delta: number): string | null {
  if (id === "unemployment") {
    const text = formatSignedPp(delta);
    if (text === "0.0 pp") return null;
    return `${unsigned(text)} ${delta > 0 ? "above" : "below"} where the previous statutes would have landed`;
  }
  if (id === "stability") {
    const text = formatSignedPoints(delta);
    if (text === "0") return null;
    return `${unsigned(text)} points ${delta > 0 ? "above" : "below"} where the previous statutes would have landed`;
  }
  if (id === "taxRevenue" || id === "treasury" || id === "reserveChange") {
    const text = formatSignedMarks(delta);
    if (text === "0") return null;
    return `${unsigned(text)} ${delta > 0 ? "above" : "below"} where the previous statutes would have landed`;
  }
  const text = formatSignedInt(delta);
  if (text === "0") return null;
  return `${unsigned(text)} ${delta > 0 ? "above" : "below"} where the previous statutes would have landed`;
}

function domainOf(
  rows: { value: number; pace: number | null; eligible: number | null }[],
  id: SeriesId,
): [number, number] {
  const nums = rows.flatMap((row) => {
    const extra = row.eligible == null ? [] : [row.eligible];
    return row.pace == null ? [row.value, ...extra] : [row.value, row.pace, ...extra];
  });
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    const pad =
      id === "unemployment" ? 0.02 : id === "stability" ? 5 : Math.max(Math.abs(min) * 0.12, 1);
    return [min - pad, max + pad];
  }
  const span = max - min;
  return [min - span * 0.18, max + span * 0.22];
}

function useQuietMotion(): boolean {
  const [quiet, setQuiet] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setQuiet(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return quiet;
}

export function Trends({ ledger }: { ledger: Ledger }) {
  const [seriesId, setSeriesId] = useState<SeriesId>("unemployment");
  const [wageView, setWageView] = useState<"job" | "person">("job");
  const [mounted, setMounted] = useState(false);
  const quiet = useQuietMotion();
  useEffect(() => setMounted(true), []);

  const series = SERIES.find((item) => item.id === seriesId) ?? SERIES[0]!;
  const books = series.id === "books";
  const plotted: SeriesId = series.id === "avgWage" && wageView === "person" ? "wagePerCapita" : series.id;
  const rows = books ? [] : chartRows(ledger.history, ledger.pace, plotted);
  const bookRows = bookChartRows(ledger.history).map((mark) => ({
    year: String(mark.year),
    income: mark.income,
    expenses: mark.expenses,
  }));
  const gap = books ? null : latestGap(rows, ledger.pace);
  const phrase = gap == null ? null : gapPhrase(plotted, gap);
  const current = rows.length > 0 ? rows[rows.length - 1]!.value : null;
  const marks = [...new Set(ledger.events.map((event) => event.year))];
  const groups = statuteGroups(ledger.events);
  const startedLate = (ledger.history[0]?.year ?? 1) > 1;
  const hasPace = (ledger.pace?.length ?? 0) > 0;
  const domain = rows.length > 0 ? domainOf(rows, plotted) : ([0, 1] as [number, number]);
  const chartRowsView = rows.map((row) => ({
    year: String(row.year),
    value: row.value,
    pace: row.pace,
    eligible: row.eligible,
  }));
  const showEligible = plotted === "population";
  const heading = books ? "Income and expenses" : plotted === "wagePerCapita" ? "Wage per person" : series.label;
  const stroke = plotted === "wagePerCapita" ? "var(--color-gold)" : series.stroke;
  const bookDomain = (() => {
    const nums = bookRows.flatMap((row) => [row.income, row.expenses]);
    if (nums.length === 0) return [0, 1] as [number, number];
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const pad = Math.max((max - min) * 0.08, 1);
    return [Math.min(0, min - pad), max + pad] as [number, number];
  })();

  const verb = heading === "People" || heading === "Jobs" || heading === "Wages" ? "are" : "is";
  let note = "A mark appears on the year a statute takes effect, not the year you switch it.";
  if (ledger.events.length === 0 && ledger.year > 1) {
    note = "No statute has taken effect. Trade, turnover, and new workers still move the line.";
  } else if (phrase) {
    note = `${heading} ${verb} ${phrase}.`;
  } else if (hasPace) {
    note = "In line with where the previous statutes would have landed.";
  }
  if (plotted === "wagePerCapita") {
    note = `${note} Wage per capita is every crypto coin of wages divided by every resident, including people without a job.`;
  }
  if (showEligible) {
    note = `${note} The lower line is people looking for work. Unemployment uses that line, not the whole city.`;
  }
  if (books) {
    note = "Green is tax income. Red is everything the city spent that year.";
  }

  return (
    <section className="min-w-0 rounded-xl border border-border bg-card px-4 py-4" aria-label="Trends" data-testid="trends">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-sans text-sm font-medium text-muted-foreground">{heading}</h2>
        {ledger.history.length > 1 ? (
          <p className="text-sm text-subtle tabular-nums">
            Year {ledger.history[0]!.year}–{ledger.history[ledger.history.length - 1]!.year}
          </p>
        ) : (
          <p className="text-sm text-subtle">Year {ledger.year}</p>
        )}
      </div>
      {books && bookRows.length > 0 ? (
        <p className="mt-1 font-sans text-2xl font-semibold tabular-nums" data-testid="trend-value">
          <span className="text-ok">{formatMarks(bookRows[bookRows.length - 1]!.income)}</span>
          <span className="text-muted-foreground"> / </span>
          <span className="text-danger">{formatMarks(bookRows[bookRows.length - 1]!.expenses)}</span>
        </p>
      ) : current != null ? (
        <p className="mt-1 font-sans text-2xl font-semibold tabular-nums" data-testid="trend-value">
          {formatValue(plotted, current)}
        </p>
      ) : null}
      <p className="mt-2 text-sm text-muted-foreground" data-testid="trend-note">
        {note}
      </p>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Which figure to chart">
        {SERIES.map((item) => {
          const selected = item.id === series.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold ${selected ? "bg-accent text-accent-foreground" : "bg-elevated text-foreground"}`}
              onClick={() => setSeriesId(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {series.id === "avgWage" ? (
        <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Wage view">
          <button
            type="button"
            role="radio"
            aria-checked={wageView === "job"}
            className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${wageView === "job" ? "bg-accent text-accent-foreground" : "bg-elevated text-foreground"}`}
            onClick={() => setWageView("job")}
          >
            Per job
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={wageView === "person"}
            className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${wageView === "person" ? "bg-accent text-accent-foreground" : "bg-elevated text-foreground"}`}
            onClick={() => setWageView("person")}
          >
            Per person
          </button>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-subtle">
        {books ? (
          <>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-0.5 w-4 bg-ok" />
              Income
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-0.5 w-4 bg-danger" />
              Expenses
            </span>
          </>
        ) : (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-0.5 w-4" style={{ background: stroke }} />
            {showEligible ? "Everyone" : "Actual"}
          </span>
        )}
        {showEligible ? (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-0.5 w-4 bg-ok" />
            Looking for work
          </span>
        ) : null}
        {hasPace && !books ? (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-4 border-b border-dashed border-muted-foreground" />
            Previous statutes
          </span>
        ) : null}
        {marks.length > 0 ? (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-3 border-l border-dashed border-foreground" />
            Statute
          </span>
        ) : null}
      </div>

      <div className="mt-2 h-48 min-w-0" data-testid="trend-chart">
        {mounted && (books ? bookRows.length : chartRowsView.length) > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={books ? bookRows : chartRowsView} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis
                dataKey="year"
                tick={{ fill: "var(--color-subtle)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                minTickGap={18}
              />
              <YAxis
                width={48}
                domain={books ? bookDomain : domain}
                allowDataOverflow
                tickCount={4}
                tick={{ fill: "var(--color-subtle)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(n: number) => formatAxis(plotted, n)}
              />
              <Tooltip
                content={(props) => (
                  <TrendTip
                    active={props.active}
                    label={props.label}
                    payload={props.payload as TipPayload[] | undefined}
                    id={plotted}
                    events={ledger.events}
                  />
                )}
                cursor={{ stroke: "var(--color-border)" }}
                wrapperStyle={{ background: "transparent", border: "none", padding: 0, boxShadow: "none" }}
              />
              {marks.map((year) => (
                <ReferenceLine
                  key={year}
                  x={String(year)}
                  stroke="var(--color-gold)"
                  strokeOpacity={0.55}
                  strokeDasharray="3 3"
                  strokeWidth={1.25}
                />
              ))}
              {hasPace && !books ? (
                <Line
                  type="linear"
                  dataKey="pace"
                  name="Earlier statutes"
                  stroke="var(--color-muted-foreground)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={!quiet}
                />
              ) : null}
              {showEligible && !books ? (
                <Line
                  type="linear"
                  dataKey="eligible"
                  name="Looking for work"
                  stroke="var(--color-ok)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={!quiet}
                />
              ) : null}
              {books ? (
                <Line
                  type="linear"
                  dataKey="income"
                  name="Income"
                  stroke="var(--color-ok)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={!quiet}
                />
              ) : null}
              {books ? (
                <Line
                  type="linear"
                  dataKey="expenses"
                  name="Expenses"
                  stroke="var(--color-danger)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={!quiet}
                />
              ) : (
              <Line
                type="linear"
                dataKey="value"
                name={heading}
                stroke={stroke}
                strokeWidth={2}
                connectNulls
                isAnimationActive={!quiet}
                dot={(dot: { cx?: number; cy?: number; index?: number }) =>
                  dot.index === chartRowsView.length - 1 && dot.cx != null && dot.cy != null ? (
                    <circle key={dot.index} cx={dot.cx} cy={dot.cy} r={3.5} fill={stroke} />
                  ) : (
                    <g key={dot.index} />
                  )
                }
                activeDot={{ r: 4, fill: stroke, stroke: "var(--color-background)" }}
              />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full" />
        )}
      </div>

      {groups.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2" data-testid="statute-list">
          {groups.map((group) => (
            <li key={group.year} className="text-sm">
              <span className="font-semibold tabular-nums">Year {group.year}</span>
              <span className="text-muted-foreground"> · {group.labels.join(" · ")}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {startedLate ? (
        <p className="mt-3 text-sm text-subtle">The line starts at year {ledger.history[0]!.year}. Earlier years were not kept.</p>
      ) : null}
    </section>
  );
}

type TipPayload = { dataKey?: string | number; value?: number };

function TrendTip({
  active,
  payload,
  label,
  id,
  events,
}: {
  active?: boolean;
  payload?: TipPayload[];
  label?: string | number;
  id: SeriesId;
  events: StatuteEvent[];
}) {
  if (!active || !payload?.length) return null;
  const income = payload.find((item) => item.dataKey === "income")?.value;
  const expenses = payload.find((item) => item.dataKey === "expenses")?.value;
  const value = payload.find((item) => item.dataKey === "value")?.value;
  const pace = payload.find((item) => item.dataKey === "pace")?.value;
  const eligible = payload.find((item) => item.dataKey === "eligible")?.value;
  const year = Number(label);
  const here = events.filter((event) => event.year === year);
  return (
    <div className="rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-foreground">
      <p className="font-medium">Year {label}</p>
      {typeof income === "number" ? <p className="tabular-nums text-ok">Income {formatMarks(income)}</p> : null}
      {typeof expenses === "number" ? <p className="tabular-nums text-danger">Expenses {formatMarks(expenses)}</p> : null}
      {typeof value === "number" ? (
        <p className="tabular-nums">{id === "population" ? `Everyone ${formatValue(id, value)}` : formatValue(id, value)}</p>
      ) : null}
      {id === "population" && typeof eligible === "number" ? (
        <p className="tabular-nums text-ok">Looking {formatValue(id, eligible)}</p>
      ) : null}
      {typeof pace === "number" && typeof value === "number" && Math.abs(pace - value) > 0 ? (
        <p className="tabular-nums text-subtle">Previous statutes {formatValue(id, pace)}</p>
      ) : null}
      {here.map((event) => (
        <p key={event.label} className="text-muted-foreground">
          {event.label}
        </p>
      ))}
    </div>
  );
}
