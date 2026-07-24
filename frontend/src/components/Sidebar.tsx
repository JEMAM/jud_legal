"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getApiUrl } from "@/lib/api";
import { useEffect, useState } from "react";
import { 
  Users, Search, LayoutGrid, Scale, Activity, Sun, Moon, 
  Calendar, User, LogOut, BookOpen, Menu, X, ChevronLeft, ChevronRight 
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

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

    // Read collapsed preference from localStorage
    const savedCollapsed = localStorage.getItem("sidebar_collapsed");
    if (savedCollapsed !== null) {
      setIsCollapsed(savedCollapsed === "true");
    }

    // Read logged in user
    if (typeof window !== "undefined") {
      setCurrentUser(localStorage.getItem("logged_in_user"));
    }
  }, []);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem("sidebar_collapsed", String(nextState));
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(getApiUrl("/api/clients"), { signal: controller.signal });
        clearTimeout(timeoutId);
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
    const interval = setInterval(checkStatus, 20000);
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

  const sidebarContent = (collapsedMode: boolean) => (
    <div className="flex flex-col justify-between h-full w-full relative">
      <div className="flex flex-col">
        {/* Header Logo */}
        <div className={`p-4 border-b border-slate-800 flex items-center ${collapsedMode ? "justify-center" : "justify-between"}`}>
          <Link href="/clients" className="flex items-center gap-3 hover:opacity-90 transition-opacity min-w-0">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-600/30 flex-shrink-0">
              <Scale className="h-6 w-6" />
            </div>
            {!collapsedMode && (
              <div className="truncate">
                <h1 className="font-extrabold text-xl tracking-tight text-white flex items-center gap-1.5 truncate">
                  LegalMind <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-semibold">v6.2</span>
                </h1>
                <p className="text-xs text-slate-400 truncate">AI Law Suite</p>
              </div>
            )}
          </Link>

          {/* Toggle Seta Button (Desktop Header) */}
          <div className="hidden md:flex items-center gap-1">
            <button
              onClick={toggleCollapse}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl border border-slate-750 transition-all flex items-center justify-center"
              title={collapsedMode ? "Abrir/Expandir Módulos" : "Recolher/Fechar Módulos"}
            >
              {collapsedMode ? (
                <ChevronRight className="h-5 w-5 text-indigo-400" />
              ) : (
                <ChevronLeft className="h-5 w-5 text-slate-300" />
              )}
            </button>
          </div>

          {/* Close button for Mobile Drawer */}
          <button 
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
            aria-label="Fechar menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto">
          {!collapsedMode && (
            <p className="px-3 text-xxs font-semibold text-slate-500 uppercase tracking-widest mb-3">Módulos do Sistema</p>
          )}
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={item.name}
                className={`flex items-center ${collapsedMode ? "justify-center px-0 py-3" : "gap-3.5 px-4 py-3"} rounded-xl transition-all duration-200 group ${
                  isActive
                    ? "bg-indigo-600 text-white font-medium shadow-md shadow-indigo-600/10"
                    : "hover:bg-slate-800/60 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className={`h-5.5 w-5.5 flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-400"}`} />
                {!collapsedMode && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold truncate">{item.name}</span>
                    <span className={`text-xxs truncate ${isActive ? "text-indigo-200" : "text-slate-500"}`}>{item.description}</span>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Backend Status Footer & Theme Selector */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 space-y-2">
        {currentUser ? (
          <div className={`flex items-center ${collapsedMode ? "justify-center p-2" : "justify-between px-3 py-2"} bg-slate-900/60 rounded-xl border border-slate-800`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-7 w-7 rounded-xl bg-indigo-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0" title={currentUser}>
                {currentUser[0].toUpperCase()}
              </div>
              {!collapsedMode && (
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-white truncate">{currentUser}</span>
                  <span className="text-[10px] text-slate-500 font-medium">Conta Ativa</span>
                </div>
              )}
            </div>
            {!collapsedMode && (
              <button
                onClick={() => {
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
            )}
          </div>
        ) : (
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            title="Fazer Login"
            className={`w-full flex items-center justify-center ${collapsedMode ? "p-2.5" : "gap-2 px-3 py-2"} bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10`}
          >
            <User className="h-4 w-4 text-white" />
            {!collapsedMode && <span>Fazer Login</span>}
          </Link>
        )}

        {/* Theme Switcher Button */}
        <button
          onClick={toggleTheme}
          title={`Tema: ${theme === "dark" ? "Escuro" : "Claro"}`}
          className={`w-full flex items-center ${collapsedMode ? "justify-center p-2.5" : "justify-between px-3 py-2"} bg-slate-900/60 hover:bg-slate-800/40 rounded-xl border border-slate-800 text-slate-350 hover:text-white transition-all text-xs font-semibold`}
        >
          <div className="flex items-center gap-2">
            {theme === "dark" ? <Moon className="h-4 w-4 text-indigo-400" /> : <Sun className="h-4 w-4 text-amber-500" />}
            {!collapsedMode && <span>Tema: {theme === "dark" ? "Escuro" : "Claro"}</span>}
          </div>
          {!collapsedMode && <span className="text-xxs uppercase tracking-wider text-slate-500 hover:text-slate-300">Alternar</span>}
        </button>

        {/* Server status indicator */}
        <div className={`flex items-center ${collapsedMode ? "justify-center p-2" : "justify-between px-3 py-2"} bg-slate-900/60 rounded-xl border border-slate-800`} title={`Servidor: ${backendStatus}`}>
          {!collapsedMode && (
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-400" />
              <span className="text-xs text-slate-400 font-medium">Servidor</span>
            </div>
          )}
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
            {!collapsedMode && (
              <span className="text-xs font-semibold capitalize text-slate-300">
                {backendStatus === "online" ? "Online" : backendStatus === "offline" ? "Offline" : "Conectando..."}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header Bar (Only visible on screens < md) */}
      <div className="md:hidden w-full bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-30 flex-shrink-0">
        <Link href="/clients" className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1">
              LegalMind <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/20 font-semibold">v6.2</span>
            </h1>
          </div>
        </Link>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
          aria-label="Abrir Módulos"
        >
          <Menu className="h-4.5 w-4.5" />
          <span>Módulos</span>
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" 
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-80 max-w-[85vw] bg-slate-900 border-r border-slate-800 h-full z-10 shadow-2xl flex flex-col">
            {sidebarContent(false)}
          </div>
        </div>
      )}

      {/* Desktop Sidebar (Only visible on screens >= md) */}
      <aside 
        className={`hidden md:flex bg-slate-900 border-r border-slate-800 text-slate-200 flex-col justify-between h-screen sticky top-0 flex-shrink-0 transition-all duration-300 ${
          isCollapsed ? "w-20" : "w-72 lg:w-80"
        }`}
      >
        {sidebarContent(isCollapsed)}
      </aside>
    </>
  );
}
