"use client";

import React, { useState, useEffect } from "react";
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  Clock, Edit, Info, LayoutGrid, X, Briefcase, Plus 
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

export default function AgendaPage() {
  const [processes, setProcesses] = useState<Processo[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"month" | "day" | "year">("month");
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"edit" | "assign">("edit");
  const [editingProcessId, setEditingProcessId] = useState<number | null>(null);
  const [resumoInput, setResumoInput] = useState("");
  const [dataLimiteInput, setDataLimiteInput] = useState("");
  const [statusInput, setStatusInput] = useState("todo");

  const fetchProcesses = async () => {
    try {
      const user = localStorage.getItem("logged_in_user") || "";
      const res = await fetch(getApiUrl(`/api/processes?usuario=${encodeURIComponent(user)}`));
      if (res.ok) {
        const data = await res.json();
        setProcesses(data);
      }
    } catch (err) {
      console.error("Erro ao buscar processos para agenda:", err);
    }
  };

  useEffect(() => {
    fetchProcesses();
  }, []);

  // Parse custom process dates into Date objects safely
  const parseProcessDate = (dateStr?: string) => {
    if (!dateStr) return null;
    
    // Normalizes divider
    const cleanStr = dateStr.trim().replace(/\//g, "-");
    const parts = cleanStr.split("-");
    if (parts.length === 3) {
      const p0 = parseInt(parts[0]);
      const p1 = parseInt(parts[1]) - 1; // Month is 0-indexed
      const p2 = parseInt(parts[2]);
      
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        return new Date(p0, p1, p2);
      } else {
        // DD-MM-YYYY
        return new Date(p2, p1, p0);
      }
    }
    return null;
  };

  // Helper to format Date back to DD-MM-YYYY
  const formatDateToDMY = (date: Date) => {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  };

  // Get processes scheduled for a specific date
  const getProcessesForDate = (date: Date) => {
    return processes.filter(p => {
      const pDate = parseProcessDate(p.data_limite_estimada);
      if (!pDate) return false;
      return (
        pDate.getDate() === date.getDate() &&
        pDate.getMonth() === date.getMonth() &&
        pDate.getFullYear() === date.getFullYear()
      );
    });
  };

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (viewMode === "day") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1));
    } else if (viewMode === "year") {
      setCurrentDate(new Date(currentDate.getFullYear() - 1, 0, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (viewMode === "day") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1));
    } else if (viewMode === "year") {
      setCurrentDate(new Date(currentDate.getFullYear() + 1, 0, 1));
    }
  };

  // Modal open for existing process edit
  const openEditModal = (p: Processo) => {
    setEditingProcessId(p.id);
    setResumoInput(p.resumo || "");
    setDataLimiteInput(p.data_limite_estimada || "");
    setStatusInput(p.status || "todo");
    setModalMode("edit");
    setIsModalOpen(true);
  };

  // Modal open for assigning a process to a selected date
  const openAssignModal = (day: Date) => {
    setEditingProcessId(null);
    setResumoInput("");
    setDataLimiteInput(formatDateToDMY(day));
    setStatusInput("todo");
    setModalMode("assign");
    setIsModalOpen(true);
  };

  // Save changes
  const handleUpdateProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProcessId) {
      alert("Por favor, selecione um processo para associar o prazo.");
      return;
    }

    try {
      const res = await fetch(getApiUrl(`/api/processes/${editingProcessId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumo: resumoInput,
          data_limite_estimada: dataLimiteInput,
          status: statusInput
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setEditingProcessId(null);
        fetchProcesses();
      }
    } catch (err) {
      console.error("Erro ao atualizar processo da agenda:", err);
    }
  };

  // Month rendering calculation helper
  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days = [];
    
    // Fill prefix empty slots from previous month
    const startDayOfWeek = date.getDay();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, new Date(year, month, 0).getDate() - i));
    }
    
    // Fill current month days
    const totalDays = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i));
    }
    
    // Fill suffix slots to complete a 6-row grid
    const totalSlots = 42;
    const suffixSlotsCount = totalSlots - days.length;
    for (let i = 1; i <= suffixSlotsCount; i++) {
      days.push(new Date(year, month + 1, i));
    }
    
    return days;
  };

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const weekdayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // ==========================================
  // RENDER SUB-VIEWS
  // ==========================================

  // Year View: 12 months grid
  const renderYearView = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto flex-1 pb-8">
        {monthNames.map((name, idx) => {
          const monthDays = getDaysInMonth(currentDate.getFullYear(), idx);
          return (
            <div 
              key={name}
              onClick={() => {
                setCurrentDate(new Date(currentDate.getFullYear(), idx, 1));
                setViewMode("month");
              }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-indigo-500/40 cursor-pointer transition-all duration-200 hover:scale-[1.01] flex flex-col h-[295px]"
            >
              <h4 className="text-white font-extrabold text-sm border-b border-slate-800 pb-2 mb-2 flex items-center justify-between">
                <span>{name}</span>
                <span className="text-xxs font-mono text-slate-550 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {processes.filter(p => {
                    const pDate = parseProcessDate(p.data_limite_estimada);
                    return pDate && pDate.getMonth() === idx && pDate.getFullYear() === currentDate.getFullYear();
                  }).length} prazos
                </span>
              </h4>
              
              <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-slate-500 mb-1">
                {weekdayNames.map(w => <div key={w}>{w[0]}</div>)}
              </div>
              
              <div className="grid grid-cols-7 gap-1 text-center flex-1">
                {monthDays.map((day, dIdx) => {
                  const isCurrentMonth = day.getMonth() === idx;
                  
                  if (!isCurrentMonth) {
                    return (
                      <div key={dIdx} className="py-1" />
                    );
                  }
                  
                  const dayProcs = getProcessesForDate(day);
                  const isToday = day.getDate() === new Date().getDate() && day.getMonth() === new Date().getMonth() && day.getFullYear() === new Date().getFullYear();
                  
                  return (
                    <div 
                      key={dIdx}
                      className={`py-1 rounded text-xxs font-semibold flex flex-col items-center justify-center relative ${
                        isToday ? "bg-indigo-650/20 text-white border border-indigo-500/20" : "text-slate-300"
                      } ${dayProcs.length > 0 ? "year-day-expired shadow-sm" : ""}`}
                    >
                      {day.getDate()}
                      {dayProcs.length > 0 && (
                        <div className="absolute bottom-0.5 w-1 h-1 bg-slate-900 rounded-full" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Month View: Full day grid
  const renderMonthView = () => {
    const days = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    
    return (
      <div className="flex flex-col flex-1 border border-slate-800 rounded-2xl overflow-hidden bg-slate-900 shadow-2xl min-h-[500px]">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-slate-950/40 border-b border-slate-800 text-center py-3 text-xxs font-bold uppercase tracking-widest text-slate-505">
          {weekdayNames.map(w => (
            <div key={w} className="flex-1">{w}</div>
          ))}
        </div>
        
        {/* Days grid */}
        <div className="grid grid-cols-7 grid-rows-6 flex-1 divide-x divide-y divide-slate-800 border-l border-slate-800">
          {days.map((day, idx) => {
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const dayProcs = getProcessesForDate(day);
            const isToday = day.getDate() === new Date().getDate() && day.getMonth() === new Date().getMonth() && day.getFullYear() === new Date().getFullYear();
            
            return (
              <div 
                key={idx}
                onClick={() => {
                  setCurrentDate(day);
                  setViewMode("day");
                }}
                className={`p-2 flex flex-col justify-between group cursor-pointer transition-colors duration-150 min-h-[90px] ${
                  isCurrentMonth ? "bg-slate-900/40" : "bg-slate-950/15"
                } ${isToday ? "bg-indigo-600/5" : ""} hover:bg-slate-850/50`}
              >
                {/* Day Indicator */}
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                    isToday 
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/10" 
                      : isCurrentMonth 
                      ? "text-slate-205" 
                      : "text-slate-600"
                  }`}>
                    {day.getDate()}
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    {/* Hover Plus Button to add deadline */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openAssignModal(day);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-md transition-all"
                      title="Vincular prazo a este dia"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    
                    {dayProcs.length > 0 && (
                      <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded">
                        {dayProcs.length}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Day events content */}
                <div className="flex-1 space-y-1 mt-2 max-h-[80px] overflow-y-auto pr-1">
                  {dayProcs.slice(0, 3).map((p) => (
                    <div
                      key={p.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(p);
                      }}
                      className="p-1 bg-slate-950 border border-slate-855 hover:border-slate-750 rounded text-[9px] font-medium transition-colors flex flex-col gap-0.5 text-left"
                    >
                      <span className="text-indigo-400 font-mono font-bold truncate block">{p.mascara}</span>
                      {p.resumo && <span className="text-slate-400 truncate block">{p.resumo}</span>}
                    </div>
                  ))}
                  {dayProcs.length > 3 && (
                    <div className="text-xxxs text-slate-500 font-bold text-center">
                      + {dayProcs.length - 3} prazos
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Day / Hours View: Hourly Breakdown
  const renderDayView = () => {
    const dayProcs = getProcessesForDate(currentDate);
    // Hours breakdown 08:00 to 18:00
    const hours = Array.from({ length: 11 }, (_, i) => i + 8);
    
    return (
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-8 pb-8 h-full">
        {/* Left Side: Schedule Timeline */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col h-full overflow-y-auto max-h-[calc(100vh-280px)]">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-5 flex items-center justify-between">
            <span>Quadro Horário do Dia</span>
            <span className="text-xxs font-mono text-slate-450">{formatDateToDMY(currentDate)}</span>
          </h3>
          
          <div className="space-y-4 divide-y divide-slate-850">
            {hours.map((hour) => {
              const matchedProc = dayProcs[hour - 8];
              
              return (
                <div key={hour} className="flex gap-4 pt-4 first:pt-0">
                  <div className="w-16 flex items-center justify-center text-slate-400 font-mono font-bold text-xs bg-slate-950 border border-slate-800 rounded-lg p-1.5 h-max">
                    <Clock className="h-3.5 w-3.5 mr-1 text-indigo-500" />
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  
                  <div className="flex-1 text-left">
                    {matchedProc ? (
                      <div 
                        onClick={() => openEditModal(matchedProc)}
                        className="bg-slate-950 border border-slate-855 hover:border-slate-750 hover:bg-slate-900/60 p-4 rounded-xl shadow-md cursor-pointer transition-all duration-150 relative group animate-fade-in"
                      >
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit className="h-3.5 w-3.5 text-slate-505 hover:text-indigo-400" />
                        </div>
                        <h4 className="font-extrabold text-xs text-indigo-400 font-mono">{matchedProc.mascara}</h4>
                        <p className="text-xxs text-slate-500 mt-0.5 font-bold">{matchedProc.cliente_nome || matchedProc.cliente}</p>
                        {matchedProc.resumo && (
                          <p className="text-slate-450 text-xxs mt-2 border-t border-slate-900/80 pt-2 font-medium leading-relaxed">
                            {matchedProc.resumo}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div 
                        onClick={() => openAssignModal(currentDate)}
                        className="h-[64px] border border-dashed border-slate-850 hover:border-slate-750 rounded-xl flex items-center justify-center text-slate-600 hover:text-indigo-400 cursor-pointer text-xxs italic group transition-all"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5 opacity-0 group-hover:opacity-100 transition-all" />
                        Vincular prazo a este horário
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Right Side: Deadlines Detail Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl h-max text-left">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
            Prazos Fatais Deste Dia ({dayProcs.length})
          </h3>
          
          {dayProcs.length === 0 ? (
            <div className="text-center py-12 text-slate-550 text-xs italic">
              Nenhum prazo com expiração marcada para este dia.
            </div>
          ) : (
            <div className="space-y-4">
              {dayProcs.map((p) => (
                <div 
                  key={p.id}
                  onClick={() => openEditModal(p)}
                  className="bg-slate-950 border border-slate-855 p-4 rounded-xl space-y-2 hover:border-slate-750 cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-indigo-400 font-mono font-bold text-xs">{p.mascara}</span>
                    <span className="text-xxs font-bold text-slate-400 uppercase tracking-widest">{p.status === "done" ? "Concluído" : "Pendente"}</span>
                  </div>
                  <p className="text-xxs font-bold text-slate-500">{p.cliente_nome || p.cliente}</p>
                  {p.resumo && <p className="text-slate-450 text-xxs leading-relaxed font-medium mt-1">{p.resumo}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in flex flex-col min-h-full overflow-y-auto max-w-full">

      
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-5 gap-4 flex-shrink-0">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <CalendarIcon className="h-8 w-8 text-indigo-500" /> Agenda de Prazos
          </h2>
          <p className="text-slate-400 text-sm mt-1">Monitore e edite prazos limites e resumos identificados por IA de forma cronológica.</p>
        </div>

        {/* View Segmented Selector */}
        <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl h-max w-max">
          <button 
            onClick={() => setViewMode("day")} 
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === "day" ? "bg-indigo-600 text-white" : "text-slate-450 hover:text-white"
            }`}
          >
            Dia / Horas
          </button>
          <button 
            onClick={() => setViewMode("month")} 
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === "month" ? "bg-indigo-600 text-white" : "text-slate-450 hover:text-white"
            }`}
          >
            Mês
          </button>
          <button 
            onClick={() => setViewMode("year")} 
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === "year" ? "bg-indigo-600 text-white" : "text-slate-450 hover:text-white"
            }`}
          >
            Ano
          </button>
        </div>
      </div>

      {/* Calendar Navigation Panel */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex-shrink-0">
        <div className="flex items-center gap-2">
          <button 
            onClick={handlePrev}
            className="p-2 bg-slate-950 border border-slate-800 hover:border-slate-750 text-slate-400 hover:text-white rounded-xl transition-all"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </button>
          <button 
            onClick={() => setCurrentDate(new Date(2026, 6, 11))} // Back to E2E Anchor date
            className="px-3.5 py-2 bg-slate-950 border border-slate-800 hover:border-slate-750 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
          >
            Hoje
          </button>
          <button 
            onClick={handleNext}
            className="p-2 bg-slate-950 border border-slate-800 hover:border-slate-750 text-slate-400 hover:text-white rounded-xl transition-all"
          >
            <ChevronRight className="h-4.5 w-4.5" />
          </button>
        </div>
        
        <h3 className="text-white text-lg font-extrabold tracking-tight font-display">
          {viewMode === "month" && `${monthNames[currentDate.getMonth()]} de ${currentDate.getFullYear()}`}
          {viewMode === "day" && `${currentDate.getDate()} de ${monthNames[currentDate.getMonth()]} de ${currentDate.getFullYear()}`}
          {viewMode === "year" && `Ano ${currentDate.getFullYear()}`}
        </h3>
        
        <div className="w-[120px]" /> {/* Spacer for symmetry */}
      </div>

      {/* Main Grid Viewport */}
      {viewMode === "month" && renderMonthView()}
      {viewMode === "day" && renderDayView()}
      {viewMode === "year" && renderYearView()}

      {/* Process Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-fade-in text-left">
            
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <LayoutGrid className="h-5.5 w-5.5 text-indigo-500" />
                <span>{modalMode === "edit" ? "Editar Detalhes do Processo" : "Vincular Prazo a Processo"}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProcess} className="space-y-4">
              
              {/* If Assign mode: select process dropdown. If Edit mode: read-only process info */}
              {modalMode === "assign" ? (
                <div>
                  <label className="text-slate-450 text-xs font-bold uppercase tracking-wider block mb-1">Selecionar Processo *</label>
                  <select
                    value={editingProcessId || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        const pid = Number(val);
                        setEditingProcessId(pid);
                        const found = processes.find(p => p.id === pid);
                        if (found) {
                          setResumoInput(found.resumo || "");
                          setStatusInput(found.status || "todo");
                        }
                      } else {
                        setEditingProcessId(null);
                        setResumoInput("");
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-350 focus:outline-none focus:border-indigo-500"
                    required
                  >
                    <option value="">Selecione o processo...</option>
                    {processes.map(p => (
                      <option key={p.id} value={p.id}>{p.mascara} ({p.cliente_nome || p.cliente || "Sem parte"})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 bg-slate-950 border border-slate-850 p-3 rounded-xl">
                  <div>
                    <span className="text-slate-550 text-xxs font-bold uppercase tracking-wider block">Processo CNJ</span>
                    <span className="text-xs font-mono font-bold text-white">
                      {processes.find(p => p.id === editingProcessId)?.mascara || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-555 text-xxs font-bold uppercase tracking-wider block">Cliente</span>
                    <span className="text-xs text-white truncate block">
                      {processes.find(p => p.id === editingProcessId)?.cliente_nome || processes.find(p => p.id === editingProcessId)?.cliente || "N/A"}
                    </span>
                  </div>
                </div>
              )}

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
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-350 font-bold py-2.5 rounded-xl text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-750 text-white font-bold py-2.5 rounded-xl text-sm transition-colors shadow-lg shadow-indigo-600/15"
                >
                  {modalMode === "edit" ? "Salvar Alterações" : "Salvar e Associar"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
