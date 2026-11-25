import { useMemo, useState } from "react";
import { formatInt, formatPct } from "@/lib/sim/format";
import { buildCityMap, type BuildingKind, type MapTile, type Zone } from "@/lib/sim/city-map";
import { asPolice, waveDamage, type Ledger } from "@/lib/sim/engine";

const CELL = 10;
const GAP = 0.45;

const SEA = ["#1f6e88", "#1b6480", "#185c78"];
const RIVER = "#3a9cc4";
const MOUTH = "#2a86a8";

const ZONE_FILL: Record<Zone, string> = {
  residential: "#1c4a33",
  commercial: "#163552",
  industrial: "#534e24",
  none: "#15202c",
};

const ZONE_FILL_ALT: Record<Zone, string> = {
  residential: "#1a4430",
  commercial: "#142e48",
  industrial: "#4a4620",
  none: "#15202c",
};

const KIND_FILL: Partial<Record<BuildingKind, string>> = {
  house: "#2f7a4e",
  shop: "#2d5f96",
  office: "#4a6f9a",
  dock: "#8a6a42",
  power: "#c47a2c",
  solar: "#27457a",
  battery: "#4f9a5c",
  tidal: "#169c94",
  water: "#3a8ec0",
  waste: "#a07540",
  data: "#6a6d78",
  hall: "#6d7d8e",
  school: "#3d6e55",
  clinic: "#5a7a6e",
  park: "#2a6a44",
  bridge: "#7a7460",
};

function houseFill(density: number): string {
  if (density >= 3) return "#4eaa6a";
  if (density === 2) return "#3d8a58";
  return "#2f7a4e";
}

function fillOf(tile: MapTile): string {
  if (tile.kind === "house") return houseFill(tile.density);
  if (tile.kind === "office" && tile.density <= 0) return "#26303c";
  if (tile.kind === "dock") return KIND_FILL.dock!;
  if (tile.kind !== "empty" && tile.kind !== "bridge" && KIND_FILL[tile.kind]) {
    return KIND_FILL[tile.kind]!;
  }
  if (tile.terrain === "sea") {
    const depth = Math.min(2, tile.x - 13);
    const mouth = tile.y >= 5 && tile.y <= 8;
    return mouth ? MOUTH : SEA[depth]!;
  }
  if (tile.terrain === "river") return tile.kind === "bridge" ? KIND_FILL.bridge! : RIVER;
  const palette = (tile.x + tile.y) % 2 === 0 ? ZONE_FILL : ZONE_FILL_ALT;
  return palette[tile.zone];
}

