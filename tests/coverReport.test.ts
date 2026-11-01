/**
 * Prints the battlefield survey for each map size, averaged over a fixed set
 * of seeds, for tuning terrain against the PRD's cover targets. Skipped
 * unless COVER_REPORT=1:
 *
 *   COVER_REPORT=1 npx vitest run tests/coverReport.test.ts --silent=false
 */
import { describe, expect, it } from 'vitest';
import type { MapSize } from '../src/config/settings';
import type { WorldGenOptions } from '../src/world/WorldGenerator';
import { generateWorld, worldOptionsFor } from '../src/world/WorldGenerator';
import type { BattlefieldSurvey } from './battlefieldSurvey';
import { surveyBattlefield } from './battlefieldSurvey';

const SEEDS: Readonly<Record<MapSize, readonly number[]>> = {
  standard: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112],
  large: [201, 202, 203, 204],
  huge: [301, 302],
};
/** Standard seeds no tuning has used, to check the cover target is not luck of the seeds above. */
const HELD_OUT_SEEDS: readonly number[] = Array.from({ length: 36 }, (_, k) => 113 + k);

interface Variant {
  readonly name: string;
  options(size: MapSize): WorldGenOptions;
}

const GENTLE: Variant = { name: 'gentle', options: (size) => worldOptionsFor(size) };
const HILLY: Variant = { name: 'hilly', options: (size) => worldOptionsFor(size, false, 'hilly') };
const VARIANTS: readonly Variant[] = [GENTLE, HILLY];

const enabled = import.meta.env.COVER_REPORT === '1';
/** Hilly may take at most this multiple of Gentle's generation time; compared within one run, as load swings timings. */
const MAX_GEN_RATIO = 1.5;
/** PRD cover target: Hilly hides at least this multiple of what Gentle hides on the same seeds. */
const COVER_TARGET_RATIO = 1.5;
/** PRD cover in play: Hilly has cover within 60 m for at least this share of positions. */
const MIN_COVER_WITHIN_60 = 0.85;
const SIZE_IDS: readonly MapSize[] = ['standard', 'large', 'huge'];
/** Surveying dozens of battlefields takes minutes (ms). */
const REPORT_TIMEOUT = 300_000;

type Row = Record<string, string>;

interface Measured {
  readonly row: Row;
  readonly genMs: number;
  readonly hidden: number;
  readonly near: number;
  readonly coverMedian: number;
  readonly within60: number;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function measure(variant: Variant, size: MapSize, seeds: readonly number[] = SEEDS[size]): Measured {
  const opts = variant.options(size);
  const surveys: BattlefieldSurvey[] = [];
  const times: number[] = [];
  let rivers = 0;
  let lakes = 0;
  let bridges = 0;
  for (const seed of seeds) {
    const start = performance.now();
    const world = generateWorld(seed, opts);
    times.push(performance.now() - start);
    surveys.push(surveyBattlefield(world, seed));
    rivers += world.rivers.length;
    lakes += world.lakes.length;
    bridges += world.bridges.length;
  }
  const avg = (pick: (s: BattlefieldSurvey) => number): number => mean(surveys.map(pick));
  const pct = (pick: (s: BattlefieldSurvey) => number): string => `${(100 * avg(pick)).toFixed(1)}%`;
  const n = seeds.length;
  const genMs = mean(times);
  const row: Row = {
    terrain: variant.name,
    size,
    seeds: String(n),
    genMs: genMs.toFixed(0),
    relief: `${avg((s) => s.relief).toFixed(1)} m`,
    hidden: pct((s) => s.hiddenShare),
    near: pct((s) => s.hiddenNear),
    far: pct((s) => s.hiddenFar),
    coverM: avg((s) => s.coverDistanceMedian).toFixed(0),
    within60: pct((s) => s.coverWithin60),
    steep: pct((s) => s.steepShare),
    spawnable: pct((s) => s.spawnableShare),
    structures: avg((s) => s.structures).toFixed(1),
    rocks: avg((s) => s.rocks).toFixed(1),
    rivers: `${(rivers / n).toFixed(1)}/${opts.rivers}`,
    lakes: `${(lakes / n).toFixed(1)}/${opts.lakes + opts.ponds}`,
    bridges: (bridges / n).toFixed(1),
    perRiver: rivers > 0 ? (bridges / rivers).toFixed(1) : '-',
  };
  return {
    row,
    genMs,
    hidden: avg((s) => s.hiddenShare),
    near: avg((s) => s.hiddenNear),
    coverMedian: avg((s) => s.coverDistanceMedian),
    within60: avg((s) => s.coverWithin60),
  };
}

function formatTable(rows: readonly Row[]): string {
  const keys = Object.keys(rows[0]!);
  const widths = keys.map((k) => Math.max(k.length, ...rows.map((r) => r[k]!.length)));
  const line = (cells: readonly string[]): string => cells.map((c, i) => c.padStart(widths[i]!)).join('  ');
  return [line(keys), ...rows.map((r) => line(keys.map((k) => r[k]!)))].join('\n');
}

describe.runIf(enabled)('Cover report', () => {
  it('surveys every terrain type at every map size, keeping Hilly within its time budget and cover-in-play threshold', () => {
    const gentleBySize = new Map<MapSize, Measured>();
    const rows: Row[] = [];
    const comparisons: { size: MapSize; hilly: Measured; gentle: Measured }[] = [];
    for (const variant of VARIANTS) {
      for (const size of SIZE_IDS) {
        const measured = measure(variant, size);
        if (variant === GENTLE) gentleBySize.set(size, measured);
        const gentle = gentleBySize.get(size)!;
        if (variant !== GENTLE) comparisons.push({ size, hilly: measured, gentle });
        rows.push({ ...measured.row, vsGentle: `${(measured.genMs / gentle.genMs).toFixed(2)}x` });
      }
    }
    console.info(`\n${formatTable(rows)}\n`);
    for (const { size, hilly, gentle } of comparisons) {
      expect(hilly.genMs / gentle.genMs, `${size} generation time`).toBeLessThanOrEqual(MAX_GEN_RATIO);
      expect(hilly.coverMedian, `${size} median move to cover`).toBeLessThanOrEqual(gentle.coverMedian);
      expect(hilly.within60, `${size} cover within 60 m`).toBeGreaterThanOrEqual(MIN_COVER_WITHIN_60);
    }
  }, REPORT_TIMEOUT);

  it('keeps Hilly hiding 1.5 times what Gentle hides on Standard seeds no tuning used', () => {
    const gentle = measure(GENTLE, 'standard', HELD_OUT_SEEDS);
    const hilly = measure(HILLY, 'standard', HELD_OUT_SEEDS);
    const hiddenRatio = hilly.hidden / gentle.hidden;
    const nearRatio = hilly.near / gentle.near;
    const seeds = `${HELD_OUT_SEEDS[0]!}–${HELD_OUT_SEEDS[HELD_OUT_SEEDS.length - 1]!}`;
    console.info(`\nHeld-out Standard seeds ${seeds}\n${formatTable([gentle.row, hilly.row])}\nHilly/Gentle hidden: ${hiddenRatio.toFixed(2)}x all ranges, ${nearRatio.toFixed(2)}x at 60–150 m\n`);
    expect(hiddenRatio).toBeGreaterThanOrEqual(COVER_TARGET_RATIO);
    expect(nearRatio).toBeGreaterThanOrEqual(COVER_TARGET_RATIO);
  }, REPORT_TIMEOUT);
});
