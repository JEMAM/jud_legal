"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Users, Search, LayoutGrid, Scale, 
  ArrowRight, Cpu, Database 
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="p-8 space-y-8 animate-fade-in max-w-7xl mx-auto">
      
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0f1e33] border border-slate-850 p-8 md:p-12 shadow-2xl text-slate-100 flex flex-col justify-between min-h-[360px] hero-container">
        {/* Glow decoration */}
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-amber-500/5 blur-[100px] pointer-events-none" />

        <div className="max-w-2xl space-y-5 relative z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xxs font-extrabold uppercase tracking-widest bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Cpu className="h-3.5 w-3.5" /> IA Jurídica Avançada & DJ-E
          </span>

          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Inteligência Processual de <br />
            <span className="text-[#fef01e] bg-gradient-to-r from-[#fef01e] to-amber-400 bg-clip-text text-transparent">Alta Performance</span>
          </h1>

          <p className="text-slate-400 text-sm md:text-base leading-relaxed font-medium">
            Gerencie sua carteira de clientes, monitore os diários oficiais do CNJ e tome decisões estratégicas utilizando nossa arquitetura de IA multi-agente local e segura.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 mt-8 relative z-10">
          <Link 
            href="/login"
            className="bg-[#fef01e] hover:bg-[#e6d91b] text-[#0f1e33] font-bold px-6 py-3 rounded-xl text-sm transition-all flex items-center gap-2 shadow-lg shadow-[#fef01e]/10 active:scale-[0.98]"
          >
            Acessar a Conta <ArrowRight className="h-4 w-4" />
          </Link>
          <Link 
            href="/triagem"
            className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 font-bold px-6 py-3 rounded-xl text-sm transition-all flex items-center gap-2 active:scale-[0.98]"
          >
            Monitorar Diários
          </Link>
        </div>
      </div>

      {/* Features Overview Section */}
      <div className="space-y-6">
        <div className="border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-white uppercase tracking-wider">
            Funcionalidades Integradas
          </h3>
          <p className="text-slate-400 text-xs mt-1">Conheça o que o sistema realiza para aprimorar sua rotina jurídica:</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <Link href="/clients" className="group bg-slate-900 hover:bg-slate-850/60 border border-slate-800 hover:border-indigo-500/30 rounded-2xl p-6 shadow-xl transition-all duration-200 space-y-4">
            <div className="p-3 bg-indigo-600/10 text-indigo-400 border border-indigo-500/15 rounded-xl w-max group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <Users className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h4 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors flex items-center gap-1">
                Cadastro e Sincronização <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-slate-400 text-xs leading-relaxed font-medium">
                Cadastre clientes (CPF/CNPJ) e vincule seus processos do escritório. Rascunhos automáticos evitam perda de dados ao navegar.
              </p>
            </div>
          </Link>

          {/* Card 2 */}
          <Link href="/triagem" className="group bg-slate-900 hover:bg-slate-850/60 border border-slate-800 hover:border-indigo-500/30 rounded-2xl p-6 shadow-xl transition-all duration-200 space-y-4">
            <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/15 rounded-xl w-max group-hover:bg-amber-600 group-hover:text-white transition-all">
              <Search className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h4 className="text-base font-bold text-white group-hover:text-amber-500 transition-colors flex items-center gap-1">
                Triagem PJe & IA <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-slate-400 text-xs leading-relaxed font-medium">
                Varredura de diários oficiais, destaque de termos, e IA multi-agente local para extração de prazos CPC/2015 e confecção de minutas.
              </p>
            </div>
          </Link>

          {/* Card 3 */}
          <Link href="/kanban" className="group bg-slate-900 hover:bg-slate-850/60 border border-slate-800 hover:border-indigo-500/30 rounded-2xl p-6 shadow-xl transition-all duration-200 space-y-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 rounded-xl w-max group-hover:bg-emerald-600 group-hover:text-white transition-all">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h4 className="text-base font-bold text-white group-hover:text-emerald-450 transition-colors flex items-center gap-1">
                Kanban de Processos <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-slate-400 text-xs leading-relaxed font-medium">
                Organize fluxos de processos entre colunas. Gerencie resumos jurídicos e prazos de expiração finais de forma totalmente visual.
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Security & Offline-First Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-950/40 border border-slate-900 p-5 rounded-2xl">
        <div className="flex items-start gap-3">
          <Database className="h-5 w-5 text-[#fef01e] mt-0.5 flex-shrink-0" />
          <div>
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">Integração Direta DJ-E</h5>
            <p className="text-slate-500 text-xxs leading-relaxed mt-1 font-medium">
              Conexões e mapeamentos de processos seguem o padrão do Diário de Justiça Eletrônico (DJ-E) para garantir busca de alta fidelidade e varreduras precisas.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Database className="h-5 w-5 text-indigo-500 mt-0.5 flex-shrink-0" />
          <div>
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">Segurança Offline-First</h5>
            <p className="text-slate-500 text-xxs leading-relaxed mt-1 font-medium">
              Os dados e os modelos de IA rodam localmente. Nada é compartilhado externamente, preservando o sigilo total de suas peças e clientes.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}

// A small helper to keep JSX neat
function ChevronRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
