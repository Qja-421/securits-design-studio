import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, CheckCircle, Zap, BookOpen, FileText, LayoutGrid, Bot } from 'lucide-react';

interface TourStep {
  id: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  highlight?: string; // CSS selector hint (for info only — no DOM targeting)
  imageEmoji?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    icon: <Zap size={28} className="text-brand-orange" />,
    title: 'Bienvenue dans Securits Tech',
    body: "Le logiciel professionnel de dimensionnement d'armoires électriques NF C 15-100. Conçu par et pour les électriciens de Pointe-Noire, Congo. Ce tutoriel rapide vous guide en 5 étapes.",
    imageEmoji: '⚡',
  },
  {
    id: 'library',
    icon: <LayoutGrid size={28} className="text-brand-blue" />,
    title: 'Bibliothèque de composants',
    body: "Dans le panneau gauche, retrouvez tous les composants : Interrupteur Général, Différentiels, Disjoncteurs et Récepteurs. Glissez-déposez n'importe quel composant directement sur les rails DIN de votre armoire.",
    imageEmoji: '🔌',
  },
  {
    id: 'canvas',
    icon: <LayoutGrid size={28} className="text-brand-blue" />,
    title: 'Canvas de câblage',
    body: "La zone centrale représente votre armoire en vue Atelier NF C 15-100. Chaque rail DIN peut accueillir jusqu'à 18 modules. Cliquez sur un composant pour voir et modifier ses propriétés électriques dans le panneau droit.",
    imageEmoji: '🗂️',
  },
  {
    id: 'propositions',
    icon: <BookOpen size={28} className="text-brand-orange" />,
    title: 'Gestion des propositions',
    body: "Créez jusqu'à 3 variantes de votre projet (Standard, Intermédiaire, Premium) via les boutons Prop 1 / Prop 2 / Prop 3 en haut. Utilisez \"Dupliquer\" pour copier une proposition et en créer une variante. Activez le mode \"Présentation\" pour comparer les 3 propositions côte à côte.",
    imageEmoji: '📋',
  },
  {
    id: 'exports',
    icon: <FileText size={28} className="text-green-400" />,
    title: 'Génération de documents',
    body: "Depuis l'onglet DOCUMENTS du ruban, exportez en un clic : une Note de Calcul Technique PDF (pour les contrôles réglementaires), une Note Explicative Word (à remettre au client en langage simple), et une Nomenclature Excel du matériel (pour le chiffrage et les commandes).",
    imageEmoji: '📄',
  },
  {
    id: 'ai',
    icon: <Bot size={28} className="text-purple-400" />,
    title: 'Assistant IA Expert NFC 15-100',
    body: "Le bouton IA flottant en bas à droite ouvre l'assistant Gemini. Posez-lui toutes vos questions sur la norme NF C 15-100, les calibres, les protections différentielles ou le dimensionnement des câbles. Il vous répondra avec précision et contextualité.",
    imageEmoji: '🤖',
  },
];

const STORAGE_KEY = 'securits_tech_tour_done';

interface OnboardingTourProps {
  onComplete: () => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  const currentStep = TOUR_STEPS[step];
  const isFirst = step === 0;
  const isLast = step === TOUR_STEPS.length - 1;
  const progress = ((step + 1) / TOUR_STEPS.length) * 100;

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, 'true');
      onComplete();
    }, 300);
  };

  const handleNext = () => {
    if (isLast) {
      handleClose();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    setStep((s) => Math.max(0, s - 1));
  };

  return (
    <div
      className={`fixed inset-0 z-[999] flex items-center justify-center transition-all duration-300 ${
        isExiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
      }`}
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
    >
      <div className="relative bg-gradient-to-br from-[#141821] to-[#0d1017] border border-white/15 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-brand-blue to-brand-orange transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition"
          title="Passer le tutoriel"
        >
          <X size={16} />
        </button>

        {/* Content */}
        <div className="p-8 pt-6">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            <div className="flex gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`rounded-full transition-all duration-300 ${
                    i === step
                      ? 'w-6 h-1.5 bg-brand-orange'
                      : i < step
                        ? 'w-1.5 h-1.5 bg-brand-blue'
                        : 'w-1.5 h-1.5 bg-white/20'
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] text-gray-500 ml-auto">
              {step + 1} / {TOUR_STEPS.length}
            </span>
          </div>

          {/* Emoji + Icon */}
          <div className="flex items-center gap-4 mb-5">
            <div className="text-5xl leading-none">{currentStep.imageEmoji}</div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              {currentStep.icon}
            </div>
          </div>

          {/* Title & Body */}
          <h2 className="text-xl font-bold text-white mb-3 leading-tight">
            {currentStep.title}
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            {currentStep.body}
          </p>
        </div>

        {/* Footer */}
        <div className="px-8 pb-6 flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={isFirst}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/10 transition disabled:opacity-0 disabled:pointer-events-none"
          >
            <ChevronLeft size={14} />
            Précédent
          </button>

          <button
            onClick={handleNext}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition shadow-lg ${
              isLast
                ? 'bg-gradient-to-r from-brand-orange to-brand-bordeaux text-white hover:shadow-brand-orange/30 hover:shadow-xl'
                : 'bg-brand-blue text-white hover:bg-brand-blue/80'
            }`}
          >
            {isLast ? (
              <>
                <CheckCircle size={15} />
                Commencer !
              </>
            ) : (
              <>
                Suivant
                <ChevronRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper hook to know if the tour should be shown
export const useShouldShowTour = (): boolean => {
  const done = localStorage.getItem(STORAGE_KEY);
  return !done;
};
