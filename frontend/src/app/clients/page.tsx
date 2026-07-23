"use client";

import React, { useState, useEffect } from "react";
import { 
  UserPlus, Mail, Phone, MapPin, ClipboardList, Briefcase, 
  Trash2, Edit, AlertCircle, CheckCircle, Search, Info, Plus, X,
  Scale, Users, LayoutGrid
} from "lucide-react";
import { getApiUrl } from "@/lib/api";

interface Processo {
  id: number;
  numero: string;
  mascara: string;
  descricao: string;
  data_limite_estimada: string;
  resumo: string;
}

interface Cliente {
  id: number;
  nome: string;
  tipo: "Física" | "Jurídica";
  cpf_cnpj: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  observacoes: string;
  processos?: Processo[];
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Form State
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"Física" | "Jurídica">("Física");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [observacoes, setObservacoes] = useState("");
  
  // State for adding processes inline
  const [processInput, setProcessInput] = useState("");
  const [processList, setProcessList] = useState<string[]>([]);
  
  // Notification State
  const [notif, setNotif] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  // Editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [stats, setStats] = useState({ clients: 0, processes: 0, activeKanban: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load search query and form draft from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("clients_searchQuery");
    if (saved) setSearchQuery(saved);

    const draftNome = localStorage.getItem("clients_draft_nome");
    if (draftNome) setNome(draftNome);

    const draftTipo = localStorage.getItem("clients_draft_tipo");
    if (draftTipo === "Física" || draftTipo === "Jurídica") setTipo(draftTipo);

    const draftCpfCnpj = localStorage.getItem("clients_draft_cpfCnpj");
    if (draftCpfCnpj) setCpfCnpj(draftCpfCnpj);

    const draftEmail = localStorage.getItem("clients_draft_email");
    if (draftEmail) setEmail(draftEmail);

    const draftTelefone = localStorage.getItem("clients_draft_telefone");
    if (draftTelefone) setTelefone(draftTelefone);

    const draftCep = localStorage.getItem("clients_draft_cep");
    if (draftCep) setCep(draftCep);

    const draftLogradouro = localStorage.getItem("clients_draft_logradouro");
    if (draftLogradouro) setLogradouro(draftLogradouro);

    const draftNumero = localStorage.getItem("clients_draft_numero");
    if (draftNumero) setNumero(draftNumero);

    const draftComplemento = localStorage.getItem("clients_draft_complemento");
    if (draftComplemento) setComplemento(draftComplemento);

    const draftBairro = localStorage.getItem("clients_draft_bairro");
    if (draftBairro) setBairro(draftBairro);

    const draftCidade = localStorage.getItem("clients_draft_cidade");
    if (draftCidade) setCidade(draftCidade);

    const draftEstado = localStorage.getItem("clients_draft_estado");
    if (draftEstado) setEstado(draftEstado);

    const draftObservacoes = localStorage.getItem("clients_draft_observacoes");
    if (draftObservacoes) setObservacoes(draftObservacoes);

    const draftProcessList = localStorage.getItem("clients_draft_processList");
    if (draftProcessList) {
      try {
        setProcessList(JSON.parse(draftProcessList));
      } catch (e) {
        console.error("Erro ao carregar rascunho de processos:", e);
      }
    }