function Icon({ tile }: { tile: MapTile }) {
  const k = tile.kind;
  if (k === "house") {
    if (tile.density >= 3) {
      return (
        <g fill="#e8f6ec" opacity="0.9">
          <rect x="2.2" y="3.2" width="2.2" height="3.6" rx="0.3" />
          <rect x="5.6" y="2.4" width="2.2" height="4.4" rx="0.3" />
        </g>
      );
    }
    if (tile.density === 2) {
      return (
        <g fill="#e8f6ec" opacity="0.9">
          <path d="M2.2 6.2 V4.6 L3.5 3.5 L4.8 4.6 V6.2Z" />
          <path d="M5.4 6.4 V4.4 L7 3.2 L8.6 4.4 V6.4Z" />
        </g>
      );
    }
    return <path d="M3 6.6 V4.6 L5 3.2 L7 4.6 V6.6Z" fill="#e8f6ec" opacity="0.9" />;
  }
  if (k === "shop") {
    return (
      <g>
        <rect x="2.4" y="4.2" width="5.2" height="3" rx="0.3" fill="#e7eef8" opacity="0.9" />
        <path d="M2.2 4.2 L5 3.2 L7.8 4.2Z" fill="#f0c14a" />
      </g>
    );
  }
  if (k === "office") {
    const lit = tile.density > 0;
    return (
      <g>
        <rect x="3" y="1.6" width="4" height="6.8" rx="0.3" fill={lit ? "#dfe9f5" : "#5b6573"} opacity="0.92" />
        <g fill={lit ? "#f0c14a" : "#2b323c"}>
          <rect x="3.6" y="2.4" width="1" height="0.9" />
          <rect x="5.4" y="2.4" width="1" height="0.9" />
          <rect x="3.6" y="4.1" width="1" height="0.9" />
          <rect x="5.4" y="4.1" width="1" height="0.9" />
          <rect x="3.6" y="5.8" width="1" height="0.9" />
          <rect x="5.4" y="5.8" width="1" height="0.9" />
        </g>
      </g>
    );
  }
  if (k === "dock") {
    return (
      <g stroke="#f0e2c8" strokeWidth="0.7" opacity="0.85">
        <path d="M2.2 4.2 H7.8" />
        <path d="M2.2 5.5 H7.8" />
        <path d="M2.2 6.8 H7.8" />
      </g>
    );
  }
  if (k === "power") {
    // Oil plant: a smokestack and a fuel tank.
    return (
      <g opacity="0.9">
        <rect x="2.4" y="2.2" width="1.5" height="5.6" rx="0.2" fill="#2a1a0a" />
        <circle cx="3.15" cy="1.6" r="0.6" fill="#d9d2c4" opacity="0.7" />
        <rect x="4.6" y="4.2" width="3.2" height="3.6" rx="1" fill="#2a1a0a" />
        <path d="M6.2 4.9 C6.2 4.9 5.5 5.8 5.5 6.3 A0.7 0.7 0 0 0 6.9 6.3 C6.9 5.8 6.2 4.9 6.2 4.9Z" fill="#f0c14a" />
      </g>
    );
  }
  if (k === "solar") {
    return (
      <g>
        <rect x="1.9" y="2.6" width="6.2" height="4.8" rx="0.3" fill="#0f2242" stroke="#9cc4ff" strokeWidth="0.35" />
        <path d="M4 2.6 V7.4 M6 2.6 V7.4 M1.9 5 H8.1" stroke="#9cc4ff" strokeWidth="0.3" />
        <circle cx="7.6" cy="2" r="0.8" fill="#f0c14a" />
      </g>
    );
  }
  if (k === "battery") {
    return (
      <g>
        <rect x="2.4" y="3.2" width="4.8" height="3.6" rx="0.4" fill="#eaf6ec" opacity="0.9" />
        <rect x="7.2" y="4.3" width="0.7" height="1.4" rx="0.2" fill="#eaf6ec" opacity="0.9" />
        <rect x="2.9" y="3.7" width="2.6" height="2.6" rx="0.2" fill="#2f7a3e" />
      </g>
    );
  }
  if (k === "tidal") {
    // Tidal turbine: a hub with three blades over the waves.
    return (
      <g>
        <path d="M1.8 7.6 Q3.4 6.9 5 7.6 Q6.6 8.3 8.2 7.6" stroke="#d8f4f1" strokeWidth="0.45" fill="none" opacity="0.8" />
        <g fill="#eafaf8" opacity="0.95">
          <path d="M5 4.4 L4.6 1.6 L5.4 1.6Z" />
          <path d="M5 4.4 L7.5 5.6 L7.1 6.3Z" />
          <path d="M5 4.4 L2.9 6.3 L2.5 5.6Z" />
          <circle cx="5" cy="4.4" r="0.7" />
        </g>
      </g>
    );
  }
  if (k === "water") {
    return (
      <path
        d="M5 2.2 C5 2.2 2.6 5.4 2.6 6.8 A2.4 2.4 0 0 0 7.4 6.8 C7.4 5.4 5 2.2 5 2.2Z"
        fill="#e8f4fc"
        opacity="0.9"
      />
    );
  }
  if (k === "waste") {
    return (
      <g fill="#f3e6d4" opacity="0.9">
        <rect x="3" y="3.8" width="4" height="3.6" rx="0.4" />
        <rect x="2.6" y="3.2" width="4.8" height="0.9" rx="0.3" />
      </g>
    );
  }
  if (k === "data") {
    return (
      <g fill="#d7dbe6" opacity="0.9">
        <rect x="2.2" y="2.6" width="2.4" height="5" rx="0.3" />
        <rect x="5.4" y="2.6" width="2.4" height="5" rx="0.3" />
        <rect x="2.5" y="3.4" width="1.8" height="0.5" fill="#3ecfb2" />
        <rect x="5.7" y="3.4" width="1.8" height="0.5" fill="#3ecfb2" />
        <rect x="2.5" y="4.6" width="1.8" height="0.5" fill="#3ecfb2" />
        <rect x="5.7" y="4.6" width="1.8" height="0.5" fill="#3ecfb2" />
      </g>
    );
  }
  if (k === "hall") {
    return (
      <g fill="#f4f1ea" opacity="0.9">
        <path d="M2.2 5 L5 2.6 L7.8 5Z" />
        <rect x="3" y="5" width="4" height="2.8" />
        <rect x="4.7" y="2" width="0.6" height="1.2" />
      </g>
    );
  }
  if (k === "school") {
    return (
      <g fill="#f4f1ea" opacity="0.9">
        <rect x="2.6" y="4" width="4.8" height="3.2" rx="0.3" />
        <path d="M5 2.4 L7.4 4 H2.6Z" />
      </g>
    );
  }
  if (k === "clinic") {
    return (
      <g fill="#f4f1ea" opacity="0.95">
        <rect x="4.2" y="2.6" width="1.6" height="4.8" rx="0.3" />
        <rect x="2.6" y="4.2" width="4.8" height="1.6" rx="0.3" />
      </g>
    );
  }
  if (k === "park") {
    return (
      <g fill="#b6e3c0" opacity="0.85">
        <circle cx="5" cy="4.2" r="2" />
        <rect x="4.5" y="5.6" width="1" height="2" rx="0.3" />
      </g>
    );
  }
  if (k === "bridge") {
    return <path d="M1.6 5 H8.4" stroke="#f0e6cc" strokeWidth="1.2" strokeLinecap="round" />;
  }
  if (k === "empty" && tile.terrain === "sea") {
    const shift = (tile.x + tile.y) % 2 === 0 ? 0 : 0.5;
    return (
      <g stroke="#b7e0ee" strokeWidth="0.45" opacity="0.4" fill="none">
        <path
          d={`M2.1 ${3.8 + shift} Q3.6 ${3.1 + shift} 5 ${3.8 + shift} Q6.4 ${4.5 + shift} 7.9 ${3.8 + shift}`}
        />
        <path
          d={`M2.1 ${6.2 + shift} Q3.6 ${5.5 + shift} 5 ${6.2 + shift} Q6.4 ${6.9 + shift} 7.9 ${6.2 + shift}`}
        />
      </g>
    );
  }
  return null;
}

