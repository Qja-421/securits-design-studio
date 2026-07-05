import React, { useState, useEffect, useRef } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { validateCabinet } from '../../engine/validator';
import { calculateComponentMetrics } from '../../engine/calculator';
import { Send, Sparkles, X, Key } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface Message {
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export const AIChat: React.FC = () => {
  const { cabinets, activeCabinetId, details } = useProjectStore();
  const activeCabinet = cabinets.find((c) => c.id === activeCabinetId);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      text: 'Bonjour ! Je suis votre assistant expert NF C 15-100. Posez un composant sur le rail ou demandez-moi une validation complète pour démarrer l\'analyse de votre armoire électrique.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || ((import.meta as any).env.VITE_GEMINI_API_KEY as string) || '');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    setShowKeyInput(false);
  };

  const getCabinetContextString = () => {
    if (!activeCabinet) return 'Aucun coffret actif.';
    const violations = validateCabinet(activeCabinet);
    
    let text = `Projet: ${details.name} (Client: ${details.clientName}, Lieu: ${details.clientAddress})\n`;
    text += `Cabinet: ${activeCabinet.name} (${activeCabinet.rowsCount} rangées, ${activeCabinet.modulesPerRow} modules par rangée)\n`;
    text += `Composants installés :\n`;

    activeCabinet.components.forEach((c) => {
      const p = c.properties;
      text += `- ID: ${c.id}, Type: ${c.type}, Pôles: ${p.poles}, Calibre: ${p.ratingA}A, Nom: ${p.name}`;
      if (c.type === 'load') {
        const m = calculateComponentMetrics(c);
        text += `, Catégorie: ${p.category}, Puissance: ${p.powerW}W, Longueur Câble: ${p.cableLengthM}m, Section: ${p.cableSectionMm2}mm², Pose: ${p.installationMode}, Chute U: ${m.voltageDropPercent}%, Ib: ${m.ibA}A`;
      } else if (c.type === 'differential') {
        text += `, Type Différentiel: ${p.diffType}, Sensibilité: ${p.sensitivity}`;
      }
      text += '\n';
    });

    text += `Anomalies NF C 15-100 détectées en temps réel :\n`;
    if (violations.length === 0) {
      text += `- Aucune anomalie, coffret entièrement conforme.\n`;
    } else {
      violations.forEach((v) => {
        text += `- [${v.severity.toUpperCase()}] ${v.message} (Type: ${v.type})\n`;
      });
    }
    return text;
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMsg: Message = {
      sender: 'user',
      text: inputText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    const userQuery = inputText;
    setInputText('');
    setLoading(true);

    try {
      const context = getCabinetContextString();
      const systemPrompt = `Tu es un ingénieur électricien expert en installations basse tension résidentielles et tertiaires, maîtrisant la norme NF C 15-100 édition 2025, les produits Legrand/Schneider/Hager, le dimensionnement des protections et câbles, la coordination des protections (sélectivité, filiation), et les règles IEC 60364. Quand l'utilisateur pose un coffret ou un circuit : valide les choix de protection, vérifie la coordination amont/aval, signale les non-conformités, propose des alternatives justifiées, explique pédagogiquement sans jargon inutile. Voici les détails et l'état actuel de son coffret électrique :\n\n${context}`;

      let aiResponseText = '';

      if (apiKey) {
        // Google Generative AI SDK v0.x integration
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-pro',
          systemInstruction: systemPrompt
        });

        // Build history for multi-turn conversation (exclude the latest user message)
        const history = messages
          .filter((m) => m.text !== '')
          .map((m) => ({
            role: m.sender === 'user' ? ('user' as const) : ('model' as const),
            parts: [{ text: m.text }]
          }));

        const chat = model.startChat({ history });
        const result = await chat.sendMessage(userQuery);
        aiResponseText = result.response.text();
      } else {
        // Simulator Fallback if no key is provided
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        // Custom smart simulation answers depending on query
        if (userQuery.toLowerCase().includes('conforme') || userQuery.toLowerCase().includes('valider')) {
          if (!activeCabinet) {
            aiResponseText = "Veuillez d'abord ajouter un tableau électrique.";
          } else {
            const violations = validateCabinet(activeCabinet);
            if (violations.length === 0) {
              aiResponseText = "### Diagnostic Expert NF C 15-100\n\nFélicitations, l'armoire **" + activeCabinet.name + "** est parfaitement conforme aux règles de la norme NF C 15-100.\n\n* Les sections minimales sont respectées.\n* Les différentiels sont correctement dimensionnés (Règle de l'aval validée).\n* Aucun circuit ne présente de chute de tension supérieure à la limite de 3% (éclairage) ou 5% (autres).\n\nVous pouvez exporter le dossier technique en toute confiance.";
            } else {
              aiResponseText = `### Diagnostic Expert NF C 15-100\n\nJ'ai analysé votre coffret et détecté **${violations.length} anomalie(s)** :\n\n` +
                violations.map(v => `* **${v.severity === 'error' ? '❌ Non-conformité' : '⚠️ Avertissement'}** (${v.type}) : ${v.message}`).join('\n') +
                `\n\n**Recommandations :**\n* Cliquez sur les boutons **"Résoudre"** dans le panneau latéral droit pour corriger automatiquement les calibres de disjoncteurs et sections de câbles.\n* Assurez-vous d'avoir un Interrupteur Différentiel Type A en amont des plaques de cuisson et du lave-linge.`;
            }
          }
        } else if (userQuery.toLowerCase().includes('câble') || userQuery.toLowerCase().includes('section')) {
          aiResponseText = "### Règles de Dimensionnement des Conducteurs NF C 15-100\n\nSelon le tableau de la norme, les sections minimales de cuivre en fonction des usages résidentiels sont :\n\n* **1,5 mm²** : Éclairage (max 16A disjoncteur) et Volets roulants.\n* **2,5 mm²** : Prises de courant standards (max 20A disjoncteur), Four, Lave-linge, Lave-vaisselle, Chauffe-eau.\n* **6 mm²** : Plaque de cuisson monophasée (max 32A disjoncteur).\n* **10 mm²** : Borne de recharge pour véhicule électrique (recharge rapide 7,4 kW - 32A).\n\nLa chute de tension cumulée depuis l'origine de l'installation ne doit pas dépasser **3%** pour l'éclairage et **5%** pour les autres usages.";
        } else {
          aiResponseText = "### Analyse Expert Securits Tech\n\nJ'ai bien pris note de votre question sur le tableau. Pour une analyse personnalisée avec Gemini 3.1 Pro, veuillez renseigner votre **Clé API Gemini** dans l'icône de clé en haut du chat.\n\nEn mode simulation, sachez que je valide en temps réel :\n* Les calibres de protection ($Iz \\ge In \\ge Ib$)\n* La chute de tension limite copper ($0.0225\\,\\Omega\\cdot\\text{mm}^2/\\text{m}$)\n* Le nombre maximum de circuits par différentiel (max 8) et la règle de l'aval.";
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: aiResponseText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `Désolé, une erreur est survenue lors de la communication avec l'API Gemini : ${err?.message || err}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 select-none">
      {/* Collapsed Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center space-x-2 bg-brand-blue text-brand-black hover:bg-brand-blue/80 px-4 py-3 rounded-full shadow-lg transition-transform transform hover:scale-105 font-bold text-xs"
        >
          <Sparkles size={16} className="animate-spin" />
          <span>ASSISTANT IA EXPERT (NFC 15-100)</span>
          {activeCabinet && validateCabinet(activeCabinet).length > 0 && (
            <span className="bg-brand-bordeaux text-white text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-black animate-pulse">
              {validateCabinet(activeCabinet).length}
            </span>
          )}
        </button>
      )}

      {/* Expanded Chat Dialog */}
      {isOpen && (
        <div className="bg-brand-darkGray text-white border border-white/10 w-96 rounded-xl shadow-2xl flex flex-col h-[450px] overflow-hidden">
          {/* Header */}
          <div className="p-3 bg-black/40 flex justify-between items-center border-b border-white/5">
            <div className="flex items-center space-x-2">
              <Sparkles size={15} className="text-brand-blue" />
              <span className="text-xs font-bold uppercase tracking-wider">Assistant IA Securits Tech</span>
            </div>
            
            <div className="flex items-center space-x-1.5">
              {/* API Key configuration icon */}
              <button
                onClick={() => setShowKeyInput(!showKeyInput)}
                className={`p-1 rounded transition ${apiKey ? 'text-green-400 hover:bg-white/5' : 'text-gray-400 hover:text-white'}`}
                title="Configurer la Clé API Gemini"
              >
                <Key size={13} />
              </button>
              
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/10 rounded transition text-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* API Key Modal Inline */}
          {showKeyInput && (
            <div className="bg-black/85 p-3 border-b border-white/10 text-xs space-y-2">
              <div className="font-semibold text-brand-orange">Entrez votre Clé API Gemini (Google AI) :</div>
              <div className="flex space-x-2">
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1 bg-brand-darkGray border border-white/20 rounded px-2 py-1 text-white focus:outline-none"
                />
                <button
                  onClick={() => saveApiKey(apiKey)}
                  className="bg-brand-blue text-brand-black px-2.5 py-1 rounded font-bold hover:bg-brand-blue/80"
                >
                  OK
                </button>
              </div>
              <div className="text-[9px] text-gray-400">
                La clé est conservée localement dans votre navigateur.
              </div>
            </div>
          )}

          {/* Messages box */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-black/10">
            {messages.map((msg, mIdx) => (
              <div
                key={mIdx}
                className={`flex flex-col max-w-[85%] ${
                  msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                }`}
              >
                <div
                  className={`p-2.5 rounded-lg text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-brand-blue text-brand-black font-medium rounded-tr-none'
                      : 'bg-white/5 border border-white/5 text-gray-200 rounded-tl-none font-sans'
                  }`}
                  style={{ whiteSpace: 'pre-line' }}
                >
                  {msg.text}
                </div>
                <span className="text-[8px] text-gray-500 mt-1 px-1">{msg.timestamp}</span>
              </div>
            ))}
            {loading && (
              <div className="flex items-center space-x-2 text-xs text-gray-400 bg-white/5 p-2 rounded-lg border border-white/5 self-start max-w-[70%]">
                <div className="w-2 h-2 bg-brand-blue rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-brand-blue rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 bg-brand-blue rounded-full animate-bounce [animation-delay:0.4s]"></div>
                <span>Calcul en cours...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick analysis triggers */}
          <div className="px-3 py-1.5 bg-black/25 border-t border-white/5 flex space-x-1.5 overflow-x-auto text-[9px]">
            <button
              onClick={() => {
                setInputText("Valider la conformité NF C 15-100 de ce coffret");
                setTimeout(handleSendMessage, 50);
              }}
              className="bg-brand-orange/20 border border-brand-orange/40 hover:bg-brand-orange/35 px-2 py-1 rounded text-brand-orange font-bold whitespace-nowrap"
            >
              🔍 Validation Globale
            </button>
            <button
              onClick={() => {
                setInputText("Donne-moi les règles NF C 15-100 sur la section de câble");
                setTimeout(handleSendMessage, 50);
              }}
              className="bg-brand-blue/20 border border-brand-blue/40 hover:bg-brand-blue/35 px-2 py-1 rounded text-brand-blue font-bold whitespace-nowrap"
            >
              📏 Guide Câblage
            </button>
          </div>

          {/* Text Input footer */}
          <div className="p-2 border-t border-white/10 bg-black/40 flex items-center space-x-1.5">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez une question technique..."
              rows={1}
              className="flex-1 bg-black/30 border border-white/20 rounded-md px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue resize-none max-h-12 font-sans"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim()}
              className="p-2 bg-brand-blue hover:bg-brand-blue/80 text-brand-black rounded-md disabled:opacity-40 transition"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
