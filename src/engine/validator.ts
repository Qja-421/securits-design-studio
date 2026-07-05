import { Cabinet, ElectricalViolation, ElectricalComponent } from '../types/electrical';
import { CATEGORY_NORMS, STANDARD_RATINGS } from './norms';
import { calculateComponentMetrics } from './calculator';

/**
 * Validates an entire Cabinet against standard NF C 15-100 rules
 */
export const validateCabinet = (cabinet: Cabinet): ElectricalViolation[] => {
  const violations: ElectricalViolation[] = [];
  const components = cabinet.components;

  // Group components by row for downstream analysis
  const rowsMap: Record<number, ElectricalComponent[]> = {};
  for (let r = 0; r < cabinet.rowsCount; r++) {
    rowsMap[r] = [];
  }
  
  components.forEach((c) => {
    if (rowsMap[c.rowIndex]) {
      rowsMap[c.rowIndex].push(c);
    }
  });

  // ----------------------------------------------------
  // Rule 1: Validate individual load circuits
  // ----------------------------------------------------
  const loads = components.filter((c) => c.type === 'load');
  
  loads.forEach((load) => {
    const metrics = calculateComponentMetrics(load);
    const props = load.properties;
    const norm = props.category ? CATEGORY_NORMS[props.category] : null;
    const circuitUsage = props.circuitUsage || 'terminal';

    // Check Ib vs In
    if (props.ratingA < metrics.ibA) {
      violations.push({
        id: `v_ib_in_${load.id}`,
        componentId: load.id,
        severity: 'error',
        message: `Le calibre du disjoncteur (${props.ratingA}A) est inférieur au courant d'emploi estimé (${metrics.ibA}A). Surcharge prévisible.`,
        type: 'rating',
        suggestedValue: `${STANDARD_RATINGS.find(r => r >= metrics.ibA) || 16}A`
      });
    }

    // Check In vs Iz
    if (metrics.izA < props.ratingA) {
      violations.push({
        id: `v_in_iz_${load.id}`,
        componentId: load.id,
        severity: 'error',
        message: `La capacité du câble (${metrics.izA}A en mode ${props.installationMode}) est insuffisante pour le calibre du disjoncteur (${props.ratingA}A). Risque d'incendie du câble en cas de surcharge prolongée.`,
        type: 'section',
        suggestedValue: props.cableSectionMm2 >= 6 ? 'Augmenter la section' : 'Utiliser une section de câble supérieure'
      });
    }

    // Check standard limits by load category
    if (norm) {
      // Check section minimum
      if (props.cableSectionMm2 < norm.minSectionMm2) {
        violations.push({
          id: `v_section_min_${load.id}`,
          componentId: load.id,
          severity: 'error',
          message: `Section de câble non conforme pour un circuit de type "${norm.labelFr}". Section minimale requise : ${norm.minSectionMm2} mm². Actuelle : ${props.cableSectionMm2} mm².`,
          type: 'section',
          suggestedValue: `${norm.minSectionMm2} mm²`
        });
      }

      // Check max rating
      if (circuitUsage === 'terminal' && props.ratingA > norm.maxBreakerRatingA) {
        violations.push({
          id: `v_rating_max_${load.id}`,
          componentId: load.id,
          severity: 'warning',
          message: `Le calibre du disjoncteur (${props.ratingA}A) dépasse la limite conseillée par la NF C 15-100 pour ce type de circuit (${norm.maxBreakerRatingA}A).`,
          type: 'rating',
          suggestedValue: `${norm.maxBreakerRatingA}A`
        });
      }
    }

    // Check Voltage drop (Lighting 3%, others 5%)
    const limit = props.category === 'lighting' ? 3 : 5;
    if (metrics.voltageDropPercent > limit) {
      violations.push({
        id: `v_voltage_drop_${load.id}`,
        componentId: load.id,
        severity: 'error',
        message: `Chute de tension excessive : ${metrics.voltageDropPercent.toFixed(1)}% (limite autorisée : ${limit}%). Risque de dysfonctionnement des récepteurs.`,
        type: 'voltage_drop',
        suggestedValue: 'Augmenter la section du conducteur'
      });
    }
  });

  // ----------------------------------------------------
  // Rule 2: Validate differential protections (Règle de l'aval + type checking)
  // ----------------------------------------------------
  Object.keys(rowsMap).forEach((rowKey) => {
    const rowIndex = Number(rowKey);
    const rowComponents = rowsMap[rowIndex];
    
    // Find differentials on this row
    const diffsOnRow = rowComponents.filter((c) => c.type === 'differential');
    const loadsOnRow = rowComponents.filter((c) => c.type === 'load');

    if (diffsOnRow.length === 0 && loadsOnRow.length > 0) {
      // Sockets/lights on a row without a differential (error in residential)
      violations.push({
        id: `v_no_diff_row_${rowIndex}`,
        componentId: loadsOnRow[0].id, // flag first load
        severity: 'error',
        message: `La rangée ${rowIndex + 1} contient des circuits de protection sans interrupteur différentiel en tête de rangée. Obligatoire par la NF C 15-100.`,
        type: 'differential_load'
      });
      return;
    }

    diffsOnRow.forEach((diff) => {
      const diffRating = diff.properties.ratingA;
      const diffType = diff.properties.diffType || 'AC';

      // Règle de l'aval calculation:
      // NFC 15-100 § 10.1.1.2: Sum of ratings of downstream circuit breakers
      // weighted: 1.0 for heating, water heater, EV charger, 0.5 for others.
      // Total sum must be <= rating of differential (In)
      let weightedSum = 0;
      let hasPriorityLoad = false;
      let priorityLoadName = '';

      loadsOnRow.forEach((load) => {
        const cat = load.properties.category || 'other';
        const rating = load.properties.ratingA;
        const norm = CATEGORY_NORMS[cat];

        // Sizing factors
        const isThermal = cat === 'water_heater' || cat === 'ac' || cat === 'ev_charger' || cat === 'oven';
        const coeff = isThermal ? 1.0 : 0.5;
        weightedSum += rating * coeff;

        // Check if load requires a Type A/Hpi differential
        if (norm && norm.isPriorityDifferential) {
          hasPriorityLoad = true;
          priorityLoadName = norm.labelFr;
        }
      });

      // Verify "Règle de l'aval"
      if (weightedSum > diffRating) {
        violations.push({
          id: `v_diff_overload_${diff.id}`,
          componentId: diff.id,
          severity: 'warning',
          message: `Surcharge potentielle de l'interrupteur différentiel (Règle de l'aval). Somme pondérée des circuits aval : ${weightedSum}A, pour un calibre de ${diffRating}A.`,
          type: 'differential_load',
          suggestedValue: '63A' // Suggest standard 63A differential
        });
      }

      // Verify Differential Type
      if (hasPriorityLoad && diffType === 'AC') {
        violations.push({
          id: `v_diff_type_mismatch_${diff.id}`,
          componentId: diff.id,
          severity: 'error',
          message: `L'interrupteur différentiel est de type AC alors que la rangée protège des circuits à courant continu (ex : ${priorityLoadName}) qui exigent un différentiel de Type A ou Hpi.`,
          type: 'differential_load',
          suggestedValue: 'Type A'
        });
      }
    });
  });

  return violations;
};
