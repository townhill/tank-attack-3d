/**
 * Prints the battlefield survey for each map size, averaged over a fixed set
 * of seeds, for tuning terrain against the PRD's cover target. Skipped
 * unless COVER_REPORT=1:
 *
 *   COVER_REPORT=1 npx vitest run tests/coverReport.test.ts
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

interface Variant {
  readonly name: string;
  options(size: MapSize): WorldGenOptions;
}

const VARIANTS: readonly Variant[] = [
  { name: 'gentle', options: (size) => worldOptionsFor(size) },
  { name: 'hilly', options: (size) => worldOptionsFor(size, false, 'hilly') },
];

const enabled = import.meta.env.COVER_REPORT === '1';
/** Hilly may take at most this multiple of Gentle's generation time; compared within one run, as load swings timings. */
const MAX_GEN_RATIO = 1.5;
const SIZE_IDS: readonly MapSize[] = ['standard', 'large', 'huge'];

type Row = Record<string, string>;

interface Measured {
  readonly row: Row;
  readonly genMs: number;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function measure(variant: Variant, size: MapSize): Measured {
  const opts = variant.options(size);
  const surveys: BattlefieldSurvey[] = [];
  const times: number[] = [];
  let rivers = 0;
  let lakes = 0;
  let bridges = 0;
  for (const seed of SEEDS[size]) {
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
  const n = SEEDS[size].length;
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
  return { row, genMs };
}

function formatTable(rows: readonly Row[]): string {
  const keys = Object.keys(rows[0]!);
  const widths = keys.map((k) => Math.max(k.length, ...rows.map((r) => r[k]!.length)));
  const line = (cells: readonly string[]): string => cells.map((c, i) => c.padStart(widths[i]!)).join('  ');
  return [line(keys), ...rows.map((r) => line(keys.map((k) => r[k]!)))].join('\n');
}

describe.runIf(enabled)('Cover report', () => {
  it('surveys every terrain type at every map size, keeping Hilly within its generation-time budget', () => {
    const gentleMs = new Map<MapSize, number>();
    const rows: Row[] = [];
    const ratios: number[] = [];
    for (const variant of VARIANTS) {
      for (const size of SIZE_IDS) {
        const { row, genMs } = measure(variant, size);
        if (variant.name === 'gentle') gentleMs.set(size, genMs);
        const ratio = genMs / gentleMs.get(size)!;
        if (variant.name !== 'gentle') ratios.push(ratio);
        rows.push({ ...row, vsGentle: `${ratio.toFixed(2)}x` });
      }
    }
    console.info(`\n${formatTable(rows)}\n`);
    for (const ratio of ratios) expect(ratio).toBeLessThanOrEqual(MAX_GEN_RATIO);
  }, 300_000);
});
