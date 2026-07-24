import { NextRequest, NextResponse } from "next/server";
import { cleanPublicationText } from "@/lib/htmlUtils";

export const preferredRegion = "gru1";

function cleanHtml(html: string): string {
  return cleanPublicationText(html);
}

function extractCNJ(text: string): string {
  const match = text.match(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/);
  return match ? match[0] : "CNJ Não Identificado";
}

function formatDate(raw: any): string {
  if (!raw || raw === "-") return "-";
  const str = String(raw).trim();
  const datePart = str.split(" ")[0].split("T")[0];
  const parts = datePart.split("-");
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return datePart;
  }
  return str;
}

function toYYYYMMDD(dateStr: string): string {
  if (!dateStr) return "";
  const cleaned = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  const parts = cleaned.split(/[-/]/);
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    const params = await req.json();

    const data_ini = toYYYYMMDD(params.data_ini || "");
    const data_fim = toYYYYMMDD(params.data_fim || "");
    const num_proc = params.num_proc || "";
    const tribunal = params.tribunal || "TODOS";
    const nome = params.nome_part || "";
    const num_oab = params.num_oab || "";
    const estado_oab = params.estado_oab || "";
    const pagina = params.pagina || 1;
    const itens_pagina = params.itens_pagina || 50;
    const apenas_monitorados = Boolean(params.apenas_monitorados);
    const monitored_cnjs: string[] = Array.isArray(params.monitored_cnjs) ? params.monitored_cnjs : [];

    // Conjunto de dígitos dos processos monitorados
    const monitoredSet = new Set(monitored_cnjs.map(c => String(c).replace(/\D/g, "")).filter(Boolean));

    // Se "Apenas Monitorados" estiver ativo e a lista de processos monitorados estiver vazia
    if (apenas_monitorados && monitoredSet.size === 0 && !num_proc) {
      return NextResponse.json({
        status: "⚠️ Nenhum processo monitorado selecionado no filtro.",
        results: [],
      });
    }

    let rawItems: any[] = [];

    // Caso 1: Busca por OAB, Nome, Tribunal ou Número de Processo específico
    if (num_proc || num_oab || nome || tribunal !== "TODOS") {
      const baseParams: Record<string, any> = {
        pagina: pagina,
        itensPorPagina: itens_pagina,
      };

      if (data_ini) {
        baseParams.dataDisponibilizacaoInicio = data_ini;
        baseParams.dataInicial = data_ini;
      }
      if (data_fim) {
        baseParams.dataDisponibilizacaoFim = data_fim;
        baseParams.dataFinal = data_fim;
      }

      if (num_proc) {
        baseParams.numeroProcesso = num_proc.replace(/\D/g, "");
      } else {
        if (tribunal && tribunal !== "TODOS") baseParams.siglaTribunal = tribunal.trim().toUpperCase();
        if (nome) baseParams.nomeParte = nome.trim();
        if (num_oab) baseParams.oab = num_oab.replace(/\D/g, "");
        if (estado_oab) baseParams.ufOab = estado_oab.trim().toUpperCase();
      }

      const queryString = new URLSearchParams(baseParams).toString();
      const targetUrl = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?${queryString}`;

      const res = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        next: { revalidate: 0 },
      });

      if (res.ok) {
        const data = await res.json();
        rawItems = data.items || [];
      }
    } else if (apenas_monitorados && monitoredSet.size > 0) {
      // Caso 2: "Apenas Monitorados" sem OAB/Nome preenchidos -> busca cada processo monitorado individualmente
      const promises = Array.from(monitoredSet).map(async (cnj) => {
        const baseParams: Record<string, any> = {
          pagina: pagina,
          itensPorPagina: itens_pagina,
          numeroProcesso: cnj,
        };
        if (data_ini) {
          baseParams.dataDisponibilizacaoInicio = data_ini;
          baseParams.dataInicial = data_ini;
        }
        if (data_fim) {
          baseParams.dataDisponibilizacaoFim = data_fim;
          baseParams.dataFinal = data_fim;
        }

        const queryString = new URLSearchParams(baseParams as any).toString();
        const targetUrl = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?${queryString}`;

        try {
          const res = await fetch(targetUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              "Accept": "application/json, text/plain, */*",
            },
            next: { revalidate: 0 },
          });
          if (res.ok) {
            const data = await res.json();
            return data.items || [];
          }
        } catch (e) {
          console.error("Erro ao buscar processo monitorado:", cnj, e);
        }
        return [];
      });

      const itemLists = await Promise.all(promises);
      rawItems = itemLists.flat();
    }

    // Filtrar resultados para conter APENAS os processos monitorados quando o filtro estiver ativo
    let filteredItems = rawItems;
    if (apenas_monitorados && monitoredSet.size > 0) {
      filteredItems = rawItems.filter((item: any) => {
        const textoLimpo = cleanHtml(item.texto || "");
        const nProc = item.numeroprocessocommascara || item.numero_processo || item.numeroProcesso || item.numero || extractCNJ(textoLimpo);
        const cnjDigits = String(nProc).replace(/\D/g, "");
        return monitoredSet.has(cnjDigits);
      });
    }

    const rows = filteredItems.map((item: any, idx: number) => {
      const textoLimpo = cleanHtml(item.texto || "");
      const nProc = item.numeroprocessocommascara || item.numero_processo || item.numeroProcesso || item.numero || extractCNJ(textoLimpo);
      const sigla = item.siglaTribunal || item.sigla || "PJe";
      const tipo = item.tipoComunicacao || "Outros";
      const dDisp = formatDate(item.data_disponibilizacao || item.datadisponibilizacao || item.dataDisponibilizacao);

      const destLista = item.destinatarios || item.destinatarioadvogados || [];
      const destNomes = Array.isArray(destLista) ? destLista.map((d: any) => typeof d === "object" ? d.nome : d).filter(Boolean) : [];
      const destinatariosStr = destNomes.length > 0 ? destNomes.join(", ") : "Não informado";

      return {
        linha: idx + 1,
        processo_cnj: nProc,
        tribunal: sigla,
        tipo: tipo,
        data_disp: dDisp,
        destinatarios: destinatariosStr,
        conteudo_resumo: textoLimpo.substring(0, 100) + "...",
        conteudo_completo: textoLimpo,
      };
    });

    const statusMsg = apenas_monitorados
      ? `✅ Sucesso! ${rows.length} registros localizados para os processos monitorados.`
      : `✅ Sucesso! ${rows.length} registros localizados.`;

    return NextResponse.json({
      status: statusMsg,
      results: rows,
    });
  } catch (error: any) {
    return NextResponse.json({ status: `❌ Erro ao consultar PJe: ${error.message}`, results: [] }, { status: 500 });
  }
}
