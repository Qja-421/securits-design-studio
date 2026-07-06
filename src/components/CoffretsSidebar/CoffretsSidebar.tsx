import React, { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { Copy, LayoutGrid, Plus, Trash2, Edit3 } from 'lucide-react';

export const CoffretsSidebar: React.FC = () => {
  const {
    cabinets,
    activeCabinetId,
    setActiveCabinet,
    addCabinet,
    duplicateCabinet,
    renameCabinet,
    deleteCabinet
  } = useProjectStore();

  const [editingCabinetId, setEditingCabinetId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleStartRename = (id: string, name: string) => {
    setEditingCabinetId(id);
    setEditName(name);
  };

  const handleFinishRename = (id: string) => {
    if (editName.trim()) {
      renameCabinet(id, editName.trim());
    }
    setEditingCabinetId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleFinishRename(id);
    } else if (e.key === 'Escape') {
      setEditingCabinetId(null);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (cabinets.length <= 1) {
      alert("Impossible de supprimer le seul tableau électrique restant.");
      return;
    }
    const confirm = window.confirm(`Voulez-vous vraiment supprimer le tableau "${name}" ? Cette action est irréversible.`);
    if (confirm) {
      deleteCabinet(id);
    }
  };

  return (
    <div className="bg-brand-darkGray text-white border-r border-white/10 flex h-full min-h-0 flex-col select-none">
      {/* Title Header */}
      <div className="p-3 bg-black/35 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center space-x-1.5 text-brand-blue">
          <LayoutGrid size={14} />
          <span className="text-xs font-bold uppercase tracking-wider">Mes Tableaux ({cabinets.length})</span>
        </div>
        <button
          onClick={() => {
            const name = prompt("Nom du nouveau tableau :", `Tableau ${cabinets.length + 1}`);
            if (name) addCabinet(name, 3, 13);
          }}
          className="p-1 hover:bg-white/10 rounded transition text-brand-orange"
          title="Ajouter un tableau électrique"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Cabinets List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {cabinets.map((cab) => {
          const isActive = cab.id === activeCabinetId;
          const isEditing = cab.id === editingCabinetId;

          return (
            <div
              key={cab.id}
              onClick={() => !isEditing && setActiveCabinet(cab.id)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition duration-150 cursor-pointer ${
                isActive
                  ? 'bg-brand-blue/10 border-brand-blue text-brand-blue shadow-inner'
                  : 'bg-black/25 border-transparent text-gray-300 hover:bg-black/40 hover:text-white'
              }`}
            >
              <div className="flex-1 min-w-0 pr-2">
                {isEditing ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleFinishRename(cab.id)}
                    onKeyDown={(e) => handleKeyDown(e, cab.id)}
                    className="w-full bg-black/80 border border-brand-blue rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <div
                    onDoubleClick={() => handleStartRename(cab.id, cab.name)}
                    className="text-xs font-semibold truncate"
                    title="Double-cliquer pour renommer"
                  >
                    {cab.name}
                  </div>
                )}
                <div className="text-[9px] text-gray-400 mt-0.5 font-medium">
                  {cab.rowsCount} rangée{cab.rowsCount > 1 ? 's' : ''} · {cab.modulesPerRow} mod. · {cab.components.filter(c=>c.type==='load').length} circuits
                </div>
              </div>

              {/* Actions list */}
              <div className="flex items-center space-x-1 opacity-100 transition-opacity sm:opacity-0 sm:hover:opacity-100 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartRename(cab.id, cab.name);
                  }}
                  className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white"
                  title="Renommer le tableau"
                >
                  <Edit3 size={11} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateCabinet(cab.id);
                  }}
                  className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-brand-orange"
                  title="Dupliquer ce tableau"
                >
                  <Copy size={11} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(cab.id, cab.name);
                  }}
                  className="p-1 hover:bg-white/10 rounded text-brand-bordeaux hover:text-red-400"
                  title="Supprimer le tableau"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
