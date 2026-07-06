import React from 'react';
import { useProjectStore } from '../../store/projectStore';
import { validateCabinet } from '../../engine/validator';
import { calculateComponentMetrics } from '../../engine/calculator';
import {
  DEPART_TABLEAU_RATINGS,
  DEPART_TABLEAU_SECTIONS,
  STANDARD_RATINGS,
  STANDARD_SECTIONS,
  POLE_OPTIONS
} from '../../engine/norms';
import { AlertTriangle, CheckCircle, Info, RefreshCw } from 'lucide-react';

export const PropertiesPanel: React.FC = () => {
  const {
    cabinets,
    activeCabinetId,
    selectedComponentId,
    updateComponentProperties,
    removeComponent
  } = useProjectStore();

  const activeCabinet = cabinets.find((c) => c.id === activeCabinetId);
  const selectedComponent = activeCabinet?.components.find(
    (c) => c.id === selectedComponentId
  );

  if (!selectedComponent) {
    return (
      <div className="bg-brand-darkGray text-gray-400 p-4 rounded-lg flex flex-col items-center justify-center h-full border border-white/5 select-none">
        <Info size={28} className="mb-2 text-gray-500" />
        <p className="text-xs text-center font-medium">Sélectionnez un composant sur le rail pour éditer ses propriétés et voir son diagnostic de calcul.</p>
      </div>
    );
  }

  const props = selectedComponent.properties;
  const metrics = calculateComponentMetrics(selectedComponent);
  const cabinetViolations = activeCabinet ? validateCabinet(activeCabinet) : [];
  const compViolations = cabinetViolations.filter(
    (v) => v.componentId === selectedComponent.id
  );

  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    let typedValue: any = value;

    if (['powerW', 'voltageV', 'cosPhi', 'cableLengthM', 'cableSectionMm2', 'ratingA'].includes(name)) {
      typedValue = Number(value);
    }

    updateComponentProperties(activeCabinetId, selectedComponent.id, {
      [name]: typedValue
    });
  };

  const handleResolve = (violationType: string, componentId: string, suggestedValue?: string) => {
    if (!suggestedValue) return;

    if (violationType === 'rating') {
      const match = suggestedValue.match(/\d+/);
      if (match) {
        const rating = Number(match[0]);
        updateComponentProperties(activeCabinetId, componentId, {
          ratingA: rating
        });
      }
    } else if (violationType === 'section') {
      const match = suggestedValue.match(/[\d.]+/);
      if (match) {
        const section = Number(match[0]);
        updateComponentProperties(activeCabinetId, componentId, {
          cableSectionMm2: section
        });
      }
    } else if (violationType === 'differential_load') {
      if (suggestedValue === '63A') {
        updateComponentProperties(activeCabinetId, componentId, {
          ratingA: 63
        });
      } else if (suggestedValue === 'Type A') {
        updateComponentProperties(activeCabinetId, componentId, {
          diffType: 'A'
        });
      }
    }
  };

  const handleDelete = () => {
    if (window.confirm("Supprimer ce composant du rail ?")) {
      removeComponent(activeCabinetId, selectedComponent.id);
    }
  };

  const isLoad = selectedComponent.type === 'load';
  const isDiff = selectedComponent.type === 'differential';
  const isDepartTableau = props.circuitUsage === 'depart_tableau';
  const ratingOptions = isDepartTableau ? DEPART_TABLEAU_RATINGS : STANDARD_RATINGS;
  const sectionOptions = isDepartTableau ? DEPART_TABLEAU_SECTIONS : STANDARD_SECTIONS;

  return (
    <div className="bg-brand-darkGray text-white border border-white/5 rounded-lg flex flex-col h-full overflow-hidden select-none">
      {/* Title */}
      <div className="p-3 bg-black/35 border-b border-white/5 flex justify-between items-center">
        <span className="text-xs font-bold uppercase tracking-wider text-brand-orange truncate pr-2">
          {props.name || 'Propriétés'}
        </span>
        <button
          onClick={handleDelete}
          className="text-[10px] bg-brand-bordeaux/60 hover:bg-brand-bordeaux px-2 py-0.5 rounded text-white font-semibold transition"
        >
          Supprimer
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
        {/* Real-time compliance warnings */}
        {compViolations.length > 0 ? (
          <div className="space-y-1.5">
            {compViolations.map((v) => (
              <div
                key={v.id}
                className={`p-2.5 rounded border text-xs flex flex-col ${
                  v.severity === 'error'
                    ? 'bg-red-950/20 border-red-800 text-red-200'
                    : 'bg-amber-950/20 border-amber-800 text-amber-200'
                }`}
              >
                <div className="flex items-start space-x-1.5 font-semibold">
                  <AlertTriangle size={14} className="mt-0.5 text-brand-orange flex-shrink-0" />
                  <span>{v.message}</span>
                </div>
                {v.suggestedValue && (
                  <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
                    <span className="text-[10px] text-gray-400">
                      Suggéré : <strong className="text-white">{v.suggestedValue}</strong>
                    </span>
                    <button
                      onClick={() => handleResolve(v.type, v.componentId, v.suggestedValue)}
                      className="flex items-center space-x-1 bg-brand-blue text-brand-black hover:bg-brand-blue/80 px-2 py-0.5 rounded text-[10px] font-bold transition shadow-sm"
                    >
                      <RefreshCw size={10} />
                      <span>Résoudre</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-2.5 bg-green-950/15 border border-green-800 text-green-200 rounded text-xs flex items-center space-x-1.5 font-medium">
            <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
            <span>Circuit entièrement conforme à la NF C 15-100.</span>
          </div>
        )}

        {/* Form fields */}
        <div className="space-y-3">
          {/* 1. Name */}
          <div className="flex flex-col">
            <label className="text-[10px] text-gray-400 font-semibold mb-1 uppercase tracking-wider">Libellé du circuit</label>
            <input
              type="text"
              name="name"
              value={props.name}
              onChange={handleFieldChange}
              className="bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-brand-blue"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {/* 2. Rating */}
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-400 font-semibold mb-1 uppercase tracking-wider">Calibre (In)</label>
              <select
                name="ratingA"
                value={props.ratingA}
                onChange={handleFieldChange}
                className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-brand-blue"
              >
                {ratingOptions.map((r) => (
                  <option key={r} value={r} className="bg-brand-darkGray text-white">
                    {r} A
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Poles */}
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-400 font-semibold mb-1 uppercase tracking-wider">Pôles</label>
              <select
                name="poles"
                value={props.poles}
                onChange={handleFieldChange}
                className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-brand-blue"
              >
                {POLE_OPTIONS.map((p) => (
                  <option key={p} value={p} className="bg-brand-darkGray text-white">
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Load specific properties */}
          {isLoad && (
            <>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-400 font-semibold mb-1 uppercase tracking-wider">Usage du circuit</label>
                <select
                  name="circuitUsage"
                  value={props.circuitUsage || 'terminal'}
                  onChange={handleFieldChange}
                  className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-brand-blue"
                >
                  <option value="terminal" className="bg-brand-darkGray text-white">Terminal (résidentiel)</option>
                  <option value="moteur" className="bg-brand-darkGray text-white">Moteur</option>
                  <option value="depart_tableau" className="bg-brand-darkGray text-white">Départ vers tableau divisionnaire</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {/* Power */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-400 font-semibold mb-1 uppercase tracking-wider">Puissance (W)</label>
                  <input
                    type="number"
                    name="powerW"
                    value={props.powerW || 0}
                    onChange={handleFieldChange}
                    min={0}
                    className="bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-brand-blue"
                  />
                </div>
                {/* Voltage */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-400 font-semibold mb-1 uppercase tracking-wider">Tension (V)</label>
                  <select
                    name="voltageV"
                    value={props.voltageV}
                    onChange={handleFieldChange}
                    className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-brand-blue"
                  >
                    <option value={230} className="bg-brand-darkGray text-white">230 V (Mono)</option>
                    <option value={400} className="bg-brand-darkGray text-white">400 V (Tri)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {/* Cable section */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-400 font-semibold mb-1 uppercase tracking-wider">Section (mm²)</label>
                  <select
                    name="cableSectionMm2"
                    value={props.cableSectionMm2}
                    onChange={handleFieldChange}
                    className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-brand-blue"
                  >
                    {sectionOptions.map((s) => (
                      <option key={s} value={s} className="bg-brand-darkGray text-white">
                        {s} mm²
                      </option>
                    ))}
                  </select>
                </div>
                {/* Cable length */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-400 font-semibold mb-1 uppercase tracking-wider">Longueur (m)</label>
                  <input
                    type="number"
                    name="cableLengthM"
                    value={props.cableLengthM || 0}
                    onChange={handleFieldChange}
                    min={0.1}
                    step={0.1}
                    className="bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-brand-blue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {/* Pose Mode */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-400 font-semibold mb-1 uppercase tracking-wider">Mode de pose</label>
                  <select
                    name="installationMode"
                    value={props.installationMode}
                    onChange={handleFieldChange}
                    className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-brand-blue"
                  >
                    <option value="A" className="bg-brand-darkGray text-white">Mode A (Cloison)</option>
                    <option value="B" className="bg-brand-darkGray text-white">Mode B (Goulotte encastré)</option>
                    <option value="C" className="bg-brand-darkGray text-white">Mode C (En apparent - Défaut)</option>
                    <option value="D" className="bg-brand-darkGray text-white">Mode D (Enterré)</option>
                    <option value="E" className="bg-brand-darkGray text-white">Mode E (Chemin de câbles)</option>
                  </select>
                </div>
                {/* Cos Phi */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-400 font-semibold mb-1 uppercase tracking-wider">Facteur cos φ</label>
                  <input
                    type="number"
                    name="cosPhi"
                    value={props.cosPhi}
                    onChange={handleFieldChange}
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    className="bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-brand-blue"
                  />
                </div>
              </div>
            </>
          )}

          {/* Differential specific properties */}
          {isDiff && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-400 font-semibold mb-1 uppercase tracking-wider">Type Différentiel</label>
                <select
                  name="diffType"
                  value={props.diffType}
                  onChange={handleFieldChange}
                  className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-brand-blue"
                >
                  <option value="AC" className="bg-brand-darkGray text-white">Type AC (Standard)</option>
                  <option value="A" className="bg-brand-darkGray text-white">Type A (Spéciaux/Cuisson)</option>
                  <option value="Hpi" className="bg-brand-darkGray text-white">Type Hpi (Immunisé/Frigo)</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-400 font-semibold mb-1 uppercase tracking-wider">Sensibilité</label>
                <select
                  name="sensitivity"
                  value={props.sensitivity}
                  onChange={handleFieldChange}
                  className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-brand-blue"
                >
                  <option value="30mA" className="bg-brand-darkGray text-white">30 mA (Personnes)</option>
                  <option value="300mA" className="bg-brand-darkGray text-white">300 mA (Incendie)</option>
                  <option value="500mA" className="bg-brand-darkGray text-white">500 mA (Général)</option>
                </select>
              </div>
            </div>
          )}

          {/* Breaker specific properties */}
          {selectedComponent.type === 'breaker' && (
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-400 font-semibold mb-1 uppercase tracking-wider">Courbe Magnétique</label>
              <select
                name="curve"
                value={props.curve}
                onChange={handleFieldChange}
                className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-brand-blue"
              >
                <option value="B" className="bg-brand-darkGray text-white">Courbe B (Générateur/Ligne longue)</option>
                <option value="C" className="bg-brand-darkGray text-white">Courbe C (Récepteurs standards - Défaut)</option>
                <option value="D" className="bg-brand-darkGray text-white">Courbe D (Moteurs/Forts appels)</option>
              </select>
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col">
            <label className="text-[10px] text-gray-400 font-semibold mb-1 uppercase tracking-wider">Commentaires techniques</label>
            <textarea
              name="notes"
              value={props.notes || ''}
              onChange={handleFieldChange}
              rows={2}
              className="bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-brand-blue resize-none font-sans"
            />
          </div>
        </div>

        {/* Calculation results summary */}
        {isLoad && (
          <div className="mt-2 border-t border-white/10 pt-3 space-y-2">
            <span className="text-[10px] text-brand-orange font-bold uppercase tracking-wider">Résultats de la note de calcul</span>
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div className="bg-black/20 p-2 rounded border border-white/5">
                <div className="text-[9px] text-gray-400 font-semibold uppercase">Courant d'emploi (Ib)</div>
                <div className="text-sm font-bold text-white mt-0.5">{metrics.ibA} A</div>
              </div>
              <div className="bg-black/20 p-2 rounded border border-white/5">
                <div className="text-[9px] text-gray-400 font-semibold uppercase">Chute de tension (ΔU)</div>
                <div className={`text-sm font-bold mt-0.5 ${metrics.voltageDropPercent > (props.category === 'lighting' ? 3 : 5) ? 'text-brand-orange' : 'text-green-400'}`}>
                  {metrics.voltageDropPercent} %
                </div>
              </div>
              <div className="bg-black/20 p-2 rounded border border-white/5">
                <div className="text-[9px] text-gray-400 font-semibold uppercase">Courant de Court-circuit (Icc)</div>
                <div className="text-xs font-semibold text-gray-300 mt-0.5">Min: {metrics.minIcc} A<br/>Max: {metrics.maxIcc} A</div>
              </div>
              <div className="bg-black/20 p-2 rounded border border-white/5">
                <div className="text-[9px] text-gray-400 font-semibold uppercase">Capacité Câble (Iz)</div>
                <div className="text-sm font-bold text-white mt-0.5">{metrics.izA} A</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
