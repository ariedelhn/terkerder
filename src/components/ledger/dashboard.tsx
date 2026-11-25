import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Briefcase,
  GraduationCap,
  HardHat,
  HeartPulse,
  Landmark,
  Menu,
  RotateCcw,
  Shield,
  Store,
  Truck,
  Wheat,
  Zap,
  Droplets,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  CITIZEN_PAYOUT,
  CHARTERS,
  FIRM_AI,
  LEVY_TAKE,
  PUBLIC_JOB_OVERHEAD,
  DIVIDEND_PER,
  LOAN_SIZE,
  LOAN_TERM,
  PLANT_CREW,
  SECTORS,
  SERVICES,
  STIPEND_PER,
  TAX_RATES,
  TECHS,
  advance,
  automationLabel,
  borrow,
  dueThisYear,
  interestRemaining,
  jobsGap,
  publicHires,
  nextLoanRate,
  openingState,
  plantJobs,
  prepay,
  programCosts,
  retireOil,
  sectorDef,
  setResearch,
  stagePower,
  serviceOutlook,
  serviceBill,
  stageService,
  toggleTech,
  utilityJobs,
  worksJobCount,
  type Gates,
  type Ledger,
  type Policies,
  type PublicHiring,
  type SectorId,
  type ServiceId,
  type TechId,
} from "@/lib/sim/engine";
import {
  MAX_TIDAL,
  POWER_KINDS,
  POWER_TYPES,
  RESEARCH,
  fuelBill,
  kindUnlocked,
  oilCount,
  oilShare,
  plantCrew,
  plantFuel,
  plantMw,
  plantUpkeep,
  powerUpkeep,
  researchDef,
  researchStatus,
  retireTarget,
  stageRoom,
  tidalCount,
  upkeepFactor,
  worksFactor,
  type PowerKind,
  type ResearchId,
} from "@/lib/sim/energy";
import {
  formatInt,
  formatMarks,
  formatPct,
  formatSignedInt,
  formatSignedMarks,
  formatSignedPct,
  formatSignedPoints,
  formatSignedPp,
  stabilityWord,
} from "@/lib/sim/format";
import { loadLedger, loadSaves, rememberCity, forgetSave, saveLedger, type CitySave } from "@/lib/sim/storage";
import { Trends } from "@/components/ledger/trends";
import { CityMap } from "@/components/ledger/city-map";

type Tab =
  | "sectors"
  | "city"
  | "policy"
  | "technology"
  | "research"
  | "people"
  | "figures"
  | "charts"
  | "map"
  | "expenses";

const SECTOR_TEXT: Record<SectorId, string> = {
  housing: "text-gold",
  transport: "text-water",
  food: "text-ok",
  energy: "text-gold",
  services: "text-violet",
  government: "text-foreground",
  health: "text-coral",
  education: "text-water",
  law: "text-danger",
  office: "text-accent",
};

const SECTOR_BAR: Record<SectorId, string> = {
  housing: "bg-gold",
  transport: "bg-water",
  food: "bg-ok",
  energy: "bg-gold",
  services: "bg-violet",
  government: "bg-foreground",
  health: "bg-coral",
  education: "bg-water",
  law: "bg-danger",
  office: "bg-accent",
};

const SECTOR_ICON: Record<SectorId, LucideIcon> = {
  housing: HardHat,
  transport: Truck,
  food: Wheat,
  energy: Zap,
  services: Store,
  government: Landmark,
  health: HeartPulse,
  education: GraduationCap,
  law: Shield,
  office: Briefcase,
};

