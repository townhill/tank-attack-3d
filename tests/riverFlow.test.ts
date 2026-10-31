import { describe, expect, it } from 'vitest';
import { FLOW_PEAK_SPEED, riverFlowField } from '../src/world/riverFlow';
import { Terrain } from '../src/world/Terrain';
import { carveWater } from '../src/world/WaterGenerator';
import { makeStraightRiver } from './waterFixtures';

describe('riverFlowField', () => {
  // A 28 m wide river flowing north to south (towards +Z) along x = 0.
  const terrain = new Terrain(100, 5);
  const river = makeStraightRiver(0, -100, 0, 100, { halfWidth: 14 });
  const level = carveWater(terrain, [river], [], 80);
  const flow = riverFlowField(terrain, level, [river]);
  const mid = (terrain.resolution - 1) / 2;
  const at = (i: number, j: number): [number, number] => {
    const v = terrain.index(i, j);
    return [flow[2 * v]!, flow[2 * v + 1]!];
  };

  it('has one velocity per vertex', () => {
    expect(flow.length).toBe(terrain.resolution * terrain.resolution * 2);
  });

  it('flows downstream at the peak speed on the centreline', () => {
    const [vx, vz] = at(mid, mid);
    expect(vx).toBeCloseTo(0, 6);
    expect(vz).toBeCloseTo(FLOW_PEAK_SPEED, 6);
  });

  it('slows towards the banks and stops at the waterline', () => {
    const centre = at(mid, mid)[1];
    const near = at(mid + 1, mid)[1];
    const far = at(mid + 2, mid)[1];
    expect(near).toBeLessThan(centre);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
    // The bank vertices 15 m out carry a water level for the shoreline but no flow.
    expect(at(mid + 3, mid)).toEqual([0, 0]);
  });

  it('leaves dry ground still', () => {
    expect(at(0, 0)).toEqual([0, 0]);
    expect(at(mid + 8, mid)).toEqual([0, 0]);
  });

  it('is all zero when there are no rivers', () => {
    const still = riverFlowField(terrain, level, []);
    expect(still.length).toBe(flow.length);
    expect(still.every((v) => v === 0)).toBe(true);
  });
});
