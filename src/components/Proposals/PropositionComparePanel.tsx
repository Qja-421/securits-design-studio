import React from 'react';
import { useProjectStore } from '../../store/projectStore';
import { Cabinet } from '../../types/electrical';
import { validateCabinet } from '../../engine/validator';
import { CheckCircle, AlertTriangle, Zap, Package, Shield, Star, ChevronRight } from 'lucide-react';

// ─────────────────────────────────────────────────────
// Compute per-proposition summary stats
// ─────────────────────────────────────────────────────
const summariseCabinets = (cabs: Cabinet[]) => {
  let totalComponents = 0;
  let totalModulesUsed = 0;
  let totalModules = 0;
  let installedPowerW = 0;
  let violations = 0;

  cabs.forEach((cab) => {
    totalComponents += cab.components.length;
    totalModulesUsed += cab.components.reduce((s, c) => s + (c.widthModules || 1), 0);
    totalModules += cab.rowsCount * cab.modulesPerRow;
    const loads = cab.components.filter((c) => c.type === 'load');
    installedPowerW += loads.reduce((s, l) => s + (l.properties.powerW || 0), 0);
    violations += validateCabinet(cab).length;
  });

  const fillRate = totalModules > 0 ? Math.round((totalModulesUsed / totalModules) * 100) : 0;
  const hasThreePhase = cabs.some((cab) =>
    cab.components.some(
      (c) => (c.properties.poles === '3P' || c.properties.poles === '4P') && (c.properties.powerW || 0) > 0
    )
  );

  return {
    totalComponents,
    totalModulesUsed,
    totalModules,
    fillRate,
    installedKW: (installedPowerW / 1000).toFixed(1),
    violations,
    networkType: hasThreePhase ? '400V Triphasé' : '230V Monophasé',
    isEmpty: totalComponents === 0,
  };
};

interface PropCardProps {
  propKey: 'prop1' | 'prop2' | 'prop3';
  cabinets: Cabinet[];
  isActive: boolean;
  onActivate: () => void;
  onExportPDF?: () => void;
}

const PROP_CONFIG = {
  prop1: {
    label: 'Proposition 1',
    badge: 'Standard',
    badgeColor: 'bg-gray-600',
    gradient: 'from-gray-800/60 to-gray-900/60',
    borderColor: 'border-gray-500/40',
    activeBorder: 'border-brand-blue',
    accentColor: 'text-gray-300',
    starCount: 1,
    description: 'Solution économique, répondant aux exigences réglementaires minimales de la NF C 15-100.',
  },
  prop2: {
    label: 'Proposition 2',
    badge: 'Intermédiaire',
    badgeColor: 'bg-brand-blue/80',
    gradient: 'from-blue-950/60 to-gray-900/60',
    borderColor: 'border-brand-blue/30',
    activeBorder: 'border-brand-blue',
    accentColor: 'text-brand-blue',
    starCount: 2,
    description: 'Bon compromis qualité/prix. Marques reconnues, câblage optimisé, évolutivité assurée.',
  },
  prop3: {
    label: 'Proposition 3',
    badge: 'Premium',
    badgeColor: 'bg-brand-orange/80',
    gradient: 'from-orange-950/50 to-gray-900/60',
    borderColor: 'border-brand-orange/30',
    activeBorder: 'border-brand-orange',
    accentColor: 'text-brand-orange',
    starCount: 3,
    description: 'Haut de gamme : équipements Legrand Céliane Pro ou équivalent, câblage avec repérage complet.',
  },
};

