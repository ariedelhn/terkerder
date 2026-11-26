import { ArrowRight, FolderOpen, RotateCcw, X } from "lucide-react";
import type { Ledger } from "@/lib/sim/engine";
import { advisors, type Advisor, type AdvisorId, type AdvisorStatus } from "@/lib/sim/advisors";
import { finalTally, type ProtestDispatch, type ProtestTier } from "@/lib/sim/events";
import { formatInt, formatMarks, formatPct } from "@/lib/sim/format";
import tier1 from "@/assets/art/protest-tier1.webp";
import tier2 from "@/assets/art/protest-tier2.webp";
import tier3 from "@/assets/art/protest-tier3.webp";
import tier4 from "@/assets/art/protest-tier4.webp";
import zombies from "@/assets/art/gameover-zombie.webp";
import stabilityFace from "@/assets/art/advisor-stability.webp";
import robotFace from "@/assets/art/advisor-robot.webp";
import energyFace from "@/assets/art/advisor-energy.webp";
import treasuryFace from "@/assets/art/advisor-treasury.webp";

const TIER_ART: Record<ProtestTier, { src: string; alt: string }> = {
  1: { src: tier1, alt: "Crowds march peacefully down Harbor Avenue with banners." },
  2: { src: tier2, alt: "Strikers behind barricades of carts and burning bins." },
  3: { src: tier3, alt: "An overturned truck, riot police, and a smashed shop window." },
  4: { src: tier4, alt: "Empty barricades and smoke under a night curfew." },
};

const TIER_TONE: Record<ProtestTier, string> = {
  1: "text-gold",
  2: "text-coral",
  3: "text-danger",
  4: "text-danger",
};

const FACE: Record<AdvisorId, string> = {
  stability: stabilityFace,
  robot: robotFace,
  energy: energyFace,
  treasury: treasuryFace,
};

const BADGE: Record<AdvisorStatus, { label: string; className: string }> = {
  calm: { label: "Calm", className: "bg-ok/20 text-ok border-ok/40" },
  watch: { label: "Watch", className: "bg-warn/20 text-warn border-warn/40" },
  alert: { label: "Alert", className: "bg-danger/20 text-danger border-danger/50" },
};

export function ProtestCutscene({ dispatch, year, onClose }: { dispatch: ProtestDispatch; year: number; onClose: () => void }) {
  const art = TIER_ART[dispatch.tier];
  const lines = [
    `Stability fell below ${dispatch.line} in year ${year}.`,
    `Blockades will cost about ${formatPct(dispatch.outputHit)} of shop, office, freight, and building output each year.`,
    dispatch.shopsClosed > 0.0005 ? `${formatPct(dispatch.shopsClosed)} of shop jobs closed by looting. Shops reopen as the wave ends.` : null,
    `Expected to last ${dispatch.years} year${dispatch.years === 1 ? "" : "s"}${dispatch.police === "strong" ? " with strong police on the streets" : dispatch.police === "low" ? " with a thin police budget" : ""}.`,
  ].filter((line): line is string => line != null);
  return (
    <div
      className="safe-top safe-bottom fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#0b0e14]/92 px-3 py-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="protest-title"
      data-testid="protest-cutscene"
    >
      <div className="rise w-full max-w-md overflow-hidden rounded-2xl border border-border bg-[#151b25]">
        <img src={art.src} alt={art.alt} className="block aspect-video w-full object-cover" />
        <div className="px-4 pt-4 pb-4">
          <p className={`text-sm font-semibold tracking-wide uppercase ${TIER_TONE[dispatch.tier]}`}>
            Breaking · {dispatch.kicker}
          </p>
          <h2 id="protest-title" className="font-display mt-1 text-2xl leading-tight">
            {dispatch.title}
          </h2>
          <ul className="mt-3 flex flex-col gap-1.5 text-base text-muted-foreground">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent text-base font-semibold text-accent-foreground"
            onClick={onClose}
            data-testid="protest-continue"
          >
            Back to the city
            <ArrowRight className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function GameOverScreen({
  ledger,
  onNewGame,
  onLoad,
  onInspect,
}: {
  ledger: Ledger;
  onNewGame: () => void;
  onLoad: () => void;
  onInspect: () => void;
}) {
  const tally = finalTally(ledger);
  const rows: [string, string][] = [
    ["Years survived", formatInt(tally.yearsSurvived)],
    ["Peak population", formatInt(tally.peakPopulation)],
    ["Unemployment at the end", formatPct(tally.unemployment)],
    ["Protest waves", formatInt(tally.protestWaves)],
    [tally.treasury < 0 ? "Reserve (overdrawn)" : "Reserve", formatMarks(tally.treasury)],
    ["Debt", tally.debt > 0 ? formatMarks(tally.debt) : "none"],
  ];
  return (
    <div
      className="safe-top safe-bottom fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0b0e14]/95 px-3 py-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-title"
      data-testid="game-over"
    >
      <div className="rise w-full max-w-md overflow-hidden rounded-2xl border border-danger/50 bg-[#151b25]">
        <img
          src={zombies}
          alt="A pyramid of zombies climbs the city hall steps while a pigeon watches."
          className="block aspect-video w-full object-cover"
        />
        <div className="px-4 pt-4 pb-4">
          <p className="text-sm font-semibold tracking-wide text-danger uppercase">Game over · Stability 0</p>
          <h2 id="gameover-title" className="font-display mt-1 text-3xl leading-tight">
            City falls to the horde
          </h2>
          <p className="mt-2 text-base text-muted-foreground">
            With order gone, the undead took city hall in year {tally.finalYear}. The council has been, regrettably, eaten. A pigeon is now in charge.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-2">
            {rows.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-card px-3 py-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent text-base font-semibold text-accent-foreground"
            onClick={onNewGame}
            data-testid="gameover-new"
          >
            <RotateCcw className="size-5" strokeWidth={1.75} aria-hidden="true" />
            Start a new game
          </button>
          <button
            type="button"
            className="mt-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-base font-semibold"
            onClick={onLoad}
            data-testid="gameover-load"
          >
            <FolderOpen className="size-5" strokeWidth={1.75} aria-hidden="true" />
            Load a saved game
          </button>
          <button
            type="button"
            className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-muted-foreground"
            onClick={onInspect}
            data-testid="gameover-inspect"
          >
            <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Look over the ruins
          </button>
        </div>
      </div>
    </div>
  );
}

export function Advisors({ ledger }: { ledger: Ledger }) {
  const list = advisors(ledger);
  return (
    <section aria-label="Advisors" className="flex flex-col gap-3" data-testid="advisors">
      <p className="text-sm text-muted-foreground">
        Your cabinet reads this year&rsquo;s books. Their tips change as the city does.
      </p>
      {list.map((advisor) => (
        <AdvisorCard key={advisor.id} advisor={advisor} />
      ))}
    </section>
  );
}

function AdvisorCard({ advisor }: { advisor: Advisor }) {
  const badge = BADGE[advisor.status];
  return (
    <article className="rounded-xl border border-border bg-card px-3 py-3" data-testid={`advisor-${advisor.id}`}>
      <div className="flex items-center gap-3">
        <img
          src={FACE[advisor.id]}
          alt=""
          width={64}
          height={64}
          className="size-16 shrink-0 rounded-xl border border-border object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{advisor.name}</p>
          <p className="text-sm text-muted-foreground">{advisor.role}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${badge.className}`}>
          {badge.label}
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-2 text-base">
        {advisor.tips.map((tip) => (
          <li key={tip} className="border-l-2 border-accent/50 pl-3">
            {tip}
          </li>
        ))}
      </ul>
    </article>
  );
}
