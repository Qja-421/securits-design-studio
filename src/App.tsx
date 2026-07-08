import { useEffect, useState } from 'react';
import { useProjectStore } from './store/projectStore';
import { RibbonBar } from './components/Ribbon/RibbonBar';
import { CoffretsSidebar } from './components/CoffretsSidebar/CoffretsSidebar';
import { LibraryPanel } from './components/Library/LibraryPanel';
import { CabinetCanvas } from './components/Canvas/CabinetCanvas';
import { PropertiesPanel } from './components/Properties/PropertiesPanel';
import { PowerBalance } from './components/Properties/PowerBalance';
import { AIChat } from './components/AI/AIChat';
import { PropositionComparePanel } from './components/Proposals/PropositionComparePanel';
import { OnboardingTour, useShouldShowTour } from './components/Onboarding/OnboardingTour';
import { exportToPDF, exportToWord, exportToExcel } from './utils/exportUtils';
import { LayoutGrid, PanelLeft, PanelRight, PanelLeftClose, PanelRightClose, SlidersHorizontal } from 'lucide-react';

function App() {
  const { initNewProject, cabinets, activeCabinetId, details, loadProject } = useProjectStore();
  const [zoom, setZoom] = useState(1.0);
  const [presentationMode, setPresentationMode] = useState(false);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [showTour, setShowTour] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'catalogue' | 'canvas' | 'properties'>('canvas');

  // Initialize project on first load from IndexedDB, or create new if empty
  useEffect(() => {
    const initializeProject = async () => {
      try {
        const { db } = await import('./store/projectStore');
        // Fetch the most recently updated project
        const lastProjects = await db.projects.orderBy('updatedAt').reverse().limit(1).toArray();
        if (lastProjects && lastProjects.length > 0) {
          loadProject(lastProjects[0]);
        } else {
          initNewProject();
        }
      } catch (err) {
        console.error("Erreur lors de la récupération du projet local:", err);
        initNewProject();
      }
    };

    initializeProject();

    // Check if we should display the onboarding tour
    const needsTour = !localStorage.getItem('securits_tech_tour_done');
    if (needsTour) {
      setShowTour(true);
    }
  }, []);

  const activeCabinet = cabinets.find((c) => c.id === activeCabinetId);

  return (
    <div className="flex flex-col h-screen bg-brand-darkGray overflow-hidden font-sans">
      {showTour && <OnboardingTour onComplete={() => setShowTour(false)} />}

      {/* ── TOP: Ribbon Bar ── */}
      <RibbonBar
        onExportPDF={() => {
          exportToPDF(cabinets, details, { activeCabinetId: activeCabinetId ?? undefined });
        }}
        onExportWord={() => {
          if (activeCabinet) exportToWord(activeCabinet, details);
        }}
        onExportExcel={() => {
          if (activeCabinet) exportToExcel(activeCabinet, details);
        }}
        zoom={zoom}
        setZoom={setZoom}
        onPresentationToggle={() => setPresentationMode((m) => !m)}
        presentationMode={presentationMode}
      />

      {/* ── BODY: Sidebars + Canvas + Properties ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* === PRESENTATION MODE: full-width 3-prop compare panel === */}
        {presentationMode ? (
          <div className="flex-1 overflow-hidden">
            <PropositionComparePanel onClose={() => setPresentationMode(false)} />
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden md:flex-row">
            <div className="grid grid-cols-3 gap-1 border-b border-white/10 bg-black/35 p-1.5 md:hidden">
              {[
                { id: 'catalogue', label: 'Catalogue', icon: <PanelLeft size={14} /> },
                { id: 'canvas', label: 'Coffret', icon: <LayoutGrid size={14} /> },
                { id: 'properties', label: 'Propriétés', icon: <SlidersHorizontal size={14} /> }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setMobilePanel(item.id as 'catalogue' | 'canvas' | 'properties')}
                  className={`flex items-center justify-center gap-1 rounded px-2 py-2 text-[11px] font-bold transition ${
                    mobilePanel === item.id
                      ? 'bg-brand-blue text-brand-black'
                      : 'bg-brand-darkGray text-gray-300'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            {/* LEFT SIDE: Coffrets nav + Library */}
            <div className={`${mobilePanel === 'catalogue' ? 'flex' : 'hidden'} ${leftSidebarOpen ? 'md:flex' : 'md:hidden'} flex-1 flex-col overflow-hidden border-r border-white/10 md:w-48 md:flex-none md:shrink-0 lg:w-56`}>
              {/* Mes Coffrets panel */}
              <div className="h-48 border-b border-white/10 overflow-hidden shrink-0">
                <CoffretsSidebar />
              </div>
              {/* Library panel */}
              <div className="flex-1 overflow-hidden">
                <LibraryPanel />
              </div>
            </div>

            {/* Toggle Left Sidebar button */}
            <button
              onClick={() => setLeftSidebarOpen((v) => !v)}
              title={leftSidebarOpen ? 'Replier le panneau gauche' : 'Ouvrir le panneau gauche'}
              className={`absolute bottom-6 z-20 hidden bg-brand-darkGray border border-white/10 border-l-0 rounded-r-lg px-1.5 py-2 text-gray-400 hover:text-brand-blue hover:bg-black/40 transition shadow-lg md:block ${
                leftSidebarOpen ? 'md:left-48 lg:left-56' : 'md:left-0'
              }`}
            >
              {leftSidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
            </button>

            {/* CENTER: Cabinet Canvas */}
            <div className={`${mobilePanel === 'canvas' ? 'block' : 'hidden'} relative min-w-0 flex-1 overflow-hidden md:block`}>
              <CabinetCanvas
                zoom={zoom}
                setZoom={setZoom}
                presentationMode={false}
              />
            </div>

            {/* Toggle Right Panel button */}
            <button
              onClick={() => setRightPanelOpen((v) => !v)}
              title={rightPanelOpen ? 'Replier le panneau droit' : 'Ouvrir le panneau droit'}
              className={`absolute bottom-6 z-20 hidden bg-brand-darkGray border border-white/10 border-r-0 rounded-l-lg px-1.5 py-2 text-gray-400 hover:text-brand-blue hover:bg-black/40 transition shadow-lg md:block ${
                rightPanelOpen ? 'md:right-52 lg:right-56' : 'md:right-0'
              }`}
            >
              {rightPanelOpen ? <PanelRightClose size={14} /> : <PanelRight size={14} />}
            </button>

            {/* RIGHT SIDE: Properties + Power Balance */}
            <div className={`${mobilePanel === 'properties' ? 'flex' : 'hidden'} ${rightPanelOpen ? 'md:flex' : 'md:hidden'} flex-1 flex-col overflow-hidden border-l border-white/10 md:w-52 md:flex-none md:shrink-0 lg:w-56`}>
              {/* Properties Panel (upper) */}
              <div className="flex-1 overflow-hidden p-2">
                <PropertiesPanel />
              </div>
              {/* Power Balance (lower, permanent) */}
              <div className="shrink-0 p-2 border-t border-white/10">
                <PowerBalance />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Floating AI Chat Widget ── */}
      <AIChat />
    </div>
  );
}

export default App;
