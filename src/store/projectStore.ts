import { create } from 'zustand';
import Dexie, { type Table } from 'dexie';
import { Cabinet, ProjectDetails, ElectricalComponent, ComponentProperties } from '../types/electrical';

// ----------------------------------------------------
// IndexedDB Schema & Dexie Setup
// ----------------------------------------------------
export interface SavedProject {
  id: string;
  details: ProjectDetails;
  cabinets: Cabinet[];
  activeCabinetId: string;
  activeProp: 'prop1' | 'prop2' | 'prop3';
  propositions: {
    prop1: Cabinet[];
    prop2: Cabinet[];
    prop3: Cabinet[];
  };
  updatedAt: number;
}

class SecuritsTechDB extends Dexie {
  projects!: Table<SavedProject>;

  constructor() {
    super('SecuritsTechDB');
    this.version(1).stores({
      projects: 'id, updatedAt, [details.clientName]'
    });
  }
}

export const db = new SecuritsTechDB();

// ----------------------------------------------------
// Project State Interface
// ----------------------------------------------------
interface ProjectHistoryState {
  cabinets: Cabinet[];
}

export interface ProjectStore {
  id: string;
  details: ProjectDetails;
  cabinets: Cabinet[];
  activeCabinetId: string;
  activeProp: 'prop1' | 'prop2' | 'prop3';
  propositions: {
    prop1: Cabinet[];
    prop2: Cabinet[];
    prop3: Cabinet[];
  };
  selectedComponentId: string | null;
  
  // History Undo/Redo
  past: ProjectHistoryState[];
  future: ProjectHistoryState[];

  // Actions
  initNewProject: () => void;
  loadProject: (project: SavedProject) => void;
  saveToDB: () => Promise<void>;
  updateDetails: (details: Partial<ProjectDetails>) => void;
  setActiveProp: (prop: 'prop1' | 'prop2' | 'prop3') => void;
  duplicateProp: (from: 'prop1' | 'prop2' | 'prop3', to: 'prop1' | 'prop2' | 'prop3') => void;
  
  // Cabinet management
  addCabinet: (name: string, rowsCount: number, modulesPerRow: number) => void;
  duplicateCabinet: (id: string) => void;
  renameCabinet: (id: string, name: string) => void;
  updateCabinetSimultaneityCoeff: (id: string, coeff?: number) => void;
  deleteCabinet: (id: string) => void;
  setActiveCabinet: (id: string) => void;

  // Component management
  addComponent: (cabinetId: string, component: Omit<ElectricalComponent, 'moduleIndex'>) => boolean;
  moveComponent: (cabinetId: string, componentId: string, rowIndex: number, moduleIndex: number) => boolean;
  removeComponent: (cabinetId: string, componentId: string) => void;
  updateComponentProperties: (cabinetId: string, componentId: string, properties: Partial<ComponentProperties>) => void;
  selectComponent: (componentId: string | null) => void;

  // Undo/Redo actions
  undo: () => void;
  redo: () => void;
}

// Helper to create a clean initial cabinet
const createInitialCabinet = (id: string, name: string, rows = 3, modules = 13): Cabinet => ({
  id,
  name,
  rowsCount: rows,
  modulesPerRow: modules,
  components: [
    // Pre-populate with a Main Vistop switch and differential by default
    {
      id: 'main-vistop-' + id,
      type: 'general_protection',
      widthModules: 2,
      rowIndex: 0,
      moduleIndex: 0,
      properties: {
        name: 'Interrupteur Général VISTOP',
        poles: '2P',
        ratingA: 63,
        voltageV: 230,
        cosPhi: 0.8,
        cableLengthM: 1,
        cableSectionMm2: 10,
        installationMode: 'C',
        notes: 'Coupure d\'urgence générale de l\'installation.'
      }
    },
    {
      id: 'diff-head-r0-' + id,
      type: 'differential',
      widthModules: 2,
      rowIndex: 0,
      moduleIndex: 2,
      properties: {
        name: 'Différentiel Principal R1',
        poles: '2P',
        ratingA: 40,
        sensitivity: '30mA',
        diffType: 'A',
        voltageV: 230,
        cosPhi: 0.8,
        cableLengthM: 0.5,
        cableSectionMm2: 10,
        installationMode: 'C',
        notes: 'Protection différentielle R1.'
      }
    }
  ]
});

