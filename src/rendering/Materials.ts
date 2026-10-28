/**
 * Shared materials. Hidden-line removal works by drawing opaque, depth-writing
 * solids pushed slightly back with polygon offset, then drawing crease edges
 * with normal depth testing: edges on visible faces pass, while edges behind
 * any solid (the tank itself, other tanks, terrain, buildings) are occluded.
 */
import { Color, MeshStandardMaterial } from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { TankKind } from '../config/settings';
import type { GraphicsModeSpec } from './GraphicsModes';

export type SolidRole = TankKind | 'rock' | 'structure' | 'mountain' | 'wreck';
export type EdgeRole = 'rock' | 'structure' | 'mountain' | 'boundary';

const SOLID_ROLES: readonly SolidRole[] = ['player', 'standard', 'heavy', 'scout', 'rock', 'structure', 'mountain', 'wreck'];
const EDGE_ROLES: readonly EdgeRole[] = ['rock', 'structure', 'mountain', 'boundary'];

function createSolid(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: 0x000000,
    roughness: 1,
    metalness: 0,
    flatShading: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
}

function createEdge(width: number): LineMaterial {
  return new LineMaterial({ color: 0xffffff, linewidth: width, worldUnits: false, fog: true, transparent: false });
}

export interface MaterialOptions {
  /** Classic-mode nostalgia: hide occluding solids so every edge shows through. */
  readonly seeThrough: boolean;
}

export class MaterialLibrary {
  readonly solids: Record<SolidRole, MeshStandardMaterial>;
  readonly edges: Record<EdgeRole, LineMaterial>;
  private readonly lineMaterials = new Set<LineMaterial>();
  private readonly width = { w: 1, h: 1 };
  private spec: GraphicsModeSpec | null = null;
  private seeThrough = false;

  constructor() {
    this.solids = Object.fromEntries(SOLID_ROLES.map((r) => [r, createSolid()])) as Record<SolidRole, MeshStandardMaterial>;
    this.edges = Object.fromEntries(EDGE_ROLES.map((r) => [r, this.register(createEdge(1.5))])) as Record<EdgeRole, LineMaterial>;
  }

  get mode(): GraphicsModeSpec | null {
    return this.spec;
  }

  /** Tracks a line material so resolution changes reach it. */
  register(material: LineMaterial): LineMaterial {
    material.resolution.set(this.width.w, this.width.h);
    this.lineMaterials.add(material);
    return material;
  }

  release(material: LineMaterial): void {
    this.lineMaterials.delete(material);
    material.dispose();
  }

  /** Creates a per-instance edge material (tanks recolour theirs for damage). */
  createEdgeMaterial(colour: number, width: number): LineMaterial {
    const m = this.register(createEdge(width));
    m.color.setHex(colour);
    return m;
  }

  setResolution(width: number, height: number): void {
    this.width.w = width;
    this.width.h = height;
    for (const m of this.lineMaterials) m.resolution.set(width, height);
  }

  applyMode(spec: GraphicsModeSpec, options: MaterialOptions): void {
    this.spec = spec;
    this.seeThrough = options.seeThrough && spec.id === 'classic';
    const colours: Record<SolidRole, number> = {
      player: spec.tanks.player.solid,
      standard: spec.tanks.standard.solid,
      heavy: spec.tanks.heavy.solid,
      scout: spec.tanks.scout.solid,
      rock: spec.rock.solid,
      structure: spec.structure.solid,
      mountain: spec.mountains.solid,
      wreck: spec.solidStyle === 'shaded' ? 0x1c1a1a : 0x050404,
    };
    for (const role of SOLID_ROLES) {
      const m = this.solids[role];
      m.color.setHex(spec.solidStyle === 'black' ? 0x000000 : colours[role]);
      m.roughness = spec.roughness;
      m.metalness = spec.metalness;
      m.envMapIntensity = spec.envIntensity;
      m.emissive.setHex(0x000000);
      // See-through mode removes the occluders entirely so every edge shows.
      m.visible = !this.seeThrough;
      m.needsUpdate = true;
    }
    this.edges.rock.color.setHex(spec.rock.edge);
    this.edges.structure.color.setHex(spec.structure.edge);
    this.edges.mountain.color.setHex(spec.mountains.edge);
    this.edges.boundary.color.setHex(spec.boundary);
    for (const role of EDGE_ROLES) this.edges[role].linewidth = spec.edgeWidth * (role === 'mountain' ? 1.15 : 1);
    this.edges.boundary.linewidth = spec.edgeWidth * 1.3;
  }

  solidFor(role: SolidRole): MeshStandardMaterial {
    return this.solids[role];
  }

  /** Base edge colour for a tank kind in the current mode. */
  tankEdgeColour(kind: TankKind, out: Color): Color {
    return out.setHex(this.spec ? this.spec.tanks[kind].edge : 0xffffff);
  }

  dispose(): void {
    for (const m of Object.values(this.solids)) m.dispose();
    for (const m of this.lineMaterials) m.dispose();
    this.lineMaterials.clear();
  }
}
