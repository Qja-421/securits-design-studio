import React, { useState } from 'react';
import { Search, ChevronDown, ChevronRight, Zap, ShieldAlert, Cpu, HelpCircle, Activity } from 'lucide-react';
import { ComponentType, ComponentProperties, LoadCategory, ComponentPoles } from '../../types/electrical';

interface ComponentPreset {
  id: string;
  type: ComponentType;
  name: string;
  widthModules: number;
  properties: ComponentProperties;
}

const COMPONENT_PRESETS: ComponentPreset[] = [
  // 1. PROTECTION GENERALE
  {
    id: 'preset_vistop_2p',
    type: 'general_protection',
    name: 'Interrupteur Général VISTOP 2P 63A',
    widthModules: 2,
    properties: {
      name: 'VISTOP 63A',
      poles: '2P',
      ratingA: 63,
      voltageV: 230,
      cosPhi: 1.0,
      cableLengthM: 1,
      cableSectionMm2: 10,
      installationMode: 'C',
      notes: 'Interrupteur de coupure générale'
    }
  },
  {
    id: 'preset_vistop_4p',
    type: 'general_protection',
    name: 'Interrupteur Général VISTOP 4P 63A',
    widthModules: 4,
    properties: {
      name: 'VISTOP 4P 63A',
      poles: '4P',
      ratingA: 63,
      voltageV: 400,
      cosPhi: 1.0,
      cableLengthM: 1,
      cableSectionMm2: 10,
      installationMode: 'C',
      notes: 'Interrupteur général triphasé'
    }
  },
  {
    id: 'preset_parafoudre',
    type: 'general_protection',
    name: 'Parafoudre Type 2 Monobloc',
    widthModules: 2,
    properties: {
      name: 'Parafoudre T2',
      poles: '2P',
      ratingA: 20, // max surge protection
      voltageV: 230,
      cosPhi: 1.0,
      cableLengthM: 0.5,
      cableSectionMm2: 6,
      installationMode: 'C',
      notes: 'Protection contre les surtensions atmosphériques'
    }
  },
  
  // 2. DIFFERENTIELS
  {
    id: 'preset_diff_40a_ac',
    type: 'differential',
    name: 'Interrupteur Différentiel 2P 40A 30mA AC',
    widthModules: 2,
    properties: {
      name: 'Inter Diff 40A AC',
      poles: '2P',
      ratingA: 40,
      sensitivity: '30mA',
      diffType: 'AC',
      voltageV: 230,
      cosPhi: 1.0,
      cableLengthM: 0.5,
      cableSectionMm2: 10,
      installationMode: 'C',
      notes: 'Protection différentielle circuits standards'
    }
  },
  {
    id: 'preset_diff_40a_a',
    type: 'differential',
    name: 'Interrupteur Différentiel 2P 40A 30mA A',
    widthModules: 2,
    properties: {
      name: 'Inter Diff 40A A',
      poles: '2P',
      ratingA: 40,
      sensitivity: '30mA',
      diffType: 'A',
      voltageV: 230,
      cosPhi: 1.0,
      cableLengthM: 0.5,
      cableSectionMm2: 10,
      installationMode: 'C',
      notes: 'Protection différentielle circuits spéciaux (cuisson, LL)'
    }
  },
  {
    id: 'preset_diff_63a_a',
    type: 'differential',
    name: 'Interrupteur Différentiel 2P 63A 30mA A',
    widthModules: 2,
    properties: {
      name: 'Inter Diff 63A A',
      poles: '2P',
      ratingA: 63,
      sensitivity: '30mA',
      diffType: 'A',
      voltageV: 230,
      cosPhi: 1.0,
      cableLengthM: 0.5,
      cableSectionMm2: 16,
      installationMode: 'C',
      notes: 'Forte puissance, requis pour plaques + LL'
    }
  },
  {
    id: 'preset_diff_40a_4p_a',
    type: 'differential',
    name: 'Interrupteur Différentiel 4P 40A 30mA A',
    widthModules: 4,
    properties: {
      name: 'Inter Diff 4P 40A',
      poles: '4P',
      ratingA: 40,
      sensitivity: '30mA',
      diffType: 'A',
      voltageV: 400,
      cosPhi: 1.0,
      cableLengthM: 0.5,
      cableSectionMm2: 10,
      installationMode: 'C',
      notes: 'Protection différentielle triphasée'
    }
  },

  // 3. DISJONCTEURS
  {
    id: 'preset_disj_10a',
    type: 'breaker',
    name: 'Disjoncteur Divisionnaire 10A 1P+N',
    widthModules: 1,
    properties: {
      name: 'Disj. 10A',
      poles: '1P+N',
      ratingA: 10,
      curve: 'C',
      voltageV: 230,
      cosPhi: 0.9,
      cableLengthM: 15,
      cableSectionMm2: 1.5,
      installationMode: 'C'
    }
  },
  {
    id: 'preset_disj_16a',
    type: 'breaker',
    name: 'Disjoncteur Divisionnaire 16A 1P+N',
    widthModules: 1,
    properties: {
      name: 'Disj. 16A',
      poles: '1P+N',
      ratingA: 16,
      curve: 'C',
      voltageV: 230,
      cosPhi: 0.8,
      cableLengthM: 20,
      cableSectionMm2: 1.5,
      installationMode: 'C'
    }
  },
  {
    id: 'preset_disj_20a',
    type: 'breaker',
    name: 'Disjoncteur Divisionnaire 20A 1P+N',
    widthModules: 1,
    properties: {
      name: 'Disj. 20A',
      poles: '1P+N',
      ratingA: 20,
      curve: 'C',
      voltageV: 230,
      cosPhi: 0.8,
      cableLengthM: 25,
      cableSectionMm2: 2.5,
      installationMode: 'C'
    }
  },
  {
    id: 'preset_disj_32a',
    type: 'breaker',
    name: 'Disjoncteur Divisionnaire 32A 1P+N',
    widthModules: 1,
    properties: {
      name: 'Disj. 32A',
      poles: '1P+N',
      ratingA: 32,
      curve: 'C',
      voltageV: 230,
      cosPhi: 0.8,
      cableLengthM: 10,
      cableSectionMm2: 6.0,
      installationMode: 'C'
    }
  },
  {
    id: 'preset_disj_20a_4p',
    type: 'breaker',
    name: 'Disjoncteur 4P 20A Triphasé',
    widthModules: 4,
    properties: {
      name: 'Disj. 4P 20A',
      poles: '4P',
      ratingA: 20,
      curve: 'C',
      voltageV: 400,
      cosPhi: 0.8,
      cableLengthM: 30,
      cableSectionMm2: 2.5,
      installationMode: 'C'
    }
  },

  // 4. RECEPTEURS / CHARGES
  {
    id: 'preset_load_lighting',
    type: 'load',
    name: 'Circuit Éclairage LED (600W)',
    widthModules: 1,
    properties: {
      name: 'Éclairage Salon',
      category: 'lighting',
      powerW: 600,
      voltageV: 230,
      cosPhi: 0.9,
      cableLengthM: 15,
      cableSectionMm2: 1.5,
      installationMode: 'C',
      ratingA: 10,
      poles: '1P+N',
      notes: 'Lustre LED principal + appliques'
    }
  },
  {
    id: 'preset_load_socket',
    type: 'load',
    name: 'Prises de courant standard (8 socles)',
    widthModules: 1,
    properties: {
      name: 'Prises Cuisine',
      category: 'socket',
      powerW: 2800,
      voltageV: 230,
      cosPhi: 1.0,
      cableLengthM: 20,
      cableSectionMm2: 2.5,
      installationMode: 'C',
      ratingA: 16,
      poles: '1P+N',
      notes: 'Socles prises plan de travail'
    }
  },
  {
    id: 'preset_load_ac',
    type: 'load',
    name: 'Climatisation Split (2200W)',
    widthModules: 1,
    properties: {
      name: 'Clim Chambre 1',
      category: 'ac',
      powerW: 2200,
      voltageV: 230,
      cosPhi: 0.8,
      cableLengthM: 18,
      cableSectionMm2: 2.5,
      installationMode: 'C',
      ratingA: 16,
      poles: '1P+N',
      notes: 'Climatiseur Split inverter'
    }
  },
  {
    id: 'preset_load_cooker',
    type: 'load',
    name: 'Plaque de Cuisson Induction (6000W)',
    widthModules: 1,
    properties: {
      name: 'Plaque Induction',
      category: 'cooker',
      powerW: 6000,
      voltageV: 230,
      cosPhi: 1.0,
      cableLengthM: 8,
      cableSectionMm2: 6.0,
      installationMode: 'C',
      ratingA: 32,
      poles: '1P+N',
      notes: 'Plaque induction 4 foyers'
    }
  },
  {
    id: 'preset_load_oven',
    type: 'load',
    name: 'Four Électrique (2800W)',
    widthModules: 1,
    properties: {
      name: 'Four Encastré',
      category: 'oven',
      powerW: 2800,
      voltageV: 230,
      cosPhi: 0.9,
      cableLengthM: 10,
      cableSectionMm2: 2.5,
      installationMode: 'C',
      ratingA: 20,
      poles: '1P+N'
    }
  },
  {
    id: 'preset_load_ev',
    type: 'load',
    name: 'Borne de Recharge VE (7400W)',
    widthModules: 1,
    properties: {
      name: 'Borne Tesla',
      category: 'ev_charger',
      powerW: 7400,
      voltageV: 230,
      cosPhi: 1.0,
      cableLengthM: 12,
      cableSectionMm2: 10.0,
      installationMode: 'C',
      ratingA: 32,
      poles: '1P+N',
      notes: 'Wallbox extérieure recharge voiture'
    }
  },
  {
    id: 'preset_load_pump',
    type: 'load',
    name: 'Pompe de Piscine / Forage (1500W)',
    widthModules: 1,
    properties: {
      name: 'Pompe Forage',
      category: 'pump',
      powerW: 1500,
      voltageV: 230,
      cosPhi: 0.75,
      cableLengthM: 40,
      cableSectionMm2: 2.5,
      installationMode: 'D', // underground
      ratingA: 16,
      poles: '1P+N'
    }
  },
  {
    id: 'preset_load_elevator',
    type: 'load',
    name: 'Ascenseur (5500W)',
    widthModules: 4,
    properties: {
      name: 'Ascenseur',
      category: 'other',
      circuitUsage: 'moteur',
      powerW: 5500,
      voltageV: 400,
      cosPhi: 0.8,
      cableLengthM: 30,
      cableSectionMm2: 6,
      installationMode: 'C',
      ratingA: 32,
      poles: '4P',
      notes: 'Charge triphasee 400V - ascenseur immeuble'
    }
  },
  {
    id: 'preset_load_booster_pump',
    type: 'load',
    name: 'Pompe de Surpression (3000W)',
    widthModules: 4,
    properties: {
      name: 'Pompe de Surpression',
      category: 'pump',
      circuitUsage: 'moteur',
      powerW: 3000,
      voltageV: 400,
      cosPhi: 0.8,
      cableLengthM: 25,
      cableSectionMm2: 4,
      installationMode: 'C',
      ratingA: 20,
      poles: '4P',
      notes: 'Charge triphasee 400V - surpression eau'
    }
  },
  {
    id: 'preset_load_subpanel_feed',
    type: 'load',
    name: 'Départ Tableau Divisionnaire',
    widthModules: 4,
    properties: {
      name: 'Départ Tableau Divisionnaire',
      category: 'other',
      circuitUsage: 'depart_tableau',
      powerW: 12000,
      voltageV: 400,
      cosPhi: 0.9,
      cableLengthM: 25,
      cableSectionMm2: 16,
      installationMode: 'C',
      ratingA: 63,
      poles: '4P',
      notes: 'Depart vers tableau divisionnaire - puissance et calibre a ajuster'
    }
  }
];

