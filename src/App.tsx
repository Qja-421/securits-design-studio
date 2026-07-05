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
import { PanelLeft, PanelRight, PanelLeftClose, PanelRightClose } from 'lucide-react';

function App() {
  const { initNewProject, cabinets, activeCabinetId, details, loadProject } = useProjectStore();
  const [zoom, setZoom] = useState(1.0);
  const [presentationMode, setPresentationMode] = useState(false);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [showTour, setShowTour] = useState(false);

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
          if (activeCabinet) exportToPDF(activeCabinet, details);
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
      <div className="flex flex-1 overflow-hidden">

        {/* === PRESENTATION MODE: full-width 3-prop compare panel === */}
        {presentationMode ? (
          <div className="flex-1 overflow-hidden">
            <PropositionComparePanel onClose={() => setPresentationMode(false)} />
          </div>
        ) : (
          <>
            {/* LEFT SIDE: Coffrets nav + Library */}
            {leftSidebarOpen && (
              <div className="flex flex-col w-56 shrink-0 border-r border-white/10 overflow-hidden">
                {/* Mes Coffrets panel */}
                <div className="h-48 border-b border-white/10 overflow-hidden shrink-0">
                  <CoffretsSidebar />
                </div>
                {/* Library panel */}
                <div className="flex-1 overflow-hidden">
                  <LibraryPanel />
                </div>
              </div>
            )}

            {/* Toggle Left Sidebar button */}
            <button
              onClick={() => setLeftSidebarOpen((v) => !v)}
              title={leftSidebarOpen ? 'Replier le panneau gauche' : 'Ouvrir le panneau gauche'}
              className="absolute left-0 bottom-6 z-20 bg-brand-darkGray border border-white/10 border-l-0 rounded-r-lg px-1.5 py-2 text-gray-400 hover:text-brand-blue hover:bg-black/40 transition shadow-lg"
              style={{ left: leftSidebarOpen ? '222px' : '0px' }}
            >
              {leftSidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
            </button>

            {/* CENTER: Cabinet Canvas */}
            <div className="flex-1 overflow-hidden relative">
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
              className="absolute right-0 bottom-6 z-20 bg-brand-darkGray border border-white/10 border-r-0 rounded-l-lg px-1.5 py-2 text-gray-400 hover:text-brand-blue hover:bg-black/40 transition shadow-lg"
              style={{ right: rightPanelOpen ? '220px' : '0px' }}
            >
              {rightPanelOpen ? <PanelRightClose size={14} /> : <PanelRight size={14} />}
            </button>

            {/* RIGHT SIDE: Properties + Power Balance */}
            {rightPanelOpen && (
              <div className="w-56 shrink-0 flex flex-col border-l border-white/10 overflow-hidden">
                {/* Properties Panel (upper) */}
                <div className="flex-1 overflow-hidden p-2">
                  <PropertiesPanel />
                </div>
                {/* Power Balance (lower, permanent) */}
                <div className="shrink-0 p-2 border-t border-white/10">
                  <PowerBalance />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Floating AI Chat Widget ── */}
      <AIChat />
    </div>
  );
}

export default App;

