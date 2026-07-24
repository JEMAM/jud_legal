"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search, Brain, Calendar, ArrowRight, CheckSquare, Square,
  Copy, FileText, CheckCircle2, ChevronRight, Sparkles, AlertCircle, Info, Lock,
  Briefcase, ChevronDown
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getApiUrl } from "@/lib/api";
import { cleanPublicationText } from "@/lib/htmlUtils";

interface ProcessoDropdown {
  id: number;
  mascara: string;
  cliente: string;
}

interface Publicacao {
  linha: number;
  processo_cnj: string;
  tribunal: string;
  tipo: string;
  data_disp: string;
  destinatarios: string;
  conteudo_resumo: string;
  conteudo_completo: string;
}

interface PrazoDetectado {
  data: string;
  hora: string;
  descricao: string;
}

const PROVIDER_MODELS: Record<string, string[]> = {
  Gemini: ["gemini-3.5-flash", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
  Anthropic: ["claude-opus-4.8", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
  ChatGPT: ["gpt-5.6", "gpt-4o", "gpt-4o-mini", "o3-mini", "o1-preview"],
  Ollama: ["gemma4:12b", "gemma2:9b", "llama3.2", "llama3.3:latest", "qwen2.5-coder"],
  Groq: ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "gemma2-9b-it"]
};

export default function TriagemPage() {
  const [processesList, setProcessesList] = useState<ProcessoDropdown[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpenMonitorDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search Params State
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [numProc, setNumProc] = useState("");
  const [tribunal, setTribunal] = useState("TODOS");
  const [nomeParte, setNomeParte] = useState("");
  const [numOab, setNumOab] = useState("");
  const [estadoOab, setEstadoOab] = useState("");
  const [pagina, setPagina] = useState(1);
  const [itensPagina, setItensPagina] = useState(50);
  const [apenasMonitorados, setApenasMonitorados] = useState(false);
  const [processoSelecionadoId, setProcessoSelecionadoId] = useState<string>("Nenhum");
  const [selectedMonitorProcessIds, setSelectedMonitorProcessIds] = useState<number[]>([]);
  const [isOpenMonitorDropdown, setIsOpenMonitorDropdown] = useState<boolean>(false);

  // Search Results
  const [results, setResults] = useState<Publicacao[]>([]);
  const [searchStatus, setSearchStatus] = useState("");
  const [searching, setSearching] = useState(false);

  // Row Selection (checks)
  const [selectedLines, setSelectedLines] = useState<number[]>([]);

  // Destaque de Termo
  const [termoBusca, setTermoBusca] = useState("");

  // AI Config State
  const [provedor, setProvedor] = useState("Ollama");
  const [modeloId, setModeloId] = useState("llama3.1");
  const [apiKeyOrHost, setApiKeyOrHost] = useState("http://localhost:11434");
  const [teseDefesa, setTeseDefesa] = useState("");

  // AI Execution Results
  const [runningAI, setRunningAI] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [aiError, setAiError] = useState("");
  const [prazosMarkdown, setPrazosMarkdown] = useState("");
  const [minutaMarkdown, setMinutaMarkdown] = useState("");
  const [agendaJson, setAgendaJson] = useState("");
  const [prazosDetectados, setPrazosDetectados] = useState<PrazoDetectado[]>([]);

  // Tabs for AI results
  const [activeAiTab, setActiveAiTab] = useState<"prazos" | "minuta" | "sugestoes">("prazos");

  // Copy to clipboard notification
  const [copied, setCopied] = useState(false);

  // Quick-action scheduling feedback
  const [quickActionNotif, setQuickActionNotif] = useState<{ index: number; success: boolean; msg: string } | null>(null);

  const [shouldResumeAI, setShouldResumeAI] = useState(false);
  const [aiTaskId, setAiTaskId] = useState<string | null>(null);
  const [aiProgress, setAiProgress] = useState(0);

  // Load state from localStorage on mount and fetch processes
  useEffect(() => {
    // 1. Load dates
    const savedDataIni = localStorage.getItem("triagem_dataIni");
    if (savedDataIni) setDataIni(savedDataIni);
    else {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      setDataIni(fiveDaysAgo.toISOString().split("T")[0]);
    }

    const savedDataFim = localStorage.getItem("triagem_dataFim");
    if (savedDataFim) setDataFim(savedDataFim);
    else {
      setDataFim(new Date().toISOString().split("T")[0]);
    }

    // 2. Load other params
    const savedNumProc = localStorage.getItem("triagem_numProc");
    if (savedNumProc !== null) setNumProc(savedNumProc);

    const savedTribunal = localStorage.getItem("triagem_tribunal");
    if (savedTribunal !== null) setTribunal(savedTribunal);

    const savedNomeParte = localStorage.getItem("triagem_nomeParte");
    if (savedNomeParte !== null) setNomeParte(savedNomeParte);

    const savedNumOab = localStorage.getItem("triagem_numOab");
    if (savedNumOab !== null) setNumOab(savedNumOab);

    const savedEstadoOab = localStorage.getItem("triagem_estadoOab");
    if (savedEstadoOab !== null) setEstadoOab(savedEstadoOab);

    const savedApenasMonitorados = localStorage.getItem("triagem_apenasMonitorados");
    if (savedApenasMonitorados !== null) setApenasMonitorados(savedApenasMonitorados === "true");

    const savedProcessoSelecionadoId = localStorage.getItem("triagem_processoSelecionadoId");
    if (savedProcessoSelecionadoId !== null) setProcessoSelecionadoId(savedProcessoSelecionadoId);

    const savedProvedor = localStorage.getItem("triagem_provedor");
    if (savedProvedor !== null) setProvedor(savedProvedor);

    const savedModeloId = localStorage.getItem("triagem_modeloId");
    if (savedModeloId !== null) setModeloId(savedModeloId);

    // Remove API key from persistent localStorage and use sessionStorage for session-only retention
    localStorage.removeItem("triagem_apiKeyOrHost");
    const savedApiKeyOrHost = sessionStorage.getItem("triagem_apiKeyOrHost");
    if (savedApiKeyOrHost !== null) setApiKeyOrHost(savedApiKeyOrHost);

    // Load search results
    const savedResults = localStorage.getItem("triagem_results");
    if (savedResults) {
      try {
        const parsed = JSON.parse(savedResults);
        const sanitized = (parsed || []).map((r: Publicacao) => ({
          ...r,
          conteudo_resumo: cleanPublicationText(r.conteudo_resumo),
          conteudo_completo: cleanPublicationText(r.conteudo_completo)
        }));
        setResults(sanitized);
      } catch (e) {
        console.error("Erro ao ler triagem_results:", e);
      }
    }

    const savedSearchStatus = localStorage.getItem("triagem_searchStatus");
    if (savedSearchStatus) setSearchStatus(savedSearchStatus);

    const savedSelectedLines = localStorage.getItem("triagem_selectedLines");
    if (savedSelectedLines) {
      try {
        setSelectedLines(JSON.parse(savedSelectedLines));
      } catch (e) {
        console.error("Erro ao ler triagem_selectedLines:", e);
      }
    }

    const savedTermoBusca = localStorage.getItem("triagem_termoBusca");
    if (savedTermoBusca) setTermoBusca(savedTermoBusca);

    const savedMonitorProcessIds = localStorage.getItem("triagem_selected_monitor_process_ids");
    if (savedMonitorProcessIds) {
      try {
        setSelectedMonitorProcessIds(JSON.parse(savedMonitorProcessIds));
      } catch (e) {
        console.error("Erro ao ler triagem_selected_monitor_process_ids:", e);
      }
    }

    const savedPrazosMarkdown = localStorage.getItem("triagem_prazosMarkdown");
    if (savedPrazosMarkdown) setPrazosMarkdown(savedPrazosMarkdown);

    const savedMinutaMarkdown = localStorage.getItem("triagem_minutaMarkdown");
    if (savedMinutaMarkdown) setMinutaMarkdown(savedMinutaMarkdown);

    const savedAgendaJson = localStorage.getItem("triagem_agendaJson");
    if (savedAgendaJson) setAgendaJson(savedAgendaJson);

    const savedPrazosDetectados = localStorage.getItem("triagem_prazosDetectados");
    if (savedPrazosDetectados) {
      try {
        setPrazosDetectados(JSON.parse(savedPrazosDetectados));
      } catch (e) {
        console.error("Erro ao ler triagem_prazosDetectados:", e);
      }
    }

    const savedActiveAiTab = localStorage.getItem("triagem_activeAiTab");
    if (savedActiveAiTab === "prazos" || savedActiveAiTab === "minuta" || savedActiveAiTab === "sugestoes") {
      setActiveAiTab(savedActiveAiTab as any);
    }

    const savedRunningAI = localStorage.getItem("triagem_runningAI");
    const savedTaskId = localStorage.getItem("triagem_taskId");
    if (savedRunningAI === "true" && savedTaskId) {
      setAiTaskId(savedTaskId);
      setShouldResumeAI(true);
    } else if (savedRunningAI === "true") {
      // Fallback if runningAI is true but no task_id is found
      setShouldResumeAI(true);
    }

    setIsLoaded(true);

    // Load processes for dropdown
    const loadProcesses = async () => {
      try {
        const user = localStorage.getItem("logged_in_user") || "";
        const res = await fetch(getApiUrl(`/api/processes?usuario=${encodeURIComponent(user)}`));
        if (res.ok) {
          const data = await res.json();
          setProcessesList(data);
        }
      } catch (err) {
        console.error("Erro ao carregar processos:", err);
      }
    };
    loadProcesses();
  }, []);

  // Save state to localStorage on changes
  useEffect(() => {
    if (!isLoaded) return;

    if (dataIni) localStorage.setItem("triagem_dataIni", dataIni);
    if (dataFim) localStorage.setItem("triagem_dataFim", dataFim);
    localStorage.setItem("triagem_numProc", numProc);
    localStorage.setItem("triagem_tribunal", tribunal);
    localStorage.setItem("triagem_nomeParte", nomeParte);
    localStorage.setItem("triagem_numOab", numOab);
    localStorage.setItem("triagem_estadoOab", estadoOab);
    localStorage.setItem("triagem_apenasMonitorados", apenasMonitorados.toString());
    localStorage.setItem("triagem_processoSelecionadoId", processoSelecionadoId);
    localStorage.setItem("triagem_selected_monitor_process_ids", JSON.stringify(selectedMonitorProcessIds));
    localStorage.setItem("triagem_provedor", provedor);
    localStorage.setItem("triagem_modeloId", modeloId);
    sessionStorage.setItem("triagem_apiKeyOrHost", apiKeyOrHost);
    localStorage.setItem("triagem_teseDefesa", teseDefesa);

    localStorage.setItem("triagem_results", JSON.stringify(results));
    localStorage.setItem("triagem_searchStatus", searchStatus);
    localStorage.setItem("triagem_selectedLines", JSON.stringify(selectedLines));
    localStorage.setItem("triagem_termoBusca", termoBusca);

    localStorage.setItem("triagem_prazosMarkdown", prazosMarkdown);
    localStorage.setItem("triagem_minutaMarkdown", minutaMarkdown);
    localStorage.setItem("triagem_agendaJson", agendaJson);
    localStorage.setItem("triagem_prazosDetectados", JSON.stringify(prazosDetectados));
    localStorage.setItem("triagem_activeAiTab", activeAiTab);
    localStorage.setItem("triagem_runningAI", runningAI.toString());
  }, [
    isLoaded, dataIni, dataFim, numProc, tribunal, nomeParte, numOab,
    estadoOab, apenasMonitorados, processoSelecionadoId, selectedMonitorProcessIds, provedor,
    modeloId, apiKeyOrHost, teseDefesa,
    results, searchStatus, selectedLines, termoBusca,
    prazosMarkdown, minutaMarkdown, agendaJson, prazosDetectados, activeAiTab, runningAI
  ]);

  // Update models choices based on provider
  useEffect(() => {
    if (!isLoaded) return;

    const defaults: Record<string, { defaultVal: string; defaultCredential: string }> = {
      Gemini: { defaultVal: "gemini-3.5-flash", defaultCredential: "" },
      Anthropic: { defaultVal: "claude-opus-4.8", defaultCredential: "" },
      ChatGPT: { defaultVal: "gpt-5.6", defaultCredential: "" },
      Ollama: { defaultVal: "llama3.2", defaultCredential: "http://localhost:11434" },
      Groq: { defaultVal: "llama-3.3-70b-versatile", defaultCredential: "" }
    };

    const config = defaults[provedor];
    if (config) {
      const allowedModels = PROVIDER_MODELS[provedor] || [];
      if (!allowedModels.includes(modeloId)) {
        setModeloId(config.defaultVal);
      }
      if (provedor === "Ollama") {
        if (!apiKeyOrHost || !apiKeyOrHost.startsWith("http")) {
          setApiKeyOrHost(config.defaultCredential);
        }
      } else if (provedor !== "Ollama" && apiKeyOrHost.startsWith("http")) {
        setApiKeyOrHost("");
      }
    }
  }, [isLoaded, provedor]);

  // Execute Search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setSearchStatus("Realizando varredura na ComunicaAPI PJe...");
    setResults([]);
    setSelectedLines([]);

    // Reset AI outputs on new search
    setPrazosMarkdown("");
    setMinutaMarkdown("");
    setAgendaJson("");
    setPrazosDetectados([]);
    setAiError("");

    const payload = {
      data_ini: dataIni.split("-").reverse().join("-"), // Format standard DD-MM-YYYY
      data_fim: dataFim.split("-").reverse().join("-"),
      num_proc: numProc,
      tribunal,
      nome_part: nomeParte,
      num_oab: numOab,
      estado_oab: estadoOab,
      pagina,
      itens_pagina: itensPagina,
      apenas_monitorados: apenasMonitorados,
      processo_selecionado_id: processoSelecionadoId === "Nenhum" ? null : parseInt(processoSelecionadoId),
      selected_process_ids: apenasMonitorados ? selectedMonitorProcessIds : []
    };

    try {
      const res = await fetch(getApiUrl("/api/search-pje"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setSearchStatus(data.status);
        const sanitized = (data.results || []).map((r: Publicacao) => ({
          ...r,
          conteudo_resumo: cleanPublicationText(r.conteudo_resumo),
          conteudo_completo: cleanPublicationText(r.conteudo_completo)
        }));
        setResults(sanitized);
      } else {
        setSearchStatus("Erro ao realizar busca.");
      }
    } catch (err) {
      setSearchStatus("Falha de conexão com o backend.");
    } finally {
      setSearching(false);
    }
  };

  // Toggle selection for all rows
  const handleSelectAll = () => {
    if (selectedLines.length === results.length) {
      setSelectedLines([]);
    } else {
      setSelectedLines(results.map(r => r.linha));
    }
  };

  // Toggle selection for single row
  const toggleRow = (linha: number) => {
    if (selectedLines.includes(linha)) {
      setSelectedLines(selectedLines.filter(l => l !== linha));
    } else {
      setSelectedLines([...selectedLines, linha]);
    }
  };

  // Get selected publications content and process numbers
  const getSelectedData = () => {
    const selectedPubs = results.filter(r => selectedLines.includes(r.linha));
    const processes = Array.from(new Set(selectedPubs.map(r => r.processo_cnj))).join(", ");

    const combinedText = selectedPubs.map(r => {
      const isSecured = r.conteudo_completo?.includes("Processo sigiloso");
      const cleanText = isSecured
        ? "⚠️ CONTEÚDO BLOQUEADO: Processo corre em Segredo de Justiça."
        : cleanPublicationText(r.conteudo_completo || r.conteudo_resumo);

      return `=== PROCESSO: ${r.processo_cnj} (Linha ${r.linha}) ===\n` +
        `Tribunal: ${r.tribunal} | Data Disp: ${r.data_disp}\n` +
        `Teor da Publicação:\n${cleanText}\n`;
    }).join("\n\n");

    return { processes, combinedText };
  };

  // Render Highlighted Text
  const renderHighlightedText = (text: string) => {
    if (!text) return <p className="text-slate-500 italic">Selecione uma publicação para ler o teor completo.</p>;
    if (!termoBusca.trim()) return <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{text}</div>;

    try {
      const parts = text.split(new RegExp(`(${termoBusca.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")})`, "gi"));
      return (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
          {parts.map((part, index) =>
            part.toLowerCase() === termoBusca.toLowerCase() ? (
              <mark key={index} className="bg-amber-200 text-amber-950 px-1 py-0.5 rounded border border-amber-300 font-bold">
                {part}
              </mark>
            ) : part
          )}
        </div>
      );
    } catch (e) {
      return <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{text}</div>;
    }
  };

  const handleRunAI = async (resumeTaskId?: string | React.MouseEvent) => {
    let taskId = (typeof resumeTaskId === "string" && resumeTaskId && resumeTaskId !== "[object Object]") ? resumeTaskId : null;

    setRunningAI(true);
    setElapsedTime(0);
    setAiError("");
    setAiProgress(0);

    if (!taskId) {
      setPrazosMarkdown("");
      setMinutaMarkdown("");
      setAgendaJson("");
      setPrazosDetectados([]);
      localStorage.setItem("triagem_runningAI", "true");
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Math.round((Date.now() - startTime) / 100) / 10);
    }, 100);

    try {
      if (!taskId) {
        const { processes, combinedText } = getSelectedData();
        if (!combinedText) {
          alert("Selecione ao menos uma publicação com checkbox para analisar.");
          clearInterval(interval);
          setRunningAI(false);
          localStorage.setItem("triagem_runningAI", "false");
          return;
        }

        const payload = {
          provedor,
          modelo_id: modeloId,
          api_key_or_host: apiKeyOrHost,
          num_processo: processes,
          texto_publicacao: combinedText,
          tese_defesa: teseDefesa
        };

        const res = await fetch(getApiUrl("/api/run-agents"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json();
          setAiError(err.detail || "Erro desconhecido na execução dos agentes.");
          clearInterval(interval);
          setRunningAI(false);
          localStorage.setItem("triagem_runningAI", "false");
          return;
        }

        const data = await res.json();
        taskId = data.task_id;
        setAiTaskId(taskId);
        localStorage.setItem("triagem_taskId", taskId || "");
      }

      // Poll the status endpoint until completed or failed
      let completed = false;
      while (!completed) {
        // Wait 2 seconds before polling
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const statusRes = await fetch(getApiUrl(`/api/run-agents/status/${taskId}`));
        if (!statusRes.ok) {
          if (statusRes.status === 404) {
            localStorage.removeItem("triagem_taskId");
            localStorage.setItem("triagem_runningAI", "false");
            setAiTaskId(null);
            throw new Error("Sessão de execução expirada ou backend reiniciado. Por favor, clique em 'Ativar IA Multi-Agente' novamente.");
          }
          throw new Error("Falha ao obter status do processamento dos agentes.");
        }

        const statusData = await statusRes.json();
        setAiProgress(statusData.progress || 0);

        if (statusData.status === "completed") {
          const data = statusData.result;
          setPrazosMarkdown(data.prazos_markdown);
          setMinutaMarkdown(data.minuta_markdown);
          setAgendaJson(data.agenda_json_raw);
          setPrazosDetectados(data.prazos_detectados);
          setActiveAiTab("prazos");

          localStorage.removeItem("triagem_taskId");
          localStorage.setItem("triagem_runningAI", "false");
          setAiTaskId(null);
          completed = true;
        } else if (statusData.status === "failed") {
          setAiError(statusData.error || "Erro na execução dos agentes.");
          localStorage.removeItem("triagem_taskId");
          localStorage.setItem("triagem_runningAI", "false");
          setAiTaskId(null);
          completed = true;
        }
      }
    } catch (err: any) {
      setAiError(err.message || "Falha de conexão ao executar os agentes de IA.");
      localStorage.removeItem("triagem_taskId");
      localStorage.setItem("triagem_runningAI", "false");
      setAiTaskId(null);
    } finally {
      clearInterval(interval);
      setRunningAI(false);
    }
  };

  useEffect(() => {
    if (isLoaded && shouldResumeAI) {
      setShouldResumeAI(false);
      const taskId = localStorage.getItem("triagem_taskId");
      if (taskId && typeof taskId === "string" && taskId !== "[object Object]") {
        handleRunAI(taskId);
      } else {
        localStorage.removeItem("triagem_taskId");
        localStorage.setItem("triagem_runningAI", "false");
      }
    }
  }, [isLoaded, shouldResumeAI]);

  // Quick action: Save deadline directly in the database
  const handleQuickSaveDeadline = async (prazo: PrazoDetectado, index: number) => {
    // Tenta encontrar o processo CNJ no texto da descrição
    const match = prazo.descricao.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
    let cnj = match ? match[1] : "";

    // Se não encontrou no texto, tenta usar o processo da primeira publicação selecionada
    if (!cnj) {
      const selected = results.filter(r => selectedLines.includes(r.linha));
      if (selected.length > 0) {
        cnj = selected[0].processo_cnj;
      }
    }

    if (!cnj) {
      setQuickActionNotif({ index, success: false, msg: "Não foi possível associar a um processo CNJ." });
      return;
    }

    const user = localStorage.getItem("logged_in_user") || "";
    const payload = {
      processo_cnj: cnj,
      data_limite: prazo.data,
      resumo: prazo.descricao,
      usuario: user
    };

    try {
      const res = await fetch(getApiUrl("/api/save-deadline"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setQuickActionNotif({ index, success: true, msg: "Prazo lançado no banco!" });
      } else {
        setQuickActionNotif({ index, success: false, msg: "Erro ao atualizar banco." });
      }
    } catch (err) {
      setQuickActionNotif({ index, success: false, msg: "Conexão falhou." });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { combinedText } = getSelectedData();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 animate-fade-in max-w-full overflow-x-hidden">


      {/* Title */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            Painel de Triagem & DJE
          </h2>
          <p className="text-slate-400 text-sm mt-1">Busque publicações oficiais, filtre processos e execute a análise multi-agente de prazos.</p>
        </div>
      </div>

      {/* Main Grid: Left inputs and table, Right details and IA */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

        {/* Left Side: Parameters & Table (7 cols) */}
        <div className="xl:col-span-7 space-y-6">

          {/* Params card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Search className="h-4.5 w-4.5 text-indigo-500" /> Parâmetros de Varredura (PJe)
            </h3>

            <form onSubmit={handleSearch} className="space-y-4">

              {/* Date Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Data Inicial</label>
                  <input
                    type="date"
                    required
                    value={dataIni}
                    onChange={(e) => setDataIni(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Data Final</label>
                  <input
                    type="date"
                    required
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* Checkbox and Select office process */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <label className="flex items-center gap-2.5 cursor-pointer bg-slate-950 border border-slate-850 px-4 py-3 rounded-xl hover:bg-slate-950/80 transition-all h-[46px]">
                  <input
                    type="checkbox"
                    checked={apenasMonitorados}
                    onChange={(e) => {
                      setApenasMonitorados(e.target.checked);
                      if (!e.target.checked) {
                        setSelectedMonitorProcessIds([]);
                      } else {
                        // By default select all when checked
                        setSelectedMonitorProcessIds(processesList.map(p => p.id));
                      }
                    }}
                    className="h-4.5 w-4.5 rounded border-slate-800 text-indigo-600 focus:ring-0 bg-slate-950"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-200">Apenas Processos Monitorados</span>
                    <span className="text-xxs text-slate-500">Limitar busca a processos do banco</span>
                  </div>
                </label>

                <div className="relative" ref={dropdownRef}>
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Processos Monitorados no Filtro</label>
                  <button
                    type="button"
                    disabled={!apenasMonitorados}
                    onClick={() => setIsOpenMonitorDropdown(!isOpenMonitorDropdown)}
                    className={`w-full border px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between gap-2 transition-all ${!apenasMonitorados
                      ? "bg-slate-900/40 border-slate-850 text-slate-500 cursor-not-allowed"
                      : "bg-slate-950 border-slate-800 hover:border-slate-750 text-slate-300 hover:text-white"
                      }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Briefcase className="h-4.5 w-4.5 text-indigo-500" />
                      <span className="truncate">
                        {!apenasMonitorados
                          ? "Filtro desativado"
                          : selectedMonitorProcessIds.length === 0
                            ? "Nenhum processo selecionado"
                            : selectedMonitorProcessIds.length === processesList.length
                              ? "Todos os processos monitorados"
                              : `${selectedMonitorProcessIds.length} processo(s) selecionado(s)`
                        }
                      </span>
                    </div>
                    <ChevronDown className="h-4.5 w-4.5 text-slate-500" />
                  </button>

                  {/* Dropdown checklist */}
                  {apenasMonitorados && isOpenMonitorDropdown && (
                    <div className="absolute right-0 mt-2 w-full bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-2 max-h-60 overflow-y-auto space-y-1">
                      <div className="px-3 py-1.5 border-b border-slate-800 mb-2 flex items-center justify-between">
                        <span className="text-xxs font-bold text-slate-500 uppercase tracking-widest">Processos Monitorados</span>
                        <div className="flex gap-2.5">
                          <button
                            type="button"
                            onClick={() => setSelectedMonitorProcessIds(processesList.map(p => p.id))}
                            className="text-xxs text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
                          >
                            Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedMonitorProcessIds([])}
                            className="text-xxs text-rose-400 hover:text-rose-350 font-bold transition-colors"
                          >
                            Limpar
                          </button>
                        </div>
                      </div>

                      {processesList.length === 0 ? (
                        <p className="text-slate-500 text-xs italic p-3 text-center">Nenhum processo cadastrado.</p>
                      ) : (
                        processesList.map((p) => {
                          const isChecked = selectedMonitorProcessIds.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                if (isChecked) {
                                  setSelectedMonitorProcessIds(selectedMonitorProcessIds.filter(id => id !== p.id));
                                } else {
                                  setSelectedMonitorProcessIds([...selectedMonitorProcessIds, p.id]);
                                }
                              }}
                              className={`w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${isChecked ? "bg-indigo-600/10 text-white font-medium" : "hover:bg-slate-850 text-slate-400 hover:text-slate-200"
                                }`}
                            >
                              {isChecked ? <CheckSquare className="h-4 w-4 text-indigo-500" /> : <Square className="h-4 w-4 text-slate-600" />}
                              <div className="min-w-0">
                                <p className="font-mono truncate">{p.mascara}</p>
                                <p className="text-xxs text-slate-500 truncate">{p.cliente}</p>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Text Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Nº Processo</label>
                  <input
                    type="text"
                    value={numProc}
                    onChange={(e) => setNumProc(e.target.value.replace(/\D/g, ""))}
                    placeholder="Ex: 150025498..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Tribunal</label>
                  <select
                    value={tribunal}
                    onChange={(e) => setTribunal(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="TODOS">TODOS</option>
                    {["STF", "STJ", "TST", "TSE", "TRF1", "TRF2", "TRF3", "TRF4", "TRF5", "TRF6", "TJSP", "TJRJ", "TJMG", "TJRS", "TJPR", "TJBA", "TJSC", "TJGO", "TJPE", "TJCE", "TJDF"].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Nome da Parte</label>
                  <input
                    type="text"
                    value={nomeParte}
                    onChange={(e) => setNomeParte(e.target.value)}
                    placeholder="Nome completo..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* OAB Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Número OAB (Somente nºs)</label>
                  <input
                    type="text"
                    value={numOab}
                    onChange={(e) => setNumOab(e.target.value.replace(/\D/g, ""))}
                    placeholder="Ex: 123456"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">UF da OAB</label>
                  <input
                    type="text"
                    value={estadoOab}
                    onChange={(e) => setEstadoOab(e.target.value.toUpperCase())}
                    placeholder="SP"
                    maxLength={2}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* Pagination and Items Limit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800/60 pt-4">
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Página</label>
                  <input
                    type="number"
                    value={pagina}
                    min={1}
                    onChange={(e) => setPagina(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Itens por Página</label>
                  <select
                    value={itensPagina}
                    onChange={(e) => setItensPagina(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    {["10", "50", "100", "300", "1000"].map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit Search */}
              <button
                type="submit"
                disabled={searching}
                className="w-full bg-indigo-600 hover:bg-indigo-750 text-white font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:bg-slate-800 disabled:text-slate-500 shadow-lg shadow-indigo-600/15"
              >
                {searching ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-500" />
                    <span>Realizando varredura...</span>
                  </>
                ) : (
                  <>
                    <Search className="h-4.5 w-4.5" />
                    <span>🔎 Executar Pesquisa Avançada</span>
                  </>
                )}
              </button>

            </form>
          </div>

          {/* Results Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white">Registros Extraídos do Diário de Justiça</h3>
                <p className="text-slate-400 text-xs mt-0.5">{searchStatus || "Aguardando pesquisa..."}</p>
              </div>

              {results.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="px-3 py-1.5 bg-slate-800 border border-slate-750 text-slate-350 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {selectedLines.length === results.length ? <Square className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
                    {selectedLines.length === results.length ? "Desmarcar Todos" : "Selecionar Todos"}
                  </button>
                </div>
              )}
            </div>

            {searching ? (
              <div className="p-12 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse flex space-x-4">
                    <div className="rounded-full bg-slate-850 h-10 w-10"></div>
                    <div className="flex-1 space-y-3 py-1">
                      <div className="h-2 bg-slate-850 rounded"></div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="h-2 bg-slate-850 rounded col-span-2"></div>
                        <div className="h-2 bg-slate-850 rounded col-span-1"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-20 bg-slate-900">
                <Info className="h-10 w-10 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-semibold">Nenhum diário localizado ou carregado.</p>
                <p className="text-slate-500 text-xs mt-1">Preencha os filtros acima e clique em Executar Pesquisa.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/40 text-slate-400 text-xxs font-extrabold uppercase tracking-wider border-b border-slate-800">
                      <th className="p-4 w-12 text-center">Sel</th>
                      <th className="p-4 w-14 text-center">Nº</th>
                      <th className="p-4">Processo CNJ</th>
                      <th className="p-4 w-20">Tribunal</th>
                      <th className="p-4 w-24">Classe / Tipo</th>
                      <th className="p-4 w-32">Data Disp</th>
                      <th className="p-4">Destinatários</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {results.map((row) => {
                      const isSelected = selectedLines.includes(row.linha);
                      return (
                        <tr
                          key={row.linha}
                          className={`hover:bg-slate-850/50 cursor-pointer transition-colors duration-150 ${isSelected ? "bg-indigo-600/5 hover:bg-indigo-600/10" : ""
                            }`}
                          onClick={() => toggleRow(row.linha)}
                        >
                          <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => toggleRow(row.linha)} className="text-slate-500 hover:text-indigo-400">
                              {isSelected ? <CheckSquare className="h-5 w-5 text-indigo-500" /> : <Square className="h-5 w-5" />}
                            </button>
                          </td>
                          <td className="p-4 text-center text-slate-500 text-xs font-mono">{row.linha}</td>
                          <td className="p-4 font-bold text-slate-200 text-xs font-mono whitespace-nowrap">{row.processo_cnj}</td>
                          <td className="p-4 text-slate-350 text-xs">{row.tribunal}</td>
                          <td className="p-4 whitespace-nowrap">
                            <span className={`text-xxs px-2.5 py-0.5 rounded-full font-bold ${row.tipo === "Sem Movimentação"
                              ? "bg-slate-800 text-slate-450 border border-slate-700"
                              : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                              }`}>
                              {row.tipo}
                            </span>
                          </td>
                          <td className="p-4 text-slate-350 text-xs font-mono whitespace-nowrap">{row.data_disp}</td>
                          <td className="p-4 text-slate-400 text-xs max-w-xxs truncate">{row.destinatarios}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Details & AI Multi-Agent (5 cols) */}
        <div className="xl:col-span-5 space-y-6">

          {/* teor da publicação completo */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-indigo-500" /> Teor da Publicação Selecionada
              </span>
              <span className="text-xxs bg-slate-950 border border-slate-800 text-slate-400 font-bold px-2 py-1 rounded-full">
                {selectedLines.length} selecionada(s)
              </span>
            </div>

            {/* Keyword highlight input */}
            {selectedLines.length > 0 && (
              <div>
                <label className="text-slate-455 text-xxs font-bold uppercase tracking-wider block mb-1">Destacar Palavra-Chave no Texto</label>
                <input
                  type="text"
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  placeholder="Digite termo para destacar..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            )}

            <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 min-h-36 max-h-80 overflow-y-auto">
              {renderHighlightedText(combinedText)}
            </div>

            {/* Defence guidelines instructions */}
            {selectedLines.length > 0 && (
              <div>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Tese / Instruções de Defesa (Diretriz)</label>
                <textarea
                  value={teseDefesa}
                  onChange={(e) => setTeseDefesa(e.target.value)}
                  placeholder="Ex: Alegar tempestividade dos embargos ou justificar ausência de intimação..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>
            )}

            {/* AI Model Settings */}
            {selectedLines.length > 0 && (
              <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-4">
                <span className="text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Brain className="h-4.5 w-4.5 text-indigo-500" /> Configuração do Modelo de IA
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-400 text-xxs font-bold uppercase tracking-wider block mb-1">Provedor LLM</label>
                    <select
                      value={provedor}
                      onChange={(e) => setProvedor(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                    >
                      {["Gemini", "Anthropic", "ChatGPT", "Ollama", "Groq"].map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 text-xxs font-bold uppercase tracking-wider block mb-1">Modelo LLM</label>
                    <select
                      value={modeloId}
                      onChange={(e) => setModeloId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                    >
                      {(PROVIDER_MODELS[provedor] || []).map(model => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 text-xxs font-bold uppercase tracking-wider block mb-1">
                    {provedor === "Ollama" ? "Endereço Host do Ollama" : "Chave de API (API Key)"}
                  </label>
                  <input
                    type={provedor === "Ollama" ? "text" : "password"}
                    value={apiKeyOrHost}
                    onChange={(e) => setApiKeyOrHost(e.target.value)}
                    placeholder={provedor === "Ollama" ? "http://localhost:11434" : "Insira sua API Key..."}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleRunAI()}
                  disabled={runningAI}
                  className="w-full bg-indigo-600 hover:bg-indigo-750 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:bg-slate-800 disabled:text-slate-500 shadow-md shadow-indigo-600/15"
                >
                  {runningAI ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-500" />
                      <span>Ativando Multi-Agente...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>🤖 Ativar IA Multi-Agente</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* AI Auditing results */}
          {(prazosMarkdown || minutaMarkdown || runningAI || aiError) && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">

              {/* Tabs */}
              <div className="flex border-b border-slate-800 bg-slate-950/40">
                <button
                  onClick={() => setActiveAiTab("prazos")}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-2 ${activeAiTab === "prazos" ? "border-indigo-600 text-white bg-slate-900" : "border-transparent text-slate-500 hover:text-slate-300"
                    }`}
                >
                  <Calendar className="h-4 w-4" /> Prazos (Controller)
                </button>
                <button
                  onClick={() => setActiveAiTab("minuta")}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-2 ${activeAiTab === "minuta" ? "border-indigo-600 text-white bg-slate-900" : "border-transparent text-slate-500 hover:text-slate-300"
                    }`}
                >
                  <FileText className="h-4 w-4" /> Minuta (Peça)
                </button>
                <button
                  onClick={() => setActiveAiTab("sugestoes")}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-2 ${activeAiTab === "sugestoes" ? "border-indigo-600 text-white bg-slate-900" : "border-transparent text-slate-500 hover:text-slate-300"
                    }`}
                >
                  <Sparkles className="h-4 w-4" /> Compromissos (Eventos)
                </button>
              </div>

              <div className="p-6">

                {/* Loader */}
                {runningAI && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-6 space-y-4 animate-pulse">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-indigo-400">Processamento Multi-Agente em execução...</span>
                      <span className="font-mono text-white bg-indigo-600 px-2 py-0.5 rounded-md text-xxs font-semibold shadow-md shadow-indigo-600/10">
                        Tempo decorrido: {elapsedTime.toFixed(1)}s
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${aiProgress > 0 ? aiProgress : Math.min((elapsedTime / 15) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xxs text-slate-400 leading-relaxed italic">
                      {aiProgress > 0 ? (
                        aiProgress <= 10
                          ? "Iniciando os agentes de triagem..."
                          : aiProgress <= 25
                          ? "Agente de Resumo extraindo o teor da publicação..."
                          : aiProgress <= 45
                          ? "Controller Jurídico analisando publicações e calculando prazos..."
                          : aiProgress <= 70
                          ? "Agente Redator estruturando a minuta de peça processual..."
                          : aiProgress <= 85
                          ? "Assistente de Agenda extraindo compromissos e datas fatais..."
                          : "Finalizando o processamento e salvando informações..."
                      ) : (
                        elapsedTime < 5
                          ? "Agente de Triagem extraindo termos de publicação..."
                          : elapsedTime < 10
                          ? "Agente de Prazos calculando prazos com base no CPC/2015..."
                          : "Agente de Minuta estruturando a tese de contestação..."
                      )}
                    </p>
                  </div>
                )}

                {/* Error */}
                {aiError && (
                  <div className="flex items-center justify-between gap-3 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 flex-shrink-0" />
                      <span>{aiError}</span>
                    </div>
                    <button
                      onClick={() => setAiError("")}
                      className="text-rose-400 hover:text-white text-xs font-bold px-2 py-1 rounded-lg hover:bg-rose-500/20 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {!runningAI && !aiError && (
                  <>
                    {/* Tab: Prazos */}
                    {activeAiTab === "prazos" && prazosMarkdown && (
                      <div className="prose dark:prose-invert prose-sm max-h-[500px] overflow-y-auto text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-850 p-4 rounded-xl bg-white dark:bg-slate-950/40">
                        <ReactMarkdown>{prazosMarkdown}</ReactMarkdown>
                      </div>
                    )}

                    {/* Tab: Minuta */}
                    {activeAiTab === "minuta" && minutaMarkdown && (
                      <div className="space-y-3">
                        <div className="flex justify-end">
                          <button
                            onClick={() => copyToClipboard(minutaMarkdown)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-750"
                          >
                            {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                            {copied ? "Copiado!" : "Copiar Minuta"}
                          </button>
                        </div>
                        <div className="prose dark:prose-invert prose-sm max-h-[450px] overflow-y-auto text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-850 p-4 rounded-xl bg-white dark:bg-slate-950/40 font-mono">
                          <ReactMarkdown>{minutaMarkdown}</ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* Tab: Sugestões */}
                    {activeAiTab === "sugestoes" && (
                      <div className="space-y-4">
                        <span className="text-slate-400 text-xxs font-bold uppercase tracking-wider block">Sugestões de prazos detectados para lançar no processo</span>

                        {prazosDetectados.length === 0 ? (
                          <p className="text-slate-500 text-xs italic">Nenhum prazo fatal localizado pela IA.</p>
                        ) : (
                          <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {prazosDetectados.map((item, idx) => (
                              <div key={idx} className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850 rounded-xl p-4 flex flex-col justify-between gap-4 shadow-sm">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Prazo Estimado</span>
                                    <span className="text-xs bg-rose-500/10 text-rose-600 dark:text-rose-455 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold">
                                      {item.data} às {item.hora}
                                    </span>
                                  </div>
                                  <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{item.descricao}</p>
                                </div>

                                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-900/60 pt-3">
                                  {quickActionNotif && quickActionNotif.index === idx ? (
                                    <span className={`text-xs font-semibold ${quickActionNotif.success ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                      {quickActionNotif.msg}
                                    </span>
                                  ) : (
                                    <div />
                                  )}
                                  <button
                                    onClick={() => handleQuickSaveDeadline(item, idx)}
                                    className="bg-indigo-600/10 border border-indigo-600/20 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-400 hover:text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
                                  >
                                    <span>Lançar no Processo</span>
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {agendaJson && (
                          <div className="mt-4">
                            <span className="text-slate-500 text-xxs font-bold uppercase tracking-wider block mb-1">Payload JSON Sugerido da Agenda</span>
                            <pre className="text-slate-700 dark:text-slate-450 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-xl p-3 text-xxs overflow-x-auto font-mono">
                              {agendaJson}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