const PropCard: React.FC<PropCardProps> = ({ propKey, cabinets, isActive, onActivate }) => {
  const cfg = PROP_CONFIG[propKey];
  const stats = summariseCabinets(cabinets);

  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 transition-all duration-300 overflow-hidden cursor-pointer group ${
        isActive
          ? `${cfg.activeBorder} shadow-2xl shadow-brand-blue/20 scale-[1.02]`
          : `${cfg.borderColor} hover:border-white/30 hover:scale-[1.01]`
      } bg-gradient-to-b ${cfg.gradient}`}
      onClick={onActivate}
    >
      {/* Active badge */}
      {isActive && (
        <div className="absolute top-3 right-3 bg-brand-blue text-white text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wider uppercase">
          ✓ ACTIVE
        </div>
      )}

      {/* Card header */}
      <div className="p-5 pb-3 border-b border-white/10">
        <div className="flex items-start gap-3 mb-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${cfg.badgeColor} uppercase tracking-wider`}>
            {cfg.badge}
          </span>
          <div className="flex gap-0.5 ml-auto mt-0.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Star
                key={i}
                size={12}
                className={i < cfg.starCount ? 'text-brand-orange fill-brand-orange' : 'text-gray-600'}
              />
            ))}
          </div>
        </div>
        <h3 className={`text-lg font-bold ${cfg.accentColor} mb-1`}>{cfg.label}</h3>
        <p className="text-[11px] text-gray-400 leading-relaxed">{cfg.description}</p>
      </div>

      {/* Stats grid */}
      {stats.isEmpty ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <p className="text-gray-500 text-sm font-semibold mb-1">Proposition vide</p>
            <p className="text-gray-600 text-xs">Basculez vers cette proposition et ajoutez des composants, ou utilisez "Dupliquer" depuis une autre proposition.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 p-5">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-black/30 rounded-xl p-3 flex flex-col items-center">
              <Zap size={16} className="text-brand-orange mb-1" />
              <span className="text-base font-bold text-white">{stats.installedKW} kW</span>
              <span className="text-[9px] text-gray-500 text-center">Puissance installée</span>
            </div>
            <div className="bg-black/30 rounded-xl p-3 flex flex-col items-center">
              <Package size={16} className="text-brand-blue mb-1" />
              <span className="text-base font-bold text-white">{stats.totalComponents}</span>
              <span className="text-[9px] text-gray-500 text-center">Composants</span>
            </div>
            <div className="bg-black/30 rounded-xl p-3 flex flex-col items-center">
              <Shield size={16} className={stats.violations === 0 ? 'text-green-400 mb-1' : 'text-red-400 mb-1'} />
              <span className={`text-base font-bold ${stats.violations === 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.violations === 0 ? '✓ OK' : stats.violations}
              </span>
              <span className="text-[9px] text-gray-500 text-center">
                {stats.violations === 0 ? 'Conforme NFC' : 'Non-conformité(s)'}
              </span>
            </div>
            <div className="bg-black/30 rounded-xl p-3 flex flex-col items-center">
              <span className="text-[9px] font-bold text-gray-400 mb-1">RÉSEAU</span>
              <span className="text-[11px] font-bold text-white text-center">{stats.networkType}</span>
              <span className="text-[9px] text-gray-500 text-center">{stats.fillRate}% occupé</span>
            </div>
          </div>

          {/* Compliance status */}
          <div className={`rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-semibold ${
            stats.violations === 0
              ? 'bg-green-950/60 border border-green-800/50 text-green-300'
              : 'bg-red-950/60 border border-red-800/50 text-red-300'
          }`}>
            {stats.violations === 0
              ? <><CheckCircle size={14} /> Conforme NF C 15-100</>
              : <><AlertTriangle size={14} /> {stats.violations} anomalie(s) à corriger</>
            }
          </div>

          {/* Cabinet list */}
          {cabinets.length > 1 && (
            <div className="mt-3">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1 font-semibold">Coffrets ({cabinets.length})</p>
              <div className="space-y-1">
                {cabinets.slice(0, 3).map((cab) => (
                  <div key={cab.id} className="flex items-center gap-2 text-[10px] text-gray-400">
                    <ChevronRight size={10} className="text-gray-600" />
                    <span className="truncate">{cab.name}</span>
                    <span className="ml-auto text-gray-600">{cab.rowsCount}R × {cab.modulesPerRow}M</span>
                  </div>
                ))}
                {cabinets.length > 3 && (
                  <p className="text-[9px] text-gray-600">+ {cabinets.length - 3} autres...</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer CTA */}
      <div className={`px-5 py-3 border-t border-white/10 flex items-center gap-2 text-[11px] font-semibold transition ${
        isActive ? cfg.accentColor : 'text-gray-500 group-hover:text-gray-300'
      }`}>
        {isActive ? (
          <><CheckCircle size={13} /> Proposition active en édition</>
        ) : (
          <><ChevronRight size={13} /> Cliquer pour activer cette proposition</>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────
// Main Compare Panel
// ─────────────────────────────────────────────────────
interface PropositionComparePanelProps {
  onClose: () => void;
}

export const PropositionComparePanel: React.FC<PropositionComparePanelProps> = ({ onClose }) => {
  const { cabinets, propositions, activeProp, setActiveProp, details } = useProjectStore();

  const propCabinets: Record<'prop1' | 'prop2' | 'prop3', Cabinet[]> = {
    prop1: activeProp === 'prop1' ? cabinets : propositions.prop1,
    prop2: activeProp === 'prop2' ? cabinets : propositions.prop2,
    prop3: activeProp === 'prop3' ? cabinets : propositions.prop3,
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-[#0f1117] via-[#141821] to-[#0f1117] overflow-hidden">
      {/* Header */}
      <div className="px-8 py-5 border-b border-white/10 flex items-center justify-between bg-black/40">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">
            Comparatif des Propositions Client
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            <span className="text-brand-blue font-semibold">{details.clientName}</span>
            {' · '}
            {details.clientAddress}
            {' · '}
            <span className="text-gray-500">Projet : {details.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
            Mode Présentation Client — NF C 15-100
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-brand-blue/20 border border-brand-blue/40 text-brand-blue text-xs font-bold hover:bg-brand-blue/30 transition"
          >
            ✦ Retour Atelier
          </button>
        </div>
      </div>

      {/* Comparison cards */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="grid grid-cols-3 gap-5 h-full max-h-[600px]">
          {(['prop1', 'prop2', 'prop3'] as const).map((propKey) => (
            <PropCard
              key={propKey}
              propKey={propKey}
              cabinets={propCabinets[propKey]}
              isActive={activeProp === propKey}
              onActivate={() => {
                setActiveProp(propKey);
                onClose();
              }}
            />
          ))}
        </div>

        {/* Bottom notice */}
        <div className="mt-6 text-center text-[11px] text-gray-600">
          <p>Ce comparatif est généré automatiquement depuis les données NF C 15-100 saisies dans l'atelier de câblage.</p>
          <p className="mt-1">Pour modifier une proposition, cliquez dessus pour l'activer, puis retournez en mode Atelier.</p>
        </div>
      </div>
    </div>
  );
};