export const LibraryPanel: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    protection: true,
    differentiels: true,
    disjoncteurs: true,
    recepteurs: true
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleDragStart = (e: React.DragEvent, preset: ComponentPreset) => {
    const data = {
      type: preset.type,
      widthModules: preset.widthModules,
      properties: preset.properties
    };
    e.dataTransfer.setData('application/react-coffret-component', JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const filteredPresets = COMPONENT_PRESETS.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.properties.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPresetsByType = (types: ComponentType[], loadCategory?: boolean) => {
    return filteredPresets.filter((p) => {
      if (loadCategory) return p.type === 'load';
      return types.includes(p.type) && p.type !== 'load';
    });
  };

  const sectionsList = [
    {
      id: 'protection',
      title: 'PROTECTION GÉNÉRALE',
      icon: <ShieldAlert size={14} className="text-brand-orange" />,
      presets: getPresetsByType(['general_protection'])
    },
    {
      id: 'differentiels',
      title: 'DIFFÉRENTIELS',
      icon: <Zap size={14} className="text-brand-blue" />,
      presets: getPresetsByType(['differential'])
    },
    {
      id: 'disjoncteurs',
      title: 'DISJONCTEURS DIVISIONNAIRES',
      icon: <Cpu size={14} className="text-brand-bordeaux" />,
      presets: getPresetsByType(['breaker'])
    },
    {
      id: 'recepteurs',
      title: 'RÉCEPTEURS & CHARGES',
      icon: <Activity size={14} className="text-green-400" />,
      presets: getPresetsByType([], true)
    }
  ];

  return (
    <div className="bg-brand-darkGray text-white border-r border-white/10 flex flex-col h-full select-none">
      {/* Search Header */}
      <div className="p-3 border-b border-white/5 bg-black/15">
        <div className="relative">
          <input
            type="text"
            placeholder="Rechercher un composant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/40 border border-white/20 rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue"
          />
          <Search className="absolute left-2.5 top-2 text-gray-500" size={14} />
        </div>
      </div>

      {/* Accordion Categories */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {sectionsList.map((sec) => {
          const isExpanded = expandedSections[sec.id];
          if (sec.presets.length === 0) return null;

          return (
            <div key={sec.id} className="border border-white/5 bg-black/10 rounded-md overflow-hidden">
              <button
                onClick={() => toggleSection(sec.id)}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/5 text-left transition"
              >
                <div className="flex items-center space-x-2">
                  {sec.icon}
                  <span className="text-[10px] font-bold tracking-wider uppercase text-gray-300">{sec.title}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-[9px] bg-black/60 px-1.5 py-0.5 rounded text-gray-400 font-semibold">
                    {sec.presets.length}
                  </span>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </button>

              {isExpanded && (
                <div className="p-1.5 space-y-1.5 border-t border-white/5 bg-black/15">
                  {sec.presets.map((preset) => (
                    <div
                      key={preset.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, preset)}
                      className="group relative flex flex-col p-2.5 rounded bg-brand-darkGray hover:bg-black/30 border border-white/5 hover:border-brand-blue/40 transition cursor-grab active:cursor-grabbing shadow-sm"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-gray-200 truncate pr-2" title={preset.name}>
                          {preset.properties.name}
                        </span>
                        <span className="text-[8px] bg-black/40 text-brand-blue font-bold px-1.5 py-0.5 rounded">
                          {preset.properties.poles}
                        </span>
                      </div>

                      {/* Small Description */}
                      <div className="text-[9px] text-gray-500 truncate mt-1">
                        {preset.type === 'load' 
                          ? `${preset.properties.powerW}W · ${preset.properties.ratingA}A · ${preset.properties.cableSectionMm2}mm²` 
                          : `${preset.properties.ratingA}A${preset.properties.sensitivity ? ` · ${preset.properties.sensitivity}` : ''}${preset.properties.diffType ? ` Type ${preset.properties.diffType}` : ''}`
                        }
                      </div>

                      {/* Realistic Thumbnail preview on hover overlay */}
                      <div className="hidden group-hover:block absolute left-full ml-2 top-0 z-50 p-2 bg-brand-darkGray border border-brand-blue/50 rounded-md shadow-lg w-48 text-[10px] text-gray-300 pointer-events-none">
                        <div className="font-bold text-xs text-brand-orange border-b border-white/10 pb-1 mb-1">
                          {preset.name}
                        </div>
                        <div className="space-y-0.5">
                          <div><strong>Type :</strong> {preset.type}</div>
                          <div><strong>Calibre :</strong> {preset.properties.ratingA} A</div>
                          <div><strong>Tension :</strong> {preset.properties.voltageV} V</div>
                          <div><strong>Largeur :</strong> {preset.widthModules} module(s)</div>
                          {preset.properties.powerW && <div><strong>Puissance :</strong> {preset.properties.powerW} W</div>}
                          {preset.properties.cableSectionMm2 && <div><strong>Section Câble :</strong> {preset.properties.cableSectionMm2} mm²</div>}
                          {preset.properties.notes && <div className="text-gray-500 italic mt-1 font-serif">"{preset.properties.notes}"</div>}
                        </div>
                        <div className="text-[8px] text-brand-blue font-bold mt-2 text-center border-t border-white/5 pt-1 uppercase">
                          Faire glisser vers le rail
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