const LEGEND: readonly { color: string; label: string; mark?: "auto" }[] = [
  { color: "#1f6e88", label: "Sea" },
  { color: "#3a9cc4", label: "River" },
  { color: "#8a6a42", label: "Docks" },
  { color: "#2f7a4e", label: "Homes" },
  { color: "#2d5f96", label: "Shops" },
  { color: "#4a6f9a", label: "Offices" },
  { color: "#26303c", label: "Empty offices" },
  { color: "#6a6328", label: "Industry" },
  { color: "#6a6d78", label: "Data" },
  { color: "#c47a2c", label: "Oil power" },
  { color: "#27457a", label: "Solar" },
  { color: "#4f9a5c", label: "Batteries" },
  { color: "#169c94", label: "Tidal" },
  { color: "#3a8ec0", label: "Water" },
  { color: "#a07540", label: "Waste" },
  { color: "#3ecfb2", label: "Automated", mark: "auto" },
  { color: "#e5484d", label: "Protest" },
];

function summaryText(ledger: Ledger, map: ReturnType<typeof buildCityMap>): string {
  const { counts } = map;
  const plants = counts.power + counts.water + counts.waste;
  const energy = [
    counts.oil ? `${formatInt(counts.oil)} oil` : "",
    counts.solar ? `${formatInt(counts.solar)} solar` : "",
    counts.tidal ? `${formatInt(counts.tidal)} tidal` : "",
  ].filter(Boolean);
  const parts = [
    `Year ${ledger.year} city map`,
    `${formatInt(ledger.population)} residents`,
    `${formatInt(counts.homes)} home tiles`,
    `${formatInt(counts.shops)} shops`,
    `${formatInt(counts.offices)} busy offices${counts.emptyOffices > 0 ? `, ${formatInt(counts.emptyOffices)} empty` : ""}`,
    `${formatInt(plants)} utility plants`,
  ];
  if (energy.length > 0) parts.push(`Power from ${energy.join(", ")}`);
  if (counts.data > 0) parts.push(`${formatInt(counts.data)} data centers`);
  if (counts.automatedPlants > 0) parts.push(`${formatInt(counts.automatedPlants)} automated`);
  if (counts.protests > 0) parts.push(`Protests on ${formatInt(counts.protests)} squares`);
  return parts.join(". ");
}

