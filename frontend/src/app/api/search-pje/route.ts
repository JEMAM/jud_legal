import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const params = await req.json();

    const data_ini = params.data_ini;
    const data_fim = params.data_fim;
    const num_proc = params.num_proc || "";
    const tribunal = params.tribunal || "TODOS";
    const nome = params.nome_part || "";
    const num_oab = params.num_oab || "";
    const estado_oab = params.estado_oab || "";
    const pagina = params.pagina || 1;
    const itens_pagina = params.itens_pagina || 50;

    const baseParams: Record<string, any> = {
      pagina: pagina,
      itensPorPagina: itens_pagina,
      dataInicial: data_ini,
      dataFinal: data_fim,
    };

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

    if (!res.ok) {
      return NextResponse.json({ status: `⚠️ Erro na requisição PJe (Status ${res.status})`, results: [] });
    }

    const data = await res.json();
    const items = data.items || [];

    return NextResponse.json({
      status: `✅ Sucesso! ${items.length} registros localizados.`,
      results: items,
    });
  } catch (error: any) {
    return NextResponse.json({ status: `❌ Erro ao consultar PJe: ${error.message}`, results: [] }, { status: 500 });
  }
}
