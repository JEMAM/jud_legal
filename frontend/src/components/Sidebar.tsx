"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getApiUrl } from "@/lib/api";
import { useEffect, useState } from "react";
import { Users, Search, LayoutGrid, Scale, Activity, Sun, Moon, Home, Calendar, User, LogOut, BookOpen } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("app_theme") as "dark" | "light";
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === "light") {
        document.documentElement.classList.add("theme-light");
      } else {
        document.documentElement.classList.remove("theme-light");
      }
    }
    // Read logged in user
    if (typeof window !== "undefined") {
      setCurrentUser(localStorage.getItem("logged_in_user"));
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("app_theme", nextTheme);
    if (nextTheme === "light") {
      document.documentElement.classList.add("theme-light");
    } else {
      document.documentElement.classList.remove("theme-light");
    }
  };

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(getApiUrl("/api/clients"), { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          setBackendStatus("online");
        } else {
          setBackendStatus("offline");
        }
      } catch (err) {
        setBackendStatus("offline");
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    {
      name: "Cadastro de Clientes",
      href: "/clients",
      icon: Users,
      description: "Gerenciar clientes e processos",
    },
    {
      name: "Painel de Triagem & DJE",
      href: "/triagem",
      icon: Search,
      description: "Varredura PJe e agentes IA",
    },
    {
      name: "Kanban de Processos",
      href: "/kanban",
      icon: LayoutGrid,
      description: "Gestão visual de tarefas",
    },
    {
      name: "Agenda de Prazos",
      href: "/agenda",
      icon: Calendar,
      description: "Visualização cronológica",
    },
    {
      name: "Guia de Uso & Tutorial",
      href: "/guia",
      icon: BookOpen,
      description: "Como utilizar a plataforma",
    },
  ];

  return (
    <aside className="w-80 bg-slate-900 border-r border-slate-800 text-slate-200 flex flex-col justify-between h-screen sticky top-0">
      <div className="flex flex-col">
        {/* Header Logo */}
        <Link href="/clients" className="p-6 border-b border-slate-800 flex items-center gap-3 hover:bg-slate-850/20 transition-colors">
          <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-600/30">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-xl tracking-tight text-white flex items-center gap-1.5">
              LegalMind <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-semibold">v6.2</span>
            </h1>
            <p className="text-xs text-slate-400">AI Law Suite</p>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1.5 flex-1">
          <p className="px-3 text-xxs font-semibold text-slate-500 uppercase tracking-widest mb-3">Módulos</p>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? "bg-indigo-600 text-white font-medium shadow-md shadow-indigo-600/10"
                    : "hover:bg-slate-800/60 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className={`h-5.5 w-5.5 transition-transform duration-200 group-hover:scale-105 ${isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-400"}`} />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{item.name}</span>
                  <span className={`text-xxs ${isActive ? "text-indigo-200" : "text-slate-500"}`}>{item.description}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Backend Status Footer & Theme Selector */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-3">
        {currentUser ? (
          <div className="flex items-center justify-between px-3 py-2 bg-slate-900/60 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-7 w-7 rounded-xl bg-indigo-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {currentUser[0].toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-white truncate">{currentUser}</span>
                <span className="text-[10px] text-slate-500 font-medium">Conta Ativa</span>
              </div>
            </div>
            <button
              onClick={() => {
                // Clear all triagem and session data on logout so another user starts clean
                if (typeof window !== "undefined") {
                  Object.keys(localStorage).forEach((key) => {
                    if (key.startsWith("triagem_")) {
                      localStorage.removeItem(key);
                    }
                  });
                  sessionStorage.clear();
                  localStorage.removeItem("logged_in_user");
                }
                setCurrentUser(null);
                window.location.href = "/";
              }}
              className="p-1.5 bg-slate-950 hover:bg-rose-500/10 border border-slate-850 hover:border-rose-500/20 text-slate-450 hover:text-rose-400 rounded-lg transition-all"
              title="Sair da Conta"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10"
          >
            <User className="h-4 w-4 text-white" />
            <span>Fazer Login</span>
          </Link>
        )}

        {/* Theme Switcher Button */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/60 hover:bg-slate-800/40 rounded-xl border border-slate-800 text-slate-350 hover:text-white transition-all text-xs font-semibold"
        >
          <div className="flex items-center gap-2">
            {theme === "dark" ? <Moon className="h-4 w-4 text-indigo-400" /> : <Sun className="h-4 w-4 text-amber-500" />}
            <span>Tema: {theme === "dark" ? "Escuro" : "Claro"}</span>
          </div>
          <span className="text-xxs uppercase tracking-wider text-slate-500 hover:text-slate-300">Alternar</span>
        </button>

        <div className="flex items-center justify-between px-3 py-2 bg-slate-900/60 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-400 font-medium">Status do Servidor</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2.5 w-2.5 rounded-full animate-pulse ${
                backendStatus === "online"
                  ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                  : backendStatus === "offline"
                  ? "bg-rose-500 shadow-sm shadow-rose-500/50"
                  : "bg-amber-500"
              }`}
            />
            <span className="text-xs font-semibold capitalize text-slate-300">
              {backendStatus === "online" ? "Online" : backendStatus === "offline" ? "Offline" : "Conectando..."}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