const POLICE_WORD = { low: "Thin police force", normal: "Normal police", strong: "Strong police" } as const;

/** What the current protest wave is doing and how long it lasts. Red tiles on the map show where. */
export function UnrestBanner({ ledger }: { ledger: Ledger }) {
  const wave = ledger.unrest?.wave;
  if (!wave || wave.yearsLeft <= 0) {
    const cooldown = ledger.unrest?.cooldown ?? 0;
    if (cooldown <= 0 || !ledger.hasClosedYear) return null;
    return (
      <p className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground" data-testid="unrest-calm">
        The streets are calm. People are waiting to see what changes; no new protest wave can start for{" "}
        {cooldown === 1 ? "1 more year" : `${cooldown} more years`}.
      </p>
    );
  }
  const police = asPolice(ledger.policies?.police);
  const fresh = wave.started === ledger.year;
  const now = waveDamage(wave, police);
  const left = police === "strong" ? 1 : wave.yearsLeft;
  const years = left === 1 ? "1 year" : `${left} years`;
  return (
    <div
      role="status"
      className="rounded-lg border border-danger/60 bg-danger/15 px-3 py-2 text-sm"
      data-testid="unrest-banner"
    >
      <p className="font-semibold text-danger">
        {fresh ? `Protests broke out · stability fell below ${wave.line}` : `Protests go on · from the fall below ${wave.line}`}
      </p>
      <p className="mt-0.5 text-foreground">
        Road blockades cut shop, office, freight and building business about {formatPct(now.share)} for {years}.
        Looters shut about {formatPct(now.closed)} of shops; they reopen as the protests end.
      </p>
      <p className="mt-0.5 text-muted-foreground">
        {POLICE_WORD[police]}.{" "}
        {police === "strong"
          ? "Damage is lower and the roads clear sooner."
          : "Switch to strong police to cut the damage and clear the roads sooner, at a cost."}{" "}
        No new wave can start until this one has run its course.
      </p>
    </div>
  );
}

