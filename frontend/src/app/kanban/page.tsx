"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  LayoutGrid, Trash2, Edit, CheckSquare, Square, 
  ChevronDown, X, Info, Calendar, Briefcase
} from "lucide-react";
import { getApiUrl } from "@/lib/api";

interface Processo {
  id: number;
  numero: string;
  mascara: string;
  cliente: string;
  cliente_nome?: string;
  descricao?: string;
  data_limite_estimada?: string;
  resumo?: string;
  status?: string;
}

export default function KanbanPage() {
  const [processes, setProcesses] = useState<Processo[]>([]);
  const [selectedProcessIds, setSelectedProcessIds] = useState<number[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Dropdown select state
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form/Modal inputs state
  const [editingProcessId, setEditingProcessId] = useState<number | null>(null);
  const [resumoInput, setResumoInput] = useState("");
  const [dataLimiteInput, setDataLimiteInput] = useState("");
  const [statusInput, setStatusInput] = useState("todo");

  // Drag over states (for styling column drop zones)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpenDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch all processes
  const fetchProcesses = async () => {
    try {
      const user = localStorage.getItem("logged_in_user") || "";
      const res = await fetch(getApiUrl(`/api/processes?usuario=${encodeURIComponent(user)}`));
      if (res.ok) {
        const data = await res.json();
        setProcesses(data);
        
        // Select all by default if no selection exists
        const saved = localStorage.getItem("kanban_selected_process_ids");
        if (!saved && data.length > 0) {
          const allIds = data.map((p: any) => p.id);
          setSelectedProcessIds(allIds);
          localStorage.setItem("kanban_selected_process_ids", JSON.stringify(allIds));
        } else if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              const allIds = data.map((p: any) => p.id);
              const newIds = allIds.filter((id: number) => !parsed.includes(id));
              if (newIds.length > 0) {
                const updated = [...parsed, ...newIds];
                setSelectedProcessIds(updated);
                localStorage.setItem("kanban_selected_process_ids", JSON.stringify(updated));
              } else {
                setSelectedProcessIds(parsed);
              }
            }
          } catch (e) {
            console.error("Erro ao processar localstorage em kanban:", e);
          }
        }
      }
    } catch (err) {
      console.error("Erro ao buscar processos:", err);
    }
  };

  // Load state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("kanban_selected_process_ids");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSelectedProcessIds(parsed);
        }
      } catch (e) {
        console.error("Erro ao ler localStorage:", e);
      }
    }
    setIsLoaded(true);
    fetchProcesses();
  }, []);

  // Toggle process selection in multi-select
  const handleToggleProcess = (id: number) => {
    let newSelection;
    if (selectedProcessIds.includes(id)) {
      newSelection = selectedProcessIds.filter(pid => pid !== id);
    } else {
      newSelection = [...selectedProcessIds, id];
    }
    setSelectedProcessIds(newSelection);
    localStorage.setItem("kanban_selected_process_ids", JSON.stringify(newSelection));
  };

  // Drag and Drop implementation
  const handleDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData("processId", id.toString());
  };

  const handleDragOver = (e: React.DragEvent, columnStatus: string) => {
    e.preventDefault();
    setDragOverCol(columnStatus);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverCol(null);
    const processIdStr = e.dataTransfer.getData("processId");
    if (!processIdStr) return;
    
    const processId = parseInt(processIdStr);
    
    // Update local state instantly (Optimistic UI)
    setProcesses(prev => prev.map(p => p.id === processId ? { ...p, status: targetStatus } : p));

    try {
      const res = await fetch(getApiUrl(`/api/processes/${processId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus })
      });
      if (!res.ok) {
        fetchProcesses(); // rollback if error
      }
    } catch (err) {
      console.error("Erro ao arrastar processo:", err);
      fetchProcesses();
    }
  };

  // Delete process
  const handleDeleteProcess = async (id: number) => {
    if (!confirm("Deseja realmente remover este processo do escritório?")) return;
    try {
      const res = await fetch(getApiUrl(`/api/processes/${id}`), {
        method: "DELETE"
      });
      if (res.ok) {
        setSelectedProcessIds(prev => prev.filter(pid => pid !== id));
        fetchProcesses();
      }
    } catch (err) {
      console.error("Erro ao deletar processo:", err);
    }
  };

  // Open Edit Modal
  const openEditModal = (p: Processo) => {
    setEditingProcessId(p.id);
    setResumoInput(p.resumo || "");
    setDataLimiteInput(p.data_limite_estimada || "");
    setStatusInput(p.status || "todo");
    setIsModalOpen(true);
  };

  const handleUpdateProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProcessId) return;

    const payload = {
      resumo: resumoInput,
      data_limite_estimada: dataLimiteInput,
      status: statusInput
    };

    try {
      const res = await fetch(getApiUrl(`/api/processes/${editingProcessId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsModalOpen(false);
        setEditingProcessId(null);
        setResumoInput("");
        setDataLimiteInput("");
        setStatusInput("todo");
        fetchProcesses();
      }
    } catch (err) {
      console.error("Erro ao atualizar processo:", err);
    }
  };

  const resetForm = () => {
    setEditingProcessId(null);
    setResumoInput("");
    setDataLimiteInput("");
    setStatusInput("todo");
  };

  // Kanban Columns config
  const columns = [
    { id: "todo", title: "A Fazer", color: "border-blue-500", bg: "bg-blue-500/10 text-blue-400" },
    { id: "in_progress", title: "Em Andamento", color: "border-amber-500", bg: "bg-amber-500/10 text-amber-400" },
    { id: "blocked", title: "Bloqueado", color: "border-rose-500", bg: "bg-rose-500/10 text-rose-400" },
    { id: "done", title: "Concluído", color: "border-emerald-500", bg: "bg-emerald-500/10 text-emerald-400" }
  ];

  return (
    <div className="p-8 space-y-8 animate-fade-in flex flex-col h-screen overflow-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-5 flex-shrink-0">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            Kanban de Processos
          </h2>
          <p className="text-slate-400 text-sm mt-1">Gerencie os processos do escritório de forma visual, controlando resumos e prazos limites.</p>
        </div>
      </div>

      {/* Selector & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex-shrink-0">
        
        {/* Multi-select processes selector */}
        <div className="flex-1 max-w-xl relative" ref={dropdownRef}>
          <label className="text-slate-400 text-xxs font-bold uppercase tracking-wider block mb-1.5">Filtrar Processos no Quadro</label>
          
          <button
            type="button"
            onClick={() => setIsOpenDropdown(!isOpenDropdown)}
            className="w-full bg-slate-950 border border-slate-800 hover:border-slate-750 text-slate-350 hover:text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between gap-2 transition-all"
          >
            <div className="flex items-center gap-2 truncate">
              <Briefcase className="h-4.5 w-4.5 text-indigo-500" />
              <span className="truncate">
                {selectedProcessIds.length === 0 
                  ? "Selecione processos..." 
                  : `${selectedProcessIds.length} processo(s) selecionado(s)`
                }
              </span>
            </div>
            <ChevronDown className="h-4.5 w-4.5 text-slate-500" />
          </button>

          {/* Checklist Dropdown Panel */}
          {isOpenDropdown && (
            <div className="absolute left-0 mt-2 w-full bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-2 max-h-80 overflow-y-auto space-y-1">
              <div className="px-3 py-1.5 border-b border-slate-800 mb-2 flex items-center justify-between">
                <span className="text-xxs font-bold text-slate-500 uppercase tracking-widest">Selecione os Processos</span>
                <div className="flex gap-2.5">
                  {processes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = processes.map(p => p.id);
                        setSelectedProcessIds(allIds);
                        localStorage.setItem("kanban_selected_process_ids", JSON.stringify(allIds));
                      }}
                      className="text-xxs text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
                    >
                      Selecionar Todos
                    </button>
                  )}
                  {selectedProcessIds.length > 0 && (
                    <button 
                      type="button"
                      onClick={() => { setSelectedProcessIds([]); localStorage.setItem("kanban_selected_process_ids", JSON.stringify([])); }} 
                      className="text-xxs text-rose-400 hover:text-rose-350 font-bold transition-colors"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
              
              {processes.length === 0 ? (
                <p className="text-slate-500 text-xs italic p-3 text-center">Nenhum processo cadastrado.</p>
              ) : (
                processes.map((p) => {
                  const isChecked = selectedProcessIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleToggleProcess(p.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                        isChecked ? "bg-indigo-600/10 text-white font-medium" : "hover:bg-slate-850 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {isChecked ? <CheckSquare className="h-4 w-4 text-indigo-500" /> : <Square className="h-4 w-4 text-slate-600" />}
                      <div className="min-w-0">
                        <p className="font-mono truncate">{p.mascara}</p>
                        <p className="text-xxs text-slate-500 truncate">{p.cliente_nome || p.cliente || "Sem parte"}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 overflow-hidden">
        {selectedProcessIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 bg-slate-900 border border-slate-800 rounded-2xl p-8">
            <Info className="h-10 w-10 text-slate-500 mb-3 animate-pulse" />
            <p className="text-slate-400 text-sm font-semibold">Nenhum processo selecionado para exibição do Kanban.</p>
            <p className="text-slate-500 text-xs mt-1">Utilize o seletor acima para escolher os processos e visualizar suas colunas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 h-full pb-8">
            {columns.map((col) => {
              const colProcesses = processes.filter(p => selectedProcessIds.includes(p.id) && (p.status || "todo") === col.id);
              const isOver = dragOverCol === col.id;
              
              return (
                <div 
                  key={col.id}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={`bg-slate-900 border ${isOver ? "border-indigo-600 bg-slate-850/50" : "border-slate-800"} rounded-2xl p-4 flex flex-col h-full max-h-[calc(100vh-320px)] transition-all duration-200`}
                >
                  
                  {/* Column Header */}
                  <div className={`border-b-2 ${col.color} pb-3 mb-4 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xxs px-2.5 py-0.5 rounded-full font-bold uppercase ${col.bg}`}>
                        {col.title}
                      </span>
                    </div>
                    <span className="bg-slate-950 border border-slate-800 text-slate-400 font-extrabold px-2 py-0.5 rounded-full text-xxs">
                      {colProcesses.length}
                    </span>
                  </div>

                  {/* Processes Cards List */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {colProcesses.length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xxs italic">
                        Sem processos nesta coluna
                      </div>
                    ) : (
                      colProcesses.map((p) => (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, p.id)}
                          className="bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900/60 rounded-xl p-4 shadow-md cursor-grab active:cursor-grabbing transition-all duration-150 relative group"
                        >
                          {/* Quick delete/edit on card */}
                          <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => openEditModal(p)} 
                              className="text-slate-500 hover:text-indigo-400 transition-colors"
                              title="Editar"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteProcess(p.id)} 
                              className="text-slate-500 hover:text-rose-400 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Process CNJ Number in bold */}
                          <h4 className="font-extrabold text-sm text-white pr-10 leading-snug break-words font-mono">
                            {p.mascara}
                          </h4>
                          
                          {/* Client Name */}
                          <p className="text-xxs text-slate-500 font-semibold mt-1 truncate">
                            {p.cliente_nome || p.cliente || "Parte não informada"}
                          </p>

                          {/* Expiration Date - Prominent badge */}
                          <div className="mt-2.5 flex items-center gap-1 text-xxs font-mono font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded w-max">
                            <Calendar className="h-3 w-3" />
                            <span>Prazo Limite: {p.data_limite_estimada || "N/A"}</span>
                          </div>

                          {/* Small Process Summary */}
                          {p.resumo && (
                            <p className="text-slate-400 text-xxs leading-relaxed mt-2.5 line-clamp-3 break-words font-medium border-t border-slate-900/80 pt-2">
                              {p.resumo}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Process Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-fade-in">
            
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <LayoutGrid className="h-5.5 w-5.5 text-indigo-500" />
                <span>Editar Detalhes do Processo</span>
              </h3>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProcess} className="space-y-4">
              
              {/* Process Mask & Client Info (Read only) */}
              <div className="grid grid-cols-2 gap-4 bg-slate-950 border border-slate-850 p-3 rounded-xl">
                <div>
                  <span className="text-slate-500 text-xxs font-bold uppercase tracking-wider block">Processo CNJ</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {processes.find(p => p.id === editingProcessId)?.mascara || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-xxs font-bold uppercase tracking-wider block">Cliente</span>
                  <span className="text-xs text-white truncate block">
                    {processes.find(p => p.id === editingProcessId)?.cliente_nome || processes.find(p => p.id === editingProcessId)?.cliente || "N/A"}
                  </span>
                </div>
              </div>

              {/* Expiration Date */}
              <div>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Prazo Limite Estimado</label>
                <input
                  type="text"
                  value={dataLimiteInput}
                  onChange={(e) => setDataLimiteInput(e.target.value)}
                  placeholder="Ex: 15-08-2026, N/A, etc."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Status select */}
              <div>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Status no Kanban</label>
                <select
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-350 focus:outline-none focus:border-indigo-500"
                >
                  <option value="todo">A Fazer</option>
                  <option value="in_progress">Em Andamento</option>
                  <option value="blocked">Bloqueado</option>
                  <option value="done">Concluído</option>
                </select>
              </div>

              {/* Summary */}
              <div>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Resumo do Processo / Prazos</label>
                <textarea
                  value={resumoInput}
                  onChange={(e) => setResumoInput(e.target.value)}
                  placeholder="Insira um pequeno resumo ou os prazos pendentes deste processo..."
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); resetForm(); }}
                  className="flex-1 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-350 font-bold py-2.5 rounded-xl text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-750 text-white font-bold py-2.5 rounded-xl text-sm transition-colors shadow-lg shadow-indigo-600/15"
                >
                  Salvar Alterações
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
