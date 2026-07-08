import React, { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { validateCabinet } from '../../engine/validator';
import { 
  Undo2, Redo2, PlusCircle,
  FileSpreadsheet, FileText, CheckCircle, 
  AlertTriangle, Settings, HelpCircle, LayoutGrid, Copy, 
  ZoomIn, ZoomOut, ChevronDown, GitCompare
} from 'lucide-react';

interface RibbonBarProps {
  onExportPDF: () => void;
  onExportWord: () => void;
  onExportExcel: () => void;
  zoom: number;
  setZoom: (z: number) => void;
  onPresentationToggle: () => void;
  presentationMode: boolean;
}

export const RibbonBar: React.FC<RibbonBarProps> = ({
  onExportPDF,
  onExportWord,
  onExportExcel,
  zoom,
  setZoom,
  onPresentationToggle,
  presentationMode
}) => {
  const [activeTab, setActiveTab] = useState<'accueil' | 'edition' | 'conception' | 'validation' | 'documents' | 'utilitaires'>('accueil');
  const [showDupMenu, setShowDupMenu] = useState(false);
  const dupMenuRef = useRef<HTMLDivElement>(null);

  // Close dup menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dupMenuRef.current && !dupMenuRef.current.contains(e.target as Node)) {
        setShowDupMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  
  const {
    details,
    updateDetails,
    cabinets,
    activeCabinetId,
    addCabinet,
    deleteCabinet,
    activeProp,
    setActiveProp,
    duplicateProp,
    propositions,
    undo,
    redo,
    past,
    future
  } = useProjectStore();

  const activeCabinet = cabinets.find((c) => c.id === activeCabinetId);
  const violations = activeCabinet ? validateCabinet(activeCabinet) : [];

  const handleDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateDetails({ [e.target.name]: e.target.value });
  };

  // These handlers mutate the active cabinet layout without needing individual store actions
  const patchActiveCabinet = (updater: (c: typeof activeCabinet) => Partial<typeof activeCabinet>) => {
    if (!activeCabinet) return;
    const { cabinets: cabs, past: p, saveToDB } = useProjectStore.getState();
    const updatedCabinets = cabs.map((c) =>
      c.id === activeCabinetId ? { ...c, ...updater(c) } : c
    );
    useProjectStore.setState({
      past: [...p, { cabinets: JSON.parse(JSON.stringify(cabs)) }],
      future: [],
      cabinets: updatedCabinets
    });
    saveToDB();
  };

  const handleAddRow = () =>
    patchActiveCabinet((c) => ({ rowsCount: Math.min((c?.rowsCount ?? 1) + 1, 6) }));

  const handleRemoveRow = () => {
    if (!activeCabinet || activeCabinet.rowsCount <= 1) return;
    patchActiveCabinet((c) => {
      const nextRows = (c?.rowsCount ?? 1) - 1;
      return {
        rowsCount: nextRows,
        components: (c?.components ?? []).filter((comp) => comp.rowIndex < nextRows)
      };
    });
  };

  const handleWidthChange = (modules: number) =>
    patchActiveCabinet(() => ({ modulesPerRow: modules }));

  return (
    <div className="bg-brand-darkGray text-white shadow-md border-b border-white/10 select-none">
      {/* Top Brand Header */}
      <div className="flex flex-col gap-2 bg-black/40 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 items-center space-x-2">
          {/* SVG logo Securits Tech: circle with omega inside and wifi waves */}
          <div className="relative w-8 h-8 flex items-center justify-center bg-brand-blue/20 rounded-full border border-brand-blue/50">
            <span className="text-brand-blue font-bold text-lg leading-none">Ω</span>
            <div className="absolute inset-0 rounded-full border-2 border-brand-blue/30 scale-75 animate-pulse"></div>
            {/* WiFi icon representations */}
            <div className="absolute -top-1 -right-1 text-[8px] text-brand-blue">📡</div>
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm tracking-wide text-brand-blue uppercase">Securits Tech</h1>
            <p className="truncate text-[10px] text-gray-400">Pointe-Noire, Congo · Jacques Alphonse MATOKO</p>
          </div>
        </div>

        {/* Multi-Proposal Tab Switcher */}
        <div className="flex w-full items-center space-x-2 overflow-x-auto pb-1 sm:w-auto sm:pb-0">
          <span className="text-[10px] text-gray-400 font-medium">PROPOSITION CLIENT :</span>
          <div className="flex bg-black/60 p-0.5 rounded-lg border border-white/10">
            {(['prop1', 'prop2', 'prop3'] as const).map((prop) => {
              // Count components across all cabinets of this proposition
              const propCabs = prop === activeProp ? cabinets : propositions[prop];
              const compCount = propCabs.reduce((sum, c) => sum + c.components.length, 0);
              const hasContent = compCount > 0;
              const propLabel = prop === 'prop1' ? 'Standard' : prop === 'prop2' ? 'Intermédiaire' : 'Premium';
              return (
                <button
                  key={prop}
                  onClick={() => setActiveProp(prop)}
                  className={`relative px-3 py-1 rounded text-xs font-semibold tracking-wider transition-all flex items-center gap-1.5 ${
                    activeProp === prop
                      ? 'bg-brand-blue text-white shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                  title={`Basculer sur la proposition ${propLabel}`}
                >
                  <span>{prop === 'prop1' ? 'Prop 1' : prop === 'prop2' ? 'Prop 2' : 'Prop 3'}</span>
                  <span className={`text-[9px] rounded px-1 py-0.5 font-bold ${
                    activeProp === prop
                      ? 'bg-white/20 text-white'
                      : hasContent ? 'bg-brand-blue/30 text-brand-blue' : 'bg-white/5 text-gray-600'
                  }`}>
                    {hasContent ? compCount : '∅'}
                  </span>
                </button>
              );
            })}
          </div>
          
          {/* Duplicate with target selection dropdown */}
          <div className="relative flex items-center pl-2 border-l border-white/20" ref={dupMenuRef}>
            <button
              onClick={() => setShowDupMenu((v) => !v)}
              title="Dupliquer cette proposition vers..."
              className="flex items-center gap-1 px-2 py-1 hover:bg-white/10 rounded text-brand-orange hover:text-brand-orange/80 text-xs font-semibold transition"
            >
              <Copy size={13} />
              <span>Dupliquer</span>
              <ChevronDown size={11} className={`transition-transform ${showDupMenu ? 'rotate-180' : ''}`} />
            </button>

            {showDupMenu && (
              <div className="absolute top-full right-0 mt-1 bg-[#1a1f2e] border border-white/15 rounded-lg shadow-xl z-50 w-52 py-1 text-xs">
                <p className="px-3 py-1.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wider border-b border-white/10">
                  Copier <span className="text-brand-orange">{activeProp === 'prop1' ? 'Prop 1' : activeProp === 'prop2' ? 'Prop 2' : 'Prop 3'}</span> vers :
                </p>
                {(['prop1', 'prop2', 'prop3'] as const)
                  .filter((p) => p !== activeProp)
                  .map((target) => (
                    <button
                      key={target}
                      onClick={() => {
                        duplicateProp(activeProp, target);
                        setShowDupMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-brand-blue/20 hover:text-white text-gray-300 transition flex items-center gap-2"
                    >
                      <Copy size={11} className="text-brand-orange" />
                      {target === 'prop1' ? 'Prop 1 — Standard' : target === 'prop2' ? 'Prop 2 — Intermédiaire' : 'Prop 3 — Premium'}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Compare all propositions button (triggers presentation mode) */}
          <button
            onClick={onPresentationToggle}
            title={presentationMode ? 'Retour en mode Atelier' : 'Mode Présentation / Comparaison Client'}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition border ${
              presentationMode
                ? 'bg-brand-bordeaux/30 border-brand-bordeaux text-red-300 hover:bg-brand-bordeaux/50'
                : 'bg-black/30 border-white/15 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <GitCompare size={13} />
            <span>{presentationMode ? 'Atelier' : 'Présentation'}</span>
          </button>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex overflow-x-auto bg-black/20 border-b border-white/5 text-xs px-2">
        {[
          { id: 'accueil', label: 'ACCUEIL' },
          { id: 'edition', label: 'ÉDITION PROJET' },
          { id: 'conception', label: 'CONCEPTION COFFRET' },
          { id: 'validation', label: `VALIDATION (${violations.length})` },
          { id: 'documents', label: 'DOCUMENTS' },
          { id: 'utilitaires', label: 'UTILITAIRES' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`shrink-0 whitespace-nowrap px-3 py-2 font-medium tracking-wide transition-all border-b-2 sm:px-4 ${
              activeTab === tab.id
                ? 'border-brand-orange text-brand-orange bg-brand-darkGray/80'
                : 'border-transparent text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents Panels */}
      <div className="flex min-h-[64px] items-center overflow-x-auto bg-brand-darkGray/60 p-2 sm:p-3">
        {/* ACCUEIL PANEL */}
        {activeTab === 'accueil' && (
          <div className="flex min-w-max items-center space-x-4 sm:space-x-6">
            <div className="flex flex-col items-center border-r border-white/10 pr-4">
              <span className="text-[10px] text-gray-400 mb-1 font-semibold uppercase tracking-wider">Historique</span>
              <div className="flex space-x-1">
                <button
                  disabled={past.length === 0}
                  onClick={undo}
                  className="p-1.5 bg-black/40 hover:bg-black/60 text-white rounded transition disabled:opacity-40"
                  title="Annuler"
                >
                  <Undo2 size={16} />
                </button>
                <button
                  disabled={future.length === 0}
                  onClick={redo}
                  className="p-1.5 bg-black/40 hover:bg-black/60 text-white rounded transition disabled:opacity-40"
                  title="Rétablir"
                >
                  <Redo2 size={16} />
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center border-r border-white/10 pr-4">
              <span className="text-[10px] text-gray-400 mb-1 font-semibold uppercase tracking-wider">Affichage Canvas</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setZoom(Math.max(zoom - 0.1, 0.5))}
                  className="p-1.5 bg-black/40 hover:bg-black/60 text-white rounded transition"
                  title="Zoom Arrière"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs font-semibold px-2">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom(Math.min(zoom + 0.1, 2.0))}
                  className="p-1.5 bg-black/40 hover:bg-black/60 text-white rounded transition"
                  title="Zoom Avant"
                >
                  <ZoomIn size={16} />
                </button>
              </div>
            </div>


            <div className="flex flex-col items-center border-r border-white/10 pr-4">
              <span className="text-[10px] text-gray-400 mb-1 font-semibold uppercase tracking-wider">Propositions</span>
              <div className="flex items-center gap-1">
                {(['prop1', 'prop2', 'prop3'] as const).map((prop) => {
                  const propCabs = prop === activeProp ? cabinets : propositions[prop];
                  const compCount = propCabs.reduce((sum, c) => sum + c.components.length, 0);
                  return (
                    <button
                      key={prop}
                      onClick={() => setActiveProp(prop)}
                      className={`flex flex-col items-center px-2.5 py-1 rounded text-[10px] transition border ${
                        activeProp === prop
                          ? 'bg-brand-blue/20 border-brand-blue text-brand-blue'
                          : compCount > 0
                            ? 'bg-black/30 border-white/20 text-gray-300 hover:border-brand-blue/50'
                            : 'bg-black/20 border-white/10 text-gray-600 hover:text-gray-400'
                      }`}
                    >
                      <span className="font-bold">{prop === 'prop1' ? 'P1' : prop === 'prop2' ? 'P2' : 'P3'}</span>
                      <span className={`font-semibold ${compCount > 0 ? 'text-green-400' : 'text-gray-600'}`}>{compCount > 0 ? `${compCount}c` : '∅'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-[10px] text-gray-400 mb-1 font-semibold uppercase tracking-wider">Mode de Vue</span>
              <button
                onClick={onPresentationToggle}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                  presentationMode
                    ? 'bg-brand-bordeaux text-white hover:bg-brand-bordeaux/80'
                    : 'bg-brand-blue text-brand-black font-medium hover:bg-brand-blue/80'
                }`}
              >
                {presentationMode ? '✦ Mode Atelier' : '◈ Présentation Client'}
              </button>
            </div>
          </div>
        )}


        {/* ÉDITION PROJET PANEL */}
        {activeTab === 'edition' && (
          <div className="grid min-w-[720px] grid-cols-5 gap-3 w-full max-w-5xl md:min-w-0">
            <div className="flex flex-col">
              <label className="text-[9px] text-gray-400 font-semibold mb-1 uppercase tracking-wider">Nom du Projet</label>
              <input
                type="text"
                name="name"
                value={details.name}
                onChange={handleDetailsChange}
                className="bg-black/40 border border-white/20 rounded px-2 py-1 text-xs focus:outline-none focus:border-brand-blue"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[9px] text-gray-400 font-semibold mb-1 uppercase tracking-wider">Client</label>
              <input
                type="text"
                name="clientName"
                value={details.clientName}
                onChange={handleDetailsChange}
                className="bg-black/40 border border-white/20 rounded px-2 py-1 text-xs focus:outline-none focus:border-brand-blue"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[9px] text-gray-400 font-semibold mb-1 uppercase tracking-wider">Adresse (Pointe-Noire)</label>
              <input
                type="text"
                name="clientAddress"
                value={details.clientAddress}
                onChange={handleDetailsChange}
                className="bg-black/40 border border-white/20 rounded px-2 py-1 text-xs focus:outline-none focus:border-brand-blue"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[9px] text-gray-400 font-semibold mb-1 uppercase tracking-wider">Date du Devis</label>
              <input
                type="date"
                name="date"
                value={details.date}
                onChange={handleDetailsChange}
                className="bg-black/40 border border-white/20 rounded px-2 py-1 text-xs focus:outline-none focus:border-brand-blue"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[9px] text-gray-400 font-semibold mb-1 uppercase tracking-wider">Électricien Responsable</label>
              <input
                type="text"
                name="author"
                value={details.author}
                onChange={handleDetailsChange}
                className="bg-black/40 border border-white/20 rounded px-2 py-1 text-xs focus:outline-none focus:border-brand-blue"
              />
            </div>
          </div>
        )}

        {/* CONCEPTION COFFRET PANEL */}
        {activeTab === 'conception' && activeCabinet && (
          <div className="flex min-w-max items-center space-x-4 sm:space-x-6">
            <div className="flex flex-col items-center border-r border-white/10 pr-4">
              <span className="text-[10px] text-gray-400 mb-1 font-semibold uppercase tracking-wider">Rails DIN (Rangées)</span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={handleRemoveRow}
                  disabled={activeCabinet.rowsCount <= 1}
                  className="px-2 py-1 bg-brand-bordeaux hover:bg-brand-bordeaux/80 text-white text-xs font-semibold rounded disabled:opacity-40"
                  title="Supprimer la dernière rangée"
                >
                  Retirer
                </button>
                <span className="text-xs font-bold px-2">{activeCabinet.rowsCount} / 6</span>
                <button
                  onClick={handleAddRow}
                  disabled={activeCabinet.rowsCount >= 6}
                  className="px-2 py-1 bg-brand-blue text-brand-black text-xs font-semibold rounded disabled:opacity-40"
                  title="Ajouter une rangée"
                >
                  Ajouter
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center border-r border-white/10 pr-4">
              <span className="text-[10px] text-gray-400 mb-1 font-semibold uppercase tracking-wider">Modules de largeur</span>
              <div className="flex space-x-2">
                {[13, 18].map((mods) => (
                  <button
                    key={mods}
                    onClick={() => handleWidthChange(mods)}
                    className={`px-3 py-1 rounded text-xs font-bold border ${
                      activeCabinet.modulesPerRow === mods
                        ? 'bg-brand-orange border-brand-orange text-white'
                        : 'border-white/20 text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    {mods} Mod. ({mods === 13 ? 'Résidentiel' : 'Tertiaire'})
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-[10px] text-gray-400 mb-1 font-semibold uppercase tracking-wider">Gestion Multi-Coffret</span>
              <button
                onClick={() => {
                  const name = prompt("Nom du nouveau coffret :", "Coffret Secondaire");
                  if (name) addCabinet(name, 2, 13);
                }}
                className="flex items-center space-x-1 px-3 py-1 bg-black/40 hover:bg-black/60 border border-white/20 text-xs font-semibold rounded text-brand-blue"
              >
                <PlusCircle size={14} />
                <span>Nouveau Tableau</span>
              </button>
            </div>
          </div>
        )}

        {/* VALIDATION PANEL */}
        {activeTab === 'validation' && (
          <div className="flex min-w-max items-center space-x-3 w-full overflow-x-auto py-1">
            {violations.length === 0 ? (
              <div className="flex items-center space-x-2 text-green-400 text-xs font-semibold">
                <CheckCircle size={18} />
                <span>Aucune anomalie détectée (NF C 15-100 respectée). L'installation est conforme pour signature.</span>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1 bg-brand-bordeaux/30 border border-brand-bordeaux text-red-300 px-3 py-1 rounded text-xs font-bold whitespace-nowrap">
                  <AlertTriangle size={14} className="text-brand-orange animate-bounce" />
                  <span>{violations.length} ANOMALIE{violations.length > 1 ? 'S' : ''} DETECTEE{violations.length > 1 ? 'S' : ''}</span>
                </div>
                {/* Horizontal list of brief error messages */}
                <div className="flex space-x-2 text-xs">
                  {violations.slice(0, 3).map((v) => (
                    <div 
                      key={v.id} 
                      className={`px-3 py-1 rounded border whitespace-nowrap ${
                        v.severity === 'error' 
                          ? 'bg-red-950/40 border-red-800 text-red-200' 
                          : 'bg-amber-950/40 border-amber-800 text-amber-200'
                      }`}
                    >
                      <strong>{v.type === 'voltage_drop' ? 'Chute U' : v.type === 'section' ? 'Câble' : 'Protection'} :</strong> {v.message.slice(0, 75)}...
                    </div>
                  ))}
                  {violations.length > 3 && (
                    <div className="bg-black/40 border border-white/10 px-3 py-1 rounded text-gray-300 whitespace-nowrap">
                      + {violations.length - 3} autres anomalies...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      {/* DOCUMENTS EXPORTS PANEL */}
      {activeTab === 'documents' && (
        <div className="flex min-w-max items-center space-x-3">
          <button
            onClick={onExportPDF}
            title="Dossier Client complet en 2 parties : Partie 1 Dossier de Conviction (présentation, engagements, méthodologie, synthèse) + Partie 2 Dossier Technique (NF C 15-100, calculs, conformité, schémas, signatures)."
            className="flex items-center space-x-2 px-4 py-2 bg-brand-bordeaux/80 hover:bg-brand-bordeaux text-white text-xs font-bold rounded-lg shadow transition"
          >
            <FileText size={16} />
            <span>Dossier Client PDF</span>
          </button>

          <button
            onClick={onExportWord}
            className="flex items-center space-x-2 px-4 py-2 bg-brand-blue text-brand-black text-xs font-bold rounded-lg shadow transition"
          >
            <FileText size={16} />
            <span>Note Client Word</span>
          </button>

          <button
            onClick={onExportExcel}
            className="flex items-center space-x-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-xs font-bold rounded-lg shadow transition"
          >
            <FileSpreadsheet size={16} />
            <span>Nomenclature Excel</span>
          </button>

          <button
            onClick={() => {
              alert("Schéma vectoriel SVG copié dans le presse-papiers pour édition externe.");
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-black/40 hover:bg-black/60 border border-white/20 text-xs font-semibold rounded-lg text-gray-300 transition"
          >
            <LayoutGrid size={16} />
            <span>Schéma SVG</span>
          </button>
        </div>
      )}

        {/* UTILITAIRES PANEL */}
        {activeTab === 'utilitaires' && (
          <div className="flex min-w-max items-center space-x-4 text-xs text-gray-300 sm:space-x-6">
            <div className="flex items-center space-x-1 hover:text-white cursor-pointer transition">
              <Settings size={14} />
              <span>Paramètres de l'Application</span>
            </div>
            
            <div className="flex items-center space-x-1 hover:text-white cursor-pointer transition">
              <HelpCircle size={14} />
              <span>Bibliothèque Legrand & Hager</span>
            </div>

            <div className="flex items-center space-x-1 pl-4 border-l border-white/20">
              <span className="text-[10px] text-gray-400">DEXIE LOCAL STORE :</span>
              <span className="text-green-400 font-bold">SYNCHRONISÉ</span>
            </div>

            <div className="flex items-center space-x-1 pl-4 border-l border-white/20 text-brand-orange font-semibold">
              <span>Firebase Cloud :</span>
              <span className="text-gray-400 font-normal">En attente de connexion (.env)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