    setIsLoaded(true);
  }, []);

  // Save search query and form draft to localStorage
  useEffect(() => {
    if (!isLoaded) return;
    
    localStorage.setItem("clients_searchQuery", searchQuery);
    localStorage.setItem("clients_draft_nome", nome);
    localStorage.setItem("clients_draft_tipo", tipo);
    localStorage.setItem("clients_draft_cpfCnpj", cpfCnpj);
    localStorage.setItem("clients_draft_email", email);
    localStorage.setItem("clients_draft_telefone", telefone);
    localStorage.setItem("clients_draft_cep", cep);
    localStorage.setItem("clients_draft_logradouro", logradouro);
    localStorage.setItem("clients_draft_numero", numero);
    localStorage.setItem("clients_draft_complemento", complemento);
    localStorage.setItem("clients_draft_bairro", bairro);
    localStorage.setItem("clients_draft_cidade", cidade);
    localStorage.setItem("clients_draft_estado", estado);
    localStorage.setItem("clients_draft_observacoes", observacoes);
    localStorage.setItem("clients_draft_processList", JSON.stringify(processList));
  }, [
    isLoaded, searchQuery, nome, tipo, cpfCnpj, email, telefone, 
    cep, logradouro, numero, complemento, bairro, cidade, estado, 
    observacoes, processList
  ]);

  // Fetch clients & statistics
  const fetchClientsAndStats = async () => {
    try {
      const user = localStorage.getItem("logged_in_user") || "";
      const userParam = user ? `?usuario=${encodeURIComponent(user)}` : "";
      const [resClients, resProcs] = await Promise.all([
        fetch(getApiUrl(`/api/clients${userParam}`)),
        fetch(getApiUrl(`/api/processes${userParam}`))
      ]);
      if (resClients.ok && resProcs.ok) {
        const clientsData = await resClients.json();
        const procsData = await resProcs.json();
        
        setClients(clientsData);
        setStats({
          clients: clientsData.length,
          processes: procsData.length,
          activeKanban: procsData.filter((p: any) => p.status && p.status !== "done").length
        });
      }
    } catch (err) {
      console.error("Erro ao carregar clientes e estatísticas:", err);
    } finally {
      setLoading(false);
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchClientsAndStats();
  }, []);

  // Format CPF/CNPJ
  const handleCpfCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (tipo === "Física") {
      // CPF format: 000.000.000-00
      if (value.length > 11) value = value.slice(0, 11);
      value = value
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      // CNPJ format: 00.000.000/0000-00
      if (value.length > 14) value = value.slice(0, 14);
      value = value
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    }
    setCpfCnpj(value);
  };

  // Format Phone
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 10) {
      value = value.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
    } else if (value.length > 5) {
      value = value.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
    } else {
      value = value.replace(/^(\d*)$/, "($1");
    }
    setTelefone(value);
  };

  // Format CEP & Autofill
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 8) value = value.slice(0, 8);
    
    // Format: 00000-000
    const formatted = value.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
    setCep(formatted);

    if (value.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${value}/json/`);
        if (res.ok) {
          const data = await res.json();
          if (!data.erro) {
            setLogradouro(data.logradouro || "");
            setBairro(data.bairro || "");
            setCidade(data.localidade || "");
            setEstado(data.uf || "");
          }
        }
      } catch (err) {
        console.error("Erro ao buscar CEP:", err);
      }
    }
  };

  // Add process to list
  const addProcessToList = () => {
    if (!processInput.trim()) return;
    const clean = processInput.replace(/\D/g, "");
    if (clean.length !== 20) {
      setNotif({ type: "error", message: "O número do processo deve ter 20 dígitos CNJ." });
      return;
    }
    const formatted = `${clean.slice(0, 7)}-${clean.slice(7, 9)}.${clean.slice(9, 13)}.${clean.slice(13, 14)}.${clean.slice(14, 16)}.${clean.slice(16, 20)}`;
    if (!processList.includes(formatted)) {
      setProcessList([...processList, formatted]);
    }
    setProcessInput("");
  };

  // Remove process from list
  const removeProcessFromList = (proc: string) => {
    setProcessList(processList.filter(p => p !== proc));
  };

  // Submit Client
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !cpfCnpj) {
      setNotif({ type: "error", message: "Nome e CPF/CNPJ são obrigatórios." });
      return;
    }

    const user = localStorage.getItem("logged_in_user") || "";
    const payload = {
      nome,
      tipo,
      cpf_cnpj: cpfCnpj.replace(/\D/g, ""),
      email,
      telefone: telefone.replace(/\D/g, ""),
      cep: cep.replace(/\D/g, ""),
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      estado,
      observacoes,
      processos: processList,
      usuario: user
    };

    try {
      let res;
      if (editingId) {
        res = await fetch(getApiUrl(`/api/clients/${editingId}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(getApiUrl("/api/clients"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        setNotif({
          type: "success",
          message: editingId ? "Cliente atualizado com sucesso!" : "Cliente cadastrado com sucesso!",
        });
        resetForm();
        fetchClientsAndStats();
      } else {
        const data = await res.json();
        setNotif({ type: "error", message: data.detail || "Erro ao salvar cliente." });
      }
    } catch (err) {
      setNotif({ type: "error", message: "Erro ao conectar ao servidor." });
    }
  };

  // Edit action
  const handleEdit = (client: Cliente) => {
    setEditingId(client.id);
    setNome(client.nome);
    setTipo(client.tipo);
    
    // Format CPF/CNPJ
    let cpf_cnpj_val = client.cpf_cnpj;
    if (client.tipo === "Física") {
      cpf_cnpj_val = cpf_cnpj_val.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else {
      cpf_cnpj_val = cpf_cnpj_val.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    setCpfCnpj(cpf_cnpj_val);
    
    setEmail(client.email || "");
    
    // Format phone
    let phone_val = client.telefone || "";
    if (phone_val.length === 11) {
      phone_val = phone_val.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    } else if (phone_val.length === 10) {
      phone_val = phone_val.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    setTelefone(phone_val);
    
    // Format CEP
    let cep_val = client.cep || "";
    if (cep_val.length === 8) {
      cep_val = cep_val.replace(/(\d{5})(\d{3})/, "$1-$2");
    }
    setCep(cep_val);
    
    setLogradouro(client.logradouro || "");
    setNumero(client.numero || "");
    setComplemento(client.complemento || "");
    setBairro(client.bairro || "");
    setCidade(client.cidade || "");
    setEstado(client.estado || "");
    setObservacoes(client.observacoes || "");
    if (client.processos && client.processos.length > 0) {
      setProcessList(client.processos.map((p: any) => p.mascara || p.numero));
    } else {
      setProcessList([]);
    }
  };

  // Delete Client
  const handleDelete = async (id: number) => {
    if (!confirm("Deseja realmente remover este cliente? Todos os processos vinculados ficarão sem cliente associado.")) return;
    try {
      const res = await fetch(getApiUrl(`/api/clients/${id}`), {
        method: "DELETE",
      });
      if (res.ok) {
        setNotif({ type: "success", message: "Cliente removido!" });
        fetchClientsAndStats();
      }
    } catch (err) {
      setNotif({ type: "error", message: "Erro ao remover cliente." });
    }
  };

  // Reset form
  const resetForm = () => {
    // Clear drafts from localStorage
    localStorage.removeItem("clients_draft_nome");
    localStorage.removeItem("clients_draft_tipo");
    localStorage.removeItem("clients_draft_cpfCnpj");
    localStorage.removeItem("clients_draft_email");
    localStorage.removeItem("clients_draft_telefone");
    localStorage.removeItem("clients_draft_cep");
    localStorage.removeItem("clients_draft_logradouro");
    localStorage.removeItem("clients_draft_numero");
    localStorage.removeItem("clients_draft_complemento");
    localStorage.removeItem("clients_draft_bairro");
    localStorage.removeItem("clients_draft_cidade");
    localStorage.removeItem("clients_draft_estado");
    localStorage.removeItem("clients_draft_observacoes");
    localStorage.removeItem("clients_draft_processList");

    setEditingId(null);
    setNome("");
    setTipo("Física");
    setCpfCnpj("");
    setEmail("");
    setTelefone("");
    setCep("");
    setLogradouro("");
    setNumero("");
    setComplemento("");
    setBairro("");
    setCidade("");
    setEstado("");
    setObservacoes("");
    setProcessList([]);
    setProcessInput("");
  };

  // Filter clients by query
  const filteredClients = clients.filter(c => 
    c.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.cpf_cnpj.includes(searchQuery) ||
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Title */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Cadastro de Clientes</h2>
          <p className="text-slate-400 text-sm mt-1">Gerencie a base de clientes do escritório e seus respectivos processos.</p>
        </div>
      </div>

      {/* Statistics Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Stat 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center gap-5 hover:border-slate-750 transition-colors text-left animate-fade-in">
          <div className="p-4 bg-indigo-600/10 rounded-xl text-indigo-400 border border-indigo-500/15">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xxs font-bold uppercase tracking-wider">Clientes Ativos</p>
            <h3 className="text-2xl font-extrabold text-white mt-1">
              {statsLoading ? "..." : stats.clients}
            </h3>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center gap-5 hover:border-slate-750 transition-colors text-left animate-fade-in">
          <div className="p-4 bg-amber-500/10 rounded-xl text-amber-400 border border-[#fef01e]/15">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xxs font-bold uppercase tracking-wider">Processos no Banco</p>
            <h3 className="text-2xl font-extrabold text-white mt-1">
              {statsLoading ? "..." : stats.processes}
            </h3>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center gap-5 hover:border-slate-750 transition-colors text-left animate-fade-in">
          <div className="p-4 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/15">
            <LayoutGrid className="h-6 w-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xxs font-bold uppercase tracking-wider">Monitoramentos Kanban</p>
            <h3 className="text-2xl font-extrabold text-white mt-1">
              {statsLoading ? "..." : stats.activeKanban}
            </h3>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notif && (
        <div 
          className={`flex items-center gap-3 p-4 rounded-xl border ${
            notif.type === "success" 
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}
        >
          {notif.type === "success" ? <CheckCircle className="h-5 w-5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 flex-shrink-0" />}
          <span className="text-sm font-semibold">{notif.message}</span>
          <button className="ml-auto hover:opacity-80" onClick={() => setNotif(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left Side: Cadastro Form */}
        <div className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4">
            <UserPlus className="h-5.5 w-5.5 text-indigo-500" />
            <h3 className="text-lg font-bold text-white">
              {editingId ? "Editar Informações do Cliente" : "Adicionar Novo Cliente"}
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Tipo de Pessoa */}
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-2">Tipo de Cliente</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setTipo("Física"); setCpfCnpj(""); }}
                  className={`py-2 px-4 rounded-xl text-sm font-bold border transition-all ${
                    tipo === "Física"
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/15"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750"
                  }`}
                >
                  Pessoa Física (CPF)
                </button>
                <button
                  type="button"
                  onClick={() => { setTipo("Jurídica"); setCpfCnpj(""); }}
                  className={`py-2 px-4 rounded-xl text-sm font-bold border transition-all ${
                    tipo === "Jurídica"
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/15"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750"
                  }`}
                >
                  Pessoa Jurídica (CNPJ)
                </button>
              </div>
            </div>

            {/* Nome e CPF/CNPJ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Nome / Razão Social *</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome completo ou Razão"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
                  {tipo === "Física" ? "CPF *" : "CNPJ *"}
                </label>
                <input
                  type="text"
                  required
                  value={cpfCnpj}
                  onChange={handleCpfCnpjChange}
                  placeholder={tipo === "Física" ? "000.000.000-00" : "00.000.000/0000-00"}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* Email e Telefone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exemplo@email.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Telefone / WhatsApp</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-500" />
                  <input
                    type="text"
                    value={telefone}
                    onChange={handlePhoneChange}
                    placeholder="(00) 00000-0000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Endereço (CEP, Logradouro, Número, Complemento) */}
            <div className="border-t border-slate-800 pt-4 space-y-4">
              <span className="text-slate-200 text-xs font-extrabold uppercase tracking-widest flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-indigo-500" /> Endereço residencial/comercial
              </span>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">CEP</label>
                  <input
                    type="text"
                    value={cep}
                    onChange={handleCepChange}
                    placeholder="00000-000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Logradouro</label>
                  <input
                    type="text"
                    value={logradouro}
                    onChange={(e) => setLogradouro(e.target.value)}
                    placeholder="Rua, Av..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Número</label>
                  <input
                    type="text"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    placeholder="123"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Complemento</label>
                  <input
                    type="text"
                    value={complemento}
                    onChange={(e) => setComplemento(e.target.value)}
                    placeholder="Apto, Bloco..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Bairro</label>
                  <input
                    type="text"
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                    placeholder="Bairro"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Cidade</label>
                  <input
                    type="text"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    placeholder="Cidade"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Estado (UF)</label>
                  <input
                    type="text"
                    value={estado}
                    onChange={(e) => setEstado(e.target.value.toUpperCase())}
                    placeholder="SP"
                    maxLength={2}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Observações / Notas Internas</label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Insira detalhes adicionais do cliente..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              />
            </div>

            {/* Processos CNJ Link */}
            <div className="border-t border-slate-800 pt-4 space-y-3">
              <span className="text-slate-200 text-xs font-extrabold uppercase tracking-widest flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-indigo-500" /> Vincular Processos do Cliente
              </span>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={processInput}
                  onChange={(e) => setProcessInput(e.target.value)}
                  placeholder="Nº Processo CNJ (20 dígitos)"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={addProcessToList}
                  className="bg-indigo-600 hover:bg-indigo-750 text-white font-bold px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" /> Vincular
                </button>
              </div>

              {/* Chips of processes */}
              {processList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950 border border-slate-800 rounded-xl max-h-32 overflow-y-auto">
                  {processList.map((proc, idx) => (
                    <span key={idx} className="flex items-center gap-1 bg-slate-900 border border-slate-800 text-slate-300 text-xxs px-2.5 py-1 rounded-full font-mono">
                      {proc}
                      <button type="button" onClick={() => removeProcessFromList(proc)} className="text-slate-500 hover:text-rose-400">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="flex gap-3 border-t border-slate-800 pt-4">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-sm transition-colors"
                >
                  Cancelar Edição
                </button>
              )}
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-750 text-white font-bold py-2.5 rounded-xl text-sm transition-colors shadow-lg shadow-indigo-600/15"
              >
                {editingId ? "Salvar Alterações" : "Cadastrar Cliente"}
              </button>
            </div>

          </form>
        </div>

        {/* Right Side: Clients list */}
        <div className="xl:col-span-7 space-y-6">
          
          {/* Filters card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar cliente por nome, e-mail ou documento..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div className="text-slate-400 text-xs font-semibold whitespace-nowrap bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl">
              Total: <span className="text-indigo-400 font-bold">{filteredClients.length}</span>
            </div>
          </div>

          {/* Clients Cards Grid */}
          {loading ? (
            <div className="flex justify-center items-center py-20 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
              <Info className="h-10 w-10 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-semibold">Nenhum cliente cadastrado correspondendo à pesquisa.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredClients.map((client) => (
                <div 
                  key={client.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xl transition-all duration-200 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Header: Name and Document */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-base text-white truncate">{client.nome}</h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-xxs px-2 py-0.5 rounded-full font-bold ${
                            client.tipo === "Física" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          }`}>
                            {client.tipo}
                          </span>
                          <span className="text-slate-500 text-xs font-mono">
                            {client.tipo === "Física" 
                              ? client.cpf_cnpj.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
                              : client.cpf_cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
                            }
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleEdit(client)}
                          className="p-2 bg-slate-800 hover:bg-indigo-600/20 border border-slate-750 text-slate-300 hover:text-indigo-400 rounded-xl transition-colors"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(client.id)}
                          className="p-2 bg-slate-800 hover:bg-rose-600/20 border border-slate-750 text-slate-300 hover:text-rose-400 rounded-xl transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Contacts Info */}
                    <div className="space-y-1.5 text-xs text-slate-400 border-t border-slate-800/60 pt-3">
                      {client.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-slate-500" />
                          <span className="truncate">{client.email}</span>
                        </div>
                      )}
                      {client.telefone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-slate-500" />
                          <span>{client.telefone.length === 11 ? client.telefone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3") : client.telefone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3")}</span>
                        </div>
                      )}
                      {(client.cidade || client.estado) && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-slate-500" />
                          <span>{client.cidade} / {client.estado}</span>
                        </div>
                      )}
                    </div>

                    {/* Associated Processes List */}
                    <div className="space-y-2 border-t border-slate-800/60 pt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <ClipboardList className="h-4 w-4 text-indigo-500" /> Processos
                        </span>
                        <span className="bg-slate-950 border border-slate-800 text-slate-400 font-bold px-2 py-0.5 rounded-full text-xxs">
                          {client.processos?.length || 0}
                        </span>
                      </div>
                      
                      {client.processos && client.processos.length > 0 ? (
                        <div className="space-y-1.5 max-h-28 overflow-y-auto">
                          {client.processos.map((proc) => (
                            <div key={proc.id} className="p-2 bg-slate-950/80 border border-slate-850 rounded-xl space-y-1">
                              <div className="flex justify-between text-xxs font-mono">
                                <span className="text-indigo-400 font-semibold">{proc.mascara}</span>
                                <span className="text-rose-400 font-semibold">{proc.data_limite_estimada}</span>
                              </div>
                              {proc.descricao && <p className="text-slate-500 text-xxs truncate">{proc.descricao}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 text-xxs italic">Nenhum processo vinculado.</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
