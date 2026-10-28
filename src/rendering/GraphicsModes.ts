/**
 * Visual presets. All three share the same simulation and scene graph; a mode
 * only changes colours, material styles, lighting and post-processing.
 */
import type { TankKind } from '../config/settings';
import type { GraphicsModeId } from '../config/userSettings';

export interface ColourPair {
  readonly edge: number;
  readonly solid: number;
}

export interface GraphicsModeSpec {
  readonly id: GraphicsModeId;
  readonly label: string;
  readonly description: string;
  readonly skyZenith: number;
  readonly skyHorizon: number;
  readonly horizonGlow: number;
  readonly fogColor: number;
  readonly fogDensity: number;
  readonly tanks: Readonly<Record<TankKind, ColourPair>>;
  readonly rock: ColourPair;
  readonly structure: ColourPair;
  readonly mountains: ColourPair;
  readonly terrain: {
    readonly low: number;
    readonly high: number;
    readonly grid: number;
    readonly gridIntensity: number;
    readonly gridSpacing: number;
    readonly contour: number;
    readonly contourIntensity: number;
    readonly contourSpacing: number;
  };
  readonly boundary: number;
  readonly playerShell: number;
  readonly enemyShell: number;
  /** Explosion colours from hottest to coolest. */
  readonly explosion: readonly number[];
  readonly smoke: number;
  readonly wreckEdge: number;
  /** 'black' = pure occluders, 'dark' = near-black glossy panels, 'shaded' = lit coloured materials. */
  readonly solidStyle: 'black' | 'dark' | 'shaded';
  readonly roughness: number;
  readonly metalness: number;
  readonly envIntensity: number;
  /** Edge line width in CSS pixels. */
  readonly edgeWidth: number;
  readonly panelDetail: boolean;
  readonly bloom: { readonly strength: number; readonly radius: number; readonly threshold: number };
  readonly shadows: boolean;
  readonly hemiSky: number;
  readonly hemiGround: number;
  readonly hemiIntensity: number;
  readonly sunColor: number;
  readonly sunIntensity: number;
  readonly stars: boolean;
  /** Supports CRT scanlines, flicker and phosphor persistence. */
  readonly crt: boolean;
  readonly dust: boolean;
  readonly hudTheme: 'classic' | 'neon';
}

const CLASSIC_GREEN = 0x39ff6a;

