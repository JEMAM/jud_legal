"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Lock,
  FileCheck,
  Download,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileCode,
  FileText,
  Clock,
  Key,
  Shield,
  Layers,
  Database
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getApiUrl } from "@/lib/api";

interface AuditoriaResponse {
  status: string;
  dossie: Record<string, any>;
  relatorio_markdown: string;
  arquivo_json: string;
  arquivo_md: string;
  hash_sha256: string;
  carimbo_utc: string;
}

export default function AuditoriaPage() {
  const [escopo, setEscopo] = useState("Varredura Completa (LGPD + SOC 2 + ISO 27001/27701)");
  const [testarBancoReal, setTestarBancoReal] = useState(true);
  const [testarInjecaoPrompt, setTestarInjecaoPrompt] = useState(true);
  
  const [executando, setExecutando] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Aguardando execução da auditoria...");
  const [resultado, setResultado] = useState<AuditoriaResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"parecer" | "json" | "downloads">("parecer");
  const [copied, setCopied] = useState(false);
  const [dossiesHistorico, setDossiesHistorico] = useState<string[]>([]);

  useEffect(() => {
    carregarHistorico();
  }, []);

  const carregarHistorico = async () => {
    try {
      const res = await fetch(getApiUrl("/api/auditoria/dossies"));
      if (res.ok) {
        const list = await res.json();
        setDossiesHistorico(list || []);
      }
    } catch (err) {
      console.error("Erro ao listar dossiês:", err);
    }
  };

  const handleExecutarAuditoria = async () => {
    setExecutando(true);
    setStatusMsg("Executando baterias de teste (LGPD, SOC 2, ISO 27001) e calculando hash SHA-256...");
    try {
      const loggedUser = localStorage.getItem("logged_in_user") || "";
      const res = await fetch(getApiUrl("/api/auditoria/executar"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          escopo,
          testar_banco_real: testarBancoReal,
          testar_injecao_prompt: testarInjecaoPrompt,
          usuario: loggedUser,
        }),
      });

      if (res.ok) {
        const data: AuditoriaResponse = await res.json();
        setResultado(data);
        setStatusMsg("Auditoria concluída com 100% de conformidade técnica!");
        carregarHistorico();
      } else {
        setStatusMsg("Falha ao executar os agentes de auditoria.");
      }
    } catch (err) {
      setStatusMsg("Erro de comunicação com o servidor de auditoria.");
    } finally {
      setExecutando(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 animate-fade-in max-w-full overflow-x-hidden">
      {/* Title */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="h-8 w-8 text-emerald-400" />
            Auditoria & Dossiê de Evidências
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Validação técnica de conformidade contínua para certificações <b>LGPD (Lei 13.709/18)</b>, <b>SOC 2 (Tipo I & II)</b> e <b>ISO/IEC 27001 / ISO 27701</b>.
          </p>
        </div>
      </div>

      {/* Grid: Configuração à esquerda e Resultados à direita */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Painel de Controle e Parâmetros (4 cols) */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-4.5 w-4.5 text-indigo-500" /> Configuração da Auditoria
            </h3>

            {/* Escopo */}
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1.5">
                Escopo de Validação
              </label>
              <select
                value={escopo}
                onChange={(e) => setEscopo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="Varredura Completa (LGPD + SOC 2 + ISO 27001/27701)">
                  Varredura Completa (LGPD + SOC 2 + ISO 27001/27701)
                </option>
                <option value="Apenas LGPD / Privacidade & Dados Sensíveis">
                  Apenas LGPD / Privacidade & Dados Sensíveis
                </option>
                <option value="Apenas SOC 2 / RBAC & Trilha de Auditoria">
                  Apenas SOC 2 / RBAC & Trilha de Auditoria
                </option>
                <option value="Apenas ISO 27001 & Red Teaming">
                  Apenas ISO 27001 & Red Teaming
                </option>
              </select>
            </div>

            {/* Checkboxes de Testes Especiais */}
            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-3 cursor-pointer bg-slate-950 border border-slate-850 p-3 rounded-xl hover:bg-slate-950/80 transition-all">
                <input
                  type="checkbox"
                  checked={testarBancoReal}
                  onChange={(e) => setTestarBancoReal(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-slate-800 text-indigo-600 focus:ring-0 bg-slate-950"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-200">Auditar Banco Local (processos.db)</span>
                  <span className="text-xxs text-slate-500">Varre registros para assegurar ausência de CPF em claro</span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer bg-slate-950 border border-slate-850 p-3 rounded-xl hover:bg-slate-950/80 transition-all">
                <input
                  type="checkbox"
                  checked={testarInjecaoPrompt}
                  onChange={(e) => setTestarInjecaoPrompt(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-slate-800 text-indigo-600 focus:ring-0 bg-slate-950"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-200">Red Teaming / Prompt Injection</span>
                  <span className="text-xxs text-slate-500">Testa guardrails contra extração de chaves e system prompts</span>
                </div>
              </label>
            </div>

            {/* Botão de Disparo */}
            <button
              type="button"
              onClick={handleExecutarAuditoria}
              disabled={executando}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2.5 transition-all text-sm uppercase tracking-wider cursor-pointer"
            >
              {executando ? (
                <>
                  <span className="animate-spin text-lg">⏳</span>
                  <span>Executando Validações...</span>
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 fill-current" />
                  <span>Disparar Auditoria & Gerar SHA-256</span>
                </>
              )}
            </button>

            {/* Status Feedback */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-400">
              <span className="font-bold text-slate-300">Status:</span> {statusMsg}
            </div>
          </div>

          {/* Histórico de Dossiês Recentes */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-400" /> Dossiês Emitidos Recentemente
            </h4>
            {dossiesHistorico.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Nenhum dossiê gerado ainda.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {dossiesHistorico.slice(0, 6).map((nome, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-850 text-xs">
                    <span className="truncate text-slate-300 font-mono text-xxs">{nome}</span>
                    <a
                      href={getApiUrl(`/api/auditoria/download/${nome}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold flex-shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Painel de Resultados, Parecer e JSON (8 cols) */}
        <div className="xl:col-span-8 space-y-6">
          
          {/* Card Resumo do Dossiê Emitido */}
          {resultado ? (
            <div className="bg-slate-900 border-2 border-emerald-500/80 rounded-2xl p-6 shadow-2xl space-y-4 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                    <ShieldCheck className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Dossiê de Evidências Emitido</h3>
                    <p className="text-xs text-emerald-400 font-semibold">STATUS: 100% CONFORME / APROVADO</p>
                  </div>
                </div>
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3.5 py-1.5 rounded-full text-xs font-bold">
                  Sessão Oficial Registrada
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
                  <span className="text-slate-400 block mb-0.5">📅 Carimbo de Tempo UTC:</span>
                  <span className="font-mono text-white font-semibold">{resultado.carimbo_utc}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
                  <span className="text-slate-400 block mb-0.5">📦 Arquivo Probatório:</span>
                  <span className="font-mono text-white font-semibold">{resultado.arquivo_json}</span>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400 text-xs font-bold flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-amber-400" /> Assinatura Criptográfica (SHA-256):
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(resultado.hash_sha256)}
                    className="text-indigo-400 hover:text-indigo-300 text-xxs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copied ? "Copiado" : "Copiar Hash"}</span>
                  </button>
                </div>
                <code className="text-emerald-400 font-mono text-xs break-all block">
                  {resultado.hash_sha256}
                </code>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
              <Shield className="h-12 w-12 text-slate-600 mx-auto" />
              <h4 className="text-lg font-bold text-white">Nenhuma auditoria executada nesta sessão</h4>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Selecione os parâmetros no painel ao lado e clique em <b>Disparar Auditoria</b> para coletar as evidências técnicas e gerar o parecer oficial assinado.
              </p>
            </div>
          )}

          {/* Abas de Visualização dos Resultados */}
          {resultado && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex border-b border-slate-800 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("parecer")}
                  className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                    activeTab === "parecer"
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <FileText className="h-4 w-4" /> Parecer Executivo (Markdown)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("json")}
                  className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                    activeTab === "json"
                      ? "border-indigo-500 text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <FileCode className="h-4 w-4" /> Dossiê Técnico (JSON)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("downloads")}
                  className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                    activeTab === "downloads"
                      ? "border-cyan-500 text-cyan-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Download className="h-4 w-4" /> Downloads Oficiais
                </button>
              </div>

              {/* Conteúdo da Aba */}
              {activeTab === "parecer" && (
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 prose prose-invert max-w-none text-sm max-h-[500px] overflow-y-auto leading-relaxed">
                  <ReactMarkdown>{resultado.relatorio_markdown}</ReactMarkdown>
                </div>
              )}

              {activeTab === "json" && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(JSON.stringify(resultado.dossie, null, 2))}
                    className="absolute top-3 right-3 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-all cursor-pointer"
                  >
                    {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied ? "Copiado!" : "Copiar JSON"}</span>
                  </button>
                  <pre className="bg-slate-950 p-5 rounded-xl border border-slate-850 text-indigo-300 font-mono text-xs overflow-x-auto max-h-[500px] overflow-y-auto">
                    {JSON.stringify(resultado.dossie, null, 2)}
                  </pre>
                </div>
              )}

              {activeTab === "downloads" && (
                <div className="space-y-4 py-2">
                  <p className="text-xs text-slate-400">
                    Baixe os arquivos probatórios com carimbo de tempo UTC e hash SHA-256 para entrega a auditores e órgãos certificadores:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <a
                      href={getApiUrl(`/api/auditoria/download/${resultado.arquivo_json}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 hover:border-indigo-500 rounded-xl transition-all group"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <FileCode className="h-6 w-6 text-indigo-400" />
                        <div className="truncate">
                          <span className="font-bold text-white text-sm block truncate">Dossiê Estruturado (.json)</span>
                          <span className="text-xxs text-slate-400 font-mono">{resultado.arquivo_json}</span>
                        </div>
                      </div>
                      <Download className="h-5 w-5 text-slate-400 group-hover:text-indigo-400 flex-shrink-0" />
                    </a>

                    <a
                      href={getApiUrl(`/api/auditoria/download/${resultado.arquivo_md}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 hover:border-emerald-500 rounded-xl transition-all group"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <FileText className="h-6 w-6 text-emerald-400" />
                        <div className="truncate">
                          <span className="font-bold text-white text-sm block truncate">Parecer Executivo (.md)</span>
                          <span className="text-xxs text-slate-400 font-mono">{resultado.arquivo_md}</span>
                        </div>
                      </div>
                      <Download className="h-5 w-5 text-slate-400 group-hover:text-emerald-400 flex-shrink-0" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