export function Dashboard() {
  const [ledger, setLedger] = useState<Ledger>(() => openingState());
  const [tab, setTab] = useState<Tab>("map");
  const [confirming, setConfirming] = useState(false);
  const [savesOpen, setSavesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saves, setSaves] = useState<CitySave[]>([]);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [namingSave, setNamingSave] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [pendingLoad, setPendingLoad] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [ready, setReady] = useState(false);
  const simTimer = useRef<number | null>(null);

  useEffect(() => {
    const saved = loadLedger();
    if (saved) setLedger(saved);
    setSaves(loadSaves());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveLedger(ledger);
  }, [ledger, ready]);

  useEffect(() => {
    return () => {
      if (simTimer.current != null) window.clearTimeout(simTimer.current);
    };
  }, []);

  function advanceYear() {
    if (simulating) return;
    setConfirming(false);
    setSimulating(true);
    simTimer.current = window.setTimeout(() => {
      setLedger((current) => advance(current));
      setSimulating(false);
    }, 2000);
  }

  const costs = programCosts(ledger.population, Math.max(0, ledger.laborForce - ledger.employed));
  const stability = Math.round(ledger.stability);
  const word = stabilityWord(stability);
  const priorMark = ledger.history.length >= 2 ? ledger.history[ledger.history.length - 2] : null;
  const reserveChange = priorMark ? ledger.treasury - priorMark.treasury : null;
  const gapNow = jobsGap(ledger.history);

  function selectTab(next: Tab) {
    setTab(next);
    requestAnimationFrame(() => {
      const panel = document.getElementById("ledger-panel");
      const scroller = document.querySelector("main");
      if (!panel || !(scroller instanceof HTMLElement)) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const top =
        panel.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      scroller.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    });
  }

  function saveCheckpoint() {
    if (simulating) return;
    const result = rememberCity(ledger, saveLabel);
    setSaves(result.saves);
    if (result.full) {
      setNamingSave(false);
      setSaveNote("Eight saves already. Delete one to keep this year.");
      setSavesOpen(true);
      return;
    }
    const label = saveLabel.trim().slice(0, 20);
    setSaveNote(label ? `Saved “${label}”.` : `Saved year ${ledger.year}.`);
    setSaveLabel("");
    setNamingSave(false);
  }

  function openSaves() {
    setSaves(loadSaves());
    setPendingLoad(null);
    setSavesOpen(true);
  }

  function closeSaves() {
    setSavesOpen(false);
    setPendingLoad(null);
  }

  function setPolicy<K extends keyof Policies>(key: K, value: Policies[K]) {
    setLedger((current) => ({ ...current, policies: { ...current.policies, [key]: value } }));
  }

  return (
    <div className="relative h-dvh">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <img
          src={`${import.meta.env.BASE_URL}city-bg.jpg`}
          alt=""
          className="h-full w-full scale-110 object-cover blur-[10px]"
        />
        <div className="absolute inset-0 bg-[#0c1218]/25" />
      </div>
      <div className="relative z-10 mx-auto flex h-dvh w-full max-w-md flex-col">
      <header className="safe-top shrink-0 border-b border-border bg-[#10141c]/40 px-4 pb-3 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">City-state</p>
            <h1 className="text-3xl font-medium tracking-tight text-gold">Terkerder</h1>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              <span className="font-display text-base font-medium text-water" data-testid="year">
                Year {ledger.year}
              </span>
              {" · "}
              {formatInt(ledger.population)} residents
            </p>
            <p className="mt-1 text-base font-semibold tabular-nums">
              <span className={ledger.treasury < 0 ? "text-danger" : "text-accent"}>{formatMarks(ledger.treasury)}</span>
              <span className="font-medium text-muted-foreground"> reserve</span>
              {reserveChange != null ? (
                <span className={reserveChange < 0 ? "text-danger" : "text-ok"}>
                  {" "}
                  {formatSignedMarks(reserveChange)} last year
                </span>
              ) : null}
            </p>
            <p className="text-sm tabular-nums">
              {ledger.hasClosedYear ? (
                <>
                  <span className="text-ok">Income {formatMarks(ledger.taxRevenue)}</span>
                  <span className="text-muted-foreground"> · </span>
                  <span className={ledger.spending > ledger.taxRevenue ? "text-danger" : "text-foreground"}>
                    Expenses {formatMarks(ledger.spending)}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Income and expenses close with the year</span>
              )}
            </p>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm tabular-nums">
              {SERVICES.map((def) => {
                const nextCover = serviceOutlook(ledger, def.id).nextCover;
                const pct = Math.round(nextCover * 100);
                const Icon = SERVICE_ICON[def.id];
                return (
                  <span key={def.id} className={`inline-flex items-center gap-1 ${nextCover < 1 ? "text-warn" : "text-ok"}`}>
                    <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    {def.name} {pct}% next
                  </span>
                );
              })}
            </p>
            <p className="text-sm tabular-nums">
              <span className={stability < 35 ? "text-danger" : "text-foreground"}>Stability {stability}</span>
              <span className="text-muted-foreground"> · {word}</span>
            </p>
            <p className="text-sm tabular-nums">
              <span className={ledger.unemployment > 0.12 ? "text-warn" : "text-foreground"}>
                Unemployment {formatPct(ledger.unemployment)}
              </span>
              <span className="text-muted-foreground"> · </span>
              <span
                className={
                  ledger.inflation > 0.04 || ledger.priceIndex > 110
                    ? "text-warn"
                    : ledger.inflation < -0.01
                      ? "text-ok"
                      : "text-foreground"
                }
              >
                Prices {Math.round(ledger.priceIndex)} · {formatSignedPct(ledger.inflation)}
              </span>
            </p>
          </div>
          <button
            type="button"
            className="mt-1 flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-[#10141c]/50"
            aria-expanded={menuOpen}
            aria-controls="city-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Menu className="size-6" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        {menuOpen ? (
          <nav id="city-menu" className="mt-3 flex max-h-[62vh] flex-col gap-2 overflow-y-auto" aria-label="City menu">
            <button
              type="button"
              className="min-h-12 rounded-xl bg-accent px-4 text-left text-base font-semibold text-accent-foreground"
              onClick={() => {
                setMenuOpen(false);
                setSaveLabel("");
                setNamingSave(true);
              }}
            >
              Save game
            </button>
            <button
              type="button"
              className="min-h-12 rounded-xl border border-border bg-[#10141c]/55 px-4 text-left text-base font-semibold"
              onClick={() => {
                setMenuOpen(false);
                openSaves();
              }}
            >
              Load game
            </button>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <TabButton id="sectors" current={tab} onSelect={(next) => { selectTab(next); setMenuOpen(false); }} label="Jobs" />
              <TabButton id="city" current={tab} onSelect={(next) => { selectTab(next); setMenuOpen(false); }} label="City" />
              <TabButton id="policy" current={tab} onSelect={(next) => { selectTab(next); setMenuOpen(false); }} label="Policy" />
              <TabButton id="technology" current={tab} onSelect={(next) => { selectTab(next); setMenuOpen(false); }} label="Auto" />
              <TabButton id="research" current={tab} onSelect={(next) => { selectTab(next); setMenuOpen(false); }} label="Research" />
              <TabButton id="people" current={tab} onSelect={(next) => { selectTab(next); setMenuOpen(false); }} label="People" />
              <TabButton id="figures" current={tab} onSelect={(next) => { selectTab(next); setMenuOpen(false); }} label="Figures" />
              <TabButton id="charts" current={tab} onSelect={(next) => { selectTab(next); setMenuOpen(false); }} label="Charts" />
              <TabButton id="map" current={tab} onSelect={(next) => { selectTab(next); setMenuOpen(false); }} label="Map" />
              <TabButton id="expenses" current={tab} onSelect={(next) => { selectTab(next); setMenuOpen(false); }} label="Expenses" />
            </div>
          </nav>
        ) : null}
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-4">
        <p
          className="rise text-base text-foreground"
          data-testid="bulletin"
          aria-live="polite"
          key={`note-${ledger.year}`}
        >
          {ledger.bulletin}
        </p>

        <div id="ledger-panel">

        {tab === "figures" ? (
          <>
            <section aria-label="City accounts" className="grid grid-cols-2 gap-3" key={ledger.year}>
              <Metric
                label="Unemployment"
                value={formatPct(ledger.unemployment)}
                delta={ledger.deltas.unemployment == null ? null : formatSignedPp(ledger.deltas.unemployment)}
                unit="of people looking for work"
                testId="unemployment"
                tone={ledger.unemployment > 0.15 ? "danger" : "coral"}
              />
              <Metric
                label="Average wage"
                value={formatInt(ledger.avgWage)}
                unit="crypto coins"
                delta={ledger.deltas.avgWage == null ? null : formatSignedInt(ledger.deltas.avgWage)}
                testId="avg-wage"
                tone="gold"
              />
              <Metric
                label="Tax revenue"
                value={formatMarks(ledger.taxRevenue)}
                unit="crypto coins"
                delta={ledger.deltas.taxRevenue == null ? null : formatSignedMarks(ledger.deltas.taxRevenue)}
                testId="tax"
                tone="ok"
              />
              <Metric
                label="Stability"
                value={String(stability)}
                unit={word}
                delta={ledger.deltas.stability == null ? null : formatSignedPoints(ledger.deltas.stability)}
                testId="stability"
                tone={stability < 35 ? "danger" : stability >= 80 ? "ok" : "water"}
                meter={stability}
              />
              <Metric
                label="Inflation"
                value={formatSignedPct(ledger.inflation)}
                unit={ledger.hasClosedYear ? "in prices this year" : "the going rate"}
                delta={null}
                testId="inflation"
                tone={ledger.inflation > 0.08 ? "danger" : ledger.inflation > 0.04 ? "coral" : ledger.inflation < -0.01 ? "ok" : "default"}
              />
              <Metric
                label="Real wage"
                value={formatInt(ledger.realWage)}
                unit="crypto coins of goods"
                delta={null}
                testId="real-wage"
                tone="gold"
              />
              <Metric
                label="Youth unemployment"
                value={formatPct(ledger.jobs.youthUnemployment)}
                unit="of teens and early twenties looking"
                delta={null}
                testId="youth-unemployment"
                tone={ledger.jobs.youthUnemployment > 0.3 ? "danger" : "coral"}
              />
              <Metric
                label="Missing jobs"
                value={gapNow ? formatInt(Math.max(0, gapNow.gap)) : "—"}
                unit={gapNow && gapNow.gap > 0 ? "fewer than output growth suggests" : "none: jobs keep pace with output"}
                delta={null}
                testId="jobs-gap"
                tone={gapNow && gapNow.gap > ledger.laborForce * 0.05 ? "danger" : "default"}
              />
            </section>
            <AiFigures ledger={ledger} />
            <div className="mt-4">
              <ServiceMeters ledger={ledger} onOpen={() => selectTab("city")} />
            </div>
            <section className="mt-4 rounded-xl border border-border bg-card px-4 py-4" aria-label="Reserve">
              <p className="text-sm font-medium text-muted-foreground">
                {ledger.treasury < 0 ? "Reserve overdrawn" : "Reserve"}
              </p>
              <p
                className={`font-sans text-metric font-semibold tabular-nums ${ledger.treasury < 0 ? "text-danger" : "text-accent"}`}
                data-testid="reserve"
              >
                {formatMarks(ledger.treasury)}
              </p>
              {reserveChange != null ? (
                <p className={`mt-1 text-base tabular-nums ${reserveChange < 0 ? "text-danger" : "text-ok"}`}>
                  {formatSignedMarks(reserveChange)} last year
                </p>
              ) : null}
              <p className="mt-2 text-sm text-muted-foreground tabular-nums">
                {formatInt(ledger.employed)} working · {formatInt(ledger.laborForce)} looking
                {ledger.debt > 0 ? ` · debt ${formatMarks(ledger.debt)}` : ""}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Prices {Math.round(ledger.priceIndex)}, {formatSignedPct(ledger.inflation)}. A wage buys {formatInt(ledger.realWage)} crypto coins of goods.
                {ledger.profit > 0 ? ` Machine profit ${formatMarks(ledger.profit)}, held by ${ledger.policies.ownership}.` : " No machine profit yet."}
              </p>
            </section>
          </>
        ) : null}
        {tab === "people" ? <Ages ledger={ledger} /> : null}
        {tab === "charts" ? <Trends ledger={ledger} /> : null}
        {tab === "map" ? <CityMap ledger={ledger} /> : null}
        {tab === "expenses" ? <Expenses ledger={ledger} /> : null}
        {tab === "sectors" ? <SectorList ledger={ledger} /> : null}
        {tab === "city" ? (
          <CityList
            ledger={ledger}
            onStage={(id, kind) => setLedger((current) => stageService(current, id, kind))}
            onStagePower={(kind, mode) => setLedger((current) => stagePower(current, kind, mode))}
            onRetire={() => setLedger((current) => retireOil(current))}
            onOpenResearch={() => selectTab("research")}
            onBorrow={() => setLedger((current) => borrow(current))}
            onPrepay={(id, amount) => setLedger((current) => prepay(current, id, amount))}
          />
        ) : null}
        {tab === "policy" ? (
          <PolicyList ledger={ledger} costs={costs} onPolicy={setPolicy} />
        ) : null}
        {tab === "research" ? (
          <ResearchList
            ledger={ledger}
            onPick={(id) => setLedger((current) => setResearch(current, id))}
            onOpenCity={() => selectTab("city")}
          />
        ) : null}
        {tab === "technology" ? (
          <TechList
            ledger={ledger}
            onToggle={(id) => setLedger((current) => toggleTech(current, id))}
          />
        ) : null}
        </div>

        <p className="text-sm text-subtle">
          Switches apply when the year advances. Power, water, and waste do not grow on their own.
        </p>
      </main>

      <footer className="safe-bottom shrink-0 border-t border-border bg-[#10141c]/45 backdrop-blur-sm">
        <div className="flex flex-col gap-2 px-4 py-3">
          <button
            type="button"
            className="flex min-h-16 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-accent-foreground"
            data-testid="advance"
            disabled={simulating}
            onClick={advanceYear}
          >
            <span className="text-lg font-semibold">Advance year</span>
            <ArrowRight className="size-6" strokeWidth={1.75} aria-hidden="true" />
          </button>
          {saveNote ? <p className="text-center text-sm text-muted-foreground">{saveNote}</p> : null}
        </div>
      </footer>

      {confirming ? (
        <div
          className="safe-top safe-bottom fixed inset-0 z-30 flex flex-col bg-[#10141c] px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="restart-title"
        >
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
            <h2 id="restart-title" className="pt-6 text-3xl font-medium tracking-tight">
              New game
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              This does not delete your saves. The city you are playing is replaced. Pick a charter.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              {CHARTERS.map((charter) => (
                <button
                  key={charter.id}
                  type="button"
                  className="min-h-24 rounded-xl border border-border bg-card px-4 py-4 text-left"
                  onClick={() => {
                    setLedger(openingState(charter.id));
                    setTab("figures");
                    setConfirming(false);
                  }}
                >
                  <span className="block text-lg font-semibold">{charter.name}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{charter.detail}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-auto mb-3 min-h-14 rounded-xl bg-accent text-base font-semibold text-accent-foreground"
              onClick={() => setConfirming(false)}
            >
              Keep this year
            </button>
          </div>
        </div>
      ) : null}

      {simulating ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#10141c]/85 px-6"
          role="status"
          aria-live="polite"
        >
          <div className="w-full max-w-sm rounded-2xl border border-accent/40 bg-card px-6 py-10 text-center">
            <p className="font-display text-2xl text-gold">Simulating city-state</p>
            <p className="mt-4 text-4xl font-semibold tracking-widest text-accent" aria-hidden="true">
              <span className="sim-dot">.</span>
              <span className="sim-dot">.</span>
              <span className="sim-dot">.</span>
            </p>
          </div>
        </div>
      ) : null}

      {namingSave ? (
        <div
          className="safe-top safe-bottom fixed inset-0 z-30 flex flex-col bg-[#10141c] px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-title"
        >
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
            <h2 id="save-title" className="pt-6 text-3xl font-medium tracking-tight">
              Save game
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              A short name, up to 20 characters. It shows on the load list.
            </p>
            <label className="mt-6 block text-sm font-medium text-muted-foreground" htmlFor="save-label">
              Note
            </label>
            <input
              id="save-label"
              value={saveLabel}
              maxLength={20}
              autoComplete="off"
              enterKeyHint="done"
              placeholder="Before water plant"
              className="mt-2 min-h-14 w-full rounded-xl border border-border bg-card px-4 text-lg text-foreground"
              onChange={(event) => setSaveLabel(event.target.value.slice(0, 20))}
            />
            <p className="mt-2 text-right text-sm tabular-nums text-muted-foreground">{saveLabel.length}/20</p>
            <div className="mt-4 rounded-xl border border-border bg-card px-4 py-4 text-base tabular-nums">
              <p>Year {ledger.year}</p>
              <p>Reserve {formatMarks(ledger.treasury)}</p>
              <p>
                This year{" "}
                {ledger.hasClosedYear ? formatSignedMarks(ledger.taxRevenue - ledger.spending) : "not closed"}
              </p>
              <p>
                Stability {stability}
                <span className="text-muted-foreground"> · {word}</span>
              </p>
            </div>
            <button
              type="button"
              className="mt-auto min-h-14 rounded-xl bg-accent text-base font-semibold text-accent-foreground"
              onClick={saveCheckpoint}
            >
              Save game
            </button>
            <button
              type="button"
              className="mt-2 mb-3 min-h-14 rounded-xl border border-border text-base font-semibold"
              onClick={() => setNamingSave(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {savesOpen ? (
        <div
          className="safe-top safe-bottom fixed inset-0 z-30 flex flex-col overflow-hidden bg-[#10141c] px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="saves-title"
          data-testid="load-screen"
        >
          <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-col">
            <div className="flex shrink-0 items-start justify-between gap-3 pt-4">
              <h2 id="saves-title" className="text-3xl font-medium tracking-tight">
                Load game
              </h2>
              <button
                type="button"
                className="min-h-11 shrink-0 rounded-xl border border-border px-4 text-base font-semibold"
                data-testid="load-back"
                onClick={closeSaves}
              >
                Back
              </button>
            </div>
            <p className="mt-2 shrink-0 text-base text-muted-foreground">
              {saves.length} of 8. Load one to put the city back, or start a new game. The city you are playing is not changed until you load.
            </p>
            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pb-3" data-testid="load-list">
              {saves.length === 0 ? (
                <p className="rounded-xl border border-border bg-card px-4 py-4 text-base text-muted-foreground">
                  No saves yet. Use Save game before you try something risky.
                </p>
              ) : (
                saves.map((slot) => (
                  <article key={slot.id} className="rounded-xl border border-border bg-card px-4 py-4" data-testid="save-slot">
                    <p className="text-lg font-semibold">{slot.note || `Year ${slot.year}`}</p>
                    {slot.note ? <p className="text-sm text-muted-foreground">Year {slot.year}</p> : null}
                    <p className="mt-1 text-base tabular-nums">Reserve {formatMarks(slot.reserve)}</p>
                    <p className="text-base tabular-nums">
                      This year {slot.net == null ? "not closed" : formatSignedMarks(slot.net)}
                    </p>
                    <p className="text-base tabular-nums">
                      Stability {slot.stability}
                      <span className="text-muted-foreground"> · {stabilityWord(slot.stability)}</span>
                    </p>
                    {pendingLoad === slot.id ? (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className="min-h-14 rounded-xl bg-accent text-base font-semibold text-accent-foreground"
                          onClick={() => {
                            setLedger(slot.ledger);
                            setTab("figures");
                            setPendingLoad(null);
                            setSavesOpen(false);
                            setSaveNote(`Loaded year ${slot.year}.`);
                          }}
                        >
                          Load it
                        </button>
                        <button
                          type="button"
                          className="min-h-14 rounded-xl border border-border text-base font-semibold"
                          onClick={() => setPendingLoad(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className="min-h-14 rounded-xl bg-accent text-base font-semibold text-accent-foreground"
                          onClick={() => setPendingLoad(slot.id)}
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          className="min-h-14 rounded-xl border border-border text-base font-semibold"
                          onClick={() => {
                            setSaves(forgetSave(slot.id));
                            if (pendingLoad === slot.id) setPendingLoad(null);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
            <div className="shrink-0 pt-2">
              <button
                type="button"
                className="min-h-14 w-full rounded-xl border border-border bg-card text-base font-semibold"
                onClick={() => {
                  closeSaves();
                  setConfirming(true);
                }}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <RotateCcw className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  New game
                </span>
              </button>
              <button
                type="button"
                className="mt-2 mb-3 min-h-14 w-full rounded-xl bg-accent text-base font-semibold text-accent-foreground"
                data-testid="load-back-footer"
                onClick={closeSaves}
              >
                Back to the city
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </div>
  );
}

function Expenses({ ledger }: { ledger: Ledger }) {
  const bill = serviceBill(ledger.works, ledger.energy);
  const fuel = fuelBill(ledger.energy);
  const rows = [...ledger.history].reverse().filter((mark) => typeof mark.powerCost === "number");
  return (
    <section className="rounded-xl border border-border bg-card px-4 py-4" aria-label="Utility expenses">
      <h2 className="font-sans text-lg font-semibold">Utility bills</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        What the plants cost to run each year, at census prices. Staffed plants cost the full rate. Automated plants cost half to keep up. Oil plants also burn imported fuel.
      </p>
      <dl className="mt-4 flex flex-col gap-3 text-base">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-gold">Electricity</dt>
          <dd className="tabular-nums">{formatMarks(bill.power)}</dd>
        </div>
        {fuel > 0 ? (
          <div className="flex items-baseline justify-between gap-3 text-sm text-muted-foreground">
            <dt>of which imported oil</dt>
            <dd className="tabular-nums">{formatMarks(fuel)}</dd>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-water">Water</dt>
          <dd className="tabular-nums">{formatMarks(bill.water)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-waste">Waste</dt>
          <dd className="tabular-nums">{formatMarks(bill.waste)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3 font-semibold">
          <dt>This year</dt>
          <dd className="tabular-nums">{formatMarks(bill.power + bill.water + bill.waste)}</dd>
        </div>
      </dl>
      {rows.length > 1 ? (
        <div className="mt-4 flex flex-col gap-3">
          {rows.map((mark) => (
            <article key={mark.year} className="border-t border-border pt-3">
              <p className="text-sm font-medium text-muted-foreground">Year {mark.year}</p>
              <p className="mt-1 text-sm tabular-nums">
                Electricity {formatMarks(mark.powerCost ?? 0)} · Water {formatMarks(mark.waterCost ?? 0)} · Waste{" "}
                {formatMarks(mark.wasteCost ?? 0)}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Earlier years were not split this way. New years will be.</p>
      )}
    </section>
  );
}

function Ages({ ledger }: { ledger: Ledger }) {
  const ages = ledger.ages;
  const city = Math.max(1, ledger.population);
  const bands = [
    { label: "Children", count: ages.children, looking: ages.looking.children, bar: "bg-water" },
    { label: "Teens", count: ages.teens, looking: ages.looking.teens, bar: "bg-accent" },
    { label: "Adults", count: ages.adults, looking: ages.looking.adults, bar: "bg-gold" },
    { label: "Seniors", count: ages.seniors, looking: ages.looking.seniors, bar: "bg-violet" },
  ];
  const activeTotal = bands.reduce((sum, band) => sum + band.looking, 0);
  const unemployed = Math.max(0, ledger.laborForce - ledger.employed);
  return (
    <section className="rounded-xl border border-border bg-card px-4 py-4" aria-label="Economically active" data-testid="ages">
      <h2 className="font-sans text-sm font-medium text-muted-foreground">Economically active</h2>
      <p className="mt-1 font-sans text-metric font-semibold tabular-nums" data-testid="active-total">
        {formatInt(activeTotal)}
      </p>
      <p className="mt-1 text-sm text-subtle">
        {share(activeTotal, city)} of residents are looking for work.
      </p>
      <ul className="mt-4 flex flex-col gap-4">
        {bands.map((band) => {
          const lookingShare = band.count > 0 ? band.looking / band.count : 0;
          const notLooking = band.count - band.looking;
          return (
            <li key={band.label}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-base font-semibold">{band.label}</p>
                <p className="text-sm tabular-nums text-muted-foreground">{share(band.count, city)} of the city</p>
              </div>
              <p className="text-sm tabular-nums text-subtle">{formatInt(band.count)} people</p>
              <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-border" aria-hidden="true">
                <span className={`h-full ${band.bar}`} style={{ width: `${lookingShare * 100}%` }} />
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-3 text-sm">
                <span className="tabular-nums">
                  Looking {share(band.looking, band.count)}
                  <span className="text-subtle"> · {formatInt(band.looking)}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  Not looking {share(notLooking, band.count)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-muted-foreground">
        {formatInt(unemployed)} of the {formatInt(activeTotal)} looking do not have a job. That is the unemployment rate.
        Adults take the layoffs. Teens are hired into the new work. Seniors leave instead of queueing.
      </p>
      {ledger.transition.tenders > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {formatInt(ledger.transition.laidOff)} adults are still out of the automated industries.
          {ledger.transition.retraining > 0
            ? ` ${formatInt(ledger.transition.retraining)} are moving into other work.`
            : " Retraining is off, so almost nobody is moving."}
          {` ${formatInt(ledger.transition.tenders)} jobs exist only to tend the machines.`}
        </p>
      ) : null}
    </section>
  );
}

function share(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

function Metric({
  label,
  value,
  unit,
  delta,
  testId,
  tone = "default",
  meter,
}: {
  label: string;
  value: string;
  unit?: string;
  delta: string | null;
  testId: string;
  tone?: "default" | "danger" | "ok" | "gold" | "water" | "coral";
  meter?: number;
}) {
  const color =
    tone === "danger"
      ? "text-danger"
      : tone === "ok"
        ? "text-ok"
        : tone === "gold"
          ? "text-gold"
          : tone === "water"
            ? "text-water"
            : tone === "coral"
              ? "text-coral"
              : "text-foreground";
  const showDelta = delta != null && delta !== "0" && delta !== "0.0 pp";
  return (
    <article className="rounded-xl border border-border bg-card px-4 py-4">
      <h2 className="font-sans text-sm font-medium text-muted-foreground">{label}</h2>
      <p className={`mt-2 font-sans text-metric font-semibold tabular-nums ${color}`} data-testid={testId}>
        {value}
      </p>
      {unit ? <p className="mt-1 text-sm text-subtle">{unit}</p> : <p className="mt-1 text-sm text-subtle">of the labor force</p>}
      {showDelta ? <p className="mt-2 text-sm tabular-nums text-muted-foreground">{delta}</p> : null}
      {meter != null ? (
        <div className="meter mt-3 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
          <span
            className={`block h-full ${tone === "danger" ? "bg-danger" : tone === "ok" ? "bg-ok" : tone === "water" ? "bg-water" : "bg-foreground"}`}
            style={{ width: `${Math.max(0, Math.min(100, meter))}%` }}
          />
        </div>
      ) : null}
    </article>
  );
}

function TabButton({
  id,
  label,
  current,
  onSelect,
}: {
  id: Tab;
  label: string;
  current: Tab;
  onSelect: (tab: Tab) => void;
}) {
  const selected = current === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={`min-h-12 rounded-lg px-1 text-sm font-semibold ${selected ? "bg-accent text-accent-foreground" : "bg-card text-foreground"}`}
      onClick={() => onSelect(id)}
    >
      {label}
    </button>
  );
}

const SERVICE_ICON: Record<ServiceId, LucideIcon> = {
  power: Zap,
  water: Droplets,
  waste: Trash2,
};

const SERVICE_TONE: Record<ServiceId, { text: string }> = {
  power: { text: "text-gold" },
  water: { text: "text-water" },
  waste: { text: "text-waste" },
};

/** 100% coverage sits on the yellow/green edge. Spare room runs into the green. */
function gaugePosition(cover: number): number {
  const pct = cover * 100;
  const greenEdge = 68;
  if (pct <= 70) return 4;
  if (pct >= 140) return 96;
  if (pct <= 100) return 4 + ((pct - 70) / 30) * (greenEdge - 4);
  return greenEdge + ((pct - 100) / 40) * (96 - greenEdge);
}

function ServiceMeters({ ledger, onOpen }: { ledger: Ledger; onOpen: () => void }) {
  return (
    <div className="grid grid-cols-3 gap-2" aria-label="City services">
      {SERVICES.map((def) => {
        const look = serviceOutlook(ledger, def.id);
        const tone = SERVICE_TONE[def.id];
        const Icon = SERVICE_ICON[def.id];
        const nextPct = Math.round(Math.min(look.nextCover, 1.5) * 100);
        const marker = gaugePosition(look.cover);
        return (
          <button
            key={def.id}
            type="button"
            onClick={onOpen}
            className="min-h-24 rounded-xl border border-border bg-card px-2 py-2 text-left"
          >
            <span className={`flex items-center gap-1 text-sm ${tone.text}`}>
              <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              {def.name}
            </span>
            <span className={`mt-1 block text-lg font-semibold tabular-nums ${tone.text}`}>
              {Math.round(Math.min(look.cover, 1.5) * 100)}%
            </span>
            <span className={`block text-sm tabular-nums ${nextPct < 100 ? "text-warn" : "text-subtle"}`}>
              Next year {nextPct}%
            </span>
            <span className="relative mt-2 block h-4" aria-hidden="true">
              <span
                className="absolute top-0 size-0 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-foreground"
                style={{ left: `${marker}%` }}
              />
              <span
                className="absolute right-0 bottom-0 left-0 h-1.5 rounded-full"
                style={{
                  background:
                    "linear-gradient(to right, var(--color-danger) 0%, var(--color-warn) 34%, var(--color-ok) 68%, var(--color-ok) 100%)",
                }}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CityList({
  ledger,
  onStage,
  onStagePower,
  onRetire,
  onOpenResearch,
  onBorrow,
  onPrepay,
}: {
  ledger: Ledger;
  onStage: (id: ServiceId, kind: "crew" | "auto") => void;
  onStagePower: (kind: PowerKind, mode: "crew" | "auto") => void;
  onRetire: () => void;
  onOpenResearch: () => void;
  onBorrow: () => void;
  onPrepay: (id: string, amount: number) => void;
}) {
  const loans = ledger.loans ?? [];
  const nextRate = nextLoanRate(loans.length);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground" data-testid="crime">
        Crime is {ledger.crime}.
        {ledger.protest
          ? " A protest is on. Firms are leaving."
          : " It climbs when people are out of work or a service runs short."}
      </p>
      {SERVICES.map((def) => {
        if (def.id === "power") {
          return (
            <PowerCard
              key={def.id}
              ledger={ledger}
              onStage={onStagePower}
              onRetire={onRetire}
              onOpenResearch={onOpenResearch}
            />
          );
        }
        const plant = ledger.works[def.id];
        const look = serviceOutlook(ledger, def.id);
        const tone = SERVICE_TONE[def.id];
        const used = look.capacity > 0 ? look.demand / look.capacity : 1;
        const nextPct = Math.round(Math.min(look.nextCover, 1.5) * 100);
        const Icon = SERVICE_ICON[def.id];
        return (
          <article key={def.id} className="rounded-xl border border-border bg-card px-4 py-4">
            <div className="flex items-start gap-3">
              <Icon className={`mt-1 size-6 shrink-0 ${tone.text}`} strokeWidth={1.75} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h3 className="font-sans text-lg font-semibold">{def.name}</h3>
                <p className="text-sm text-muted-foreground">{def.detail}</p>
                <p className="mt-3 text-base tabular-nums">
                  Uses {formatService(look.demand, def.unit)} this year
                </p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {Math.round(used * 100)}% of {formatService(look.capacity, def.unit)} built
                </p>
                <p className={`mt-2 text-base font-semibold tabular-nums ${nextPct < 100 ? "text-warn" : "text-foreground"}`}>
                  Next year {formatService(look.nextDemand, def.unit)} · {nextPct}% covered
                </p>
                <p className="text-sm text-subtle tabular-nums">
                  {plantJobs(def.id, plant)} government jobs · {plant.plants} staffed · {plant.auto ?? 0} automated
                  {plant.staged > 0 ? " · one plant staged" : ""}
                  {" · "}
                  {formatMarks(serviceBill(ledger.works, ledger.energy)[def.id])} crypto coins a year
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className={`flex min-h-16 w-full flex-col items-center justify-center rounded-xl px-3 py-2 text-center ${plant.staged > 0 && !plant.stagedAuto ? "bg-accent text-accent-foreground" : "border border-border bg-background text-foreground"}`}
                onClick={() => onStage(def.id, "crew")}
              >
                <span className="text-base font-semibold">
                  {plant.staged > 0 && !plant.stagedAuto ? "Staffed plant staged · tap to cancel" : `Staffed · ${PLANT_CREW[def.id]} jobs`}
                </span>
                {plant.staged > 0 && !plant.stagedAuto ? null : (
                  <span className="text-sm">
                    {formatMarks(def.buildCost)} to build · {formatMarks(def.yearlyCost * upkeepFactor(ledger.energy))} a year · +{formatService(def.plant * worksFactor(ledger.energy), def.unit)}
                  </span>
                )}
              </button>
              <button
                type="button"
                className={`flex min-h-16 w-full flex-col items-center justify-center rounded-xl px-3 py-2 text-center ${plant.staged > 0 && plant.stagedAuto ? "bg-accent text-accent-foreground" : "border border-border bg-background text-foreground"}`}
                onClick={() => onStage(def.id, "auto")}
              >
                <span className="text-base font-semibold">
                  {plant.staged > 0 && plant.stagedAuto
                    ? "Automated plant staged · tap to cancel"
                    : `Automated · ${Math.round(PLANT_CREW[def.id] * 0.1)} jobs`}
                </span>
                {plant.staged > 0 && plant.stagedAuto ? null : (
                  <span className="text-sm">
                    {formatMarks(def.buildCost)} to build · {formatMarks(def.yearlyCost * 0.5 * upkeepFactor(ledger.energy))} a year · +{formatService(def.plant * worksFactor(ledger.energy), def.unit)}
                  </span>
                )}
              </button>
            </div>
          </article>
        );
      })}

      <article className="rounded-xl border border-border bg-card px-4 py-4">
        <h3 className="font-sans text-lg font-semibold">Loans</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Each loan is {formatMarks(LOAN_SIZE)} crypto coins for {LOAN_TERM} years. The yearly bill pays interest and principal, so the balance falls. Early years are heavier on interest. A lump payment cuts the interest left.
        </p>
        <p className="mt-3 font-sans text-2xl font-semibold tabular-nums">{formatMarks(ledger.debt)}</p>
        <p className="text-sm text-subtle">
          {loans.length === 0 ? "No loans" : `${loans.length} open`}
          {" · next loan "}
          {(nextRate * 100).toFixed(1)}%
        </p>
        <button
          type="button"
          className="mt-4 min-h-14 w-full rounded-xl bg-accent px-3 text-base font-semibold text-accent-foreground"
          onClick={onBorrow}
        >
          Borrow {formatMarks(LOAN_SIZE)} · {(nextRate * 100).toFixed(1)}%
        </button>
        <div className="mt-4 flex flex-col gap-3">
          {loans.map((loan) => {
            const due = dueThisYear(loan);
            const left = interestRemaining(loan);
            const cash = Math.max(0, ledger.treasury);
            const chips = [10_000_000, 20_000_000, 40_000_000];
            return (
              <article key={loan.id} className="rounded-xl border border-border px-3 py-3">
                <p className="text-lg font-semibold">
                  Loan {loan.name} · {(loan.rate * 100).toFixed(1)}%
                </p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  Year {loan.paid + 1} of {loan.term} · balance {formatMarks(loan.balance)}
                </p>
                <p className="mt-2 text-base tabular-nums">
                  This year {formatMarks(due.interest)} interest · {formatMarks(due.principal)} principal
                </p>
                <p className="text-sm text-subtle tabular-nums">Interest left on the schedule {formatMarks(left)}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {chips.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className="min-h-12 rounded-xl border border-border px-2 text-sm font-semibold disabled:opacity-40"
                      disabled={cash < amount || loan.balance < amount}
                      onClick={() => onPrepay(loan.id, amount)}
                    >
                      Pay {formatMarks(amount)}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="min-h-12 rounded-xl border border-border px-2 text-sm font-semibold disabled:opacity-40"
                    disabled={cash < loan.balance}
                    onClick={() => onPrepay(loan.id, loan.balance)}
                  >
                    Pay off
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </article>
    </div>
  );
}

const KIND_TONE: Record<PowerKind, string> = {
  oil: "text-coral",
  solar: "text-water",
  tidal: "text-ok",
};

function PowerCard({
  ledger,
  onStage,
  onRetire,
  onOpenResearch,
}: {
  ledger: Ledger;
  onStage: (kind: PowerKind, mode: "crew" | "auto") => void;
  onRetire: () => void;
  onOpenResearch: () => void;
}) {
  const energy = ledger.energy;
  const plant = ledger.works.power;
  const def = SERVICES.find((item) => item.id === "power")!;
  const look = serviceOutlook(ledger, "power");
  const [pick, setPick] = useState<PowerKind>(plant.staged > 0 ? energy.stagedKind : "oil");
  const used = look.capacity > 0 ? look.demand / look.capacity : 1;
  const nextPct = Math.round(Math.min(look.nextCover, 1.5) * 100);
  const cola = ledger.priceIndex / 100;
  const type = POWER_TYPES[pick];
  const unlocked = kindUnlocked(energy, pick);
  const room = stageRoom(energy, pick);
  const fuel = fuelBill(energy);
  const share = oilShare(energy);
  const retiring = energy.retire > 0;
  const target = retireTarget(energy);
  const mix = POWER_KINDS.map((kind) => {
    const row = energy.fleet[kind];
    return { kind, crew: row.crew, auto: row.auto, total: row.crew + row.auto };
  });
  const stagedHere = plant.staged > 0 && energy.stagedKind === pick;
  return (
    <article className="rounded-xl border border-border bg-card px-4 py-4" data-testid="power-card">
      <div className="flex items-start gap-3">
        <Zap className="mt-1 size-6 shrink-0 text-gold" strokeWidth={1.75} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="font-sans text-lg font-semibold">Power</h3>
          <p className="text-sm text-muted-foreground">
            A shortfall cuts shifts. The city opens on imported oil. Research unlocks solar, batteries, tidal, and bigger plants.
          </p>
          <p className="mt-3 text-base tabular-nums">Uses {formatService(look.demand, def.unit)} this year</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {Math.round(used * 100)}% of {formatService(look.capacity, def.unit)} built
          </p>
          <p className={`mt-2 text-base font-semibold tabular-nums ${nextPct < 100 ? "text-warn" : "text-foreground"}`}>
            Next year {formatService(look.nextDemand, def.unit)} · {nextPct}% covered
          </p>
          <p className="mt-2 text-sm tabular-nums" data-testid="power-mix">
            {mix
              .filter((row) => row.total > 0 || row.kind === "oil")
              .map((row) => (
                <span key={row.kind} className={`mr-3 inline-block ${KIND_TONE[row.kind]}`}>
                  {POWER_TYPES[row.kind].name} ×{row.total}
                  {row.auto > 0 ? ` (${row.auto} automated)` : ""}
                </span>
              ))}
          </p>
          <p className="text-sm text-subtle tabular-nums">
            {plantJobs("power", plant, energy)} government jobs · {formatMarks(serviceBill(ledger.works, energy).power * cola)} a year
            {fuel > 0 ? `, ${formatMarks(fuel * cola)} of it imported oil` : ""}
          </p>
          <p className="text-sm text-subtle tabular-nums" data-testid="oil-price">
            Oil price {energy.oilPrice.toFixed(2)}× the census · oil makes {Math.round(share * 100)}% of the power
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2" role="tablist" aria-label="Plant type">
        {POWER_KINDS.map((kind) => {
          const open = kindUnlocked(energy, kind);
          const selected = pick === kind;
          return (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={selected}
              data-testid={`power-kind-${kind}`}
              className={`min-h-12 rounded-lg px-1 text-sm font-semibold ${selected ? "bg-accent text-accent-foreground" : "border border-border bg-background text-foreground"} ${open ? "" : "opacity-60"}`}
              onClick={() => setPick(kind)}
            >
              {POWER_TYPES[kind].name.replace(" plant", "").replace(" farm", "").replace(" station", "")}
              {open ? "" : " · locked"}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{type.detail}</p>

      {!unlocked ? (
        <button
          type="button"
          className="mt-3 min-h-14 w-full rounded-xl border border-border bg-background px-3 text-base font-semibold"
          onClick={onOpenResearch}
        >
          Needs {researchDef(type.needs!).name} research · open Research
        </button>
      ) : room <= 0 && !stagedHere ? (
        <p className="mt-3 text-sm text-warn">The shore has room for {MAX_TIDAL} tidal stations. All are built.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {(["crew", "auto"] as const).map((mode) => {
            const auto = mode === "auto";
            const active = stagedHere && plant.stagedAuto === auto;
            const count = active ? plant.staged : 0;
            const upkeep = plantUpkeep(energy, pick, auto) + plantFuel(energy, pick, auto);
            const more = active && count < room;
            return (
              <button
                key={mode}
                type="button"
                data-testid={`stage-${pick}-${mode}`}
                className={`flex min-h-16 w-full flex-col items-center justify-center rounded-xl px-3 py-2 text-center ${active ? "bg-accent text-accent-foreground" : "border border-border bg-background text-foreground"}`}
                onClick={() => onStage(pick, mode)}
              >
                <span className="text-base font-semibold">
                  {active
                    ? `${count > 1 ? `${count} ${type.plural}` : type.name} staged${auto ? " · automated" : ""} · ${more ? "tap to add one" : "tap to cancel"}`
                    : `${auto ? "Automated" : "Staffed"} ${type.name.toLowerCase()} · ${Math.round(plantCrew(pick, auto))} jobs`}
                </span>
                <span className="text-sm">
                  {formatMarks(type.buildCost * cola)} to build · {formatMarks(upkeep * cola)} a year · +
                  {formatService(plantMw(energy, pick, auto), def.unit)}
                </span>
              </button>
            );
          })}
          {pick === "tidal" ? (
            <p className="text-sm text-subtle tabular-nums">
              {tidalCount(energy)} of {MAX_TIDAL} shore sites used.
            </p>
          ) : null}
        </div>
      )}

      {oilCount(energy) > 0 ? (
        <button
          type="button"
          data-testid="retire-oil"
          className={`mt-3 flex min-h-14 w-full flex-col items-center justify-center rounded-xl px-3 py-2 text-center ${retiring ? "bg-coral/80 text-background" : "border border-border bg-background text-foreground"}`}
          onClick={onRetire}
        >
          <span className="text-base font-semibold">
            {retiring ? "Oil plant closes at year end · tap to keep it" : "Close an oil plant"}
          </span>
          {!retiring && target ? (
            <span className="text-sm">
              −{formatService(plantMw(energy, "oil", target.auto), def.unit)} · saves{" "}
              {formatMarks((plantUpkeep(energy, "oil", target.auto) + plantFuel(energy, "oil", target.auto)) * cola)} a year ·{" "}
              {Math.round(plantCrew("oil", target.auto))} jobs lost
            </span>
          ) : null}
        </button>
      ) : null}
    </article>
  );
}

function ResearchList({
  ledger,
  onPick,
  onOpenCity,
}: {
  ledger: Ledger;
  onPick: (id: ResearchId | null) => void;
  onOpenCity: () => void;
}) {
  const energy = ledger.energy;
  const cola = ledger.priceIndex / 100;
  const fuel = fuelBill(energy);
  const share = oilShare(energy);
  const upkeep = powerUpkeep(energy);
  return (
    <section className="flex flex-col gap-3" aria-label="Energy research" data-testid="research-panel">
      <article className="rounded-xl border border-border bg-card px-4 py-4">
        <h2 className="font-sans text-lg font-semibold">Energy research</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fund one project at a time. It is paid when the year closes and takes a few years. Finished research unlocks new
          plants or upgrades every plant you already have.
        </p>
        <p className="mt-3 text-base tabular-nums">
          Oil price {energy.oilPrice.toFixed(2)}× the census · oil makes {Math.round(share * 100)}% of the power
        </p>
        <p className="text-sm text-subtle tabular-nums">
          Power costs {formatMarks((upkeep + fuel) * cola)} a year
          {fuel > 0 ? `, ${formatMarks(fuel * cola)} of it imported oil` : ""}.
        </p>
        {energy.active ? (
          <p className="mt-2 text-sm font-semibold text-accent" data-testid="research-active">
            Funding {researchDef(energy.active).name}: {energy.research[energy.active]} of {researchDef(energy.active).years} years done.
          </p>
        ) : (
          <p className="mt-2 text-sm text-subtle">Nothing is being researched.</p>
        )}
      </article>
      {RESEARCH.map((item) => {
        const status = researchStatus(energy, item.id);
        const done = energy.research[item.id] ?? 0;
        const tone =
          status === "done"
            ? "text-ok"
            : status === "active"
              ? "text-accent"
              : status === "open"
                ? "text-foreground"
                : "text-subtle";
        return (
          <article
            key={item.id}
            className={`rounded-xl border px-4 py-4 ${status === "active" ? "border-accent bg-card" : "border-border bg-card"}`}
            data-testid={`research-${item.id}`}
            data-status={status}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-sans text-lg font-semibold">{item.name}</h3>
              <span className={`text-sm font-semibold ${tone}`}>
                {status === "done"
                  ? "Done"
                  : status === "active"
                    ? `Year ${done + 1} of ${item.years}`
                    : status === "open"
                      ? done > 0
                        ? `${done} of ${item.years} years, paused`
                        : "Ready"
                      : "Locked"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{item.unlocks}</p>
            {status === "done" ? null : (
              <p className="mt-2 text-sm tabular-nums">
                {formatMarks(item.cost * cola)} a year · {item.years} years · {formatMarks(item.cost * item.years * cola)} in all
              </p>
            )}
            {item.needs && status === "locked" ? (
              <p className="text-sm text-subtle">Needs {researchDef(item.needs).name} first.</p>
            ) : null}
            <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
              <span className="h-full bg-accent" style={{ width: `${Math.min(1, done / item.years) * 100}%` }} />
            </div>
            {status === "open" || status === "active" ? (
              <button
                type="button"
                data-testid={`fund-${item.id}`}
                className={`mt-3 min-h-12 w-full rounded-xl px-3 text-base font-semibold ${status === "active" ? "border border-border bg-background" : "bg-accent text-accent-foreground"}`}
                onClick={() => onPick(status === "active" ? null : item.id)}
              >
                {status === "active" ? "Stop funding" : energy.active ? "Fund this instead" : "Fund this"}
              </button>
            ) : null}
            {status === "done" && (item.id === "solar" || item.id === "tidal") ? (
              <button
                type="button"
                className="mt-3 min-h-12 w-full rounded-xl border border-border bg-background px-3 text-base font-semibold"
                onClick={onOpenCity}
              >
                Build in City
              </button>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

function formatService(n: number, unit: string): string {
  if (unit === "ML") return `${n.toFixed(1)} ML`;
  return `${formatInt(n)} ${unit}`;
}

function SectorList({ ledger }: { ledger: Ledger }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card" aria-label="Job sectors">
      {SECTORS.map((sector, index) => {
        const snap = ledger.sectors.find((item) => item.id === sector.id);
        const employed = snap?.employed ?? 0;
        const wage = snap?.wage ?? sector.baseWage;
        const delta = snap?.prevEmployed == null ? null : employed - snap.prevEmployed;
        const share = ledger.employed > 0 ? employed / ledger.employed : 0;
        const Icon = SECTOR_ICON[sector.id];
        return (
          <article
            key={sector.id}
            className={`px-4 py-4 ${index < SECTORS.length - 1 ? "border-b border-border" : ""}`}
          >
            <div className="flex items-start gap-3">
              <Icon className={`mt-1 size-6 shrink-0 ${SECTOR_TEXT[sector.id]}`} strokeWidth={1.75} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h3 className="font-sans text-lg font-semibold">{sector.name}</h3>
                <p className="text-sm text-muted-foreground">{sector.detail}</p>
                <p className="mt-3 font-sans text-2xl font-semibold tabular-nums">{formatInt(employed)}</p>
                <p className="text-sm text-subtle">
                  employed · {formatInt(wage)} crypto coins
                  {(snap?.automatons ?? 0) > 0
                    ? ` · ${formatInt(snap?.automatons ?? 0)} machines`
                    : ""}
                  {delta != null && Math.abs(delta) >= 1 ? (
                    <span className="text-muted-foreground"> · {formatSignedInt(delta)} this year</span>
                  ) : null}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{automationLabel(sector.id, ledger.techs, ledger.ai.adoption)}</p>
                <div className="meter mt-3 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
                  <span className={`block h-full ${SECTOR_BAR[sector.id]}`} style={{ width: `${Math.round(share * 100)}%` }} />
                </div>
              </div>
            </div>
          </article>
        );
      })}
      <article className="border-t border-border px-4 py-4">
        <h3 className="font-sans text-lg font-semibold">City plants</h3>
        <p className="text-sm text-muted-foreground">Government jobs at the power, water, and waste plants.</p>
        <p className="mt-3 font-sans text-2xl font-semibold tabular-nums">{formatInt(utilityJobs(ledger.works))}</p>
        <p className="text-sm text-subtle">employed · a staffed plant hires a full crew, an automated plant about a tenth</p>
      </article>
    </section>
  );
}

function PolicyList({
  ledger,
  costs,
  onPolicy,
}: {
  ledger: Ledger;
  costs: ReturnType<typeof programCosts>;
  onPolicy: <K extends keyof Policies>(key: K, value: Policies[K]) => void;
}) {
  const tax = ledger.policies.tax;
  const gates = ledger.policies.gates;
  const displacedNow = displacedWorkers(ledger);
  const publicWage = publicPay(ledger);
  const someCost = publicHires("some", displacedNow, ledger.population) * publicWage * PUBLIC_JOB_OVERHEAD;
  const hiringCost =
    ledger.hasClosedYear && ledger.spend.publicJobs > 0
      ? ledger.spend.publicJobs
      : publicHires(asHiring(ledger.policies.publicHiring), displacedNow, ledger.population) * publicWage * PUBLIC_JOB_OVERHEAD;
  return (
    <div className="flex flex-col gap-4">
      <ChoiceGroup label="Tax band">
        <Choice
          pressed={tax === "low"}
          title="Low"
          detail={`${Math.round(TAX_RATES.low * 100)}%`}
          onClick={() => onPolicy("tax", "low")}
        />
        <Choice
          pressed={tax === "mid"}
          title="Mid"
          detail={`${Math.round(TAX_RATES.mid * 100)}%`}
          onClick={() => onPolicy("tax", "mid")}
        />
        <Choice
          pressed={tax === "high"}
          title="High"
          detail={`${Math.round(TAX_RATES.high * 100)}%`}
          onClick={() => onPolicy("tax", "high")}
        />
      </ChoiceGroup>

      <ChoiceGroup label="Gates">
        {(
          [
            ["open", "Open", "More arrivals"],
            ["steady", "Steady", "Opening rule"],
            ["tight", "Tight", "Slower growth"],
          ] as const
        ).map(([id, title, detail]) => (
          <Choice
            key={id}
            pressed={gates === id}
            title={title}
            detail={detail}
            onClick={() => onPolicy("gates", id as Gates)}
          />
        ))}
      </ChoiceGroup>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <ToggleRow
          title="Jobless stipend"
          detail={`${formatInt(STIPEND_PER)} crypto coins a year for each unemployed worker. About ${formatMarks(costs.stipend)} at today's count.`}
          on={ledger.policies.stipend}
          onToggle={() => onPolicy("stipend", !ledger.policies.stipend)}
        />
        <ToggleRow
          title="Citizen dividend"
          detail={
            ledger.policies.ownership === "citizens"
              ? `Residents already receive ${Math.round(CITIZEN_PAYOUT * 100)}% of machine profit. This adds ${formatInt(DIVIDEND_PER)} crypto coins more for every resident.`
              : `${formatInt(DIVIDEND_PER)} crypto coins a year for every resident, from taxes. About ${formatMarks(costs.dividend)} at today's size. It does not grow when the machines do.`
          }
          on={ledger.policies.dividend}
          onToggle={() => onPolicy("dividend", !ledger.policies.dividend)}
        />
        <ToggleRow
          title="Public works"
          detail={`Adds about ${formatInt(worksJobCount(ledger.population))} construction and care jobs. Costs about ${formatMarks(costs.works)} crypto coins.`}
          on={ledger.policies.works}
          onToggle={() => onPolicy("works", !ledger.policies.works)}
        />
        <ToggleRow
          title="Retraining"
          detail="Does not stop the first layoffs. Over several years it opens jobs in services, health, and education."
          on={ledger.policies.retrain}
          onToggle={() => onPolicy("retrain", !ledger.policies.retrain)}
        />
        <ToggleRow
          title="Wage floor"
          detail="Holds pay up. Private sectors hire a little less."
          on={ledger.policies.wageFloor}
          onToggle={() => onPolicy("wageFloor", !ledger.policies.wageFloor)}
          last
        />
      </div>
      <ChoiceGroup label="Public hiring for displaced workers">
        {PUBLIC_HIRING_CHOICES.map(([id, title]) => (
          <Choice
            key={id}
            pressed={asHiring(ledger.policies.publicHiring) === id}
            title={title}
            detail={id === "off" ? "No extra jobs" : `~${formatInt(publicHires(id, displacedNow, ledger.population))} jobs`}
            onClick={() => onPolicy("publicHiring", id)}
          />
        ))}
      </ChoiceGroup>
      <p className="-mt-2 text-sm text-muted-foreground">
        Health, schools, and city hall hire people AI pushed out. Unemployment looks lower, but the city pays every one of those wages, every year.
        {asHiring(ledger.policies.publicHiring) !== "off"
          ? ` About ${formatMarks(hiringCost)} a year at today's pay.`
          : ` Some would cost about ${formatMarks(someCost)} a year.`}
      </p>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <ToggleRow
          title="AI levy"
          detail={`Firms adopt AI on their own at half the pace, and pay ${Math.round(LEVY_TAKE * 100)}% more of machine profit in tax. Private hiring dips about 1%.`}
          on={ledger.policies.aiLevy}
          onToggle={() => onPolicy("aiLevy", !ledger.policies.aiLevy)}
          last
        />
      </div>
      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-medium text-muted-foreground">Who owns the machine profits</legend>
        <div className="flex flex-col gap-2">
          {(
            [
              ["firms", "Firms", "Owners keep the profit. The city taxes a slice."],
              ["city", "City", "The treasury takes a large share and can build with it."],
              ["citizens", "Residents", "Paid out as a dividend that grows with the machines."],
            ] as const
          ).map(([id, title, detail]) => (
            <button
              key={id}
              type="button"
              aria-pressed={ledger.policies.ownership === id}
              className={`min-h-14 rounded-xl border px-4 py-3 text-left ${ledger.policies.ownership === id ? "border-accent bg-elevated" : "border-border bg-card"}`}
              onClick={() => onPolicy("ownership", id)}
            >
              <span className="block text-base font-semibold">{title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{detail}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {ledger.hasClosedYear ? <Outlay ledger={ledger} /> : null}
    </div>
  );
}

function Outlay({ ledger }: { ledger: Ledger }) {
  const rows = [
    ["Standing services", ledger.spend.standing],
    ["Jobless stipend", ledger.spend.stipend],
    ["Citizen dividend", ledger.spend.dividend],
    ["Public works", ledger.spend.works],
    ["Retraining", ledger.spend.retrain],
    ["Public hiring", ledger.spend.publicJobs ?? 0],
    ["Loan interest", ledger.spend.interest],
    ["Loan principal", ledger.spend.principal],
  ].filter((row, index) => index === 0 || (row[1] as number) > 0);
  const balance = ledger.taxRevenue - ledger.spending;
  return (
    <section className="rounded-xl border border-border bg-card px-4 py-4" aria-label="Last closed year">
      <h3 className="font-sans text-sm font-medium text-muted-foreground">Last closed year · crypto coins</h3>
      <dl className="mt-3 flex flex-col gap-3">
        {rows.map(([label, amount]) => (
          <div key={String(label)} className="flex items-baseline justify-between gap-3 text-base">
            <dt>{label}</dt>
            <dd className="tabular-nums text-muted-foreground">{formatMarks(amount as number)}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3 text-base font-semibold">
          <dt>Balance</dt>
          <dd className={`tabular-nums ${balance < 0 ? "text-danger" : "text-foreground"}`}>
            {formatMarks(balance)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function TechList({ ledger, onToggle }: { ledger: Ledger; onToggle: (id: TechId) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        A machine makes ten times the goods of one worker. That abundance holds prices down, and a profit appears. Firms, the city, or the residents can own that profit. The workers who were fired do not get the cheaper goods unless a stipend, a dividend, or resident ownership pays them. Retraining moves people into other work over several years. The machines also hire a small crew to tend them, and they use more power.
      </p>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
      {TECHS.map((tech, index) => {
        const state = ledger.techs[tech.id] ?? { on: false, activeYears: 0 };
        const live = state.activeYears > 0;
        const staged = state.on && !live;
        const sector = sectorDef(tech.sectorId);
        const Icon = SECTOR_ICON[tech.sectorId];
        return (
          <button
            key={tech.id}
            type="button"
            aria-pressed={state.on}
            className={`flex w-full items-start gap-3 px-4 py-4 text-left ${index < TECHS.length - 1 ? "border-b border-border" : ""} ${state.on ? "bg-elevated" : "bg-card"}`}
            onClick={() => onToggle(tech.id)}
          >
            <Icon className={`mt-1 size-6 shrink-0 ${SECTOR_TEXT[tech.sectorId]}`} strokeWidth={1.75} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-semibold">{tech.name}</span>
              <span className="mt-1 block text-sm font-semibold text-foreground">
                {live ? `In use · year ${state.activeYears}` : staged ? "Staged · tap to cancel" : "Tap to stage"}
              </span>
              <span className="mt-2 block text-sm text-muted-foreground">{sector.name}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{tech.detail}</span>
            </span>
          </button>
        );
      })}
      </div>
    </div>
  );
}

const PUBLIC_HIRING_CHOICES: readonly [PublicHiring, string][] = [
  ["off", "Off"],
  ["some", "Some"],
  ["big", "Big"],
];

function asHiring(value: unknown): PublicHiring {
  return value === "some" || value === "big" ? value : "off";
}

/** Workers machines and firms' AI have displaced, at today's city size. */
function displacedWorkers(ledger: Ledger): number {
  return ledger.sectors.reduce((sum, sector) => sum + (sector.automatons ?? 0), 0);
}

/** Average yearly pay across health, education, and government. */
function publicPay(ledger: Ledger): number {
  const ids: SectorId[] = ["health", "education", "government"];
  const rows = ledger.sectors.filter((sector) => ids.includes(sector.id));
  const people = rows.reduce((sum, sector) => sum + sector.employed, 0);
  if (people <= 0) return 42_000;
  return rows.reduce((sum, sector) => sum + sector.employed * sector.wage, 0) / people;
}

function AiFigures({ ledger }: { ledger: Ledger }) {
  const jobs = ledger.jobs;
  const adoption = ledger.ai.adoption;
  const gap = jobsGap(ledger.history);
  const office = adoption.office ?? 0;
  const firmSectors = SECTORS.filter((sector) => FIRM_AI[sector.id].ceiling > 0);
  const firmShare =
    firmSectors.reduce((sum, sector) => {
      const snap = ledger.sectors.find((item) => item.id === sector.id);
      return sum + (adoption[sector.id] ?? 0) * ((snap?.employed ?? 0) + (snap?.automatons ?? 0));
    }, 0) /
    Math.max(
      1,
      firmSectors.reduce((sum, sector) => {
        const snap = ledger.sectors.find((item) => item.id === sector.id);
        return sum + (snap?.employed ?? 0) + (snap?.automatons ?? 0);
      }, 0),
    );
  const owner =
    ledger.policies.ownership === "firms" ? "Firms keep the profit, so they adopt at full pace." : ledger.policies.ownership === "city" ? "The city takes much of the profit, so firms adopt a little slower." : "Residents share the profit, so firms adopt slower.";
  return (
    <section className="mt-4 rounded-xl border border-border bg-card px-4 py-4" aria-label="AI at work" data-testid="ai-figures">
      <h2 className="font-sans text-sm font-medium text-muted-foreground">AI at work</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Firms hand work to AI on their own, desk jobs first. Few people are fired: firms just stop replacing the people who leave, and stop hiring new graduates. {owner}
        {ledger.policies.aiLevy ? " The AI levy halves their pace." : ""}
      </p>
      <dl className="mt-3 flex flex-col gap-2 text-base">
        <div className="flex items-baseline justify-between gap-3">
          <dt>Office work done by AI</dt>
          <dd className="tabular-nums text-accent" data-testid="ai-office">{formatPct(office)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt>Private work done by firms&apos; AI</dt>
          <dd className="tabular-nums">{formatPct(firmShare)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt>Jobs firms gave to AI</dt>
          <dd className="tabular-nums">{formatInt(jobs.aiJobs)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt>Openings left unfilled this year</dt>
          <dd className="tabular-nums" data-testid="ai-frozen">{formatInt(jobs.frozen)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt>Young people without a job</dt>
          <dd className="tabular-nums">
            {formatInt(jobs.youthUnemployed)} of {formatInt(jobs.youthLooking)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt>Desk workers still jobless</dt>
          <dd className={`tabular-nums ${jobs.officeJobless > ledger.laborForce * 0.02 ? "text-warn" : ""}`}>{formatInt(jobs.officeJobless)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt>Desk workers now in shops and services</dt>
          <dd className="tabular-nums">{formatInt(jobs.downshift)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt>Extra public jobs</dt>
          <dd className="tabular-nums">
            {formatInt(jobs.publicJobs)}
            {ledger.spend.publicJobs > 0 ? ` · ${formatMarks(ledger.spend.publicJobs)}/yr` : ""}
          </dd>
        </div>
        {gap ? (
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
            <dt>Jobs expected from output</dt>
            <dd className="tabular-nums">
              {formatInt(gap.expected)} vs {formatInt(gap.actual)}
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="mt-2 text-sm text-subtle">
        Desk workers who lose out crowd into shop work and push that pay down. Jobless desk workers and shut-out young people weigh on stability more than other unemployment.
      </p>
    </section>
  );
}

function ChoiceGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium text-muted-foreground">{label}</legend>
      <div className="grid grid-cols-3 gap-2">{children}</div>
    </fieldset>
  );
}

function Choice({
  pressed,
  title,
  detail,
  onClick,
}: {
  pressed: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`min-h-16 rounded-lg px-2 py-2 ${pressed ? "bg-accent text-accent-foreground" : "border border-border bg-card text-foreground"}`}
      onClick={onClick}
    >
      <span className="block text-base font-semibold">{title}</span>
      <span className={`mt-0.5 block text-sm ${pressed ? "text-accent-foreground" : "text-muted-foreground"}`}>
        {detail}
      </span>
    </button>
  );
}

function ToggleRow({
  title,
  detail,
  on,
  onToggle,
  last = false,
}: {
  title: string;
  detail: string;
  on: boolean;
  onToggle: () => void;
  last?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={`flex min-h-20 w-full items-center gap-4 px-4 py-4 text-left ${last ? "" : "border-b border-border"}`}
      onClick={onToggle}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{detail}</span>
      </span>
      <span
        className={`relative h-8 w-14 shrink-0 rounded-full ${on ? "bg-accent" : "bg-background"}`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-1 size-6 rounded-full ${on ? "right-1 bg-accent-foreground" : "left-1 bg-foreground"}`}
        />
      </span>
    </button>
  );
}
