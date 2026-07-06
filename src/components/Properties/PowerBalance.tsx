import React from 'react';
import { useProjectStore } from '../../store/projectStore';
import { CATEGORY_NORMS } from '../../engine/norms';
import { Activity, ShieldCheck } from 'lucide-react';

export const PowerBalance: React.FC = () => {
  const { cabinets, activeCabinetId, updateCabinetSimultaneityCoeff } = useProjectStore();
  const activeCabinet = cabinets.find((c) => c.id === activeCabinetId);

  if (!activeCabinet) return null;

  const loads = activeCabinet.components.filter((c) => c.type === 'load');

  // 1. Installed Power (W)
  const installedPowerW = loads.reduce((sum, load) => sum + (load.properties.powerW || 0), 0);
  const isThreePhaseLoad = (c: typeof loads[number]) =>
    (c.properties.poles === '3P' || c.properties.poles === '4P') && (c.properties.powerW || 0) > 0;
  const singlePhaseLoads = loads.filter((c) => !isThreePhaseLoad(c));
  const threePhaseLoads = loads.filter(isThreePhaseLoad);
  const singlePhasePowerW = singlePhaseLoads.reduce((sum, load) => sum + (load.properties.powerW || 0), 0);
  const threePhasePowerW = threePhaseLoads.reduce((sum, load) => sum + (load.properties.powerW || 0), 0);

  // 2. Simultaneity Coefficient (NFC 15-100 Table 52H / rules)
  // For general residential panels, the simultaneity coefficient decreases as the number of circuits increases:
  // 1-3 circuits: 1.0
  // 4-5 circuits: 0.9
  // 6-9 circuits: 0.8
  // 10+ circuits: 0.7
  let automaticSimultaneityCoeff = 1.0;
  const circuitCount = loads.length;
  if (circuitCount >= 10) {
    automaticSimultaneityCoeff = 0.6;
  } else if (circuitCount >= 6) {
    automaticSimultaneityCoeff = 0.7;
  } else if (circuitCount >= 4) {
    automaticSimultaneityCoeff = 0.8;
  } else if (circuitCount >= 2) {
    automaticSimultaneityCoeff = 0.9;
  }
  const simultaneityCoeff = activeCabinet.simultaneityCoeffOverride ?? automaticSimultaneityCoeff;
  const hasSimultaneityOverride = activeCabinet.simultaneityCoeffOverride !== undefined;

  const handleSimultaneityCoeffChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      updateCabinetSimultaneityCoeff(activeCabinet.id, undefined);
      return;
    }

    const nextCoeff = Number(value);
    if (!Number.isNaN(nextCoeff)) {
      updateCabinetSimultaneityCoeff(activeCabinet.id, Math.min(1, Math.max(0.1, nextCoeff)));
    }
  };

  // 3. Simultaneous Power (W)
  const simultaneousPowerW = installedPowerW * simultaneityCoeff;

  // 4. Power factor (average weighted by power)
  const totalPowerCosPhi = loads.reduce(
    (sum, load) => sum + ((load.properties.powerW || 0) * (load.properties.cosPhi || 0.8)),
    0
  );
  const avgCosPhi = installedPowerW > 0 ? totalPowerCosPhi / installedPowerW : 0.8;
  const singlePhaseAvgCosPhi = singlePhasePowerW > 0
    ? singlePhaseLoads.reduce(
      (sum, load) => sum + ((load.properties.powerW || 0) * (load.properties.cosPhi || 0.8)),
      0
    ) / singlePhasePowerW
    : 0.8;
  const threePhaseAvgCosPhi = threePhasePowerW > 0
    ? threePhaseLoads.reduce(
      (sum, load) => sum + ((load.properties.powerW || 0) * (load.properties.cosPhi || 0.8)),
      0
    ) / threePhasePowerW
    : 0.8;

  // 5. Phase Mode checking: only actual load receivers with real power determine the network type.
  // Protection devices (breakers, differentials, etc.) with 3P/4P poles do NOT count,
  // since a 4P breaker without a real load behind it is not a three-phase consumer.
  const hasSinglePhase = singlePhasePowerW > 0;
  const hasThreePhase = threePhasePowerW > 0;
  const hasMixedPhases = hasSinglePhase && hasThreePhase;

  // 6. Estimated Current (A)
  // Ib = P / (U * cosPhi) or P / (sqrt(3) * U * cosPhi)
  const u = hasThreePhase ? 400 : 230;
  const simultaneousSinglePhasePowerW = singlePhasePowerW * simultaneityCoeff;
  const simultaneousThreePhasePowerW = threePhasePowerW * simultaneityCoeff;
  const estimatedSinglePhaseCurrentA = singlePhasePowerW > 0
    ? simultaneousSinglePhasePowerW / (230 * singlePhaseAvgCosPhi)
    : 0;
  const estimatedThreePhaseCurrentA = threePhasePowerW > 0
    ? simultaneousThreePhasePowerW / (Math.sqrt(3) * 400 * threePhaseAvgCosPhi)
    : 0;
  let estimatedCurrentA = 0;
  if (installedPowerW > 0) {
    estimatedCurrentA = hasMixedPhases
      ? estimatedThreePhaseCurrentA + (estimatedSinglePhaseCurrentA / 3)
      : hasThreePhase
      ? simultaneousPowerW / (Math.sqrt(3) * u * avgCosPhi)
      : simultaneousPowerW / (u * avgCosPhi);
  }

  // 7. Suggested Subscription (kVA)
  // In France/Congo, standard Mono kVA subscriptions: 3 kVA (15A), 6 kVA (30A), 9 kVA (45A), 12 kVA (60A)
  // Standard Tri kVA: 9 kVA (15A/phase), 12 kVA (20A/phase), 18 kVA (30A/phase), 24 kVA (40A/phase), 30 kVA (50A/phase)
  let recommendedKVA = 3;
  let recommendedBreakerA = 15;

  if (hasThreePhase) {
    const currentPerPhase = estimatedCurrentA; // basic balance assumption
    if (currentPerPhase <= 15) {
      recommendedKVA = 9;
      recommendedBreakerA = 15;
    } else if (currentPerPhase <= 20) {
      recommendedKVA = 12;
      recommendedBreakerA = 20;
    } else if (currentPerPhase <= 30) {
      recommendedKVA = 18;
      recommendedBreakerA = 30;
    } else if (currentPerPhase <= 40) {
      recommendedKVA = 24;
      recommendedBreakerA = 40;
    } else {
      recommendedKVA = 30;
      recommendedBreakerA = 50;
    }
  } else {
    if (estimatedCurrentA <= 15) {
      recommendedKVA = 3;
      recommendedBreakerA = 15;
    } else if (estimatedCurrentA <= 30) {
      recommendedKVA = 6;
      recommendedBreakerA = 30;
    } else if (estimatedCurrentA <= 45) {
      recommendedKVA = 9;
      recommendedBreakerA = 45;
    } else {
      recommendedKVA = 12;
      recommendedBreakerA = 60;
    }
  }

  // Load counseling charge
  const capacityCurrent = recommendedBreakerA;
  const chargePercent = capacityCurrent > 0 ? (estimatedCurrentA / capacityCurrent) * 100 : 0;

  return (
    <div className="bg-brand-darkGray text-white border border-white/5 rounded-lg p-3 select-none">
      <div className="flex items-center space-x-1.5 border-b border-white/10 pb-2 mb-2">
        <Activity size={14} className="text-brand-blue" />
        <span className="text-xs font-bold uppercase tracking-wider">Bilan de Puissance Réseau</span>
      </div>

      <div className="space-y-2.5 text-xs">
        {/* Installed vs Simultaneous */}
        <div className="flex flex-wrap items-center justify-between gap-1">
          <span className="text-gray-400">Puissance Installée :</span>
          <span className="font-bold text-white">{(installedPowerW / 1000).toFixed(2)} kW</span>
        </div>

        {hasMixedPhases && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-gray-400">Puissance Mono (230V) :</span>
              <span className="font-bold text-white">{(singlePhasePowerW / 1000).toFixed(2)} kW</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-gray-400">Puissance Tri (400V) :</span>
              <span className="font-bold text-white">{(threePhasePowerW / 1000).toFixed(2)} kW</span>
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-1">
          <span className="text-gray-400">Coeff. Foisonnement :</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0.1}
              max={1}
              step={0.05}
              value={hasSimultaneityOverride ? activeCabinet.simultaneityCoeffOverride : ''}
              onChange={handleSimultaneityCoeffChange}
              placeholder={automaticSimultaneityCoeff.toFixed(2)}
              className="w-14 bg-black/30 border border-white/10 rounded px-1.5 py-0.5 text-right text-xs font-bold text-brand-orange focus:outline-none focus:border-brand-blue"
              title="Laisser vide pour utiliser le coefficient automatique"
            />
            <span className="text-[9px] text-gray-500">{hasSimultaneityOverride ? 'manuel' : 'auto'}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-1">
          <span className="text-gray-400">Puissance Simultanée :</span>
          <span className="font-bold text-white">{(simultaneousPowerW / 1000).toFixed(2)} kW</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-1">
          <span className="text-gray-400">Réseau d'alimentation :</span>
          <span className="font-bold text-brand-blue">
            {hasMixedPhases ? 'Mixte 230V Mono + 400V Tri' : hasThreePhase ? '400V Triphasé (3P+N)' : '230V Monophasé (1P+N)'}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-1">
          <span className="text-gray-400">Courant de Ligne estimé :</span>
          <span className="font-bold text-white">
            {estimatedCurrentA.toFixed(1)} A {hasThreePhase ? '/ phase' : ''}
          </span>
        </div>

        {hasMixedPhases && (
          <div className="text-[10px] text-gray-400 leading-snug">
            Mono: {estimatedSinglePhaseCurrentA.toFixed(1)} A total repartis sur phases | Tri: {estimatedThreePhaseCurrentA.toFixed(1)} A / phase
          </div>
        )}

        <div className="border-t border-white/5 pt-2.5 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-gray-400 uppercase font-semibold">
            <span>Abonnement Conseillé</span>
            <span>Intensité Disjoncteur</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-sm font-bold text-brand-orange">{recommendedKVA} kVA</span>
            <span className="text-sm font-bold text-brand-blue">{recommendedBreakerA} A</span>
          </div>
        </div>

        {/* Charge Progress bar */}
        <div className="space-y-1 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-1 text-[9px] text-gray-400">
            <span>Taux de Charge Estimé :</span>
            <span className={chargePercent > 80 ? 'text-brand-orange font-bold' : 'text-green-400'}>
              {chargePercent.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-black/60 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                chargePercent > 85
                  ? 'bg-brand-bordeaux'
                  : chargePercent > 65
                  ? 'bg-brand-orange'
                  : 'bg-brand-blue'
              }`}
              style={{ width: `${Math.min(chargePercent, 100)}%` }}
            />
          </div>
          {chargePercent > 90 && (
            <div className="text-[8px] text-brand-orange italic font-serif mt-0.5 leading-none">
              ⚠️ Risque élevé de déclenchement du disjoncteur général en cas de fonctionnement simultané.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
