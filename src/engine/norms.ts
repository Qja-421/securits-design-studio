import { LoadCategory, ComponentPoles } from '../types/electrical';

// NF C 15-100 Copper wire resistivity (rho) in Ohm.mm2/m
// 0.0225 for standard operations, 0.028 for high-temperature/fault checks
export const RHO_COPPER = 0.0225;

// Iz limit values for Copper conductors based on section and installation mode
// Table 52C / 52E of NF C 15-100 (Single-phase / 2 loaded conductors)
export const IZ_TABLE = {
  // Mode A: Insulated in conduit inside insulated wall
  A: {
    1.5: 14.5,
    2.5: 19.5,
    4: 26,
    6: 34,
    10: 46,
    16: 61,
    25: 80,
    35: 99
  },
  // Mode B: Insulated in conduit on wall or in floor
  B: {
    1.5: 16.5,
    2.5: 22,
    4: 30,
    6: 38,
    10: 52,
    16: 69,
    25: 90,
    35: 111
  },
  // Mode C: Surface mounted conduit/molding, cable in free air (Standard/Default)
  C: {
    1.5: 17.5,
    2.5: 24,
    4: 32,
    6: 41,
    10: 57,
    16: 76,
    25: 101,
    35: 125
  },
  // Mode D: In underground conduit/ducts
  D: {
    1.5: 22,
    2.5: 29,
    4: 38,
    6: 47,
    10: 63,
    16: 81,
    25: 104,
    35: 125
  },
  // Mode E: Cables on ladder/tray
  E: {
    1.5: 18.5,
    2.5: 25,
    4: 34,
    6: 43,
    10: 60,
    16: 80,
    25: 106,
    35: 131
  }
};

// Sizing rules by Load Category
export interface CategoryNorm {
  minSectionMm2: number;
  maxBreakerRatingA: number;
  defaultRatingA: number;
  diversityFactor: number; // For power balance
  isPriorityDifferential: boolean; // True if requires Type A/Hpi (washing machine, cooker, EV charger)
  labelFr: string;
}

export const CATEGORY_NORMS: Record<LoadCategory, CategoryNorm> = {
  lighting: {
    minSectionMm2: 1.5,
    maxBreakerRatingA: 16,
    defaultRatingA: 10,
    diversityFactor: 0.9,
    isPriorityDifferential: false,
    labelFr: 'Éclairage'
  },
  socket: {
    minSectionMm2: 2.5,
    maxBreakerRatingA: 20,
    defaultRatingA: 16,
    diversityFactor: 0.2,
    isPriorityDifferential: false,
    labelFr: 'Prises de Courant'
  },
  ac: {
    minSectionMm2: 2.5,
    maxBreakerRatingA: 20,
    defaultRatingA: 16,
    diversityFactor: 1.0,
    isPriorityDifferential: false,
    labelFr: 'Climatisation'
  },
  cooker: {
    minSectionMm2: 6.0,
    maxBreakerRatingA: 32,
    defaultRatingA: 32,
    diversityFactor: 0.7,
    isPriorityDifferential: true, // Requires Type A
    labelFr: 'Plaque de Cuisson'
  },
  oven: {
    minSectionMm2: 2.5,
    maxBreakerRatingA: 20,
    defaultRatingA: 16,
    diversityFactor: 0.7,
    isPriorityDifferential: false,
    labelFr: 'Four'
  },
  water_heater: {
    minSectionMm2: 2.5,
    maxBreakerRatingA: 20,
    defaultRatingA: 20,
    diversityFactor: 1.0,
    isPriorityDifferential: false,
    labelFr: 'Chauffe-eau'
  },
  washing_machine: {
    minSectionMm2: 2.5,
    maxBreakerRatingA: 20,
    defaultRatingA: 20,
    diversityFactor: 1.0,
    isPriorityDifferential: true, // Requires Type A
    labelFr: 'Lave-linge'
  },
  dishwasher: {
    minSectionMm2: 2.5,
    maxBreakerRatingA: 20,
    defaultRatingA: 16,
    diversityFactor: 1.0,
    isPriorityDifferential: false,
    labelFr: 'Lave-vaisselle'
  },
  fridge: {
    minSectionMm2: 2.5,
    maxBreakerRatingA: 20,
    defaultRatingA: 16,
    diversityFactor: 1.0,
    isPriorityDifferential: true, // Highly recommended Type Hpi
    labelFr: 'Réfrigérateur/Congélateur'
  },
  ev_charger: {
    minSectionMm2: 10.0,
    maxBreakerRatingA: 32,
    defaultRatingA: 32,
    diversityFactor: 1.0,
    isPriorityDifferential: true, // Requires Type A / Hpi
    labelFr: 'Borne de Recharge VE'
  },
  pump: {
    minSectionMm2: 2.5,
    maxBreakerRatingA: 20,
    defaultRatingA: 16,
    diversityFactor: 1.0,
    isPriorityDifferential: false,
    labelFr: 'Pompe de piscine/forage'
  },
  other: {
    minSectionMm2: 2.5,
    maxBreakerRatingA: 20,
    defaultRatingA: 16,
    diversityFactor: 0.8,
    isPriorityDifferential: false,
    labelFr: 'Autre Circuit'
  }
};

// Standard ratings for selection
export const STANDARD_RATINGS = [6, 10, 16, 20, 25, 32, 40, 63, 80, 100, 125];

// Standard wire sections
export const STANDARD_SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35];

// Extended options for downstream panel feeders
export const DEPART_TABLEAU_RATINGS = [32, 40, 50, 63, 80, 100, 125, 160, 200, 250];
export const DEPART_TABLEAU_SECTIONS = [10, 16, 25, 35, 50, 70, 95];

export const POLE_OPTIONS: ComponentPoles[] = ['1P+N', '2P', '3P', '4P'];
