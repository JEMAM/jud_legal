"use client";

import React, { useState } from "react";
import { ShieldCheck, User, Lock, ArrowRight, AlertCircle, CheckCircle, Sparkles } from "lucide-react";
import { getApiUrl } from "@/lib/api";

export default function LoginPage() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notif, setNotif] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setNotif({ type: "error", message: "Preencha todos os campos." });
      return;
    }

    setLoading(true);
    setNotif(null);

    const endpoint = isRegisterMode ? "/api/auth/register" : "/api/auth/login";

    try {
      const res = await fetch(getApiUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok) {
        if (isRegisterMode) {
          setNotif({ type: "success", message: "Conta criada com sucesso! Faça login." });
          setIsRegisterMode(false);
          setPassword("");
        } else {
          sessionStorage.clear();
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith("triagem_")) {
              localStorage.removeItem(key);
            }
          });
          localStorage.setItem("logged_in_user", data.username);
          setNotif({ type: "success", message: "Acesso autorizado! Redirecionando..." });
          setTimeout(() => {
            window.location.href = "/clients";
          }, 1000);
        }
      } else {
        setNotif({ type: "error", message: data.detail || "Ocorreu um erro." });
      }
    } catch (err) {
      setNotif({ type: "error", message: "Erro ao se conectar ao servidor." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#090d16] relative overflow-hidden px-4">
      {/* Decorative background glows */}
      <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-indigo-600/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-[#fef01e]/5 rounded-full blur-[120px]" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl mb-2 text-indigo-400">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            Veredictum <span className="text-[#fef01e] text-xs font-mono bg-[#fef01e]/10 px-2 py-0.5 rounded border border-[#fef01e]/20 font-bold uppercase tracking-wider">Secure</span>
          </h2>
          <p className="text-slate-400 text-xs font-medium">
            {isRegisterMode 
              ? "Crie sua credencial de acesso ao painel de controle" 
              : "Faça login com seu usuário e senha cadastrados"}
          </p>
        </div>

        {/* Notifications */}
        {notif && (
          <div 
            className={`flex items-start gap-3 p-3.5 border rounded-2xl text-xs font-bold ${
              notif.type === "success" 
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
            }`}
          >
            {notif.type === "success" ? <CheckCircle className="h-5 w-5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 flex-shrink-0" />}
            <span className="leading-relaxed">{notif.message}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          
          <div>
            <label className="text-slate-400 text-xxs font-bold uppercase tracking-wider block mb-1.5">Usuário</label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-slate-500">
                <User className="h-4.5 w-4.5" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nome de usuário"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-slate-400 text-xxs font-bold uppercase tracking-wider block mb-1.5">Senha</label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-slate-500">
                <Lock className="h-4.5 w-4.5" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha secreta"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-750 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/15 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-500" />
                <span>Processando...</span>
              </>
            ) : (
              <>
                <span>{isRegisterMode ? "Confirmar Cadastro" : "Acessar a Conta"}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="border-t border-slate-850 pt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setNotif(null);
              setPassword("");
            }}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center justify-center gap-1 mx-auto"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#fef01e]" />
            <span>{isRegisterMode ? "Já possui conta? Fazer Login" : "Não tem conta? Cadastrar-se"}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
