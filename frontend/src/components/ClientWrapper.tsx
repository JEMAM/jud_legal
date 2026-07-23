"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { ShieldCheck } from "lucide-react";

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem("logged_in_user");
    const hasAuth = !!user;
    setIsAuthenticated(hasAuth);
    setIsLoaded(true);

    const protectedRoutes = ["/clients", "/triagem", "/kanban", "/agenda"];
    const isProtected = protectedRoutes.some(route => pathname.startsWith(route));

    if (!hasAuth && isProtected) {
      router.push("/login");
    }
  }, [pathname, router]);

  // Show a premium loading screen until we check the localStorage authentication state
  if (!isLoaded) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#090d16] text-slate-100">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-650/10 border border-indigo-500/20 rounded-2xl mb-4 animate-pulse">
          <ShieldCheck className="h-10 w-10 text-indigo-500" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 animate-pulse">Verificando Credenciais...</p>
      </div>
    );
  }

  const isLoginPage = pathname === "/login";
  // We only show the Sidebar if the user is authenticated and not on the login page
  const showSidebar = isAuthenticated && !isLoginPage;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-950">
      {showSidebar && <Sidebar />}
      <main className="flex-1 overflow-y-auto h-screen bg-slate-950 flex flex-col">
        {children}
      </main>
    </div>
  );
}