// Helper check for grid collision
const checkCollision = (
  components: ElectricalComponent[],
  rowIndex: number,
  moduleIndex: number,
  widthModules: number,
  ignoreId?: string
): boolean => {
  const targetStart = moduleIndex;
  const targetEnd = moduleIndex + widthModules;

  for (const c of components) {
    if (c.id === ignoreId) continue;
    if (c.rowIndex === rowIndex) {
      const start = c.moduleIndex;
      const end = c.moduleIndex + c.widthModules;
      // Overlap condition
      if (Math.max(targetStart, start) < Math.min(targetEnd, end)) {
        return true;
      }
    }
  }
  return false;
};

// Helper to find first free module slot
const findFirstFreeSlot = (
  components: ElectricalComponent[],
  rowIndex: number,
  widthModules: number,
  modulesPerRow: number
): number => {
  for (let m = 0; m <= modulesPerRow - widthModules; m++) {
    if (!checkCollision(components, rowIndex, m, widthModules)) {
      return m;
    }
  }
  return -1;
};

const DEFAULT_DETAILS: ProjectDetails = {
  name: 'Nouveau Projet Coffret',
  clientName: 'Client Moyen/Haut de Gamme',
  clientAddress: 'Pointe-Noire, Congo',
  date: new Date().toISOString().split('T')[0],
  author: 'Jacques Alphonse MATOKO'
};

