import { ElectricalComponent, CalculationResult } from '../types/electrical';
import { RHO_COPPER, IZ_TABLE, CATEGORY_NORMS } from './norms';

/**
 * Calculates design current (Ib) in Amperes.
 * Ib = P / (U * cosPhi) for single-phase
 * Ib = P / (sqrt(3) * U * cosPhi) for three-phase
 */
export const calculateIb = (powerW: number, voltageV: number, cosPhi: number, isTriphasic: boolean): number => {
  if (powerW <= 0) return 0;
  
  if (isTriphasic) {
    // For triphasic, U is line-to-line voltage (400V)
    return powerW / (Math.sqrt(3) * voltageV * cosPhi);
  } else {
    // For monophasic, U is phase-to-neutral voltage (230V)
    return powerW / (voltageV * cosPhi);
  }
};

/**
 * Retrieves the allowed current capacity (Iz) from the standard NF C 15-100 tables
 */
export const getIz = (mode: 'A' | 'B' | 'C' | 'D' | 'E', section: number): number => {
  const modeTable = IZ_TABLE[mode] || IZ_TABLE['C'];
  // Find nearest lower section if exact section not in keys
  const sections = Object.keys(modeTable).map(Number).sort((a, b) => a - b);
  const match = sections.find((s) => s === section) || sections[0];
  return (modeTable as any)[match] || 16;
};

/**
 * Calculates voltage drop (Delta U) in percentage
 * Delta U (V) = k * rho * L * Ib / S
 * k = 2 for single-phase, k = sqrt(3) for three-phase
 */
export const calculateVoltageDropPercent = (
  ib: number,
  lengthM: number,
  sectionMm2: number,
  voltageV: number,
  isTriphasic: boolean
): number => {
  if (sectionMm2 <= 0 || ib <= 0) return 0;
  
  const k = isTriphasic ? Math.sqrt(3) : 2;
  const deltaU_Volts = (k * RHO_COPPER * lengthM * ib) / sectionMm2;
  return (deltaU_Volts / voltageV) * 100;
};

/**
 * Estimates minimum and maximum short circuit currents (Icc) in Amperes
 */
export const calculateIcc = (
  lengthM: number,
  sectionMm2: number,
  isTriphasic: boolean
): { minIcc: number; maxIcc: number } => {
  // Approximate transformer / grid source impedance for residential (e.g., 0.05 Ohms)
  const sourceImpedance = 0.035; 
  
  if (lengthM <= 0.5 || sectionMm2 <= 0) {
    return { minIcc: 6000, maxIcc: 6000 };
  }

  const k = isTriphasic ? Math.sqrt(3) : 2;
  const cableResistance = (k * RHO_COPPER * lengthM) / sectionMm2;
  
  // Phase-to-neutral voltage is 230V
  const u0 = 230; 
  
  // Max Icc is close to transformer (less cable resistance)
  const maxIcc = u0 / (sourceImpedance + (0.5 * cableResistance));
  // Min Icc (at the end of cable, under low voltage 0.8 coefficient)
  const minIcc = (0.8 * u0) / cableResistance;

  return {
    minIcc: Math.round(minIcc),
    maxIcc: Math.round(maxIcc)
  };
};

/**
 * Performs full calculations for a single circuit load component
 */
export const calculateComponentMetrics = (component: ElectricalComponent): CalculationResult => {
  const { properties, type } = component;
  
  if (type !== 'load') {
    return {
      ibA: 0,
      izA: 0,
      voltageDropPercent: 0,
      recommendedSection: 1.5,
      isConforming: true,
      minIcc: 0,
      maxIcc: 0
    };
  }

  const isTriphasic = properties.poles === '3P' || properties.poles === '4P';
  const ibA = calculateIb(properties.powerW || 0, properties.voltageV, properties.cosPhi, isTriphasic);
  const izA = getIz(properties.installationMode, properties.cableSectionMm2);
  const voltageDropPercent = calculateVoltageDropPercent(
    ibA,
    properties.cableLengthM,
    properties.cableSectionMm2,
    properties.voltageV,
    isTriphasic
  );

  const { minIcc, maxIcc } = calculateIcc(
    properties.cableLengthM,
    properties.cableSectionMm2,
    isTriphasic
  );

  // Suggest section
  let recommendedSection = 1.5;
  if (properties.category && CATEGORY_NORMS[properties.category]) {
    recommendedSection = CATEGORY_NORMS[properties.category].minSectionMm2;
  }

  // Double check Iz condition: In (breaker rating) must be >= Ib, and Iz (carrying capacity) must be >= In
  const isConforming = properties.ratingA >= ibA && izA >= properties.ratingA && voltageDropPercent <= 5;

  return {
    ibA: parseFloat(ibA.toFixed(2)),
    izA,
    voltageDropPercent: parseFloat(voltageDropPercent.toFixed(2)),
    recommendedSection,
    isConforming,
    minIcc,
    maxIcc
  };
};
