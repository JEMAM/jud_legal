"use client";

import React, { useState } from "react";
import { 
  BookOpen, Key, Users, Search, LayoutGrid, Calendar, 
  Sparkles, CheckCircle2, ShieldCheck, Cpu, ArrowRight,
  HelpCircle, FileText, Zap, Layers, Server, ExternalLink
} from "lucide-react";

export default function GuiaPage() {
  const [activeTab, setActiveTab] = useState<"inicio" | "provedores" | "triagem" | "kanban" | "agenda" | "faq">("inicio");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 md:p-10 space-y-6 sm:space-y-8 max-w-7xl mx-auto">

      {/* Header Banner */}
      <div className="hero-container relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/30 p-8 md:p-12 shadow-2xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold tracking-wide">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Guia Interativo de Operação
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Manual de Uso & Boas Práticas do <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">LegalMind AI</span>
          </h1>
          <p className="text-slate-300 text-base md:text-lg leading-relaxed font-normal">
            Bem-vindo à sua suíte de inteligência jurídica. Aprenda a configurar seus agentes de IA, realizar triagem automática de intimações do DJE/PJe, gerenciar prazos no Kanban e otimizar sua agenda.
          </p>
        </div>
      </div>

      {/* Interactive Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
        {[
          { id: "inicio", label: "Visão Geral", icon: BookOpen },
          { id: "provedores", label: "Configurar IA & Chaves", icon: Key },
          { id: "triagem", label: "Triagem & Diários (PJe)", icon: Search },
          { id: "kanban", label: "Kanban Jurídico", icon: LayoutGrid },
          { id: "agenda", label: "Agenda de Prazos", icon: Calendar },
          { id: "faq", label: "Segurança & FAQ", icon: HelpCircle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                isActive
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 scale-[1.02]"
                  : "bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-indigo-400"}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">

        {/* TAB 1: VISÃO GERAL */}
        {activeTab === "inicio" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-indigo-500/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xl">
                1
              </div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                Clientes & Processos
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Cadastre seus clientes (Pessoa Física ou Jurídica) e vincule seus números de processo no padrão CNJ. O sistema monitora automaticamente as intimações associadas.
              </p>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-indigo-500/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-bold text-xl">
                2
              </div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-sky-400" />
                Triagem & Agentes de IA
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Consulte o PJe/ComunicaAPI por número de OAB, CNJ ou nome da parte. Dispare a equipe de agentes de IA para extrair prazos fatais, minutas de peças e teses de defesa.
              </p>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-indigo-500/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xl">
                3
              </div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-emerald-400" />
                Kanban & Agenda
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Os prazos e minutas detectados são integrados diretamente ao seu painel Kanban e sincronizados na Agenda cronológica para garantir cumprimento dentro do prazo.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: PROVEDORES DE IA */}
        {activeTab === "provedores" && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 space-y-6">
            <div className="flex items-center gap-3">
              <Key className="w-7 h-7 text-indigo-400" />
              <div>
                <h2 className="text-2xl font-bold text-white">Como Configurar Provedores e Chaves de API</h2>
                <p className="text-sm text-slate-400">Escolha entre modelos em nuvem (OpenAI, Gemini, Claude, Groq) ou execução local 100% privada (Ollama).</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-3">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-base">
                  <Cpu className="w-5 h-5" />
                  Modelos Suportados
                </div>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> <strong>Google Gemini:</strong> gemini-3.5-flash / gemini-2.5-flash (ultra veloz e preciso)</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> <strong>ChatGPT (OpenAI):</strong> gpt-5.6 / gpt-4o / gpt-4o-mini</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> <strong>Anthropic Claude:</strong> claude-opus-4.8 / claude-3-5-sonnet</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> <strong>Groq Cloud:</strong> llama-3.3-70b-versatile (super veloz)</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> <strong>Ollama Local:</strong> llama3.2 (executa localmente sem custo de API)</li>
                </ul>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
                  <ShieldCheck className="w-5 h-5" />
                  Segurança da API Key
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Para sua máxima proteção, sua chave de API não fica gravada no servidor nem em arquivos de banco de dados. 
                </p>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Ela é armazenada estritamente na <strong>memória da sessão (`sessionStorage`)</strong>. Isso significa que você pode navegar entre todas as páginas sem precisar redigitar a chave, e ao fechar a aba ou navegador, ela é descartada automaticamente.
                </p>
              </div>
            </div>

            {/* Onde obter as API Keys */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 pt-4 shadow-sm">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-lg">
                <Key className="w-5 h-5 text-amber-400" />
                Endereços Oficiais para Gerar / Obter sua API Key
              </div>
              <p className="text-sm text-slate-300">
                Clique nos links abaixo para acessar diretamente os painéis oficiais dos provedores de IA e criar sua chave gratuita ou pessoal:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-slate-950 hover:bg-indigo-500/10 border border-slate-800 hover:border-indigo-500/60 rounded-xl transition-all group"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">Google Gemini (AI Studio)</span>
                    <span className="text-xs font-mono text-slate-400 font-medium">aistudio.google.com/app/apikey</span>
                  </div>
                  <ExternalLink className="w-4.5 h-4.5 text-slate-400 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                </a>

                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-slate-950 hover:bg-sky-500/10 border border-slate-800 hover:border-sky-500/60 rounded-xl transition-all group"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors">Groq Cloud Console</span>
                    <span className="text-xs font-mono text-slate-400 font-medium">console.groq.com/keys</span>
                  </div>
                  <ExternalLink className="w-4.5 h-4.5 text-slate-400 group-hover:text-sky-400 transition-colors flex-shrink-0" />
                </a>

                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-slate-950 hover:bg-emerald-500/10 border border-slate-800 hover:border-emerald-500/60 rounded-xl transition-all group"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">OpenAI Platform (ChatGPT)</span>
                    <span className="text-xs font-mono text-slate-400 font-medium">platform.openai.com/api-keys</span>
                  </div>
                  <ExternalLink className="w-4.5 h-4.5 text-slate-400 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
                </a>

                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-slate-950 hover:bg-purple-500/10 border border-slate-800 hover:border-purple-500/60 rounded-xl transition-all group"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">Anthropic Console (Claude)</span>
                    <span className="text-xs font-mono text-slate-400 font-medium">console.anthropic.com/settings/keys</span>
                  </div>
                  <ExternalLink className="w-4.5 h-4.5 text-slate-400 group-hover:text-purple-400 transition-colors flex-shrink-0" />
                </a>

                <a
                  href="https://ollama.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-slate-950 hover:bg-amber-500/10 border border-slate-800 hover:border-amber-500/60 rounded-xl transition-all group sm:col-span-2"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">Ollama (Servidor Local 100% Off-line)</span>
                    <span className="text-xs font-mono text-slate-400 font-medium">ollama.com (Host Padrão: http://localhost:11434)</span>
                  </div>
                  <ExternalLink className="w-4.5 h-4.5 text-slate-400 group-hover:text-amber-400 transition-colors flex-shrink-0" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TRIAGEM */}
        {activeTab === "triagem" && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 space-y-6">
            <div className="flex items-center gap-3">
              <Search className="w-7 h-7 text-sky-400" />
              <div>
                <h2 className="text-2xl font-bold text-white">Passo a Passo: Painel de Triagem & Diários (PJe)</h2>
                <p className="text-sm text-slate-400">Varredura inteligente de publicações e execução da equipe de 4 agentes especialistas.</p>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex gap-4 items-start bg-slate-950 p-5 rounded-2xl border border-slate-800">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">1</span>
                <div>
                  <h4 className="font-bold text-white text-base">Preencha os Critérios de Busca</h4>
                  <p className="text-slate-400 text-sm mt-1">Informe o intervalo de datas, o número da OAB e o tribunal desejado (ex: TJSP, TRF3, TST) ou busque por número CNJ específico.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start bg-slate-950 p-5 rounded-2xl border border-slate-800">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-sm">2</span>
                <div>
                  <h4 className="font-bold text-white text-base">Selecione as Publicações</h4>
                  <p className="text-slate-400 text-sm mt-1">O sistema listará as intimações encontradas na ComunicaAPI PJe. Marque os itens que deseja analisar ou adicione aos processos monitorados.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start bg-slate-950 p-5 rounded-2xl border border-slate-800">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">3</span>
                <div>
                  <h4 className="font-bold text-white text-base">Dispare os Agentes de IA</h4>
                  <p className="text-slate-400 text-sm mt-1">Clique em "Executar Agentes de IA". Quatro agentes analisarão simultaneamente o texto: Agente de Triagem, Agente Calculador de Prazos, Agente de Minutas e Agente de Sugestões de Defesa.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start bg-slate-950 p-5 rounded-2xl border border-slate-800">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm">4</span>
                <div>
                  <h4 className="font-bold text-white text-base">Salvar na Agenda & Kanban</h4>
                  <p className="text-slate-400 text-sm mt-1">Após a geração do relatório, use o botão "Salvar Prazo na Agenda/Kanban" para transformar a análise em uma tarefa agendada no sistema.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: KANBAN */}
        {activeTab === "kanban" && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 space-y-6">
            <div className="flex items-center gap-3">
              <LayoutGrid className="w-7 h-7 text-emerald-400" />
              <div>
                <h2 className="text-2xl font-bold text-white">Gestão Visual no Kanban Jurídico</h2>
                <p className="text-sm text-slate-400">Acompanhamento de fluxo de trabalho em tempo real.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-2">
                <span className="px-3 py-1 bg-sky-500/10 text-sky-400 text-xs font-bold rounded-full border border-sky-500/20">A Fazer (To Do)</span>
                <p className="text-sm text-slate-300 mt-2">Processos e intimações recém-triados que necessitam de ação do advogado.</p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-2">
                <span className="px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-bold rounded-full border border-amber-500/20">Em Andamento (In Progress)</span>
                <p className="text-sm text-slate-300 mt-2">Peças jurídicas em elaboração ou aguardando conferência antes do protocolo.</p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-2">
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20">Concluído (Done)</span>
                <p className="text-sm text-slate-300 mt-2">Prazos protocolados e petições entregues com sucesso.</p>
              </div>
            </div>

            <p className="text-sm text-slate-400 pt-2">
              💡 <strong>Dica Pro:</strong> Você pode arrastar os cartões diretamente entre as colunas ou alterar o status através do modal de edição individual.
            </p>
          </div>
        )}

        {/* TAB 5: AGENDA */}
        {activeTab === "agenda" && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 space-y-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-7 h-7 text-indigo-400" />
              <div>
                <h2 className="text-2xl font-bold text-white">Agenda Cronológica de Prazos Fatais</h2>
                <p className="text-sm text-slate-400">Controle rigoroso de datas limite para evitar perdas de prazo.</p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
              <p>
                A <strong>Agenda</strong> organiza todos os prazos limite calculados pelos Agentes de IA em uma grade mensal, semanal e diária intuitiva.
              </p>
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-white text-base">Funcionalidades Principais:</h4>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> Destaque automático para prazos que vencem na semana corrente</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> Visualização por Mês, Dia ou Lista Geral</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> Edição rápida da data estimada e associação direta ao cliente</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: FAQ */}
        {activeTab === "faq" && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 space-y-6">
            <div className="flex items-center gap-3">
              <HelpCircle className="w-7 h-7 text-amber-400" />
              <div>
                <h2 className="text-2xl font-bold text-white">Perguntas Frequentes & Dicas Rápidas</h2>
                <p className="text-sm text-slate-400">Respostas para as dúvidas mais comuns.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-white">Onde fica salvo o banco de dados?</h4>
                <p className="text-sm text-slate-400">O sistema utiliza um banco relacional SQLite local (`processos.db`), garantindo que seus dados de clientes e processos permaneçam sob seu controle exclusivo.</p>
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-white">Qual provedor de IA devo utilizar?</h4>
                <p className="text-sm text-slate-400">Recomendamos o <strong>Google Gemini (gemini-2.5-flash)</strong> ou <strong>Groq (llama-3.3-70b)</strong> pela alta velocidade de resposta e excelente compreensão de textos jurídicos em português. Caso exija privacidade total offline, utilize o <strong>Ollama</strong> local.</p>
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-white">Como sei se o backend está conectado?</h4>
                <p className="text-sm text-slate-400">Confira o indicador no rodapé da barra lateral esquerda. O ícone 🟢 verde indica que a API FastAPI está online e pronta para processar requisições.</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
