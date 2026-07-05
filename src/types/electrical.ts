export type ComponentType =
  | 'general_protection'  // VISTOP, DPX, Parafoudre
  | 'differential'        // Interrupteur différentiel, Disjoncteur différentiel
  | 'breaker'             // Disjoncteur divisionnaire
  | 'distribution'        // Peigne, bornier
  | 'load';               // Récepteur (Prise, Eclairage, Clim, etc.)

export type ComponentPoles = '1P+N' | '2P' | '3P' | '4P';

export type BreakerCurve = 'B' | 'C' | 'D';

export type DiffType = 'AC' | 'A' | 'Hpi';

export type Sensitivity = '30mA' | '300mA' | '500mA';

export type CircuitUsage = 'terminal' | 'moteur' | 'depart_tableau';

export type LoadCategory =
  | 'lighting'
  | 'socket'
  | 'ac'
  | 'cooker'
  | 'oven'
  | 'water_heater'
  | 'washing_machine'
  | 'dishwasher'
  | 'fridge'
  | 'ev_charger'
  | 'pump'
  | 'other';

export interface ComponentProperties {
  name: string;
  category?: LoadCategory;
  circuitUsage?: CircuitUsage;
  powerW?: number;
  voltageV: 230 | 400;
  cosPhi: number;
  cableLengthM: number;
  cableSectionMm2: number;
  installationMode: 'A' | 'B' | 'C' | 'D' | 'E'; // NF C 15-100 pose modes
  ratingA: number; // calibre (In)
  curve?: BreakerCurve;
  sensitivity?: Sensitivity;
  diffType?: DiffType;
  poles: ComponentPoles;
  notes?: string;
}

export interface ElectricalComponent {
  id: string;
  type: ComponentType;
  widthModules: number; // module width (e.g. 1 mod = 17.5mm, Vistop = 2 mod)
  rowIndex: number; // DIN rail row (0-indexed)
  moduleIndex: number; // Module position from left (0-indexed)
  properties: ComponentProperties;
}

export interface Cabinet {
  id: string;
  name: string;
  rowsCount: number; // 1, 2, 3, 4, 6 rows
  modulesPerRow: number; // 13, 18 modules (default: 13)
  simultaneityCoeffOverride?: number;
  components: ElectricalComponent[];
}

export interface ProjectDetails {
  name: string;
  clientName: string;
  clientAddress: string;
  date: string;
  author: string;
}

export interface ElectricalViolation {
  id: string;
  componentId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  type: 'voltage_drop' | 'rating' | 'section' | 'selectivity' | 'differential_load';
  suggestedValue?: string;
}

export interface CalculationResult {
  ibA: number;           // Design current (courant d'emploi)
  izA: number;           // Allowed current in cable (courant admissible)
  voltageDropPercent: number; // Chute de tension (%)
  recommendedSection: number; // Section recommandée (mm2)
  isConforming: boolean;
  minIcc: number;        // Icc min
  maxIcc: number;        // Icc max
}
