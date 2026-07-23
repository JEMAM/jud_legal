import asyncio
from datetime import datetime, timedelta, date
from html.parser import HTMLParser
import os
import re
import warnings

# Ignora avisos de depreciação do Starlette e outros pacotes de terceiros no Gradio
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", message=".*HTTP_422_UNPROCESSABLE_ENTITY.*")
warnings.filterwarnings("ignore", message=".*StarletteDeprecationWarning.*")
from typing import List, Optional, Tuple
import pandas as pd
from httpx import AsyncClient
import gradio as gr
from loguru import logger

# Importações do framework Agno para Agentes de IA
from agno.agent import Agent
from agno.models.ollama import Ollama

import sqlite3

# =====================================================================
# 🗄️ MÓDULO DE BANCO DE DADOS (SQLite - Processos do Escritório)
# =====================================================================

DB_FILE = "processos.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS processos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero TEXT UNIQUE NOT NULL,
            mascara TEXT,
            cliente TEXT,
            descricao TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data_limite_estimada TEXT DEFAULT 'N/A',
            resumo TEXT DEFAULT ''
        )
    """)
    # Migração para tabelas existentes sem as novas colunas
    cursor.execute("PRAGMA table_info(processos)")
    columns = [col[1] for col in cursor.fetchall()]
    if "data_limite_estimada" not in columns:
        cursor.execute("ALTER TABLE processos ADD COLUMN data_limite_estimada TEXT DEFAULT 'N/A'")
    if "resumo" not in columns:
        cursor.execute("ALTER TABLE processos ADD COLUMN resumo TEXT DEFAULT ''")

    # Tabela de tarefas Kanban de cada processo
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS kanban_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            processo_id INTEGER,
            titulo TEXT NOT NULL,
            descricao TEXT,
            status TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(processo_id) REFERENCES processos(id) ON DELETE CASCADE
        )
    """)
    conn.commit()
    conn.close()

# Inicializa o banco de dados imediatamente no import
init_db()

def adicionar_processo_db(numero_masked: str, cliente: str = "", descricao: str = "") -> Tuple[bool, str]:
    if not numero_masked or not numero_masked.strip():
        return False, "Número de processo não fornecido."
    numero_limpo = "".join(filter(str.isdigit, numero_masked))
    if not numero_limpo:
        return False, "O número do processo deve conter dígitos."
    
    mascara = numero_masked.strip()
    if len(numero_limpo) == 20:
        mascara = f"{numero_limpo[0:7]}-{numero_limpo[7:9]}.{numero_limpo[9:13]}.{numero_limpo[13]}.{numero_limpo[14:16]}.{numero_limpo[16:20]}"
        
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO processos (numero, mascara, cliente, descricao, data_limite_estimada, resumo) VALUES (?, ?, ?, ?, ?, ?)",
            (numero_limpo, mascara, cliente, descricao, "N/A", "")
        )
        conn.commit()
        conn.close()
        return True, "Processo cadastrado com sucesso!"
    except sqlite3.IntegrityError:
        return False, "Processo já cadastrado no banco do escritório."
    except Exception as e:
        return False, f"Erro ao acessar banco de dados: {str(e)}"

def listar_processos_db() -> pd.DataFrame:
    try:
        conn = sqlite3.connect(DB_FILE)
        df = pd.read_sql_query("SELECT id, mascara as 'Processo (CNJ)', cliente as 'Cliente / Parte', descricao as 'Descrição / Observação', data_limite_estimada as 'Data Limite Estimada', resumo as 'Resumo do Processo' FROM processos ORDER BY id DESC", conn)
        conn.close()
        return df
    except Exception as e:
        logger.error(f"Erro ao listar processos: {e}")
        return pd.DataFrame(columns=["id", "Processo (CNJ)", "Cliente / Parte", "Descrição / Observação", "Data Limite Estimada", "Resumo do Processo"])

def atualizar_processo_dados_ia(numero_masked: str, data_limite: str, resumo: str):
    try:
        numero_limpo = "".join(filter(str.isdigit, numero_masked))
        if not numero_limpo:
            return
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM processos WHERE numero = ?", (numero_limpo,))
        row = cursor.fetchone()
        if row:
            cursor.execute(
                "UPDATE processos SET data_limite_estimada = ?, resumo = ? WHERE numero = ?",
                (data_limite, resumo, numero_limpo)
            )
            conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Erro ao atualizar dados de IA do processo no DB: {e}")

def remover_processo_db(id_processo: int) -> Tuple[bool, str]:
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM processos WHERE id = ?", (id_processo,))
        conn.commit()
        conn.close()
        return True, "Processo removido com sucesso!"
    except Exception as e:
        return False, f"Erro ao remover processo: {str(e)}"

def obter_choices_processos() -> List[str]:
    try:
        df = listar_processos_db()
        if df.empty:
            return ["Nenhum"]
        return ["Nenhum"] + df["Processo (CNJ)"].tolist()
    except Exception:
        return ["Nenhum"]

# =====================================================================
# 📋 MÓDULO DO KANBAN DE TAREFAS POR PROCESSO
# =====================================================================

def obter_id_processo_por_mascara_ou_numero(proc_masked: str) -> Optional[int]:
    if not proc_masked or proc_masked == "Nenhum" or proc_masked == "Selecione":
        return None
    limpo = "".join(filter(str.isdigit, proc_masked))
    if not limpo:
        return None
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM processos WHERE numero = ?", (limpo,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return row[0]
    except Exception as e:
        logger.error(f"Erro ao obter ID do processo: {e}")
    return None

def adicionar_tarefa_kanban(processo_id: int, titulo: str, descricao: str = "", status: str = "todo") -> bool:
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO kanban_tasks (processo_id, titulo, descricao, status) VALUES (?, ?, ?, ?)",
            (processo_id, titulo, descricao, status)
        )
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Erro ao adicionar tarefa Kanban: {e}")
        return False

def remover_tarefa_kanban(task_id: int) -> bool:
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM kanban_tasks WHERE id = ?", (task_id,))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Erro ao remover tarefa Kanban: {e}")
        return False

def atualizar_status_tarefa_kanban(task_id: int, novo_status: str) -> bool:
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("UPDATE kanban_tasks SET status = ? WHERE id = ?", (novo_status, task_id))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Erro ao atualizar status do Kanban: {e}")
        return False

def obter_tarefas_kanban(processo_id: int) -> List[dict]:
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT id, titulo, descricao, status, created_at FROM kanban_tasks WHERE processo_id = ? ORDER BY id ASC", (processo_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error(f"Erro ao obter tarefas Kanban: {e}")
        return []

def gerar_kanban_html(processo_id: Optional[int]) -> str:
    if not processo_id:
        return """
        <div style="text-align: center; padding: 40px; color: #64748b; font-family: 'Outfit', sans-serif;">
            <p style="font-size: 16px; margin: 0;">⚠️ Nenhum processo selecionado para exibição do Kanban.</p>
            <p style="font-size: 13px; margin: 5px 0 0 0;">Selecione um processo cadastrado no banco do escritório no dropdown acima para visualizar e gerenciar suas tarefas.</p>
        </div>
        """
        
    tarefas = obter_tarefas_kanban(processo_id)
    
    colunas = {
        "todo": {"titulo": "A Fazer", "classe": "kanban-column-todo", "tarefas": []},
        "in_progress": {"titulo": "Em Andamento", "classe": "kanban-column-in_progress", "tarefas": []},
        "blocked": {"titulo": "Bloqueado", "classe": "kanban-column-blocked", "tarefas": []},
        "done": {"titulo": "Concluído", "classe": "kanban-column-done", "tarefas": []}
    }
    
    for t in tarefas:
        status = t["status"]
        if status in colunas:
            colunas[status]["tarefas"].append(t)
            
    html = """
    <div style="font-family: 'Outfit', sans-serif; padding: 10px;">
        <style>
            .kanban-board { display: flex; gap: 15px; width: 100%; margin-top: 10px; }
            .kanban-column { flex: 1; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; min-height: 400px; display: flex; flex-direction: column; transition: background-color 0.2s; }
            .kanban-column-title { font-size: 14px; font-weight: 800; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 6px; border-bottom: 2px solid; }
            .kanban-column-todo { color: #1e3a8a; border-bottom-color: #3b82f6; }
            .kanban-column-in_progress { color: #854d0e; border-bottom-color: #eab308; }
            .kanban-column-blocked { color: #991b1b; border-bottom-color: #ef4444; }
            .kanban-column-done { color: #065f46; border-bottom-color: #10b981; }
            .kanban-cards { display: flex; flex-direction: column; gap: 10px; flex-grow: 1; }
            .kanban-card { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; position: relative; box-shadow: 0 1px 3px rgba(0,0,0,0.05); cursor: grab; transition: box-shadow 0.2s; }
            .kanban-card:active { cursor: grabbing; }
            .kanban-card:hover { box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
            .kanban-card-title { font-weight: 600; font-size: 13px; color: #1e293b; margin-bottom: 4px; padding-right: 15px; word-break: break-word; }
            .kanban-card-desc { font-size: 11px; color: #64748b; line-height: 1.4; word-break: break-word; }
            .kanban-card-delete { position: absolute; top: 6px; right: 6px; background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px; line-height: 1; padding: 0; }
            .kanban-card-delete:hover { color: #ef4444; }
            .kanban-badge { font-size: 11px; background-color: #e2e8f0; color: #475569; padding: 1px 6px; border-radius: 10px; }
        </style>
        <div class="kanban-board">
    """
    
    for status, col in colunas.items():
        cards_html = ""
        for t in col["tarefas"]:
            desc_val = t["descricao"] or ""
            desc_html = f'<div class="kanban-card-desc">{desc_val}</div>' if desc_val else ""
            
            cards_html += f"""
            <div class="kanban-card" draggable="true" ondragstart="window.kanbanDragStart(event, '{t['id']}')">
                <div class="kanban-card-title">{t['titulo']}</div>
                {desc_html}
                <button class="kanban-card-delete" onclick="window.kanbanDeleteTask(event, '{t['id']}')">×</button>
            </div>
            """
            
        html += f"""
        <div class="kanban-column" ondragover="event.preventDefault(); this.style.backgroundColor='#cbd5e1';" ondragleave="this.style.backgroundColor='#f8fafc';" ondrop="this.style.backgroundColor='#f8fafc'; window.kanbanDrop(event, '{status}')">
            <div class="kanban-column-title {col['classe']}">
                <span>{col['titulo']}</span>
                <span class="kanban-badge">{len(col['tarefas'])}</span>
            </div>
            <div class="kanban-cards">
                {cards_html}
            </div>
        </div>
        """
        
    html += """
        </div>
    </div>
    """
    return html

def processar_evento_kanban(click_val, proc_masked):
    if not click_val:
        proc_id = obter_id_processo_por_mascara_ou_numero(proc_masked)
        return gerar_kanban_html(proc_id), "", ""
        
    parts = click_val.split(":", 1)
    status_msg = ""
    if len(parts) == 2:
        action = parts[0]
        payload = parts[1]
        
        if action == "MOVE_TASK":
            subparts = payload.split("|")
            if len(subparts) == 2:
                task_id = int(subparts[0])
                target_status = subparts[1]
                success = atualizar_status_tarefa_kanban(task_id, target_status)
                if success:
                    status_msg = "✅ Tarefa movida!"
                    
        elif action == "DELETE_TASK":
            task_id = int(payload)
            success = remover_tarefa_kanban(task_id)
            if success:
                status_msg = "❌ Tarefa removida!"
                
    proc_id = obter_id_processo_por_mascara_ou_numero(proc_masked)
    return gerar_kanban_html(proc_id), status_msg, ""

def form_adicionar_tarefa_kanban(proc_masked, titulo, descricao, status):
    if not proc_masked or proc_masked == "Nenhum":
        return gr.update(), "⚠️ Erro: Selecione um processo primeiro.", "", ""
    if not titulo or not titulo.strip():
        return gr.update(), "⚠️ Erro: Título da tarefa é obrigatório.", "", ""
        
    proc_id = obter_id_processo_por_mascara_ou_numero(proc_masked)
    if proc_id:
        success = adicionar_tarefa_kanban(proc_id, titulo.strip(), descricao.strip(), status)
        if success:
            kanban_html = gerar_kanban_html(proc_id)
            return kanban_html, "✅ Tarefa criada com sucesso!", "", ""
            
    return gr.update(), "⚠️ Erro ao adicionar tarefa no banco.", gr.update(), gr.update()

# =====================================================================
# 🧼 MÓDULO DE LIMPEZA E EXTRAÇÃO AVANÇADA (Padrão app6.2)
# =====================================================================

class HTMLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.reset()
        self.fed = []
        self.ignore = False
    def handle_starttag(self, tag, attrs):
        if tag.lower() in ("style", "script"):
            self.ignore = True
    def handle_endtag(self, tag):
        if tag.lower() in ("style", "script"):
            self.ignore = False
    def handle_data(self, d):
        if not self.ignore:
            self.fed.append(d)
    def get_data(self):
        return "".join(self.fed)

def limpar_html(html_text: Optional[str]) -> str:
    if not html_text:
        return "Sem conteúdo cadastrado."
    if "Processo sigiloso" in html_text:
        return "⚠️ CONTEÚDO BLOQUEADO: Processo corre em Segredo de Justiça."
    try:
        stripper = HTMLStripper()
        stripper.feed(html_text)
        return " ".join(stripper.get_data().split())
    except Exception:
        return html_text or ""

def extrair_processo_fallback(texto: str) -> str:
    padrao_cnj = r'\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}'
    match = re.search(padrao_cnj, texto)
    return match.group(0) if match else "Não identificado no texto"

def converter_data_str(data_str: str) -> Optional[date]:
    if not data_str:
        return None
    data_str = str(data_str).strip()
    
    # Suporte a timestamp Unix (float ou int) do gr.DateTime
    try:
        val = float(data_str)
        if val > 1e11:  # em milissegundos
            val = val / 1000.0
        return datetime.fromtimestamp(val).date()
    except ValueError:
        pass
        
    # Remove aspas extras se houver
    data_str = data_str.replace('"', '').replace("'", '').strip()
    
    # Tratamento de datas por extenso em português: "29 de agosto de 2026"
    import re
    match_pt = re.search(r"(\d{1,2})\s+de\s+([a-zA-ZçÇãÃóÓ]+)\s+de\s+(\d{4})", data_str, re.IGNORECASE)
    if match_pt:
        dia = int(match_pt.group(1))
        mes_nome = match_pt.group(2).lower()
        ano = int(match_pt.group(3))
        meses_pt = {
            "janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3, "abril": 4, "maio": 5, "junho": 6,
            "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12
        }
        if mes_nome in meses_pt:
            mes = meses_pt[mes_nome]
            try:
                return date(ano, mes, dia)
            except ValueError:
                pass

    # Apenas a parte da data caso venha com hora ou lixo
    clean_date = data_str.split(" ")[0].strip()
    
    formats = (
        "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d",
        "%d-%m-%y", "%d/%m/%y", "%y-%m-%d", "%y/%m/%d"
    )
    for fmt in formats:
        try:
            dt = datetime.strptime(clean_date, fmt).date()
            if dt.year < 100:
                dt = dt.replace(year=dt.year + 2000)
            return dt
        except ValueError:
            continue
    return None