export const GRAPHICS_MODE_SPECS: Readonly<Record<GraphicsModeId, GraphicsModeSpec>> = {
  classic: {
    id: 'classic',
    label: 'Classic Vector',
    description: 'Green phosphor wireframes on black, in the spirit of 1980 arcade vector displays.',
    skyZenith: 0x000000,
    skyHorizon: 0x000000,
    horizonGlow: 0x021a08,
    fogColor: 0x000000,
    fogDensity: 0.0009,
    tanks: {
      player: { edge: 0x7dffa0, solid: 0x000000 },
      standard: { edge: CLASSIC_GREEN, solid: 0x000000 },
      heavy: { edge: 0x2fe05c, solid: 0x000000 },
      scout: { edge: 0x9dffb8, solid: 0x000000 },
    },
    rock: { edge: 0x1fa848, solid: 0x000000 },
    structure: { edge: CLASSIC_GREEN, solid: 0x000000 },
    mountains: { edge: 0x2bd957, solid: 0x000000 },
    terrain: {
      low: 0x000000,
      high: 0x000000,
      grid: 0x0d6b2a,
      gridIntensity: 0.32,
      gridSpacing: 40,
      contour: 0x0d6b2a,
      contourIntensity: 0,
      contourSpacing: 5,
    },
    boundary: 0x1fa848,
    playerShell: 0xc8ffd6,
    enemyShell: 0x7dffa0,
    explosion: [0xe8fff0, 0x9dffb8, 0x39ff6a, 0x168a38],
    smoke: 0x0a2a12,
    wreckEdge: 0x0f5a24,
    solidStyle: 'black',
    roughness: 1,
    metalness: 0,
    envIntensity: 0,
    edgeWidth: 1.7,
    panelDetail: false,
    bloom: { strength: 0.85, radius: 0.28, threshold: 0.06 },
    shadows: false,
    hemiSky: 0x000000,
    hemiGround: 0x000000,
    hemiIntensity: 0,
    sunColor: 0x000000,
    sunIntensity: 0,
    stars: false,
    crt: true,
    dust: false,
    hudTheme: 'classic',
  },
  neon: {
    id: 'neon',
    label: 'Modern Neon Vector',
    description: 'Hidden-line vector graphics: dark solid armour with sharp glowing colour outlines.',
    skyZenith: 0x010208,
    skyHorizon: 0x0a1030,
    horizonGlow: 0x3a1c6e,
    fogColor: 0x050816,
    fogDensity: 0.0017,
    tanks: {
      player: { edge: 0x22e6ff, solid: 0x0a161c },
      standard: { edge: 0xff3344, solid: 0x18080b },
      heavy: { edge: 0xff8a1f, solid: 0x1a0e06 },
      scout: { edge: 0xff2fd6, solid: 0x170619 },
    },
    rock: { edge: 0x179c8a, solid: 0x05090c },
    structure: { edge: 0x8a7dff, solid: 0x07081a },
    mountains: { edge: 0x2a4dff, solid: 0x02040e },
    terrain: {
      low: 0x03080b,
      high: 0x071419,
      grid: 0x0fc2a5,
      gridIntensity: 0.55,
      gridSpacing: 20,
      contour: 0x177f8f,
      contourIntensity: 0.32,
      contourSpacing: 4,
    },
    boundary: 0xff3344,
    playerShell: 0xffd23f,
    enemyShell: 0xffb020,
    explosion: [0xffffff, 0xfff1a0, 0xffd23f, 0xff8a1f, 0xff4400],
    smoke: 0x1a1d2c,
    wreckEdge: 0x6a1e12,
    solidStyle: 'dark',
    roughness: 0.38,
    metalness: 0.7,
    envIntensity: 0.6,
    edgeWidth: 1.8,
    panelDetail: true,
    bloom: { strength: 0.55, radius: 0.22, threshold: 0.18 },
    shadows: false,
    hemiSky: 0x2a3a70,
    hemiGround: 0x05060a,
    hemiIntensity: 0.6,
    sunColor: 0x8fa8ff,
    sunIntensity: 0.7,
    stars: true,
    crt: false,
    dust: true,
    hudTheme: 'neon',
  },
  hybrid: {
    id: 'hybrid',
    label: 'Hybrid 3D',
    description: 'Shaded 3D armour, realistic shadows and coloured edge highlights.',
    skyZenith: 0x03050d,
    skyHorizon: 0x1a2240,
    horizonGlow: 0x4a2a5e,
    fogColor: 0x0d1222,
    fogDensity: 0.0013,
    tanks: {
      player: { edge: 0x5ff3ff, solid: 0x3f97a8 },
      standard: { edge: 0xff5866, solid: 0xa0353e },
      heavy: { edge: 0xffa04a, solid: 0xa8622a },
      scout: { edge: 0xff6ae6, solid: 0x93378d },
    },
    rock: { edge: 0x3fb8a8, solid: 0x5d666c },
    structure: { edge: 0xa99dff, solid: 0x4c5070 },
    mountains: { edge: 0x4a6dff, solid: 0x111833 },
    terrain: {
      low: 0x24352f,
      high: 0x55665a,
      grid: 0x2fd6b8,
      gridIntensity: 0.16,
      gridSpacing: 20,
      contour: 0x2fd6b8,
      contourIntensity: 0.08,
      contourSpacing: 5,
    },
    boundary: 0xff5866,
    playerShell: 0xffd23f,
    enemyShell: 0xffb020,
    explosion: [0xffffff, 0xfff1a0, 0xffd23f, 0xff8a1f, 0xff4400],
    smoke: 0x2a2a30,
    wreckEdge: 0x5a2a1a,
    solidStyle: 'shaded',
    roughness: 0.62,
    metalness: 0.15,
    envIntensity: 0.5,
    edgeWidth: 1.25,
    panelDetail: true,
    bloom: { strength: 0.35, radius: 0.22, threshold: 0.3 },
    shadows: true,
    hemiSky: 0x7f93c8,
    hemiGround: 0x1a1612,
    hemiIntensity: 1.6,
    sunColor: 0xffe2c2,
    sunIntensity: 3.2,
    stars: true,
    crt: false,
    dust: true,
    hudTheme: 'neon',
  },
};
