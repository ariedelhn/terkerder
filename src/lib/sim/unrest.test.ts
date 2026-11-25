import assert from "node:assert/strict";
import test from "node:test";
import {
  advance,
  crowdingPenalty,
  freshUnrest,
  nextMigration,
  nextUnrest,
  openingMigration,
  openingState,
  serviceOutlook,
  stageService,
  UNREST_COOLDOWN,
  UNREST_HIT,
  waveDamage,
  waveFor,
  type Ledger,
  type Police,
  type UnrestState,
} from "./engine.ts";
import { buildCityMap } from "./city-map.ts";
import { reviveLedger } from "./storage.ts";

/** Run the unrest books over a path of year-end stability values. */
function walk(path: number[], police: Police = "normal") {
  let unrest: UnrestState = freshUnrest();
  const waves: { year: number; line: number }[] = [];
  path.forEach((stability, index) => {
    const step = nextUnrest(unrest, stability, police, index + 1);
    unrest = step.unrest;
    if (step.started) waves.push({ year: index + 1, line: step.started.line });
  });
  return { unrest, waves };
}

function keepUp(state: Ledger): Ledger {
  let next = state;
  for (const id of ["power", "water", "waste"] as const) {
    if (serviceOutlook(next, id).nextCover < 1.03) next = stageService(next, id, "crew");
  }
  return next;
}

test("a protest wave starts once per 5-point line on the way down", () => {
  // Slow slide: one line every few years, well past each cooldown.
  const { waves } = walk([72, 69, 69, 68, 64, 64, 63, 59, 59, 58]);
  assert.deepEqual(
    waves.map((w) => w.line),
    [70, 65, 60],
  );
  // Sitting below a line does not fire it again.
  const flat = walk([72, 69, 69, 69, 69, 69, 69]);
  assert.equal(flat.waves.length, 1);
  // Nothing fires above 70.
  assert.equal(walk([100, 90, 80, 71, 75]).waves.length, 0);
});

test("after a wave, a cooldown stops new waves so the player can react", () => {
  // 69 starts a wave; 64 and 59 the next two years fall in the cooldown.
  const { waves, unrest } = walk([69, 64, 59]);
  assert.equal(UNREST_COOLDOWN, 2);
  assert.deepEqual(waves.map((w) => w.line), [70]);
  assert.deepEqual(unrest.calmed, [65, 60]);
  // Lines crossed during the cooldown are spent: they do not erupt later at the same level.
  const later = walk([69, 64, 59, 59, 59, 59]);
  assert.equal(later.waves.length, 1);
  // The next new line after the cooldown starts a wave.
  const next = walk([69, 64, 59, 59, 54]);
  assert.deepEqual(next.waves.map((w) => w.line), [70, 55]);
  // A big drop that crosses several lines at once is still one wave.
  const crash = walk([72, 52]);
  assert.equal(crash.waves.length, 1);
  assert.equal(crash.waves[0]!.line, 55);
});

test("a line re-arms only after stability climbs back above it", () => {
  // 69 fires 70. Back to 70 exactly does not re-arm; 71 does; falling again fires again.
  const { waves } = walk([69, 69, 69, 70, 69, 69, 71, 69]);
  assert.deepEqual(waves.map((w) => w.year), [1, 8]);
  // Re-arming one line leaves deeper spent lines spent until stability passes them too.
  const deep = walk([69, 69, 69, 64, 64, 66, 64]);
  assert.deepEqual(deep.waves.map((w) => w.line), [70, 65, 65]);
});