def obter_dia_semana_pt(data_str: str) -> str:
    if not data_str or data_str == "-":
        return ""
    clean_date = data_str.split(" ")[0].strip()
    try:
        dt = converter_data_str(clean_date)
        if not dt:
            return ""
        dias = {
            0: "Segunda-feira",
            1: "Terça-feira",
            2: "Quarta-feira",
            3: "Quinta-feira",
            4: "Sexta-feira",
            5: "Sábado",
            6: "Domingo"
        }
        return f" ({dias.get(dt.weekday(), '')})"
    except Exception:
        return ""

def gerar_chunks_de_datas(data_ini_str: str, data_fim_str: str, dias_por_bloco: int = 90) -> List[Tuple[str, str]]:
    d_ini = converter_data_str(data_ini_str)
    d_fim = converter_data_str(data_fim_str)
    if not d_ini or not d_fim:
        logger.error(f"Erro ao converter datas: {data_ini_str}, {data_fim_str}")
        return []

    chunks = []
    atual = d_ini
    while atual <= d_fim:
        proximo = min(atual + timedelta(days=dias_por_bloco - 1), d_fim)
        chunks.append((atual.strftime("%Y-%m-%d"), proximo.strftime("%Y-%m-%d")))
        atual = proximo + timedelta(days=1)
    return chunks

# =====================================================================
# 🗓️ MOTOR DE CÁLCULO DE PRAZOS PROCESSUAIS (CPC/2015)
# =====================================================================

def calcular_pascoa(ano: int) -> date:
    """Calcula o domingo de Páscoa para um dado ano (Meeus/Jones/Butcher)."""
    a = ano % 19
    b = ano // 100
    c = ano % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    L = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * L) // 451
    mes = (h + L - 7 * m + 114) // 31
    dia = ((h + L - 7 * m + 114) % 31) + 1
    return date(ano, mes, dia)

def e_dia_util(dt: date) -> bool:
    """Verifica se uma data é dia útil conforme regras processuais e feriados nacionais."""
    # Finais de semana
    if dt.weekday() >= 5:
        return False
    
    # Recesso do Judiciário (20/12 a 20/01 inclusive) - Suspensão de prazos
    if (dt.month == 12 and dt.day >= 20) or (dt.month == 1 and dt.day <= 20):
        return False
        
    # Feriados Fixos Nacionais (e Dia da Justiça)
    feriados_fixos = {
        (1, 1),    # Confraternização Universal
        (4, 21),   # Tiradentes
        (5, 1),    # Dia do Trabalho
        (9, 7),    # Independência
        (10, 12),  # Nossa Senhora Aparecida
        (11, 2),   # Finados
        (11, 15),  # Proclamação da República
        (11, 20),  # Dia da Consciência Negra
        (12, 8),   # Dia da Justiça
        (12, 25),  # Natal
    }
    if (dt.month, dt.day) in feriados_fixos:
        return False
        
    # Feriados Móveis baseados na Páscoa
    pascoa_dt = calcular_pascoa(dt.year)
    
    carnaval_seg = pascoa_dt - timedelta(days=48)
    carnaval_ter = pascoa_dt - timedelta(days=47)
    cinzas = pascoa_dt - timedelta(days=46)
    quinta_santa = pascoa_dt - timedelta(days=3)
    paixao = pascoa_dt - timedelta(days=2)
    corpus_christi = pascoa_dt + timedelta(days=60)
    
    feriados_moveis = {
        carnaval_seg,
        carnaval_ter,
        cinzas,
        quinta_santa,
        paixao,
        corpus_christi
    }
    if dt in feriados_moveis:
        return False
        
    return True

def proximo_dia_util(dt: date) -> date:
    """Retorna o primeiro dia útil subsequente à data informada."""
    curr = dt + timedelta(days=1)
    while not e_dia_util(curr):
        curr += timedelta(days=1)
    return curr

def calcular_prazo_processual(data_disponibilizacao: str, prazo_dias: int, prazo_dilacao_edital: int = 0) -> str:
    """
    Calcula determinística e oficialmente a data final de um prazo processual sob o CPC/2015.
    
    Esta ferramenta é a única fonte da verdade para o cálculo de datas de prazos e deve ser usada
    sempre que for necessário obter a Data Limite Estimada de um processo. Ela exclui sábados,
    domingos, feriados nacionais (fixos e móveis) e considera a suspensão de prazos durante o
    recesso forense (20 de dezembro a 20 de janeiro).
    
    Args:
        data_disponibilizacao (str): A data de disponibilização oficial no diário, formato DD-MM-YYYY, YYYY-MM-DD ou Unix timestamp.
        prazo_dias (int): A quantidade de dias úteis do prazo processual (ex: 15 para contestação/apelação, 5 para embargos de declaração).
        prazo_dilacao_edital (int): Dilação assinalada para início do prazo em caso de edital (ex: 20 ou 30 dias). Use 0 se não aplicável.
        
    Returns:
        str: Texto markdown com o passo-a-passo detalhado da contagem e o resumo final formatado para IA.
    """
    try:
        # Converter a data de disponibilização
        d0 = converter_data_str(data_disponibilizacao)
        if not d0:
            return f"Erro: Formato de data inválido ({data_disponibilizacao})."
            
        dias_uteis = int(prazo_dias)
        dilacao = int(prazo_dilacao_edital)
        
        if dias_uteis <= 0:
            return "**Data Limite Estimada:** N/A\n\n**Justificativa:** Trata-se de mero expediente ou despacho sem determinação de prazo peremptório."
            
        # 1. Encontrar a data de publicação (primeiro dia útil seguinte à disponibilização)
        d_pub = proximo_dia_util(d0)
        
        # 2. Iniciar a contagem da dilação (se aplicável)
        curr = d_pub
        explicacao_dilacao = ""
        if dilacao > 0:
            passos_dilacao = []
            for d in range(1, dilacao + 1):
                curr = proximo_dia_util(curr)
                passos_dilacao.append(f"  - Dilação Dia {d}: {curr.strftime('%d-%m-%Y')}{obter_dia_semana_pt(curr.strftime('%d-%m-%Y'))}")
            explicacao_dilacao = f"\n**Período de Dilação do Edital ({dilacao} dias):**\n" + "\n".join(passos_dilacao) + "\n"
            # O prazo principal começará após o fim da dilação
            
        # 3. Contagem dos dias úteis do prazo
        passos_prazo = []
        for p in range(1, dias_uteis + 1):
            curr = proximo_dia_util(curr)
            passos_prazo.append(f"| Dia {p} | {curr.strftime('%d-%m-%Y')} | {obter_dia_semana_pt(curr.strftime('%d-%m-%Y')).replace('(', '').replace(')', '').strip()} |")
            
        data_final_br = curr.strftime("%d-%m-%Y")
        
        # Monta a tabela markdown explicativa
        markdown_res = []
        markdown_res.append(f"### ⏱️ Relatório de Contagem de Prazo Legal (CPC/2015)")
        markdown_res.append(f"- **Disponibilização (D0):** {d0.strftime('%d-%m-%Y')}{obter_dia_semana_pt(d0.strftime('%d-%m-%Y'))}")
        markdown_res.append(f"- **Publicação Oficial:** {d_pub.strftime('%d-%m-%Y')}{obter_dia_semana_pt(d_pub.strftime('%d-%m-%Y'))}")
        if dilacao > 0:
            markdown_res.append(f"- **Dilação por Edital:** Sim, {dilacao} dias úteis.")
            markdown_res.append(explicacao_dilacao)
            
        markdown_res.append(f"\n**Tabela de Contagem do Prazo ({dias_uteis} dias úteis):**\n")
        markdown_res.append("| Dia | Data | Dia da Semana | Observação |")
        markdown_res.append("| :--- | :--- | :--- | :--- |")
        for p_str in passos_prazo:
            markdown_res.append(p_str)
            
        markdown_res.append(f"\n**Data Limite Estimada:** {data_final_br}")
        return "\n".join(markdown_res)
    except Exception as e:
        return f"Erro ao calcular prazo processual: {str(e)}"

# =====================================================================
# 🚀 CLIENTE ASSÍNCRONO DA API DO PJe
# =====================================================================

class DjenApiClient:
    BASE_URL = "https://comunicaapi.pje.jus.br/api/v1/comunicacao"

    def __init__(self, timeout: float = 60.0):
        self.timeout = timeout

    async def buscar_publicacoes_slice(self, params: dict) -> List[dict]:
        async with AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(self.BASE_URL, params=params)
                if response.status_code == 200:
                    res_json = response.json()
                    return res_json.get("items", [])
                else:
                    logger.error(f"Erro ao consultar bloco {params.get('dataInicial')}: Status {response.status_code} - {response.text}")
            except Exception as e:
                logger.error(f"Erro ao consultar bloco {params.get('dataInicial')}: {e}")
        return []

client_pje = DjenApiClient()
cache_publicacoes = {}

# =====================================================================
# 🧠 ENGENHARIA DO AGENTE AGNO
# =====================================================================

