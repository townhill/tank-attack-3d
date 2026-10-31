/**
 * Marker posts that show where a ford crosses a river: a post on each bank
 * at both ends of the shallow stretch, each flying a pennant towards the
 * water, drawn as lines in the bridge colour. Without them a ford is hard to
 * tell from the deep water either side of it.
 */
import { Group } from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { HeightField } from '../world/Terrain';
import type { Ford } from '../world/Water';
import type { World } from '../world/World';
import { SegmentList } from './geometry';
import type { MaterialLibrary } from './Materials';

/** Height of a marker post above the ground it stands on (metres). */
export const FORD_MARKER_HEIGHT = 2.6;
/** How far beyond the river's edge each post stands, up the bank (metres). */
export const FORD_MARKER_SETBACK = 4;
/** Length of a pennant out from its post, and its height down the post (metres). */
const PENNANT_LENGTH = 1.2;
const PENNANT_HEIGHT = 0.7;
const BANK_SIDES = [-1, 1] as const;
const FORD_ENDS = [-1, 1] as const;

/** Marker posts and pennants of one ford in world space, as flat [x0, y0, z0, x1, y1, z1, ...]. */
export function fordMarkerSegments(ford: Ford, ground: HeightField): number[] {
  const lines = new SegmentList();
  // Across the river: the flow direction turned a quarter.
  const ax = -ford.tz;
  const az = ford.tx;
  const reach = ford.halfWidth + FORD_MARKER_SETBACK;
  for (const side of BANK_SIDES) {
    for (const end of FORD_ENDS) {
      const x = ford.x + side * reach * ax + end * ford.halfLength * ford.tx;
      const z = ford.z + side * reach * az + end * ford.halfLength * ford.tz;
      const base = ground.heightAt(x, z);
      const top = base + FORD_MARKER_HEIGHT;
      lines.add(x, base, z, x, top, z);
      const tipX = x - side * ax * PENNANT_LENGTH;
      const tipZ = z - side * az * PENNANT_LENGTH;
      const tipY = top - PENNANT_HEIGHT / 2;
      lines.add(x, top, z, tipX, tipY, tipZ);
      lines.add(tipX, tipY, tipZ, x, top - PENNANT_HEIGHT, z);
    }
  }
  return lines.data;
}

/** The marker posts of every ford on the battlefield, as one set of lines. */
export class FordView {
  readonly group = new Group();
  private readonly geometry: LineSegmentsGeometry | null = null;

  constructor(world: World, materials: MaterialLibrary) {
    if (world.fords.length === 0) return;
    const lines = new SegmentList();
    for (const ford of world.fords) lines.append(fordMarkerSegments(ford, world));
    this.geometry = new LineSegmentsGeometry().setPositions(lines.toFloat32());
    const markers = new LineSegments2(this.geometry, materials.edges.bridge);
    markers.name = 'ford-markers';
    this.group.add(markers);
  }

  dispose(): void {
    this.geometry?.dispose();
    this.group.removeFromParent();
  }
}