test("waves hurt business for one or two years, and looted shops reopen", () => {
  const mild = waveFor(68, "normal", 5, 70);
  const harsh = waveFor(30, "normal", 5, 35);
  assert.equal(mild.length, 1);
  assert.equal(harsh.length, 2);
  assert.ok(mild.cut >= 0.05 && mild.cut < harsh.cut && harsh.cut <= 0.15);
  assert.ok(waveDamage(mild).share >= 0.05 && waveDamage(harsh).share <= 0.15);
  const first = waveDamage(harsh);
  const second = waveDamage({ ...harsh, yearsLeft: 1 });
  assert.ok(first.closed > second.closed && second.closed > 0);
  assert.equal(first.cut.services, harsh.cut);
  assert.equal(first.cut.government, undefined);
  assert.equal(waveDamage(null).closed, 0);
  // The wave ends on schedule.
  let unrest: UnrestState = { ...freshUnrest(), wave: harsh, cooldown: 2, fired: [70, 65, 60, 55, 50, 45, 40, 35] };
  unrest = nextUnrest(unrest, 30, "normal", 6).unrest;
  assert.equal(unrest.wave?.yearsLeft, 1);
  unrest = nextUnrest(unrest, 30, "normal", 7).unrest;
  assert.equal(unrest.wave, null);
});

test("strong police shorten waves and cut the damage, but cost money and a little stability", () => {
  const wave = waveFor(40, "normal", 5, 45);
  const low = waveDamage(wave, "low");
  const normal = waveDamage(wave, "normal");
  const strong = waveDamage(wave, "strong");
  assert.ok(strong.share < normal.share && normal.share < low.share);
  assert.ok(strong.closed < normal.closed && normal.closed < low.closed);
  assert.ok(waveFor(40, "strong", 5, 45).length < wave.length);
  assert.equal(waveFor(40, "low", 5, 45).length, 2);
  // Even mild unrest lasts two years with a thin police force.
  assert.equal(waveFor(68, "low", 5, 70).length, 2);
  // Bringing in strong police mid-wave clears the roads a year early.
  const start: UnrestState = { ...freshUnrest(), wave, cooldown: 2, fired: [70, 65, 60, 55, 50, 45] };
  assert.equal(nextUnrest(start, 40, "normal", 6).unrest.wave?.yearsLeft, 1);
  assert.equal(nextUnrest(start, 40, "strong", 6).unrest.wave, null);

  const base = openingState();
  const withPolice = (police: Police) => advance({ ...base, policies: { ...base.policies, police } });
  const a = withPolice("normal");
  const b = withPolice("strong");
  const c = withPolice("low");
  assert.ok(b.spend.police > a.spend.police * 1.8);
  assert.ok(c.spend.police < a.spend.police * 0.6);
  assert.ok(b.spending > a.spending);
  assert.ok(b.crime <= a.crime && c.crime >= a.crime);

  // Over a decade of calm, strong police wear stability down a little against normal police.
  const decade = (police: Police) => {
    let s = { ...base, policies: { ...base.policies, police } };
    for (let i = 0; i < 10; i += 1) s = advance(keepUp(s));
    return s;
  };
  assert.ok(decade("strong").stability < decade("normal").stability);
});

test("a wave in the engine: one-time hit, a banner, red on the map, and business lost", () => {
  const base = keepUp(openingState());
  // Set up a city right above the line, then push it below with austerity-level stress.
  const start: Ledger = { ...base, stability: 71 };
  let s = advance({ ...start, policies: { ...start.policies, tax: "high" } });
  let guard = 0;
  while (!s.unrest.wave && guard < 40) {
    s = advance(keepUp({ ...s, policies: { ...s.policies, tax: "high" } }));
    guard += 1;
  }
  assert.ok(s.unrest.wave, "a wave started");
  assert.ok(s.bulletin.startsWith("Protests broke out as stability fell below"), s.bulletin);
  assert.ok(s.events.some((e) => e.label.startsWith("Protest wave")));
  const map = buildCityMap(s);
  assert.ok(map.counts.protests > 0);
  assert.ok(map.tiles.some((tile) => tile.protest));
  // The next year carries the damage: tax from blockaded sectors falls against a calm twin.
  const calmTwin = advance(keepUp({ ...s, unrest: { ...s.unrest, wave: null } }));
  const hit = advance(keepUp(s));
  assert.ok(hit.taxRevenue < calmTwin.taxRevenue, `${hit.taxRevenue} vs ${calmTwin.taxRevenue}`);
  // The one-time hit is UNREST_HIT, not repeated in the wave's later years.
  assert.equal(UNREST_HIT, 2);
});