export function CityMap({ ledger }: { ledger: Ledger }) {
  const map = useMemo(() => buildCityMap(ledger), [ledger]);
  const [picked, setPicked] = useState<{ x: number; y: number } | null>(null);
  const selected = picked ? map.tiles[picked.y * map.width + picked.x] : null;
  const size = map.width * CELL;

  function onSelect(tile: MapTile) {
    setPicked((current) =>
      current && current.x === tile.x && current.y === tile.y ? null : { x: tile.x, y: tile.y },
    );
  }

  return (
    <section className="mb-16 flex flex-col gap-3" aria-label="City map" data-testid="city-map">
      <p className="text-sm text-muted-foreground">
        A dock town on the east shore. Houses fill as people arrive. Plants and data centers appear
        as you build and automate.
      </p>
      <UnrestBanner ledger={ledger} />
      <div className="overflow-hidden rounded-xl border border-border bg-[#10141c]/70 p-2">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={summaryText(ledger, map)}
          data-testid="map-grid"
          className="block h-auto w-full"
        >
          {map.tiles.map((tile) => {
            const active = selected?.x === tile.x && selected?.y === tile.y;
            const stroke = tile.automated
              ? "#3ecfb2"
              : tile.staged
                ? "#f0c14a"
                : active
                  ? "#f4f1ea"
                  : "#0c1218";
            return (
              <g
                key={`${tile.x},${tile.y}`}
                transform={`translate(${tile.x * CELL} ${tile.y * CELL})`}
                data-cell={`${tile.x},${tile.y}`}
                data-kind={tile.kind}
                data-zone={tile.zone}
                data-terrain={tile.terrain}
                data-automated={tile.automated ? "true" : "false"}
                data-protest={tile.protest ? "true" : undefined}
                onClick={() => onSelect(tile)}
                className="cursor-pointer"
              >
                <title>{tile.label}</title>
                <rect
                  x={GAP}
                  y={GAP}
                  width={CELL - GAP * 2}
                  height={CELL - GAP * 2}
                  rx={1.15}
                  fill={fillOf(tile)}
                  stroke={stroke}
                  strokeWidth={tile.automated || tile.staged || active ? 0.7 : 0.35}
                  strokeDasharray={tile.staged ? "0.9 0.7" : undefined}
                />
                <Icon tile={tile} />
                {tile.protest ? (
                  <rect
                    x={GAP}
                    y={GAP}
                    width={CELL - GAP * 2}
                    height={CELL - GAP * 2}
                    rx={1.15}
                    fill="#e5484d"
                    fillOpacity={0.5}
                    stroke="#ff6b6b"
                    strokeWidth={0.6}
                    className="motion-safe:animate-pulse"
                    pointerEvents="none"
                  />
                ) : null}
                {tile.automated ? (
                  <circle cx={CELL - 1.8} cy={1.8} r={0.85} fill="#3ecfb2" />
                ) : null}
              </g>
            );
          })}
        </svg>
        <ul className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 px-0.5 pb-0.5" aria-label="Map legend">
          {LEGEND.map((item) => (
            <li key={item.label} className="flex items-center gap-1 text-sm text-muted-foreground">
              <span
                className="inline-block size-2.5 shrink-0 rounded-[2px]"
                style={{
                  background: item.mark === "auto" ? "transparent" : item.color,
                  boxShadow: item.mark === "auto" ? `inset 0 0 0 2px ${item.color}` : undefined,
                }}
                aria-hidden="true"
              />
              {item.label}
            </li>
          ))}
        </ul>
        <p className="px-0.5 pt-1 text-sm text-muted-foreground" data-testid="map-summary">
          {formatInt(map.counts.homes)} homes · {formatInt(map.counts.shops)} shops ·{" "}
          {formatInt(map.counts.offices + map.counts.emptyOffices)} offices{map.counts.emptyOffices > 0 ? ` (${formatInt(map.counts.emptyOffices)} empty)` : ""} ·{" "}
          {formatInt(map.counts.power + map.counts.water + map.counts.waste)} plants ·{" "}
          {formatInt(map.counts.data)} data centers
        </p>
        <p className="px-0.5 text-sm text-muted-foreground" data-testid="map-energy">
          Power: {formatInt(map.counts.oil)} oil
          {map.counts.solar > 0 ? ` · ${formatInt(map.counts.solar)} solar` : ""}
          {map.counts.batteries > 0 ? ` · ${formatInt(map.counts.batteries)} battery banks` : ""}
          {map.counts.tidal > 0 ? ` · ${formatInt(map.counts.tidal)} tidal` : ""}
        </p>
        {selected ? (
          <p className="px-0.5 text-base font-semibold" data-testid="map-inspect">
            {selected.label}
          </p>
        ) : (
          <p className="px-0.5 text-sm text-subtle">Tap a square to see what it is.</p>
        )}
      </div>
    </section>
  );
}