def carregar_skill_advogado(provedor: str = "", texto_publicacao: str = "") -> str:
    caminho_skill = os.path.join(os.path.dirname(__file__), "SKILL_advogado.md")
    if os.path.exists(caminho_skill):
        try:
            with open(caminho_skill, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            logger.error(f"Erro ao ler arquivo SKILL_advogado.md: {e}")
            return "Você é um Advogado Especialista em Direito Civil brasileiro."
    else:
        return "Você é um Advogado Especialista em Direito Civil brasileiro."

    if provedor.strip().lower() not in ("ollama", "groq"):
        return content

    # Podando a skill para Ollama local para reduzir consumo de memória e contexto
    lines = content.splitlines()
    pruned_lines = []
    
    # 1. Introdução (linhas 1 a 230)
    pruned_lines.extend(lines[:230])
    
    # 2. Busca de Módulos Relevantes baseados no texto da publicação
    texto_busca = str(texto_publicacao).lower()
    
    secoes_especificas = [
        {"nome": "Violência Doméstica / Maria da Penha", "start": 228, "end": 263, "keys": ["maria da penha", "violência doméstica", "protetiva", "agressão"]},
        {"nome": "Família / Guarda / Alimentos", "start": 264, "end": 439, "keys": ["divórcio", "guarda", "alimentos", "pensão", "inventário", "partilha", "herança", "testamento", "sucessões"]},
        {"nome": "Responsabilidade Civil / Danos Morais", "start": 440, "end": 515, "keys": ["moral", "indenização", "responsabilidade civil", "art 186", "dano", "in re ipsa"]},
        {"nome": "Consumidor", "start": 516, "end": 554, "keys": ["consumidor", "relação de consumo", "cdc", "vício", "defeito", "prática abusiva", "cartão", "crédito", "cobrança", "banco", "tarifa"]},
        {"nome": "Imobiliário", "start": 555, "end": 600, "keys": ["imóvel", "locação", "despejo", "usucapião", "condomínio", "inquilinato"]},
        {"nome": "Trabalhista", "start": 601, "end": 640, "keys": ["trabalhista", "clt", "rescisão", "verbas", "salário", "horas extras", "empregado", "demissão"]},
        {"nome": "Previdenciário", "start": 641, "end": 664, "keys": ["previdenciário", "inss", "aposentadoria", "benefício", "auxílio", "revisão da vida toda"]},
        {"nome": "Tributário", "start": 665, "end": 687, "keys": ["tributo", "tributário", "imposto", "execução fiscal", "icms", "iptu", "iss"]},
        {"nome": "Administrativo", "start": 688, "end": 710, "keys": ["mandado de segurança", "improbidade", "licitação", "concurso"]},
        {"nome": "LGPD / Digital", "start": 711, "end": 740, "keys": ["lgpd", "dados", "privacidade", "crimes digitais", "internet"]},
        {"nome": "Empresarial / Falência", "start": 741, "end": 770, "keys": ["falência", "recuperação judicial", "sociedade", "ltda", "s/a", "empresarial"]}
    ]
    
    for sec in secoes_especificas:
        if any(k in texto_busca for k in sec["keys"]):
            pruned_lines.extend(lines[sec["start"]:sec["end"]])
            
    # 3. Parte Final (linha 770 em diante)
    pruned_lines.extend(lines[770:])
    
    pruned_content = "\n".join(pruned_lines)
    logger.info(f"{provedor.capitalize()} dynamic pruning: {len(lines)} -> {len(pruned_lines)} lines.")
    return pruned_content

def inicializar_agentes(provedor: str, modelo_id: str, api_key_or_host: str, texto_publicacao: str = ""):
    if not modelo_id or not modelo_id.strip():
        raise ValueError("Modelo LLM não selecionado.")
        
    provedor = provedor.strip()
    api_key_or_host = api_key_or_host.strip() if api_key_or_host else ""
    
    if provedor == "Gemini":
        from agno.models.google import Gemini
        llm_model = Gemini(id=modelo_id, api_key=api_key_or_host or None)
    elif provedor == "Anthropic":
        from agno.models.anthropic import Claude
        llm_model = Claude(id=modelo_id, api_key=api_key_or_host or None)
    elif provedor == "ChatGPT":
        from agno.models.openai import OpenAIChat
        llm_model = OpenAIChat(id=modelo_id, api_key=api_key_or_host or None)
    elif provedor == "Groq":
        from agno.models.groq import Groq
        llm_model = Groq(id=modelo_id, api_key=api_key_or_host or None)
    else:  # Ollama
        from agno.models.ollama import Ollama
        host = api_key_or_host if api_key_or_host else "http://localhost:11434"
        llm_model = Ollama(id=modelo_id, host=host)
        
    instrucoes_skill = carregar_skill_advogado(provedor, texto_publicacao)
    
    agente_prazos = Agent(
        model=llm_model,
        description="Você é o Controller Jurídico do Legal One AI, especialista em prazos do CPC/2015.",
        instructions=[
            "Sua função é analisar publicações jurídicas e calcular prazos com base no CPC/2015.",
            "Você tem acesso à ferramenta `calcular_prazo_processual` para calcular deterministicamente os prazos em dias úteis sob o CPC/2015, considerando recessos e feriados.",
            "Instruções cruciais:",
            "1. Identifique a data de disponibilização oficial (informada no campo 'Data Disp' no contexto).",
            "2. Identifique o prazo legal em dias (como 15 dias para contestação, 5 dias para embargos, etc.).",
            "3. Sempre chame a ferramenta `calcular_prazo_processual` fornecendo a data de disponibilização (em formato legível ou ISO) e o prazo de dias para realizar a contagem determinística.",
            "   ATENÇÃO PARA CITAÇÃO POR EDITAL: Em caso de edital com dilação de prazo (ex: edital de 20 dias, e depois corre o prazo de 15 dias de defesa), você DEVE passar o prazo de resposta (ex: 15) no parâmetro `prazo_dias` e a dilação (ex: 20) no parâmetro `prazo_dilacao_edital` em uma ÚNICA chamada da ferramenta. NUNCA tente calcular uma parte do prazo manualmente ou fazer chamadas separadas.",
            "4. Não realize cálculos mentais ou deduções textuais de datas finais por conta própria. Confie integralmente na ferramenta e transcreva sua saída literal no relatório.",
            "5. Ao final de sua resposta, forneça obrigatoriamente um resumo com uma linha em destaque no seguinte formato exato:",
            "**Data Limite Estimada:** DD-MM-YYYY"
        ],
        tools=[calcular_prazo_processual],
        markdown=True
    )

    agente_minutas = Agent(
        model=llm_model,
        description="Você é um Advogado Redator sênior focado em peças processuais.",
        instructions=[instrucoes_skill, "Redija um esqueleto estruturado de petição baseado na publicação e tese fornecida."],
        markdown=True
    )

    agente_agenda = Agent(
        model=llm_model,
        description="Você é o Assistente de Agenda Executiva do escritório.",
        instructions=[
            "Sua única tarefa é ler a publicação jurídica e a análise de prazos feita pelo Controller Jurídico para sugerir um compromisso na agenda.",
            "Utilize obrigatoriamente a 'Data Limite Estimada' calculada pelo Controller Jurídico como a data do compromisso.",
            "ATENÇÃO: Você deve retornar UNICAMENTE o bloco de código JSON abaixo (delimitado por ```json ... ```). Não escreva NADA fora do bloco JSON.",
            "Retorne o seguinte formato JSON exato:",
            "```json\n"
            "[\n"
            "  {{\"data\": \"YYYY-MM-DD\", \"hora\": \"HH:MM\", \"descricao\": \"[Processo CNJ] Data Limite Estimada: Descrição\"}}\n"
            "]\n"
            "```"
        ],
        markdown=True
    )
    
    return agente_prazos, agente_minutas, agente_agenda

# =====================================================================
# 🎛️ COORDENAÇÃO DE DADOS
# =====================================================================

LISTA_TRIBUNAIS = [
    "TODOS", "STF", "STJ", "TST", "TSE", 
    "TRF1", "TRF2", "TRF3", "TRF4", "TRF5", "TRF6",
    "TJSP", "TJRJ", "TJMG", "TJRS", "TJPR", "TJBA", "TJSC", "TJGO", "TJPE", "TJCE", "TJDF"
]

AGENDA_DICT = {}

# =====================================================================
# 🎛️ LÓGICA DE EXECUÇÃO E WORKFLOWS
# =====================================================================

async def executar_pesquisa_pje(data_ini, data_fim, num_proc, tribunal, nome, num_oab, estado_oab, pag, qtd_itens, apenas_monitorados=False, processo_selecionado="Nenhum"):
    global cache_publicacoes
    cache_publicacoes.clear()

    # Sanitiza a página para garantir que seja um inteiro >= 1 (ComunicaAPI falha com HTTP 500 se pagina for 0)
    try:
        p_num = int(pag)
        if p_num <= 0:
            p_num = 1
    except (ValueError, TypeError):
        p_num = 1

    if not data_ini or not data_fim:
        return "⚠️ Erro: As datas Inicial e Final são obrigatórias.", pd.DataFrame()

    chunks = gerar_chunks_de_datas(data_ini, data_fim, dias_por_bloco=90)
    if not chunks:
        return "❌ Erro ao processar as datas. Verifique se digitou corretamente no formato DD-MM-YYYY.", pd.DataFrame()

    # Determinar a lista de processos para buscar
    processos_para_buscar = []
    processos_nomes_dict = {}
    if apenas_monitorados:
        df_db = listar_processos_db()
        if df_db.empty:
            return "⚠️ Erro: Nenhum processo cadastrado no banco do escritório.", pd.DataFrame()
        for idx, row in df_db.iterrows():
            p = row["Processo (CNJ)"]
            limpo = "".join(filter(str.isdigit, str(p)))
            if limpo:
                processos_para_buscar.append(limpo)
                processos_nomes_dict[limpo] = {
                    "mascara": p,
                    "cliente": row.get("Cliente / Parte") or "Escritório"
                }
        if not processos_para_buscar:
            return "⚠️ Erro: Nenhum processo com formato numérico válido no banco.", pd.DataFrame()
    elif processo_selecionado and processo_selecionado != "Nenhum":
        limpo = "".join(filter(str.isdigit, str(processo_selecionado)))
        if limpo:
            processos_para_buscar = [limpo]
    elif num_proc:
        limpo = "".join(filter(str.isdigit, str(num_proc)))
        if limpo:
            processos_para_buscar = [limpo]
    else:
        processos_para_buscar = [None]

    sem = asyncio.Semaphore(10)
    
    async def buscar_com_semaforo(params):
        async with sem:
            try:
                return await client_pje.buscar_publicacoes_slice(params)
            except Exception as e:
                logger.error(f"Erro na requisição da ComunicaAPI: {e}")
                return []

    tarefas = []
    for proc in processos_para_buscar:
        base_params = {"pagina": p_num, "itensPorPagina": int(qtd_itens)}
        if proc:
            base_params["numeroProcesso"] = proc
        else:
            if tribunal and tribunal != "TODOS": base_params["siglaTribunal"] = tribunal.upper().strip()
            if nome and nome.strip(): base_params["nomeParte"] = nome.strip()
            if num_oab and num_oab.strip(): base_params["oab"] = "".join(filter(str.isdigit, num_oab))
            if estado_oab and estado_oab.strip(): base_params["ufOab"] = estado_oab.upper().strip()

        for ini, fim in chunks:
            p = {**base_params, "dataInicial": ini, "dataFinal": fim}
            tarefas.append(buscar_com_semaforo(p))
            
    resultados_fatiados = await asyncio.gather(*tarefas)
    todos_itens = []
    if resultados_fatiados:
        for lista in resultados_fatiados:
            if lista:
                todos_itens.extend(lista)

    d_ini = converter_data_str(data_ini)
    d_fim = converter_data_str(data_fim)

    # 1. Filtramos duplicados e datas nos itens retornados pela API primeiro
    itens_unicos = []
    chaves_vistas = set()
    for item in todos_itens:
        texto_raw = item.get("texto", "")
        texto_limpo = limpar_html(texto_raw)
        
        # Filtro de data local para respeitar as datas selecionadas
        d_disp_raw = item.get("data_disponibilizacao") or item.get("datadisponibilizacao") or item.get("dataDisponibilizacao") or "-"
        d_disp_dt = converter_data_str(d_disp_raw)
        if d_ini and d_fim and d_disp_dt:
            if not (d_ini <= d_disp_dt <= d_fim):
                continue  # Ignora registros fora do intervalo de datas solicitado
                
        n_proc = item.get("numeroprocessocommascara") or item.get("numero_processo") or item.get("numeroProcesso") or item.get("numero") or extrair_processo_fallback(texto_limpo)
        d_disp = formatar_data_com_hora_se_houver(d_disp_raw)
        
        chave = (n_proc, d_disp, texto_limpo[:100])
        if chave not in chaves_vistas:
            chaves_vistas.add(chave)
            itens_unicos.append(item)
            
    # Ordena itens_unicos em ordem cronológica crescente (do mais antigo ao mais recente)
    def obter_data_item(it):
        raw = it.get("data_disponibilizacao") or it.get("datadisponibilizacao") or it.get("dataDisponibilizacao") or "-"
        dt = converter_data_str(raw)
        return dt or date.min

    itens_unicos.sort(key=obter_data_item)
            
    rows = []
    processos_com_publicacao = set()
    
    # 2. Agora criamos as linhas para os itens reais
    for idx, item in enumerate(itens_unicos):
        linha_num = idx + 1
        texto_raw = item.get("texto", "")
        texto_limpo = limpar_html(texto_raw)
        cache_publicacoes[linha_num] = texto_raw or ""
        
        n_proc = item.get("numeroprocessocommascara") or item.get("numero_processo") or item.get("numeroProcesso") or item.get("numero") or extrair_processo_fallback(texto_limpo)
        sigla = item.get("siglaTribunal") or item.get("sigla") or "PJe"
        tipo = item.get("tipoComunicacao") or "Outros"
        
        if n_proc:
            proc_limpo = "".join(filter(str.isdigit, str(n_proc)))
            processos_com_publicacao.add(proc_limpo)
            
        d_disp_raw = item.get("data_disponibilizacao") or item.get("datadisponibilizacao") or item.get("dataDisponibilizacao") or "-"
        d_disp = formatar_data_com_hora_se_houver(d_disp_raw)
        
        dest_lista = item.get("destinatarios", []) or item.get("destinatarioadvogados", [])
        dest_nomes = [d.get("nome") for d in dest_lista if isinstance(d, dict) and d.get("nome")]
        destinatarios_str = ", ".join(dest_nomes) if dest_nomes else "Não informado"

        rows.append({
            "Sel": "☐",
            "Linha": linha_num,
            "Processo (CNJ)": n_proc,
            "Tribunal": sigla,
            "Classe / Tipo": tipo,
            "Data Disponibilização": d_disp,
            "Destinatários Intimados": destinatarios_str,
            "Trecho do Conteúdo": texto_limpo[:100] + "..."
        })

    # 3. Adicionamos os processos monitorados sem publicação
    if apenas_monitorados:
        for proc_limpo in processos_para_buscar:
            if proc_limpo not in processos_com_publicacao:
                info = processos_nomes_dict.get(proc_limpo, {"mascara": proc_limpo, "cliente": "Escritório"})
                linha_num = len(rows) + 1
                cache_publicacoes[linha_num] = ""
                rows.append({
                    "Sel": "☐",
                    "Linha": linha_num,
                    "Processo (CNJ)": info["mascara"],
                    "Tribunal": tribunal.upper() if tribunal and tribunal != "TODOS" else "-",
                    "Classe / Tipo": "Sem Movimentação",
                    "Data Disponibilização": "-",
                    "Destinatários Intimados": info.get("cliente", "-"),
                    "Trecho do Conteúdo": "Nenhuma nova publicação localizada no período selecionado."
                })

    if not rows:
        return f"ℹ️ Nenhum diário localizado para os processos/parâmetros indicados.", pd.DataFrame()

    df = pd.DataFrame(rows)
    
    status_msg = f"✅ Sucesso! {len(df)} registros exibidos (incluindo monitoramentos sem novidades)."
    return status_msg, df[["Sel", "Linha", "Processo (CNJ)", "Tribunal", "Classe / Tipo", "Data Disponibilização", "Destinatários Intimados", "Trecho do Conteúdo"]]

def gerar_resumo_por_dia_e_tribunal(df):
    if df is None or df.empty:
        return "ℹ️ Nenhuma publicação carregada para gerar resumo."
        
    df_valid = df[df["Classe / Tipo"] != "Sem Movimentação"].copy()
    if df_valid.empty:
        return "ℹ️ Nenhuma nova publicação no período para resumir."
        
    df_valid["Data_Limpa"] = df_valid["Data Disponibilização"].apply(lambda x: str(x).split(" ")[0])
    
    grouped = df_valid.groupby(["Data_Limpa", "Tribunal"])["Processo (CNJ)"].nunique().reset_index()
    grouped.rename(columns={"Processo (CNJ)": "Qtd_Processos"}, inplace=True)
    
    def to_date_key(d_str):
        try:
            return datetime.strptime(d_str, "%d-%m-%Y").date()
        except:
            return datetime.min.date()
    grouped["date_key"] = grouped["Data_Limpa"].apply(to_date_key)
    grouped.sort_values(by=["date_key", "Tribunal"], ascending=[False, True], inplace=True)
    
    md = "### 📊 Resumo de Processos com Publicação por Dia e Tribunal\n\n"
    md += "| Data | Tribunal | Quantidade de Processos Únicos |\n"
    md += "| :--- | :--- | :---: |\n"
    for _, row in grouped.iterrows():
        md += f"| {row['Data_Limpa']} | **{row['Tribunal']}** | {row['Qtd_Processos']} |\n"
        
    return md



def carregar_texto_da_linha(df_dados, evt: gr.SelectData):
    try:
        row_idx = evt.index[0]
        # Alterna o estado de seleção na coluna Sel
        current_val = df_dados.at[row_idx, "Sel"]
        new_val = "☑" if current_val == "☐" else "☐"
        df_dados.at[row_idx, "Sel"] = new_val
        
        # Filtra as linhas selecionadas
        df_selected = df_dados[df_dados["Sel"] == "☑"]
        
        if df_selected.empty:
            return df_dados, "", "Nenhuma publicação selecionada."
            
        textos_completos = []
        processos = []
        
        for _, row in df_selected.iterrows():
            linha_num = int(row["Linha"])
            p_cnj = row["Processo (CNJ)"]
            if p_cnj and p_cnj not in processos:
                processos.append(p_cnj)
                
            texto_raw = cache_publicacoes.get(linha_num, "")
            if row["Classe / Tipo"] == "Sem Movimentação":
                texto_puro = "Nenhuma nova publicação localizada no período selecionado."
            else:
                texto_puro = limpar_html(texto_raw)
            
            data_disp_val = row['Data Disponibilização']
            dia_semana = obter_dia_semana_pt(data_disp_val)
            textos_completos.append(
                f"=== PROCESSO: {p_cnj} (Linha {linha_num}) ===\n"
                f"Tribunal: {row['Tribunal']} | Data Disp: {data_disp_val}{dia_semana}\n"
                f"Teor da Publicação:\n{texto_puro}\n"
            )
            
        texto_alvo_val = "\n\n".join(textos_completos)
        processos_val = ", ".join(processos)
        
        return df_dados, processos_val, texto_alvo_val
    except Exception as e:
        logger.error(f"Erro ao processar seleção de linha: {e}")
        return df_dados, "", f"Erro ao processar seleção: {str(e)}"

def disparar_agentes_dje(provedor, modelo_id, api_key_or_host, num_processo, texto_publicacao, tese_defesa):
    if not modelo_id.strip():
        return "❌ Erro: Selecione ou digite o nome do modelo para inicializar os agentes.", "", ""
    if not texto_publicacao.strip() or texto_publicacao.startswith("Selecione") or texto_publicacao.startswith("Nenhuma"):
        return "Erro: Nenhuma publicação válida selecionada.", "", ""
    
    try:
        agente_prazos, agente_minutas, agente_agenda = inicializar_agentes(provedor, modelo_id, api_key_or_host, texto_publicacao)
        contexto = f"Processos Selecionados: {num_processo}\n\nConteúdo das Publicações:\n{texto_publicacao}"
        
        # Ajustando os prompts para suportar análise conjunta/lote de forma clara e estruturada
        prompt_prazos = (
            f"Você recebeu uma análise conjunta de uma ou mais publicações de diário oficial.\n"
            f"Sua função é atuar como Controller Jurídico sênior especialista em prazos do CPC/2015.\n"
            f"Analise CADA publicação separadamente e, para cada processo identificado:\n"
            f"1. Identifique a data de disponibilização oficial (informada no campo 'Data Disp' no contexto).\n"
            f"2. Identifique a natureza da intimação e a quantidade de dias úteis do prazo legal aplicável (por exemplo: 15 dias para contestação, réplica, apelação; 5 dias para embargos de declaração; etc.). Se for citação/intimação por edital, verifique se há dias de dilação (ex: 20 dias).\n"
            f"3. Se houver prazo legal, utilize obrigatoriamente a ferramenta `calcular_prazo_processual` em uma única chamada fornecendo a data de disponibilização oficial, o prazo de dias de resposta em `prazo_dias` (ex: 15) e o prazo de edital/dilação em `prazo_dilacao_edital` (ex: 20). NUNCA divida o cálculo chamando a ferramenta para apenas um dos prazos e calculando o outro manualmente no texto. Transcreva e apresente integralmente no seu relatório o passo-a-passo e a tabela de contagem fornecidos pela ferramenta.\n"
            f"   Se for despacho de mero expediente (como juntada de custas retro ou aguardar audiência designada) sem determinação de prazo peremptório, declare explicitamente que não há prazo ou data limite estimada aplicável.\n"
            f"4. Determine o nível de criticidade (Baixo, Médio, Alto, Crítico) e sugira ações preventivas.\n\n"
            f"Apresente o resultado em markdown rico com tabelas ou badges visuais claros para cada processo.\n\n"
            f"Contexto:\n{contexto}"
        )
        
        prompt_minutas = (
            f"Baseado no contexto e na tese de defesa informada, elabore sugestões estruturadas de esqueletos de petições (contendo Fatos, Fundamentação Jurídica baseada no CPC/2015 e Pedidos formais) de forma separada para cada uma das publicações de processos listadas no contexto.\n\n"
            f"Tese de Defesa: {tese_defesa}\n\n"
            f"Contexto:\n{contexto}"
        )
        
        res_prazos = agente_prazos.run(prompt_prazos)
        res_minutas = agente_minutas.run(prompt_minutas)
        
        prompt_agenda = (
            f"Você é um assistente de agenda jurídica encarregado de extrair e sugerir compromissos da agenda baseando-se no teor das publicações e na análise do Controller Jurídico.\n"
            f"Use obrigatoriamente a 'Data Limite Estimada' calculada pelo Controller Jurídico para preencher os compromissos de prazo fatal correspondentes.\n\n"
            f"Análise de Prazos do Controller Jurídico:\n{res_prazos.content}\n\n"
            f"Sua tarefa é analisar as publicações fornecidas abaixo e identificar todas as datas de prazos fatais (use a 'Data Limite Estimada' calculada), audiências ou compromissos citados.\n"
            f"ATENÇÃO: Você deve retornar UNICAMENTE o bloco de código JSON abaixo (delimitado por ```json ... ```). Não escreva NADA fora do bloco JSON. Não adicione saudações, introduções ou explicações de rodapé.\n\n"
            f"Retorne o seguinte formato JSON exato:\n"
            f"```json\n"
            f"[\n"
            f"  {{\"data\": \"YYYY-MM-DD\", \"hora\": \"HH:MM\", \"descricao\": \"[Processo CNJ] Data Limite Estimada: Descrição\"}}\n"
            f"]\n"
            f"```\n\n"
            f"Contexto:\n{contexto}"
        )
        
        res_agenda_sugestao = agente_agenda.run(prompt_agenda)
        return res_prazos.content, res_minutas.content, res_agenda_sugestao.content
    except Exception as e:
        return f"❌ Erro ao conectar ou executar no provedor '{provedor}' com modelo '{modelo_id}':\n{str(e)}", "", ""

def formatar_data_para_br(data_input) -> str:
    d = converter_data_str(data_input)
    if d:
        return d.strftime("%d-%m-%Y")
    return datetime.now().strftime("%d-%m-%Y")

def formatar_data_com_hora_se_houver(d_disp_raw) -> str:
    if not d_disp_raw or d_disp_raw == "-":
        return "-"
    d_disp_str = str(d_disp_raw).strip()
    
    parsed_dt = None
    for fmt in (
        "%Y-%m-%dT%H:%M:%S.%fZ", 
        "%Y-%m-%dT%H:%M:%SZ", 
        "%Y-%m-%dT%H:%M:%S", 
        "%Y-%m-%d %H:%M:%S", 
        "%Y-%m-%d %H:%M",
        "%d-%m-%Y %H:%M:%S",
        "%d-%m-%Y %H:%M",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M"
    ):
        try:
            parsed_dt = datetime.strptime(d_disp_str, fmt)
            break
        except ValueError:
            continue
            
    if parsed_dt:
        if "T" in d_disp_str or ":" in d_disp_str:
            return parsed_dt.strftime("%d-%m-%Y %H:%M")
        else:
            return parsed_dt.strftime("%d-%m-%Y")
            
    parsed_d = None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            parsed_d = datetime.strptime(d_disp_str.split(" ")[0].split("T")[0], fmt)
            break
        except ValueError:
            continue
    if parsed_d:
        return parsed_d.strftime("%d-%m-%Y")
        
    return d_disp_str

def obter_eventos_dia(data_str: str) -> List[dict]:
    val = AGENDA_DICT.get(data_str, [])
    if isinstance(val, str):
        return [{"hora": "09:00", "descricao": val}]
    return val

def enviar_para_agenda(data_sel, titulo_compromisso, hora_sel="09:00"):
    global AGENDA_DICT
    data_str = formatar_data_para_br(data_sel)
    
    hora_str = str(hora_sel).strip() if hora_sel else "09:00"
    if not re.match(r'^\d{2}:\d{2}$', hora_str):
        hora_str = "09:00"
            
    evento = {"hora": hora_str, "descricao": titulo_compromisso if titulo_compromisso else "Prazo Processual"}
    
    if data_str not in AGENDA_DICT:
        AGENDA_DICT[data_str] = []
    elif isinstance(AGENDA_DICT[data_str], str):
        AGENDA_DICT[data_str] = [{"hora": "09:00", "descricao": AGENDA_DICT[data_str]}]
        
    if evento not in AGENDA_DICT[data_str]:
        AGENDA_DICT[data_str].append(evento)
    AGENDA_DICT[data_str].sort(key=lambda x: x["hora"])
    return "✅ Sucesso: Prazo publicado na Agenda Central!"

def visualizar_data_calendario(data_clicada):
    if not data_clicada:
        return "### 📅 Selecione uma data para consulta."
    data_str = formatar_data_para_br(data_clicada)
    eventos = obter_eventos_dia(data_str)
    if not eventos:
        return f"### 📅 Status para o dia {data_str}:\n\n**Nenhum prazo cadastrado para este dia. O dia está livre!**"
    
    res = f"### 📅 Status para o dia {data_str}:\n\n"
    for ev in eventos:
        res += f"- **[{ev['hora']}]** {ev['descricao']}\n"
    return res

def adicionar_manual_agenda(data_man, desc_man, hora_man="09:00"):
    global AGENDA_DICT
    if not desc_man:
        return "❌ Erro: Descrição obrigatória."
    data_str = formatar_data_para_br(data_man)
    
    if not hora_man or not re.match(r'^\d{2}:\d{2}$', hora_man.strip()):
        hora_man = "09:00"
        
    evento = {"hora": hora_man.strip(), "descricao": desc_man}
    
    if data_str not in AGENDA_DICT:
        AGENDA_DICT[data_str] = []
    elif isinstance(AGENDA_DICT[data_str], str):
        AGENDA_DICT[data_str] = [{"hora": "09:00", "descricao": AGENDA_DICT[data_str]}]
        
    AGENDA_DICT[data_str].append(evento)
    AGENDA_DICT[data_str].sort(key=lambda x: x["hora"])
    return f"✅ Evento criado para {data_str} às {hora_man}!"

def enviar_para_agenda_e_atualizar(data_prazo, sugestao_titulo, hora_prazo, date_str, view, font_size="14px"):
    status = enviar_para_agenda(data_prazo, sugestao_titulo, hora_prazo)
    html = renderizar_calendario(date_str, view, font_size)
    status_dia = atualizar_status_dia_calendario(date_str)
    return status, html, status_dia

def adicionar_manual_agenda_e_atualizar(data_man, desc_man, hora_man, date_str, view):
    status = adicionar_manual_agenda(data_man, desc_man, hora_man)
    html = renderizar_calendario(date_str, view)
    status_dia = atualizar_status_dia_calendario(date_str)
    return status, html, status_dia

# =====================================================================
# 📅 GERADORES DE HTML DO CALENDÁRIO VISUAL
# =====================================================================

def obter_modal_html_e_script() -> str:
    import json
    import html as html_module
    agenda_json = json.dumps(AGENDA_DICT)
    agenda_json_escaped = html_module.escape(agenda_json)
    html = f"""
    <div id="calendar_events_data" data-events="{agenda_json_escaped}" style="display: none;"></div>
    
    <div id="html5_calendar_modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 100000; align-items: center; justify-content: center; font-family: 'Outfit', sans-serif;">
        <div style="background: #ffffff; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); border: 1px solid #cbd5e1; width: 90%; max-width: 550px; padding: 20px; box-sizing: border-box; display: flex; flex-direction: column; max-height: 85vh;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px;">
                <h3 id="html5_modal_title" style="margin: 0; font-size: 18px; font-weight: 800; color: #1e293b;">📅 Editar Compromissos</h3>
                <button onclick="window.closeHtml5Modal()" style="background: none; border: none; font-size: 24px; color: #94a3b8; cursor: pointer; line-height: 1;">&times;</button>
            </div>
            
            <div id="html5_modal_events_list" style="flex-grow: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 5px; margin-bottom: 15px; max-height: 400px;">
                <!-- Linhas dinâmicas -->
            </div>
            
            <button onclick="window.addHtml5ModalRow()" style="background-color: #f1f5f9; color: #475569; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 8px; font-weight: 600; font-size: 13px; cursor: pointer; text-align: center; margin-bottom: 15px; transition: background-color 0.2s; width: 100%;">
                ➕ Adicionar Novo Compromisso
            </button>
            
            <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
                <button onclick="window.closeHtml5Modal()" style="background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer;">
                    Cancelar
                </button>
                <button onclick="window.saveHtml5ModalEvents()" style="background-color: #2563eb; color: #ffffff; border: none; border-radius: 6px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                    💾 Salvar Alterações
                </button>
            </div>
        </div>
    </div>
    """
    return html

def gerar_calendario_mes_html(dt: date, font_size="14px") -> str:
    ano = dt.year
    mes = dt.month
    
    nomes_meses = {
        1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril",
        5: "Maio", 6: "Junho", 7: "Julho", 8: "Agosto",
        9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"
    }
    nome_mes = nomes_meses[mes]
    
    primeiro_dia = date(ano, mes, 1)
    weekday_start = (primeiro_dia.weekday() + 1) % 7
    
    if mes == 12:
        ultimo_dia = date(ano + 1, 1, 1) - timedelta(days=1)
    else:
        ultimo_dia = date(ano, mes + 1, 1) - timedelta(days=1)
    dias_no_mes = ultimo_dia.day
    
    dia_ant_ultimo = primeiro_dia - timedelta(days=1)
    dias_mes_anterior = dia_ant_ultimo.day
    
    html = f"""
    <div style="font-family: 'Outfit', sans-serif; font-size: {font_size}; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); padding: 15px; max-width: 100%;">
        <div style="text-align: left; margin-bottom: 10px;">
            <span style="font-size: 14px; font-weight: bold; color: #1e3a8a; text-transform: uppercase; tracking-wider">CALENDÁRIO JURÍDICO – PORTRAIT MODE</span>
            <h2 style="margin: 5px 0 15px 0; font-size: 28px; font-weight: 800; color: #1e293b;">{nome_mes} de {ano}</h2>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; border: 2px solid #334155;">
            <thead>
                <tr style="background-color: #1e293b; color: #ffffff; text-align: center;">
                    <th style="padding: 10px 5px; width: 14.28%; border: 1px solid #334155; font-size: 12px; font-weight: bold;">DOM.</th>
                    <th style="padding: 10px 5px; width: 14.28%; border: 1px solid #334155; font-size: 12px; font-weight: bold;">SEG.</th>
                    <th style="padding: 10px 5px; width: 14.28%; border: 1px solid #334155; font-size: 12px; font-weight: bold;">TER.</th>
                    <th style="padding: 10px 5px; width: 14.28%; border: 1px solid #334155; font-size: 12px; font-weight: bold;">QUA.</th>
                    <th style="padding: 10px 5px; width: 14.28%; border: 1px solid #334155; font-size: 12px; font-weight: bold;">QUI.</th>
                    <th style="padding: 10px 5px; width: 14.28%; border: 1px solid #334155; font-size: 12px; font-weight: bold;">SEX.</th>
                    <th style="padding: 10px 5px; width: 14.28%; border: 1px solid #334155; font-size: 12px; font-weight: bold;">SÁB.</th>
                </tr>
            </thead>
            <tbody>
    """
    
    total_slots = 42 if (weekday_start + dias_no_mes) > 35 else 35
    slots_rendered = 0
    row_html = "<tr>"
    
    for i in range(total_slots):
        cell_date_str = ""
        is_current_month = True
        
        if i < weekday_start:
            day_num = dias_mes_anterior - (weekday_start - 1 - i)
            is_current_month = False
            prev_dt = primeiro_dia - timedelta(days=weekday_start - i)
            cell_date_str = prev_dt.strftime("%Y-%m-%d")
        elif i < weekday_start + dias_no_mes:
            day_num = i - weekday_start + 1
            curr_dt = date(ano, mes, day_num)
            cell_date_str = curr_dt.strftime("%Y-%m-%d")
        else:
            day_num = i - (weekday_start + dias_no_mes) + 1
            is_current_month = False
            next_dt = ultimo_dia + timedelta(days=day_num)
            cell_date_str = next_dt.strftime("%Y-%m-%d")
            
        br_date_str = datetime.strptime(cell_date_str, "%Y-%m-%d").strftime("%d-%m-%Y")
        eventos = obter_eventos_dia(br_date_str)
        
        bg_color = "#ffffff" if is_current_month else "#f1f5f9"
        text_color = "#1e293b" if is_current_month else "#94a3b8"
        border_style = "1px solid #cbd5e1"
        
        is_today = (cell_date_str == date.today().strftime("%Y-%m-%d"))
        if is_today:
            bg_color = "#eff6ff"
            border_style = "2px solid #2563eb"
            
        cell_events_html = ""
        if eventos:
            for ev in eventos:
                hora = ev.get("hora", "09:00")
                desc = ev.get("descricao", "")
                desc_short = desc[:15] + "..." if len(desc) > 15 else desc
                desc_esc = desc.replace("\\", "\\\\").replace("'", "\\'").replace('"', '&quot;').replace("\n", " ")
                cell_events_html += f"""
                <div draggable="true" ondragstart="window.calendarDragStart(event, '{br_date_str}', '{hora}', '{desc_esc}')" title="[{hora}] {desc}" style="background-color: #2563eb; color: #ffffff; font-size: 10px; border-radius: 4px; padding: 2px 4px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: grab;">
                    <b>{hora}</b> {desc_short}
                </div>
                """
                
        row_html += f"""
        <td ondragover="event.preventDefault(); this.style.backgroundColor='#eff6ff';" ondragleave="this.style.backgroundColor='{bg_color}';" ondrop="this.style.backgroundColor='{bg_color}'; window.calendarDrop(event, '{cell_date_str}')" onclick="window.openHtml5Modal('{br_date_str}', '{cell_date_str}')" style="background-color: {bg_color}; border: {border_style}; height: 95px; width: 14.28%; vertical-align: top; padding: 4px; position: relative; cursor: pointer; transition: all 0.2s;">
            <div style="font-weight: bold; font-size: 13px; color: {text_color}; text-align: left; margin-bottom: 4px;">{day_num}</div>
            <div style="overflow-y: auto; max-height: 70px;">
                {cell_events_html}
            </div>
        </td>
        """
        
        slots_rendered += 1
        if slots_rendered % 7 == 0:
            row_html += "</tr>"
            html += row_html
            row_html = "<tr>"
            
    html += f"""
            </tbody>
        </table>
        
        <div style="margin-top: 10px; border: 2px solid #334155; background-color: #f8fafc; border-top: none;">
            <div style="background-color: #f1f5f9; border-bottom: 1px solid #334155; padding: 6px 10px; font-weight: bold; font-size: 11px; color: #475569; letter-spacing: 0.1em; text-transform: uppercase;">NOTAS / AVISOS DE PRAZOS</div>
            <div style="padding: 10px; min-height: 50px; font-size: 12px; color: #64748b; line-height: 1.5;">
    """
    
    mes_events = []
    for d_str, evs in AGENDA_DICT.items():
        try:
            d_dt = datetime.strptime(d_str, "%d-%m-%Y")
            if d_dt.year == ano and d_dt.month == mes:
                for ev in obter_eventos_dia(d_str):
                    mes_events.append((d_dt, ev))
        except Exception:
            continue
            
    if mes_events:
        mes_events.sort(key=lambda x: (x[0], x[1]["hora"]))
        for d_dt, ev in mes_events[:5]:
            html += f"📌 <b>{d_dt.strftime('%d/%m')}:</b> {ev['descricao']} (às {ev['hora']})<br/>"
    else:
        html += "* Nenhum compromisso registrado para este mês. Use a triagem de prazos para alimentar a agenda."
        
    html += """
            </div>
        </div>
    </div>
    """
    html += obter_modal_html_e_script()
    return html

def gerar_calendario_dia_html(dt: date, font_size="14px") -> str:
    ano = dt.year
    mes = dt.month
    day = dt.day
    
    nomes_meses = {
        1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril",
        5: "Maio", 6: "Junho", 7: "Julho", 8: "Agosto",
        9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"
    }
    nome_mes = nomes_meses[mes]
    
    br_date_str = dt.strftime("%d-%m-%Y")
    eventos = obter_eventos_dia(br_date_str)
    
    eventos_por_hora = {h: [] for h in range(24)}
    eventos_sem_hora = []
    
    for ev in eventos:
        hora_str = ev.get("hora", "09:00")
        try:
            h = int(hora_str.split(":")[0])
            if 0 <= h < 24:
                eventos_por_hora[h].append(ev)
            else:
                eventos_sem_hora.append(ev)
        except Exception:
            eventos_sem_hora.append(ev)
            
    html = f"""
    <div style="font-family: 'Outfit', sans-serif; font-size: {font_size}; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); padding: 15px; max-width: 100%;">
        <div style="text-align: left; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
                <span style="font-size: 14px; font-weight: bold; color: #2563eb; text-transform: uppercase; tracking-wider">Compromissos do Dia</span>
                <h2 style="margin: 5px 0 5px 0; font-size: 28px; font-weight: 800; color: #1e293b;">{day} de {nome_mes} de {ano}</h2>
                <p style="color: #64748b; margin: 0;">Cronograma de prazos e audiências do dia</p>
            </div>
            <button onclick="window.openHtml5Modal('{br_date_str}', '{dt.strftime('%Y-%m-%d')}')" style="background-color: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-family: 'Outfit', sans-serif; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-size: 13px;">📝 Editar Compromissos</button>
        </div>
        
        <div style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background-color: #ffffff; max-height: 500px; overflow-y: auto;">
    """
    
    for h in range(24):
        h_label = f"{h:02d}:00"
        evs_this_hour = eventos_por_hora[h]
        is_business_hours = 8 <= h <= 18
        bg_color = "#ffffff" if is_business_hours else "#f8fafc"
        
        events_html = ""
        if evs_this_hour:
            for ev in evs_this_hour:
                events_html += f"""
                <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; border-radius: 0 4px 4px 0; padding: 8px 12px; margin-bottom: 6px; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);">
                    <div style="font-weight: bold; font-size: 12px; color: #1e40af; margin-bottom: 2px;">{ev.get('hora')}</div>
                    <div style="font-size: 13px; color: #1e293b;">{ev.get('descricao')}</div>
                </div>
                """
        else:
            events_html = '<div style="color: #94a3b8; font-size: 13px; font-style: italic; padding: 5px 0;">Sem compromissos</div>'
            
        html += f"""
        <div style="display: flex; border-bottom: 1px solid #f1f5f9; background-color: {bg_color}; min-height: 55px;">
            <div style="width: 70px; border-right: 1px solid #f1f5f9; padding: 10px; font-weight: bold; color: #475569; font-size: 14px; text-align: right; display: flex; align-items: center; justify-content: flex-end;">
                {h_label}
            </div>
            <div style="flex-grow: 1; padding: 10px; display: flex; flex-direction: column; justify-content: center;">
                {events_html}
            </div>
        </div>
        """
        
    html += """
        </div>
    </div>
    """
    html += obter_modal_html_e_script()
    return html

def gerar_calendario_ano_html(dt: date, font_size="14px") -> str:
    ano = dt.year
    nomes_meses = {
        1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril",
        5: "Maio", 6: "Junho", 7: "Julho", 8: "Agosto",
        9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"
    }
    
    counts_por_mes = {m: 0 for m in range(1, 13)}
    for d_str, evs in AGENDA_DICT.items():
        try:
            d_dt = datetime.strptime(d_str, "%d-%m-%Y")
            if d_dt.year == ano:
                counts_por_mes[d_dt.month] += len(obter_eventos_dia(d_str))
        except Exception:
            continue
            
    html = f"""
    <div style="font-family: 'Outfit', sans-serif; font-size: {font_size}; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); padding: 15px; max-width: 100%;">
        <div style="text-align: left; margin-bottom: 20px;">
            <span style="font-size: 14px; font-weight: bold; color: #10b981; text-transform: uppercase; tracking-wider">Linha do Tempo</span>
            <h2 style="margin: 5px 0 5px 0; font-size: 28px; font-weight: 800; color: #1e293b;">Resumo de {ano}</h2>
            <p style="color: #64748b; margin: 0;">Selecione um mês para ver a agenda detalhada</p>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
    """
    
    for m in range(1, 13):
        nome_mes = nomes_meses[m]
        count = counts_por_mes[m]
        
        badge_bg = "#e2e8f0" if count == 0 else "#2563eb"
        badge_text = "#475569" if count == 0 else "#ffffff"
        badge_label = "Livre" if count == 0 else f"{count} prazo(s)"
        target_date = f"{ano}-{m:02d}-01"
        
        html += f"""
        <div onclick="window.dispararEventoCalendario('SELECT', 'Mês', '{target_date}')" style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 15px; cursor: pointer; text-align: center; background-color: #ffffff; transition: all 0.2s; box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);">
            <div style="font-weight: 800; font-size: 16px; color: #1e293b; margin-bottom: 8px;">{nome_mes}</div>
            <div style="display: inline-block; background-color: {badge_bg}; color: {badge_text}; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 20px;">
                {badge_label}
            </div>
        </div>
        """
        
    html += """
        </div>
    </div>
    """
    return html

def renderizar_calendario(date_str, view, font_size="14px"):
    try:
        dt = datetime.strptime(date_str.split(" ")[0].strip(), "%Y-%m-%d").date()
    except Exception:
        try:
            dt = datetime.strptime(date_str.split(" ")[0].strip(), "%d-%m-%Y").date()
        except Exception:
            dt = datetime.now().date()
            
    if view == "Dia":
        return gerar_calendario_dia_html(dt, font_size)
    elif view == "Ano":
        return gerar_calendario_ano_html(dt, font_size)
    else:
        return gerar_calendario_mes_html(dt, font_size)

def navegar_calendario(date_str, view, direcao):
    try:
        dt = datetime.strptime(date_str.split(" ")[0].strip(), "%Y-%m-%d").date()
    except Exception:
        try:
            dt = datetime.strptime(date_str.split(" ")[0].strip(), "%d-%m-%Y").date()
        except Exception:
            dt = datetime.now().date()
        
    if direcao == 0:
        return datetime.now().strftime("%Y-%m-%d")
        
    if view == "Dia":
        new_dt = dt + timedelta(days=direcao)
    elif view == "Mês":
        if direcao == 1:
            if dt.month == 12:
                new_dt = date(dt.year + 1, 1, 1)
            else:
                new_dt = date(dt.year, dt.month + 1, 1)
        else:
            if dt.month == 1:
                new_dt = date(dt.year - 1, 12, 1)
            else:
                new_dt = date(dt.year, dt.month - 1, 1)
    elif view == "Ano":
        new_dt = date(dt.year + direcao, dt.month, 1)
    else:
        new_dt = dt
        
    return new_dt.strftime("%Y-%m-%d")

def atualizar_status_dia_calendario(date_str):
    return visualizar_data_calendario(date_str)

def gerar_html_detalhes_dia(date_str: str) -> str:
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d").date()
        br_date_str = dt.strftime("%d-%m-%Y")
    except Exception:
        br_date_str = date_str
        
    eventos = obter_eventos_dia(br_date_str)
    
    html = f"""
    <div style="font-family: 'Outfit', 'Inter', sans-serif; color: #1e293b; padding: 10px;">
        <h3 style="margin-top: 0; color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; font-size: 20px;">
            📅 Compromissos e Processos em {br_date_str}
        </h3>
    """
    
    if not eventos:
        html += """
        <div style="text-align: center; padding: 30px; color: #64748b;">
            <p style="font-size: 16px; margin: 0;">Nenhum processo ou compromisso agendado para este dia.</p>
        </div>
        """
    else:
        html += '<div style="display: flex; flex-direction: column; gap: 15px; max-height: 450px; overflow-y: auto; padding-right: 5px;">'
        for ev in eventos:
            hora = ev.get("hora", "09:00")
            desc = ev.get("descricao", "")
            
            # Tenta extrair número CNJ
            match = re.search(r'(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})', desc)
            processo_db_dados = None
            if match:
                cnj = match.group(1)
                num_limpo = "".join(filter(str.isdigit, cnj))
                try:
                    conn = sqlite3.connect(DB_FILE)
                    cursor = conn.cursor()
                    cursor.execute("SELECT mascara, cliente, descricao, data_limite_estimada, resumo FROM processos WHERE numero = ?", (num_limpo,))
                    processo_db_dados = cursor.fetchone()
                    conn.close()
                except Exception as db_err:
                    logger.error(f"Erro ao buscar processo do calendário no DB: {db_err}")
            
            if processo_db_dados:
                p_cnj, p_cliente, p_desc, p_data_limite, p_resumo = processo_db_dados
                html += f"""
                <div style="background-color: #f8fafc; border-left: 5px solid #2563eb; border-radius: 6px; padding: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; border-left: 5px solid #2563eb;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 14px; font-weight: bold; color: #1e3a8a;">⚖️ Processo: {p_cnj}</span>
                        <span style="background-color: #dbeafe; color: #1e40af; font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 12px;">🕒 {hora}</span>
                    </div>
                    <p style="margin: 4px 0; font-size: 13px;"><b>Cliente / Parte:</b> {p_cliente or "Não informado"}</p>
                    <p style="margin: 4px 0; font-size: 13px;"><b>Descrição do Processo:</b> {p_desc or "Não informada"}</p>
                    <p style="margin: 4px 0; font-size: 13px; color: #b91c1c;"><b>📅 Data Limite Estimada:</b> {p_data_limite or "N/A"}</p>
                    <div style="margin-top: 10px; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px;">
                        <div style="font-weight: bold; font-size: 12px; color: #475569; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em;">📝 Resumo do Processo / Último Andamento:</div>
                        <div style="font-size: 13px; color: #334155; line-height: 1.4;">{p_resumo or "Nenhum resumo da IA disponível."}</div>
                    </div>
                </div>
                """
            else:
                # Evento genérico ou manual
                html += f"""
                <div style="background-color: #f8fafc; border-left: 5px solid #64748b; border-radius: 6px; padding: 12px 15px; border: 1px solid #e2e8f0; border-left: 5px solid #64748b;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <span style="font-size: 13px; font-weight: bold; color: #475569;">📌 Compromisso Geral</span>
                        <span style="background-color: #f1f5f9; color: #475569; font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 12px;">🕒 {hora}</span>
                    </div>
                    <p style="margin: 0; font-size: 13px; color: #1e293b;">{desc}</p>
                </div>
                """
        html += '</div>'
        
    html += "</div>"
    return html

def processar_clique_calendario(click_val, date_str, view, font_size="14px"):
    global AGENDA_DICT
    if not click_val:
        cal_html = renderizar_calendario(date_str, view, font_size)
        return date_str, view, "", gr.update(visible=False), [["09:00", ""]], cal_html, "#### Nenhum dia selecionado"
        
    parts = click_val.split(":", 2)
    if len(parts) >= 3:
        action = parts[0]
        new_view = parts[1]
        payload = parts[2]
        
        if action == "MOVE":
            # payload is: dateBr|targetDateIso|hora|desc
            subparts = payload.split("|", 3)
            if len(subparts) == 4:
                source_date_br = subparts[0]
                target_date_iso = subparts[1]
                hora = subparts[2]
                desc = subparts[3]
                
                # Convert targetDateIso to BR format for AGENDA_DICT key
                target_date_dt = converter_data_str(target_date_iso)
                if target_date_dt:
                    target_date_br = target_date_dt.strftime("%d-%m-%Y")
                    
                    # 1. Remove from source date list
                    if source_date_br in AGENDA_DICT:
                        events_src = AGENDA_DICT[source_date_br]
                        new_events_src = [e for e in events_src if not (e.get("hora") == hora and e.get("descricao") == desc)]
                        if new_events_src:
                            AGENDA_DICT[source_date_br] = new_events_src
                        else:
                            del AGENDA_DICT[source_date_br]
                    
                    # 2. Add to target date list
                    new_evt = {"hora": hora, "descricao": desc}
                    if target_date_br not in AGENDA_DICT:
                        AGENDA_DICT[target_date_br] = []
                    if new_evt not in AGENDA_DICT[target_date_br]:
                        AGENDA_DICT[target_date_br].append(new_evt)
                        AGENDA_DICT[target_date_br].sort(key=lambda x: x["hora"])
                        
                    # 3. Synchronize with SQLite processes.db if it contains CNJ process number
                    match = re.search(r'(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})', desc)
                    if match:
                        cnj = match.group(1)
                        atualizar_processo_dados_ia(cnj, target_date_br, desc)
            
            cal_html = renderizar_calendario(date_str, view, font_size)
            return date_str, view, "", gr.update(visible=False), [["09:00", ""]], cal_html, "#### Nenhum dia selecionado"
            
        if action == "SAVE_EVENTS":
            # payload is: dateBr|JSON_string
            subparts = payload.split("|", 1)
            if len(subparts) == 2:
                br_date = subparts[0]
                events_json_str = subparts[1]
                
                try:
                    import json
                    events_list = json.loads(events_json_str)
                    novos_eventos = []
                    for ev in events_list:
                        hora = str(ev.get("hora", "09:00")).strip()
                        desc = str(ev.get("descricao", "")).strip()
                        if desc:
                            if not re.match(r'^\d{2}:\d{2}$', hora):
                                hora = "09:00"
                            novos_eventos.append({"hora": hora, "descricao": desc})
                            
                    novos_eventos.sort(key=lambda x: x["hora"])
                    if novos_eventos:
                        AGENDA_DICT[br_date] = novos_eventos
                    else:
                        if br_date in AGENDA_DICT:
                            del AGENDA_DICT[br_date]
                            
                    # Update process limit dates in SQLite db if CNJ is in description
                    for ev in novos_eventos:
                        desc = ev.get("descricao", "")
                        match = re.search(r'(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})', desc)
                        if match:
                            cnj = match.group(1)
                            atualizar_processo_dados_ia(cnj, br_date, desc)
                except Exception as e:
                    logger.error(f"Erro ao salvar compromissos via HTML5: {e}")
            
            cal_html = renderizar_calendario(date_str, view, font_size)
            return date_str, view, "", gr.update(visible=False), [["09:00", ""]], cal_html, "#### Nenhum dia selecionado"
            
        new_date = payload
        if action == "SELECT":
            if view == "Ano":
                cal_html = renderizar_calendario(new_date, "Mês", font_size)
                return new_date, "Mês", "", gr.update(visible=False), [["09:00", ""]], cal_html, "#### Nenhum dia selecionado"
            elif view == "Mês" or view == "Dia":
                try:
                    dt_val = datetime.strptime(new_date, "%Y-%m-%d")
                    br_date = dt_val.strftime("%d-%m-%Y")
                except Exception:
                    br_date = new_date
                    
                eventos = obter_eventos_dia(br_date)
                df_data = [[ev.get("hora", "09:00"), ev.get("descricao", "")] for ev in eventos]
                if not df_data:
                    df_data = [["09:00", ""]]
                
                cal_html = renderizar_calendario(date_str, view, font_size)
                modal_title = f"### 📅 Editar Compromissos - {br_date}"
                return new_date, view, "", gr.update(visible=True), df_data, cal_html, modal_title
                
            cal_html = renderizar_calendario(new_date, new_view, font_size)
            return new_date, new_view, "", gr.update(visible=False), [["09:00", ""]], cal_html, "#### Nenhum dia selecionado"
            
    cal_html = renderizar_calendario(date_str, view, font_size)
    return date_str, view, "", gr.update(visible=False), [["09:00", ""]], cal_html, "#### Nenhum dia selecionado"

def salvar_compromissos_dia(date_str, df_data, view, font_size="14px"):
    try:
        dt_val = datetime.strptime(date_str, "%Y-%m-%d")
        br_date = dt_val.strftime("%d-%m-%Y")
    except Exception:
        br_date = date_str
        
    global AGENDA_DICT
    novos_eventos = []
    
    if isinstance(df_data, pd.DataFrame):
        rows = df_data.values.tolist()
    else:
        rows = df_data
        
    for r in rows:
        if len(r) >= 2:
            hora = str(r[0]).strip()
            desc = str(r[1]).strip()
            if desc:
                if not re.match(r'^\d{2}:\d{2}$', hora):
                    hora = "09:00"
                novos_eventos.append({"hora": hora, "descricao": desc})
                
    novos_eventos.sort(key=lambda x: x["hora"])
    
    if novos_eventos:
        AGENDA_DICT[br_date] = novos_eventos
    else:
        if br_date in AGENDA_DICT:
            del AGENDA_DICT[br_date]
            
    cal_html = renderizar_calendario(date_str, view, font_size)
    status_msg = f"### ✅ Compromissos de {br_date} salvos com sucesso!"
    
    return status_msg, cal_html, gr.update(visible=False)

def navegar_e_renderizar(date_str, view, direcao, font_size="14px"):
    new_date = navegar_calendario(date_str, view, direcao)
    cal_html = renderizar_calendario(new_date, view, font_size)
    return new_date, cal_html

def alterar_visao_e_renderizar(date_str, view, font_size="14px"):
    cal_html = renderizar_calendario(date_str, view, font_size)
    return view, cal_html

def salvar_e_recarregar(numero, cliente, desc):
    success, msg = adicionar_processo_db(numero, cliente, desc)
    df = listar_processos_db()
    choices = obter_choices_processos()
    return f"### {'✅' if success else '⚠️'} {msg}", df, gr.update(choices=choices, value="Nenhum"), gr.update(choices=choices, value="Nenhum")

def remover_e_recarregar(id_proc):
    if id_proc is None or id_proc == "":
        return "### ⚠️ Digite um ID válido.", listar_processos_db(), gr.update(), gr.update()
    success, msg = remover_processo_db(int(id_proc))
    df = listar_processos_db()
    choices = obter_choices_processos()
    return f"### {'✅' if success else '⚠️'} {msg}", df, gr.update(choices=choices, value="Nenhum"), gr.update(choices=choices, value="Nenhum")

def selecionar_processo_dropdown(proc_masked):
    if not proc_masked or proc_masked == "Nenhum":
        return gr.update()
    limpo = "".join(filter(str.isdigit, proc_masked))
    return limpo

def atualizar_provedor(provedor):
    modelos = {
        "Gemini": ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
        "Anthropic": ["Claude Opus 4.8", "claude-3-5-sonnet-20241022","claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
        "ChatGPT": ["gpt-4o", "gpt-4o-mini", "o3-mini", "o1-preview"],
        "Ollama": ["gemma4:12b", "gemma2:9b",  "llama3.2", "llama3.3:latest"],
        "Groq": ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "gemma2-9b-it"]
    }
    choices = modelos.get(provedor, [])
    default_val = choices[0] if choices else ""
    if provedor == "Ollama":    
        return gr.update(choices=choices, value=default_val), gr.update(label="Endereço do Ollama (Host)", value="http://localhost:11434", placeholder="http://localhost:11434")
    else:
        return gr.update(choices=choices, value=default_val), gr.update(label="Chave API (API Key)", value="", placeholder="Insira sua API Key aqui...")

import json

def extrair_prazos_json(texto_llm: str) -> List[dict]:
    padroes = [r"```json(.*?)```", r"```(.*?)```"]
    match = None
    for padrao in padroes:
        m = re.search(padrao, texto_llm, re.DOTALL)
        if m:
            match = m.group(1).strip()
            break
    if not match:
        match = texto_llm.strip()
        
    # Se a string não começa e termina com colchetes, tenta localizar a região do array JSON
    if not (match.startswith("[") and match.endswith("]")):
        start_idx = match.find("[")
        end_idx = match.rfind("]")
        if start_idx != -1 and end_idx != -1 and start_idx < end_idx:
            match = match[start_idx:end_idx+1]
            
    try:
        dados = json.loads(match)
        if isinstance(dados, list):
            eventos_validos = []
            for item in dados:
                if isinstance(item, dict) and "data" in item and "descricao" in item:
                    dt_val = converter_data_str(item["data"])
                    data_str = dt_val.strftime("%d-%m-%Y") if dt_val else datetime.now().strftime("%d-%m-%Y")
                    hora_str = item.get("hora", "09:00")
                    if not re.match(r"^\d{2}:\d{2}$", str(hora_str).strip()):
                        hora_str = "09:00"
                    eventos_validos.append({
                        "data": data_str,
                        "hora": hora_str.strip(),
                        "descricao": item["descricao"].strip()
                    })
            return eventos_validos
    except Exception as e:
        logger.info(f"JSON não localizado na resposta da LLM (utilizando extrator de fallback): {e}")
        
    eventos_fallback = []
    datas_encontradas = re.findall(r"\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}\s+de\s+[a-zA-ZçÇãÃóÓ]+\s+de\s+\d{4}\b", texto_llm, re.IGNORECASE)
    for d_str in datas_encontradas:
        dt_val = converter_data_str(d_str)
        if dt_val:
            eventos_fallback.append({
                "data": dt_val.strftime("%d-%m-%Y"),
                "hora": "09:00",
                "descricao": f"Prazo identificado no texto: {d_str}"
            })
    if not eventos_fallback:
        eventos_fallback.append({
            "data": datetime.now().strftime("%d-%m-%Y"),
            "hora": "09:00",
            "descricao": "Prazo Processual"
        })
    return eventos_fallback

def executar_ia_e_carregar_prazos(provedor, modelo_id, api_key_or_host, num_processo, texto_publicacao, tese_defesa):
    res_prazos, res_minutas, res_agenda_sugestao = disparar_agentes_dje(
        provedor, modelo_id, api_key_or_host, num_processo, texto_publicacao, tese_defesa
    )
    if res_prazos.startswith("❌") or res_prazos.startswith("Erro"):
        return res_prazos, res_minutas, "Aguardando...", gr.update(choices=[], value=None), "", gr.update(value=datetime.now().strftime("%Y-%m-%d")), "09:00", [], listar_processos_db()
        
    eventos = extrair_prazos_json(res_agenda_sugestao)
    
    # Se os eventos retornados forem os padrões de hoje ou vazios, tenta extrair a data limite estimada do texto da análise do Controller Jurídico (res_prazos)
    hoje_br = datetime.now().strftime("%d-%m-%Y")
    is_default = len(eventos) == 1 and eventos[0]["descricao"] == "Prazo Processual" and eventos[0]["data"] == hoje_br
    
    if not eventos or is_default:
        datas_controller = re.findall(r"\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}\s+de\s+[a-zA-ZçÇãÃóÓ]+\s+de\s+\d{4}\b", res_prazos, re.IGNORECASE)
        eventos_controller = []
        for d_str in datas_controller:
            dt_val = converter_data_str(d_str)
            if dt_val:
                eventos_controller.append({
                    "data": dt_val.strftime("%d-%m-%Y"),
                    "hora": "09:00",
                    "descricao": f"Prazo Estimado (Controller): {d_str}"
                })
        if eventos_controller:
            # Ordena do mais antigo para o mais futuro
            eventos_controller.sort(key=lambda x: datetime.strptime(x["data"], "%d-%m-%Y"))
            # Inverte para que a data mais futura (geralmente o prazo final) fique como padrão
            eventos_controller.reverse()
            eventos = eventos_controller

    # Sincroniza e atualiza o banco de dados do escritório para os processos identificados
    if num_processo and eventos:
        procs_list = [p.strip() for p in num_processo.split(",") if p.strip()]
        for p_num in procs_list:
            p_limpo = "".join(filter(str.isdigit, p_num))
            p_events = [e for e in eventos if p_limpo in "".join(filter(str.isdigit, e["descricao"]))]
            if p_events:
                p_data_limite = p_events[0]["data"]
                p_resumo = p_events[0]["descricao"]
            else:
                p_data_limite = eventos[0]["data"]
                p_resumo = eventos[0]["descricao"]
            atualizar_processo_dados_ia(p_num, p_data_limite, p_resumo)
    elif num_processo:
        procs_list = [p.strip() for p in num_processo.split(",") if p.strip()]
        for p_num in procs_list:
            p_data_limite = "N/A"
            p_resumo = "Despacho de mero expediente (Sem prazo fatal)"
            atualizar_processo_dados_ia(p_num, p_data_limite, p_resumo)

    choices = []
    for ev in eventos:
        choices.append(f"{ev['data']} às {ev['hora']} - {ev['descricao']}")
        
    if choices:
        default_choice = choices[0]
        default_evt = eventos[0]
        # Converte a data de %d-%m-%Y para %Y-%m-%d para alimentar gr.DateTime
        try:
            data_iso = datetime.strptime(default_evt["data"], "%d-%m-%Y").strftime("%Y-%m-%d")
        except Exception:
            data_iso = datetime.now().strftime("%Y-%m-%d")
        return (
            res_prazos, 
            res_minutas, 
            res_agenda_sugestao, 
            gr.update(choices=choices, value=default_choice), 
            default_evt["descricao"], 
            gr.update(value=data_iso), 
            default_evt["hora"],
            eventos,
            listar_processos_db()
        )
    else:
        default_desc = "Prazo Processual"
        default_data = datetime.now().strftime("%d-%m-%Y")
        default_data_iso = datetime.now().strftime("%Y-%m-%d")
        default_hora = "09:00"
        choices = [f"{default_data} às {default_hora} - {default_desc}"]
        default_evt = {"data": default_data, "hora": default_hora, "descricao": default_desc}
        return (
            res_prazos, 
            res_minutas, 
            res_agenda_sugestao, 
            gr.update(choices=choices, value=choices[0]), 
            default_desc, 
            gr.update(value=default_data_iso), 
            default_hora,
            [default_evt],
            listar_processos_db()
        )

def selecionar_prazo_dropdown(escolha, eventos):
    if not escolha or not eventos:
        return gr.update(), gr.update(), gr.update()
    for ev in eventos:
        ch = f"{ev['data']} às {ev['hora']} - {ev['descricao']}"
        if ch == escolha:
            try:
                data_iso = datetime.strptime(ev["data"], "%d-%m-%Y").strftime("%Y-%m-%d")
            except Exception:
                data_iso = ev["data"]
            return ev["descricao"], gr.update(value=data_iso), ev["hora"]
    return gr.update(), gr.update(), gr.update()

def selecionar_todos_registros(df_dados):
    if df_dados is None or df_dados.empty:
        return df_dados, "", ""
    df_dados["Sel"] = "☑"
    
    textos_completos = []
    processos = []
    for _, row in df_dados.iterrows():
        linha_num = int(row["Linha"])
        p_cnj = row["Processo (CNJ)"]
        if p_cnj and p_cnj not in processos:
            processos.append(p_cnj)
            
        texto_raw = cache_publicacoes.get(linha_num, "")
        if row["Classe / Tipo"] == "Sem Movimentação":
            texto_puro = "Nenhuma nova publicação localizada no período selecionado."
        else:
            texto_puro = limpar_html(texto_raw)
            
        data_disp_val = row['Data Disponibilização']
        dia_semana = obter_dia_semana_pt(data_disp_val)
        textos_completos.append(
            f"=== PROCESSO: {p_cnj} (Linha {linha_num}) ===\n"
            f"Tribunal: {row['Tribunal']} | Data Disp: {data_disp_val}{dia_semana}\n"
            f"Teor da Publicação:\n{texto_puro}\n"
        )
        
    texto_alvo_val = "\n\n".join(textos_completos)
    processos_val = ", ".join(processos)
    
    return df_dados, processos_val, texto_alvo_val

def desselecionar_todos_registros(df_dados):
    if df_dados is None or df_dados.empty:
        return df_dados, "", "Nenhuma publicação selecionada."
    df_dados["Sel"] = "☐"
    return df_dados, "", "Nenhuma publicação selecionada."

def destacar_termo_no_teor(texto, termo):
    if not texto or not texto.strip() or texto.startswith("Nenhuma publicação"):
        return "<div style='color: gray; font-style: italic; padding: 15px;'>Nenhuma publicação selecionada para destaque.</div>"
    if not termo or not termo.strip():
        formatted = texto.replace("\n", "<br>")
        return f"<div style='background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; font-family: sans-serif; white-space: pre-line; line-height: 1.5; color: #1e293b; max-height: 400px; overflow-y: auto;'>{formatted}</div>"
        
    import re
    termo_escaped = re.escape(termo)
    try:
        pattern = re.compile(f"({termo_escaped})", re.IGNORECASE)
        texto_destacado = pattern.sub(r"<mark style='background-color: #fef08a; color: #854d0e; text-decoration: underline; font-weight: bold; padding: 1px 4px; border-radius: 2px;'>\1</mark>", texto)
    except Exception as e:
        logger.error(f"Erro ao destacar termo: {e}")
        texto_destacado = texto
        
    formatted = texto_destacado.replace("\n", "<br>")
    return f"<div style='background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; font-family: sans-serif; white-space: pre-line; line-height: 1.5; color: #1e293b; max-height: 400px; overflow-y: auto;'>{formatted}</div>"

js_code = """
() => {
    window.dispararEventoCalendario = function(action, view, dateStr) {
        var el = document.getElementById('hidden_click_textbox_id');
        if (el) {
            var inputEl = el.querySelector('input, textarea');
            if (inputEl) {
                var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
                    || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
                
                if (nativeInputValueSetter) {
                    nativeInputValueSetter.call(inputEl, action + ":" + view + ":" + dateStr);
                } else {
                    inputEl.value = action + ":" + view + ":" + dateStr;
                }
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    };

    window.calendarDragStart = function(ev, dateBr, hora, desc) {
        ev.dataTransfer.setData("dateBr", dateBr);
        ev.dataTransfer.setData("hora", hora);
        ev.dataTransfer.setData("desc", desc);
        ev.dataTransfer.effectAllowed = "move";
    };

    window.calendarDrop = function(ev, targetDateIso) {
        ev.preventDefault();
        var dateBr = ev.dataTransfer.getData("dateBr");
        var hora = ev.dataTransfer.getData("hora");
        var desc = ev.dataTransfer.getData("desc");
        if (dateBr && targetDateIso) {
            ev.stopPropagation();
            window.dispararEventoCalendario("MOVE", "Mês", dateBr + "|" + targetDateIso + "|" + hora + "|" + desc);
        }
    };

    window.dispararEventoKanban = function(action, payload) {
        var el = document.getElementById('hidden_kanban_textbox_id');
        if (el) {
            var inputEl = el.querySelector('input, textarea');
            if (inputEl) {
                var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
                    || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
                
                if (nativeInputValueSetter) {
                    nativeInputValueSetter.call(inputEl, action + ":" + payload);
                } else {
                    inputEl.value = action + ":" + payload;
                }
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    };

    window.kanbanDragStart = function(ev, taskId) {
        ev.dataTransfer.setData("taskId", taskId);
        ev.dataTransfer.effectAllowed = "move";
    };

    window.kanbanDrop = function(ev, targetStatus) {
        ev.preventDefault();
        var taskId = ev.dataTransfer.getData("taskId");
        if (taskId && targetStatus) {
            ev.stopPropagation();
            window.dispararEventoKanban("MOVE_TASK", taskId + "|" + targetStatus);
        }
    };

    window.kanbanDeleteTask = function(ev, taskId) {
        ev.stopPropagation();
        if (confirm("Deseja realmente excluir esta tarefa?")) {
            window.dispararEventoKanban("DELETE_TASK", taskId);
        }
    };

    // --- FUNÇÕES DO POPUP HTML5 DO CALENDÁRIO ---
    window.currentEditingDateBr = "";

    window.openHtml5Modal = function(dateBr, dateIso) {
        window.currentEditingDateBr = dateBr;
        var modal = document.getElementById("html5_calendar_modal");
        var title = document.getElementById("html5_modal_title");
        var list = document.getElementById("html5_modal_events_list");
        
        if (!modal || !list) return;
        
        var dataEl = document.getElementById("calendar_events_data");
        if (dataEl) {
            try {
                window.AGENDA_EVENTS = JSON.parse(dataEl.getAttribute("data-events") || "{}");
            } catch(e) {
                console.error("Erro ao ler data-events:", e);
            }
        }
        
        title.innerText = "📅 Editar Compromissos - " + dateBr;
        list.innerHTML = "";
        
        var events = (window.AGENDA_EVENTS && window.AGENDA_EVENTS[dateBr]) || [];
        
        if (events.length === 0) {
            window.addHtml5ModalRow("", "");
        } else {
            events.forEach(function(ev) {
                window.addHtml5ModalRow(ev.hora, ev.descricao);
            });
        }
        
        modal.style.display = "flex";
    };

    window.closeHtml5Modal = function() {
        var modal = document.getElementById("html5_calendar_modal");
        if (modal) modal.style.display = "none";
    };

    window.addHtml5ModalRow = function(time, desc) {
        time = time || "09:00";
        desc = desc || "";
        
        var list = document.getElementById("html5_modal_events_list");
        if (!list) return;
        
        var row = document.createElement("div");
        row.className = "html5-event-row";
        row.style.display = "flex";
        row.style.gap = "10px";
        row.style.alignItems = "center";
        row.style.backgroundColor = "#f8fafc";
        row.style.padding = "8px 10px";
        row.style.border = "1px solid #e2e8f0";
        row.style.borderRadius = "6px";
        row.style.position = "relative";
        
        var timeInput = document.createElement("input");
        timeInput.type = "time";
        timeInput.className = "html5-event-time";
        timeInput.value = time;
        timeInput.style.fontFamily = "'Outfit', sans-serif";
        timeInput.style.border = "1px solid #cbd5e1";
        timeInput.style.borderRadius = "4px";
        timeInput.style.padding = "5px";
        timeInput.style.fontSize = "13px";
        timeInput.style.color = "#1e293b";
        timeInput.style.width = "85px";
        
        var descInput = document.createElement("input");
        descInput.type = "text";
        descInput.className = "html5-event-desc";
        descInput.value = desc;
        descInput.placeholder = "Descrição do compromisso...";
        descInput.style.fontFamily = "'Outfit', sans-serif";
        descInput.style.border = "1px solid #cbd5e1";
        descInput.style.borderRadius = "4px";
        descInput.style.padding = "5px 10px";
        descInput.style.fontSize = "13px";
        descInput.style.color = "#1e293b";
        descInput.style.flexGrow = "1";
        descInput.style.boxSizing = "border-box";
        
        var delBtn = document.createElement("button");
        delBtn.innerHTML = "&times;";
        delBtn.style.background = "none";
        delBtn.style.border = "none";
        delBtn.style.color = "#94a3b8";
        delBtn.style.cursor = "pointer";
        delBtn.style.fontSize = "18px";
        delBtn.style.lineHeight = "1";
        delBtn.style.padding = "0 5px";
        delBtn.onclick = function() {
            row.remove();
        };
        
        row.appendChild(timeInput);
        row.appendChild(descInput);
        row.appendChild(delBtn);
        list.appendChild(row);
    };

    window.saveHtml5ModalEvents = function() {
        var list = document.getElementById("html5_modal_events_list");
        if (!list) return;
        
        var rows = list.getElementsByClassName("html5-event-row");
        var events = [];
        
        for (var i = 0; i < rows.length; i++) {
            var timeVal = rows[i].querySelector(".html5-event-time").value;
            var descVal = rows[i].querySelector(".html5-event-desc").value.trim();
            if (descVal) {
                events.push({hora: timeVal, descricao: descVal});
            }
        }
        
        window.dispararEventoCalendario("SAVE_EVENTS", "Mês", window.currentEditingDateBr + "|" + JSON.stringify(events));
        window.closeHtml5Modal();
    };
}
"""

# =====================================================================
# 4. INTERFACE GRÁFICA (UX FIEL AO SEU APP6.2)
# =====================================================================
with gr.Blocks() as demo:
    
    # Variáveis de Estado do Calendário Customizado
    active_date = gr.State(datetime.now().strftime("%Y-%m-%d"))
    view_type = gr.State("Mês") # "Dia", "Mês", "Ano"
    estado_eventos_detectados = gr.State([])
    
    gr.Markdown("""
    # ⚖️ **LegalMind AI Suite** &nbsp; <span style='background-color:#16a34a; color:white; padding:2px 8px; font-size:12px; border-radius:4px;'>PREMIUM v6.2</span>
    ### O sistema Inteligente de gestão diária jurídica — Conectado à ComunicaAPI PJe com Multi-Agentes
    """)
    
    with gr.Tabs():
        with gr.Tab("📥 Painel de Triagem & DJE"):
            with gr.Row():
                with gr.Column(scale=1):
                    gr.Markdown("### 🔍 Parâmetros de Varredura (ComunicaAPI)")
                    
                    with gr.Row():
                        dt_retroativa = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")
                        dt_hoje = datetime.now().strftime("%Y-%m-%d")
                        
                        txt_data_inicial = gr.DateTime(label="Data Inicial", include_time=False, value=dt_retroativa)
                        txt_data_final = gr.DateTime(label="Data Final", include_time=False, value=dt_hoje)
                    
                    with gr.Row():
                        chk_apenas_monitorados = gr.Checkbox(label="Apenas Processos Monitorados", value=False)
                        drop_selecionar_escritorio = gr.Dropdown(choices=obter_choices_processos(), value="Nenhum", label="Selecionar Processo do Escritório")
                        
                    with gr.Row():
                        txt_processo = gr.Textbox(label="Número do Processo (Somente números)", value="")
                        drop_tribunal = gr.Dropdown(choices=LISTA_TRIBUNAIS, value="TODOS", label="Tribunal")
                        
                    with gr.Row():
                        txt_nome_parte = gr.Textbox(label="Nome da Parte", value="")
                        txt_oab = gr.Textbox(label="Número da OAB (Somente números)", value="")
                        txt_uf_oab = gr.Textbox(label="UF da OAB", value="")
                        
                    with gr.Row():
                        txt_pagina = gr.Textbox(label="Página", value="1")
                        drop_itens_pagina = gr.Dropdown(choices=["10", "50", "100", "300", "1000"], value="50", label="Itens por Página")
                        
                    btn_buscar = gr.Button("🔎 Executar Pesquisa Avançada", variant="primary")
                    out_status = gr.Textbox(label="Status do Motor de Busca", interactive=False)
                    
                    tabela_resultados = gr.Dataframe(
                        headers=["Sel", "Linha", "Processo (CNJ)", "Tribunal", "Classe / Tipo", "Data Disponibilização", "Destinatários Intimados", "Trecho do Conteúdo"], 
                        interactive=False, 
                        label="Registros Extraídos do Diário de Justiça"
                    )
                    with gr.Row():
                        btn_selecionar_todos = gr.Button("☑ Selecionar Todos", variant="secondary")
                        btn_desselecionar_todos = gr.Button("☐ Desselecionar Todos", variant="secondary")
                    

                    
                    with gr.Group():
                        gr.Markdown("### 📄 Tratamento do Registro Selecionado")
                        proc_alvo = gr.Textbox(label="Processo Alvo", interactive=False)
                        texto_alvo = gr.Textbox(label="Teor da Publicação Completo (Original)", lines=5, placeholder="Clique em uma linha da tabela acima...", interactive=False, visible=False)
                        txt_termo_busca = gr.Textbox(label="Destaque de Termo no Teor", placeholder="Digite um termo para sublinhar e sombrear no teor...")
                        html_texto_destacado = gr.HTML(label="Teor da Publicação Destacado", value="<div style='color: gray; font-style: italic; padding: 15px;'>Nenhuma publicação selecionada para destaque.</div>")
                        diretriz_defesa = gr.Textbox(label="Tese / Instruções de Defesa")
                        
                        with gr.Group():
                            gr.Markdown("#### 🤖 Configuração do Modelo de IA")
                            with gr.Row():
                                drop_provedor_llm = gr.Dropdown(
                                    choices=["Gemini", "Anthropic", "ChatGPT", "Ollama", "Groq"], 
                                    value="Ollama", 
                                    label="Provedor LLM"
                                )
                                drop_modelo_llm = gr.Dropdown(
                                    choices=["gemma4:12b", "gemma2:9b", "llama3.3:latest", "llama3.2", "qwen2.5-coder"], 
                                    value="llama3.1", 
                                    label="Modelo LLM",
                                    allow_custom_value=True
                                )
                            txt_api_key_or_host = gr.Textbox(
                                label="Endereço do Ollama (Host)", 
                                value="http://localhost:11434", 
                                placeholder="http://localhost:11434"
                            )
                        btn_agentes = gr.Button("🤖 Ativar IA Multi-Agente", variant="secondary")

                with gr.Column(scale=1):
                    gr.Markdown("### 🧠 Central de Auditoria das IAs")
                    with gr.Accordion("⏱️ Inteligência do Controller (Prazos)", open=True):
                        painel_prazos = gr.Markdown("Aguardando ativação...")
                    with gr.Accordion("✍️ Sugestão de Minuta (Peça Inicial)", open=False):
                        painel_minutas = gr.Markdown("Aguardando ativação...")
                    with gr.Accordion("📅 Sugestões de Eventos da IA", open=False):
                        painel_sugestoes_agenda = gr.Markdown("Aguardando ativação...")
                    
                    with gr.Group():
                        gr.Markdown("### 📅 Quick-Action: Despachar para Agenda")
                        drop_prazos_detectados = gr.Dropdown(
                            choices=[], 
                            label="Prazos / Datas Detectados pela IA", 
                            value=None, 
                            interactive=True,
                            allow_custom_value=False
                        )
                        sugestao_titulo = gr.Textbox(label="Título do Compromisso", placeholder="Selecione um prazo acima ou digite...")
                        with gr.Row():
                            data_prazo = gr.DateTime(label="Data Limite Estimada", include_time=False, value=datetime.now().strftime("%Y-%m-%d"))
                            txt_hora_prazo = gr.Textbox(label="Hora", value="09:00", placeholder="HH:MM")
                        btn_enviar_agenda = gr.Button("🚀 Confirmar e Lançar no Calendário", variant="success")
                        status_envio = gr.Markdown("")

        with gr.Tab("📅 Calendário Jurídico Central"):
            gr.Markdown("### 🗓️ Linha do Tempo e Escopo Geral de Compromissos")
            
            # Modal virtual para exibir e gerenciar detalhes do dia
            with gr.Column(visible=False, elem_id="modal_detalhes_id") as modal_detalhes:
                lbl_dia_selecionado = gr.Markdown("### 📅 Compromissos do Dia")
                tbl_eventos_dia = gr.Dataframe(
                    headers=["Hora", "Descrição"],
                    datatype=["str", "str"],
                    column_count=(2, "fixed"),
                    row_count=(1, "dynamic"),
                    interactive=True,
                    label="Compromissos do Dia (Dobre-clique para editar, use + / - para linhas)",
                    wrap=True
                )
                with gr.Row():
                    btn_salvar_compromissos = gr.Button("💾 Salvar Alterações", variant="success")
                    btn_fechar_modal = gr.Button("Fechar", variant="secondary")
            
            # --- MAPA VISUAL DO CALENDÁRIO EM LARGURA TOTAL ---
            with gr.Row():
                with gr.Column(scale=1):
                    gr.Markdown("#### 🗺️ Mapa Visual de Monitoramento de Prazos")
                    
                    with gr.Row():
                        with gr.Column(scale=1, min_width=200):
                            with gr.Row():
                                btn_anterior = gr.Button("◀", variant="secondary", size="sm")
                                btn_hoje = gr.Button("Hoje", variant="secondary", size="sm")
                                btn_proximo = gr.Button("▶", variant="secondary", size="sm")
                        with gr.Column(scale=1, min_width=150):
                            drop_view = gr.Radio(["Dia", "Mês", "Ano"], value="Mês", label="Visualização", show_label=False)
                        with gr.Column(scale=1, min_width=150):
                            drop_font = gr.Dropdown(choices=["12px", "14px", "16px", "18px", "20px", "22px"], value="14px", label="Tamanho da Fonte")
                            
                    html_calendario = gr.HTML(value=renderizar_calendario(datetime.now().strftime("%Y-%m-%d"), "Mês", "14px"))
                    hidden_click_event = gr.Textbox(visible=True, elem_id="hidden_click_textbox_id")
            
            gr.Markdown("---")
            
            # --- OUTRAS FERRAMENTAS ---
            with gr.Row():
                with gr.Column(scale=1):
                    gr.Markdown("#### 🛠️ Gestão de Eventos por Data")
                    seletor_agenda = gr.DateTime(label="Selecione uma Data para Consultar", include_time=False, value=datetime.now().strftime("%Y-%m-%d"))
                    
                    btn_consultar_data = gr.Button("🔄 Checar Eventos do Dia", variant="secondary")
                    painel_evento_dia = gr.Markdown("### 📅 Status para hoje:\n*Selecione um dia no calendário acima e clique em Checar*")
                    status_manual = gr.Markdown("")

        with gr.Tab("📂 Banco de Processos do Escritório"):
            gr.Markdown("### 📂 Gerenciamento de Processos Monitorados")
            with gr.Row():
                with gr.Column(scale=1):
                    gr.Markdown("#### 💾 Cadastrar Novo Processo")
                    txt_cad_processo = gr.Textbox(label="Número do Processo (CNJ ou Somente Números)", placeholder="Ex: 1500254-98.2018.8.26.0540")
                    txt_cad_cliente = gr.Textbox(label="Cliente / Parte Relacionada", placeholder="Ex: Weslen Queiroz")
                    txt_cad_desc = gr.Textbox(label="Descrição / Notas", placeholder="Ex: Ação de cobrança / Vara Cível", lines=2)
                    btn_salvar_proc = gr.Button("💾 Cadastrar Processo", variant="primary")
                    status_cad_proc = gr.Markdown("")
                with gr.Column(scale=2):
                    gr.Markdown("#### 📋 Processos Monitorados")
                    tbl_processos = gr.Dataframe(value=listar_processos_db(), headers=["id", "Processo (CNJ)", "Cliente / Parte", "Descrição / Observação", "Data Limite Estimada", "Resumo do Processo"], interactive=False)
                    with gr.Row():
                        num_id_remover = gr.Number(label="Digite o ID do processo para remover", precision=0)
                        btn_remover_proc = gr.Button("❌ Remover Processo", variant="stop")
                    status_rem_proc = gr.Markdown("")

        with gr.Tab("📋 Kanban de Processos"):
            gr.Markdown("### 📋 Kanban de Tarefas por Processo")
            with gr.Row():
                with gr.Column(scale=1, min_width=250):
                    gr.Markdown("#### 🔍 Seleção de Processo")
                    drop_kanban_processo = gr.Dropdown(choices=obter_choices_processos(), value="Nenhum", label="Selecione o Processo")
                    
                    gr.Markdown("#### ➕ Adicionar Nova Tarefa")
                    txt_kanban_titulo = gr.Textbox(label="Título da Tarefa", placeholder="Ex: Protocolar contestação")
                    txt_kanban_desc = gr.Textbox(label="Descrição da Tarefa (Opcional)", placeholder="Ex: Juntar guia de custas paga", lines=2)
                    drop_kanban_status = gr.Dropdown(choices=[("A Fazer", "todo"), ("Em Andamento", "in_progress"), ("Bloqueado", "blocked"), ("Concluído", "done")], value="todo", label="Status Inicial")
                    btn_kanban_adicionar = gr.Button("➕ Adicionar Tarefa", variant="primary")
                    out_kanban_status = gr.Markdown("")
                    
                with gr.Column(scale=3):
                    html_kanban_board = gr.HTML(value=gerar_kanban_html(None))
                    hidden_kanban_event = gr.Textbox(visible=True, elem_id="hidden_kanban_textbox_id")

    # =====================================================================
    # EVENTOS E CONEXÕES REPLICADAS DO APP6.2
    # =====================================================================
    btn_buscar.click(
        fn=executar_pesquisa_pje, 
        inputs=[txt_data_inicial, txt_data_final, txt_processo, drop_tribunal, txt_nome_parte, txt_oab, txt_uf_oab, txt_pagina, drop_itens_pagina, chk_apenas_monitorados, drop_selecionar_escritorio], 
        outputs=[out_status, tabela_resultados]
    )
    
    # Eventos de Banco de Processos do Escritório
    drop_selecionar_escritorio.change(
        fn=selecionar_processo_dropdown,
        inputs=[drop_selecionar_escritorio],
        outputs=[txt_processo]
    )
    
    btn_salvar_proc.click(
        fn=salvar_e_recarregar,
        inputs=[txt_cad_processo, txt_cad_cliente, txt_cad_desc],
        outputs=[status_cad_proc, tbl_processos, drop_selecionar_escritorio, drop_kanban_processo]
    )
    
    btn_remover_proc.click(
        fn=remover_e_recarregar,
        inputs=[num_id_remover],
        outputs=[status_rem_proc, tbl_processos, drop_selecionar_escritorio, drop_kanban_processo]
    )

    tabela_resultados.select(fn=carregar_texto_da_linha, inputs=[tabela_resultados], outputs=[tabela_resultados, proc_alvo, texto_alvo])
    
    btn_selecionar_todos.click(
        fn=selecionar_todos_registros,
        inputs=[tabela_resultados],
        outputs=[tabela_resultados, proc_alvo, texto_alvo]
    )
    
    btn_desselecionar_todos.click(
        fn=desselecionar_todos_registros,
        inputs=[tabela_resultados],
        outputs=[tabela_resultados, proc_alvo, texto_alvo]
    )
    
    # Eventos de Atualização do Destaque de Busca
    txt_termo_busca.change(
        fn=destacar_termo_no_teor,
        inputs=[texto_alvo, txt_termo_busca],
        outputs=[html_texto_destacado]
    )
    
    texto_alvo.change(
        fn=destacar_termo_no_teor,
        inputs=[texto_alvo, txt_termo_busca],
        outputs=[html_texto_destacado]
    )
    
    # Evento de Mudança de Provedor LLM
    drop_provedor_llm.change(
        fn=atualizar_provedor,
        inputs=[drop_provedor_llm],
        outputs=[drop_modelo_llm, txt_api_key_or_host]
    )
    
    btn_agentes.click(
        fn=executar_ia_e_carregar_prazos, 
        inputs=[drop_provedor_llm, drop_modelo_llm, txt_api_key_or_host, proc_alvo, texto_alvo, diretriz_defesa], 
        outputs=[painel_prazos, painel_minutas, painel_sugestoes_agenda, drop_prazos_detectados, sugestao_titulo, data_prazo, txt_hora_prazo, estado_eventos_detectados, tbl_processos]
    )
    
    # Evento de Mudança de Prazo no Dropdown
    drop_prazos_detectados.change(
        fn=selecionar_prazo_dropdown,
        inputs=[drop_prazos_detectados, estado_eventos_detectados],
        outputs=[sugestao_titulo, data_prazo, txt_hora_prazo]
    )
    
    # Eventos de Atualização da Agenda
    btn_enviar_agenda.click(
        fn=enviar_para_agenda_e_atualizar, 
        inputs=[data_prazo, sugestao_titulo, txt_hora_prazo, active_date, view_type, drop_font], 
        outputs=[status_envio, html_calendario, painel_evento_dia]
    )
    
    btn_salvar_compromissos.click(
        fn=salvar_compromissos_dia,
        inputs=[active_date, tbl_eventos_dia, view_type, drop_font],
        outputs=[status_manual, html_calendario, modal_detalhes]
    )
    
    drop_font.change(
        fn=renderizar_calendario,
        inputs=[active_date, view_type, drop_font],
        outputs=[html_calendario]
    )
    
    btn_consultar_data.click(fn=visualizar_data_calendario, inputs=[seletor_agenda], outputs=[painel_evento_dia])
    
    # Eventos de Navegação do Calendário Visual
    btn_anterior.click(
        fn=navegar_e_renderizar, 
        inputs=[active_date, view_type, gr.State(-1), drop_font], 
        outputs=[active_date, html_calendario]
    )
    btn_hoje.click(
        fn=navegar_e_renderizar, 
        inputs=[active_date, view_type, gr.State(0), drop_font], 
        outputs=[active_date, html_calendario]
    )
    btn_proximo.click(
        fn=navegar_e_renderizar, 
        inputs=[active_date, view_type, gr.State(1), drop_font], 
        outputs=[active_date, html_calendario]
    )
    
    drop_view.input(
        fn=alterar_visao_e_renderizar, 
        inputs=[active_date, drop_view, drop_font], 
        outputs=[view_type, html_calendario]
    )
    
    # Atualizações quando os estados do Calendário mudam
    active_date.change(
        fn=atualizar_status_dia_calendario, 
        inputs=[active_date], 
        outputs=[painel_evento_dia]
    )
    
    # Clique nos dias/meses do HTML
    hidden_click_event.change(
        fn=processar_clique_calendario,
        inputs=[hidden_click_event, active_date, view_type, drop_font],
        outputs=[active_date, drop_view, hidden_click_event, modal_detalhes, tbl_eventos_dia, html_calendario, lbl_dia_selecionado]
    )
    
    # Fechamento do Modal
    btn_fechar_modal.click(
        fn=lambda: gr.update(visible=False),
        inputs=[],
        outputs=[modal_detalhes]
    )

    # Eventos do Kanban de Processos
    drop_kanban_processo.change(
        fn=lambda proc: gerar_kanban_html(obter_id_processo_por_mascara_ou_numero(proc)),
        inputs=[drop_kanban_processo],
        outputs=[html_kanban_board]
    )
    
    btn_kanban_adicionar.click(
        fn=form_adicionar_tarefa_kanban,
        inputs=[drop_kanban_processo, txt_kanban_titulo, txt_kanban_desc, drop_kanban_status],
        outputs=[html_kanban_board, out_kanban_status, txt_kanban_titulo, txt_kanban_desc]
    )
    
    hidden_kanban_event.change(
        fn=processar_evento_kanban,
        inputs=[hidden_kanban_event, drop_kanban_processo],
        outputs=[html_kanban_board, out_kanban_status, hidden_kanban_event]
    )

    modal_css = """
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Inter:wght@300;400;600;800&family=Roboto:wght@300;400;700&family=Montserrat:wght@300;400;700&family=Open+Sans:wght@300;400;700&display=swap');
    #hidden_click_textbox_id { display: none !important; }
    #hidden_kanban_textbox_id { display: none !important; }
    #modal_detalhes_id {
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        width: 90% !important;
        max-width: 650px !important;
        background-color: white !important;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25) !important;
        border: 2px solid #cbd5e1 !important;
        border-radius: 12px !important;
        padding: 20px !important;
        z-index: 99999 !important;
        max-height: 85vh !important;
        overflow-y: auto !important;
    }
    """
    if __name__ == "__main__":
        demo.launch(js=js_code, theme=gr.themes.Soft(), css=modal_css)