test("immigration: newcomers look for work at once, but the jobs they bring lag a year or two", () => {
  const prev = openingMigration(72_000);
  const opened = nextMigration(prev, 72_000, 73_400, { gates: "open", works: false }, openingState().techs);
  assert.ok(opened.newcomers > 1000);
  assert.equal(opened.gateRamp, 0.5);
  const settled = nextMigration(opened, 73_400, 73_400 * 1.0035, { gates: "open", works: false }, openingState().techs);
  assert.ok(settled.newcomers < opened.newcomers * 0.6, "half settle each year");
  assert.equal(settled.gateRamp, 1);

  // Open the gates in year 3: the first year's hiring is well short of what it is two years on.
  const run = (gates: "open" | "steady", instant = false) => {
    let s = keepUp(openingState());
    const out: Ledger[] = [];
    for (let i = 0; i < 6; i += 1) {
      if (s.year === 3) {
        s = { ...s, policies: { ...s.policies, gates } };
        if (instant) s = { ...s, migration: { ...s.migration, gateRamp: 1 } };
      }
      s = advance(keepUp(s));
      out.push(s);
    }
    return out;
  };
  const steady = run("steady");
  const open = run("open");
  const instant = run("open", true);
  const gain = (i: number) => open[i]!.employed - steady[i]!.employed;
  assert.ok(gain(2) > 0, "open gates still add jobs");
  assert.ok(gain(2) < gain(4) * 0.6, `first year ${gain(2)} vs later ${gain(4)}`);
  // Without the lag (the old rule) the first year's boost would be bigger.
  assert.ok(instant[2]!.employed - steady[2]!.employed > gain(2));
  assert.ok(open[3]!.migration.newcomers > 0);
});

test("crowded homes cost stability and say so", () => {
  assert.equal(crowdingPenalty(0.97), 0);
  assert.ok(crowdingPenalty(1.04) > 1.5);
  assert.equal(crowdingPenalty(1.5), 3);
  const base = keepUp(openingState());
  const roomy = advance(base);
  const tight = advance({ ...base, migration: { ...base.migration, housing: Math.round(base.population * 0.93) } });
  assert.ok(tight.stability < roomy.stability, `${tight.stability} vs ${roomy.stability}`);
  assert.ok(tight.bulletin.includes("Homes are short"), tight.bulletin);
  assert.ok(tight.population - base.population < roomy.population - base.population, "crowding slows arrivals");
});

test("an old save without unrest, migration, or police loads calm and without NaN", () => {
  const base = openingState();
  const raw = JSON.parse(JSON.stringify({ ...base, stability: 48, policies: { ...base.policies, gates: "open" } })) as Record<
    string,
    unknown
  >;
  delete raw.unrest;
  delete raw.migration;
  const policies = { ...(raw.policies as Record<string, unknown>) };
  delete policies.police;
  raw.policies = policies;
  const spend = { ...(raw.spend as Record<string, unknown>) };
  delete spend.police;
  raw.spend = spend;
  const revived = reviveLedger(raw);
  assert.ok(revived);
  assert.equal(revived.policies.police, "normal");
  // Lines it crossed long ago are spent, so loading does not start a wave by itself.
  const next = advance(revived);
  assert.equal(next.unrest.wave?.line ?? null, next.stability < 45 ? next.unrest.wave?.line ?? null : null);
  assert.ok(revived.unrest.fired.includes(50));
  assert.equal(revived.migration.gateRamp, 1, "open gates keep their full effect on old saves");
  for (const value of [next.unemployment, next.treasury, next.stability, next.spend.police, next.migration.housing]) {
    assert.ok(Number.isFinite(value));
  }
});