export const useProjectStore = create<ProjectStore>((set, get) => ({
  id: 'proj_' + Math.random().toString(36).substr(2, 9),
  details: DEFAULT_DETAILS,
  cabinets: [],
  activeCabinetId: '',
  activeProp: 'prop1',
  propositions: {
    prop1: [],
    prop2: [],
    prop3: []
  },
  selectedComponentId: null,
  past: [],
  future: [],

  initNewProject: () => {
    const defaultCabinetId = 'cab_' + Math.random().toString(36).substr(2, 9);
    const initialCabinet = createInitialCabinet(defaultCabinetId, 'Tableau Principal');
    const newState = {
      id: 'proj_' + Math.random().toString(36).substr(2, 9),
      details: { ...DEFAULT_DETAILS, date: new Date().toISOString().split('T')[0] },
      cabinets: [initialCabinet],
      activeCabinetId: defaultCabinetId,
      activeProp: 'prop1' as const,
      propositions: {
        prop1: [initialCabinet],
        prop2: [],
        prop3: []
      },
      selectedComponentId: null,
      past: [],
      future: []
    };
    set(newState);
    get().saveToDB();
  },

  loadProject: (project) => {
    set({
      id: project.id,
      details: project.details,
      cabinets: project.cabinets,
      activeCabinetId: project.activeCabinetId,
      activeProp: project.activeProp,
      propositions: project.propositions,
      selectedComponentId: null,
      past: [],
      future: []
    });
  },

  saveToDB: async () => {
    const { id, details, cabinets, activeCabinetId, activeProp, propositions } = get();
    await db.projects.put({
      id,
      details,
      cabinets,
      activeCabinetId,
      activeProp,
      propositions,
      updatedAt: Date.now()
    });
  },

  updateDetails: (details) => {
    set((state) => ({ details: { ...state.details, ...details } }));
    get().saveToDB();
  },

  setActiveProp: (prop) => {
    const { propositions, activeProp, cabinets } = get();
    if (prop === activeProp) return;

    // Save current active board configuration to previous prop
    const updatedProps = { ...propositions, [activeProp]: cabinets };
    // Fetch target prop cabinets, or initialize with initial copy if empty
    const nextCabinets = propositions[prop].length > 0 ? propositions[prop] : cabinets.map(c => ({...c}));

    set({
      propositions: updatedProps,
      activeProp: prop,
      cabinets: nextCabinets,
      selectedComponentId: null,
      past: [],
      future: []
    });
    get().saveToDB();
  },

  duplicateProp: (from, to) => {
    const sourceCabinets = from === get().activeProp ? get().cabinets : get().propositions[from];
    const duplicatedCabinets = JSON.parse(JSON.stringify(sourceCabinets)); // deep copy

    set((state) => {
      const nextProps = {
        ...state.propositions,
        [to]: duplicatedCabinets
      };
      
      // If we are writing onto the active prop, refresh the current cabinets state
      if (to === state.activeProp) {
        return {
          propositions: nextProps,
          cabinets: duplicatedCabinets,
          selectedComponentId: null
        };
      }
      return { propositions: nextProps };
    });
    get().saveToDB();
  },

  addCabinet: (name, rowsCount, modulesPerRow) => {
    const { cabinets, past } = get();
    const newCabinet = createInitialCabinet('cab_' + Math.random().toString(36).substr(2, 9), name, rowsCount, modulesPerRow);

    set({
      past: [...past, { cabinets: JSON.parse(JSON.stringify(cabinets)) }],
      future: [],
      cabinets: [...cabinets, newCabinet],
      activeCabinetId: newCabinet.id
    });
    get().saveToDB();
  },

  duplicateCabinet: (id) => {
    const { cabinets, past } = get();
    const sourceCabinet = cabinets.find((c) => c.id === id);
    if (!sourceCabinet) return;

    const newCabinetId = 'cab_' + Math.random().toString(36).substr(2, 9);
    const duplicatedCabinet: Cabinet = {
      ...JSON.parse(JSON.stringify(sourceCabinet)),
      id: newCabinetId,
      name: `${sourceCabinet.name} - copie`,
      components: sourceCabinet.components.map((component) => ({
        ...JSON.parse(JSON.stringify(component)),
        id: 'comp_' + Math.random().toString(36).substr(2, 9)
      }))
    };

    set({
      past: [...past, { cabinets: JSON.parse(JSON.stringify(cabinets)) }],
      future: [],
      cabinets: [...cabinets, duplicatedCabinet],
      activeCabinetId: newCabinetId,
      selectedComponentId: null
    });
    get().saveToDB();
  },

  renameCabinet: (id, name) => {
    const { cabinets, past } = get();
    const updatedCabinets = cabinets.map((c) => (c.id === id ? { ...c, name } : c));

    set({
      past: [...past, { cabinets: JSON.parse(JSON.stringify(cabinets)) }],
      future: [],
      cabinets: updatedCabinets
    });
    get().saveToDB();
  },

  updateCabinetSimultaneityCoeff: (id, coeff) => {
    const { cabinets, past } = get();
    const updatedCabinets = cabinets.map((c) => (
      c.id === id ? { ...c, simultaneityCoeffOverride: coeff } : c
    ));

    set({
      past: [...past, { cabinets: JSON.parse(JSON.stringify(cabinets)) }],
      future: [],
      cabinets: updatedCabinets
    });
    get().saveToDB();
  },

  deleteCabinet: (id) => {
    const { cabinets, activeCabinetId, past } = get();
    if (cabinets.length <= 1) return; // Prevent deleting the last remaining board

    const updatedCabinets = cabinets.filter((c) => c.id !== id);
    const nextActiveId = activeCabinetId === id ? updatedCabinets[0].id : activeCabinetId;

    set({
      past: [...past, { cabinets: JSON.parse(JSON.stringify(cabinets)) }],
      future: [],
      cabinets: updatedCabinets,
      activeCabinetId: nextActiveId,
      selectedComponentId: null
    });
    get().saveToDB();
  },

  setActiveCabinet: (id) => {
    set({ activeCabinetId: id, selectedComponentId: null });
  },

  addComponent: (cabinetId, componentData) => {
    const { cabinets, past } = get();
    const cabinet = cabinets.find((c) => c.id === cabinetId);
    if (!cabinet) return false;

    // Find free module index on the target row
    const targetRow = componentData.rowIndex;
    const freeSlot = findFirstFreeSlot(cabinet.components, targetRow, componentData.widthModules, cabinet.modulesPerRow);

    if (freeSlot === -1) return false; // Row has no room

    const newComponent: ElectricalComponent = {
      ...componentData,
      moduleIndex: freeSlot
    };

    const updatedCabinets = cabinets.map((c) => {
      if (c.id === cabinetId) {
        return {
          ...c,
          components: [...c.components, newComponent]
        };
      }
      return c;
    });

    set({
      past: [...past, { cabinets: JSON.parse(JSON.stringify(cabinets)) }],
      future: [],
      cabinets: updatedCabinets,
      selectedComponentId: newComponent.id
    });
    get().saveToDB();
    return true;
  },

  moveComponent: (cabinetId, componentId, rowIndex, moduleIndex) => {
    const { cabinets, past } = get();
    const cabinet = cabinets.find((c) => c.id === cabinetId);
    if (!cabinet) return false;

    const component = cabinet.components.find((c) => c.id === componentId);
    if (!component) return false;

    // Keep layout boundaries within bounds
    const maxModules = cabinet.modulesPerRow;
    let targetSlot = moduleIndex;
    if (targetSlot < 0) targetSlot = 0;
    if (targetSlot + component.widthModules > maxModules) {
      targetSlot = maxModules - component.widthModules;
    }

    // Check collisions
    if (checkCollision(cabinet.components, rowIndex, targetSlot, component.widthModules, componentId)) {
      return false; // Collision, cannot move
    }

    const updatedCabinets = cabinets.map((c) => {
      if (c.id === cabinetId) {
        return {
          ...c,
          components: c.components.map((comp) =>
            comp.id === componentId ? { ...comp, rowIndex, moduleIndex: targetSlot } : comp
          )
        };
      }
      return c;
    });

    set({
      past: [...past, { cabinets: JSON.parse(JSON.stringify(cabinets)) }],
      future: [],
      cabinets: updatedCabinets
    });
    get().saveToDB();
    return true;
  },

  removeComponent: (cabinetId, componentId) => {
    const { cabinets, past, selectedComponentId } = get();
    const updatedCabinets = cabinets.map((c) => {
      if (c.id === cabinetId) {
        return {
          ...c,
          components: c.components.filter((comp) => comp.id !== componentId)
        };
      }
      return c;
    });

    set({
      past: [...past, { cabinets: JSON.parse(JSON.stringify(cabinets)) }],
      future: [],
      cabinets: updatedCabinets,
      selectedComponentId: selectedComponentId === componentId ? null : selectedComponentId
    });
    get().saveToDB();
  },

  updateComponentProperties: (cabinetId, componentId, propsToUpdate) => {
    const { cabinets, past } = get();
    const updatedCabinets = cabinets.map((c) => {
      if (c.id === cabinetId) {
        return {
          ...c,
          components: c.components.map((comp) => {
            if (comp.id === componentId) {
              // Recalculate component size if poles change
              let nextWidth = comp.widthModules;
              if (propsToUpdate.poles && propsToUpdate.poles !== comp.properties.poles) {
                nextWidth = propsToUpdate.poles === '4P' ? 4 : (propsToUpdate.poles === '3P' ? 3 : (comp.type === 'general_protection' ? 2 : 1));
              }

              return {
                ...comp,
                widthModules: nextWidth,
                properties: {
                  ...comp.properties,
                  ...propsToUpdate
                } as ComponentProperties
              };
            }
            return comp;
          })
        };
      }
      return c;
    });

    set({
      past: [...past, { cabinets: JSON.parse(JSON.stringify(cabinets)) }],
      future: [],
      cabinets: updatedCabinets
    });
    get().saveToDB();
  },

  selectComponent: (componentId) => {
    set({ selectedComponentId: componentId });
  },

  undo: () => {
    const { past, future, cabinets } = get();
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);

    set({
      past: newPast,
      future: [{ cabinets: JSON.parse(JSON.stringify(cabinets)) }, ...future],
      cabinets: previous.cabinets,
      selectedComponentId: null
    });
    get().saveToDB();
  },

  redo: () => {
    const { past, future, cabinets } = get();
    if (future.length === 0) return;

    const next = future[0];
    const newFuture = future.slice(1);

    set({
      past: [...past, { cabinets: JSON.parse(JSON.stringify(cabinets)) }],
      future: newFuture,
      cabinets: next.cabinets,
      selectedComponentId: null
    });
    get().saveToDB();
  }
}));
