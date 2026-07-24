import asyncio
from datetime import datetime, timedelta, date
import os
import re
import warnings
from typing import List, Optional, Tuple, Dict, Any
import sqlite3
import pandas as pd
from httpx import AsyncClient
from loguru import logger
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uuid

# Importações do framework Agno para Agentes de IA
from agno.agent import Agent

# Ignora avisos de depreciação do Starlette e outros pacotes de terceiros
warnings.filterwarnings("ignore", category=DeprecationWarning)

DB_FILE = "processos.db"

def db_connect():
    conn = sqlite3.connect(DB_FILE, timeout=30.0)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

# =====================================================================
# 🗄️ INICIALIZAÇÃO E UTILITÁRIOS DE BANCO DE DADOS (SQLite)
# =====================================================================

def init_db():
    conn = db_connect()
    cursor = conn.cursor()
    
    # Tabela de Clientes
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            tipo TEXT CHECK(tipo IN ('Física', 'Jurídica')),
            cpf_cnpj TEXT UNIQUE NOT NULL,
            email TEXT,
            telefone TEXT,
            cep TEXT,
            logradouro TEXT,
            numero TEXT,
            complemento TEXT,
            bairro TEXT,
            cidade TEXT,
            estado TEXT,
            observacoes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Tabela de Processos
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS processos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero TEXT UNIQUE NOT NULL,
            mascara TEXT,
            cliente TEXT,
            descricao TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data_limite_estimada TEXT DEFAULT 'N/A',
            resumo TEXT DEFAULT '',
            status TEXT DEFAULT 'todo',
            cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL
        )
    """)
    
    # Adicionar colunas se não existirem (garantir integridade para bancos existentes)
    cursor.execute("PRAGMA table_info(clientes)")
    cols_c = [col[1] for col in cursor.fetchall()]
    if "usuario" not in cols_c:
        cursor.execute("ALTER TABLE clientes ADD COLUMN usuario TEXT DEFAULT ''")

    cursor.execute("PRAGMA table_info(processos)")
    columns = [col[1] for col in cursor.fetchall()]
    if "data_limite_estimada" not in columns:
        cursor.execute("ALTER TABLE processos ADD COLUMN data_limite_estimada TEXT DEFAULT 'N/A'")
    if "resumo" not in columns:
        cursor.execute("ALTER TABLE processos ADD COLUMN resumo TEXT DEFAULT ''")
    if "status" not in columns:
        cursor.execute("ALTER TABLE processos ADD COLUMN status TEXT DEFAULT 'todo'")
    if "cliente_id" not in columns:
        cursor.execute("ALTER TABLE processos ADD COLUMN cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL")
    if "usuario" not in columns:
        cursor.execute("ALTER TABLE processos ADD COLUMN usuario TEXT DEFAULT ''")

    # Tabela de tarefas Kanban
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS kanban_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            processo_id INTEGER,
            titulo TEXT NOT NULL,
            descricao TEXT,
            status TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            usuario TEXT DEFAULT '',
            FOREIGN KEY(processo_id) REFERENCES processos(id) ON DELETE CASCADE
        )
    """)
    cursor.execute("PRAGMA table_info(kanban_tasks)")
    cols_k = [col[1] for col in cursor.fetchall()]
    if "usuario" not in cols_k:
        cursor.execute("ALTER TABLE kanban_tasks ADD COLUMN usuario TEXT DEFAULT ''")

    # Tabela de Usuários (Autenticação)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()
    conn.close()

# Inicializa o banco de dados
init_db()

# =====================================================================
# 📋 OPERAÇÕES DE BANCO DE DADOS (CLIENTES & PROCESSOS)
# =====================================================================

def db_adicionar_cliente(c: Dict[str, Any]) -> int:
    conn = db_connect()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO clientes (
                nome, tipo, cpf_cnpj, email, telefone, cep, logradouro,
                numero, complemento, bairro, cidade, estado, observacoes, usuario
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            c['nome'], c['tipo'], c['cpf_cnpj'], c.get('email'), c.get('telefone'),
            c.get('cep'), c.get('logradouro'), c.get('numero'), c.get('complemento'),
            c.get('bairro'), c.get('cidade'), c.get('estado'), c.get('observacoes'),
            c.get('usuario', '')
        ))
        client_id = cursor.lastrowid
        conn.commit()
        return client_id
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="CPF ou CNPJ já cadastrado no sistema.")
    finally:
        conn.close()

def db_atualizar_cliente(client_id: int, c: Dict[str, Any]):
    conn = db_connect()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE clientes SET
                nome = ?, tipo = ?, cpf_cnpj = ?, email = ?, telefone = ?,
                cep = ?, logradouro = ?, numero = ?, complemento = ?,
                bairro = ?, cidade = ?, estado = ?, observacoes = ?
            WHERE id = ?
        """, (
            c['nome'], c['tipo'], c['cpf_cnpj'], c.get('email'), c.get('telefone'),
            c.get('cep'), c.get('logradouro'), c.get('numero'), c.get('complemento'),
            c.get('bairro'), c.get('cidade'), c.get('estado'), c.get('observacoes'),
            client_id
        ))
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Erro de integridade. Verifique se o CPF/CNPJ já pertence a outro cliente.")
    finally:
        conn.close()

def db_remover_cliente(client_id: int):
    conn = db_connect()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM clientes WHERE id = ?", (client_id,))
        # Processos associados terão o cliente_id setado para NULL devido ao ON DELETE SET NULL
        conn.commit()
    finally:
        conn.close()

def db_listar_clientes(usuario: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = db_connect()
    try:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        if usuario:
            cursor.execute("SELECT * FROM clientes WHERE usuario = ? OR usuario = '' OR usuario IS NULL ORDER BY nome ASC", (usuario,))
        else:
            cursor.execute("SELECT * FROM clientes ORDER BY nome ASC")
        rows = cursor.fetchall()
        
        clientes_list = []
        for r in rows:
            client = dict(r)
            # Buscar processos do cliente
            if usuario:
                cursor.execute("SELECT id, numero, mascara, descricao, data_limite_estimada, resumo FROM processos WHERE cliente_id = ? AND (usuario = ? OR usuario = '' OR usuario IS NULL)", (client['id'], usuario))
            else:
                cursor.execute("SELECT id, numero, mascara, descricao, data_limite_estimada, resumo FROM processos WHERE cliente_id = ?", (client['id'],))
            client['processos'] = [dict(p) for p in cursor.fetchall()]
            clientes_list.append(client)
            
        return clientes_list
    finally:
        conn.close()

def db_adicionar_processo(numero_masked: str, cliente_id: Optional[int] = None, cliente_nome: str = "", descricao: str = "", usuario: str = "") -> Tuple[bool, str, Optional[int]]:
    if not numero_masked or not numero_masked.strip():
        return False, "Número de processo não fornecido.", None
    numero_limpo = "".join(filter(str.isdigit, numero_masked))
    if not numero_limpo:
        return False, "O número do processo deve conter dígitos.", None
    
    mascara = numero_masked.strip()
    if len(numero_limpo) == 20:
        mascara = f"{numero_limpo[0:7]}-{numero_limpo[7:9]}.{numero_limpo[9:13]}.{numero_limpo[13]}.{numero_limpo[14:16]}.{numero_limpo[16:20]}"
        
    conn = None
    try:
        conn = db_connect()
        cursor = conn.cursor()
        
        # Se cliente_id for provido, buscar o nome correto do cliente
        if cliente_id:
            cursor.execute("SELECT nome FROM clientes WHERE id = ?", (cliente_id,))
            row = cursor.fetchone()
            if row:
                cliente_nome = row[0]
                
        # Verificar se o processo já existe cadastrado
        cursor.execute("SELECT id FROM processos WHERE numero = ?", (numero_limpo,))
        row_proc = cursor.fetchone()
        if row_proc:
            # Já existe! Atualiza o cliente_id, cliente e usuario
            cursor.execute(
                "UPDATE processos SET cliente_id = ?, cliente = ?, usuario = ? WHERE id = ?",
                (cliente_id, cliente_nome, usuario, row_proc[0])
            )
            conn.commit()
            return True, "Processo já cadastrado. Vínculo de cliente atualizado!", row_proc[0]
                
        cursor.execute(
            "INSERT INTO processos (numero, mascara, cliente, descricao, data_limite_estimada, resumo, cliente_id, usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (numero_limpo, mascara, cliente_nome, descricao, "N/A", "", cliente_id, usuario)
        )
        proc_id = cursor.lastrowid
        conn.commit()
        return True, "Processo cadastrado com sucesso!", proc_id
    except sqlite3.IntegrityError:
        return False, "Processo já cadastrado no banco do escritório.", None
    except Exception as e:
        return False, f"Erro ao acessar banco de dados: {str(e)}", None
    finally:
        if conn:
            conn.close()

def db_listar_processos(cliente_id: Optional[int] = None, usuario: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = db_connect()
    try:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        conditions = []
        params = []
        if cliente_id:
            conditions.append("p.cliente_id = ?")
            params.append(cliente_id)
        if usuario:
            conditions.append("(p.usuario = ? OR p.usuario = '' OR p.usuario IS NULL)")
            params.append(usuario)
            
        where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""
        query = f"""
            SELECT p.id, p.numero, p.mascara, p.cliente, p.descricao, p.data_limite_estimada, p.resumo, p.cliente_id, p.usuario, c.nome as cliente_nome
            FROM processos p
            LEFT JOIN clientes c ON p.cliente_id = c.id
            {where_clause}
            ORDER BY p.id DESC
        """
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def db_remover_processo(proc_id: int) -> bool:
    conn = None
    try:
        conn = db_connect()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM processos WHERE id = ?", (proc_id,))
        # kanban_tasks serão removidas em cascata
        conn.commit()
        return True
    except Exception as e:
        logger.error(f"Erro ao remover processo: {e}")
        return False
    finally:
        if conn:
            conn.close()

def db_atualizar_processo_dados_ia(numero_masked: str, data_limite: str, resumo: str, usuario: str = ""):
    conn = None
    try:
        numero_limpo = "".join(filter(str.isdigit, numero_masked))
        if not numero_limpo:
            return
        conn = db_connect()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM processos WHERE numero = ?", (numero_limpo,))
        row = cursor.fetchone()
        if row:
            cursor.execute(
                "UPDATE processos SET data_limite_estimada = ?, resumo = ? WHERE numero = ?",
                (data_limite, resumo, numero_limpo)
            )
            conn.commit()
        else:
            mascara = numero_masked.strip()
            if len(numero_limpo) == 20:
                mascara = f"{numero_limpo[0:7]}-{numero_limpo[7:9]}.{numero_limpo[9:13]}.{numero_limpo[13]}.{numero_limpo[14:16]}.{numero_limpo[16:20]}"
            
            cursor.execute(
                "INSERT INTO processos (numero, mascara, cliente, descricao, data_limite_estimada, resumo, status, cliente_id, usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (numero_limpo, mascara, "Aguardando Vínculo", "Processo adicionado automaticamente via triagem de diários.", data_limite, resumo, "todo", None, usuario)
            )
            conn.commit()
    except Exception as e:
        logger.error(f"Erro ao atualizar dados de IA do processo no DB: {e}")
    finally:
        if conn:
            conn.close()

# =====================================================================
# 📋 OPERAÇÕES DO KANBAN DE TAREFAS
# =====================================================================

def db_obter_tarefas_kanban(process_ids: Optional[List[int]] = None, usuario: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = db_connect()
    try:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        conditions = []
        params = []
        
        if process_ids:
            placeholders = ",".join("?" for _ in process_ids)
            conditions.append(f"k.processo_id IN ({placeholders})")
            params.extend(process_ids)
        if usuario:
            conditions.append("(k.usuario = ? OR k.usuario = '' OR k.usuario IS NULL)")
            params.append(usuario)
            
        where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""
        query = f"""
            SELECT k.id, k.processo_id, k.titulo, k.descricao, k.status, k.created_at, k.usuario, p.mascara as processo_mascara, p.cliente as cliente_nome
            FROM kanban_tasks k
            LEFT JOIN processos p ON k.processo_id = p.id
            {where_clause}
            ORDER BY k.id ASC
        """
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def db_adicionar_tarefa_kanban(processo_id: int, titulo: str, descricao: str = "", status: str = "todo", usuario: str = "") -> Optional[int]:
    conn = None
    try:
        conn = db_connect()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO kanban_tasks (processo_id, titulo, descricao, status, usuario) VALUES (?, ?, ?, ?, ?)",
            (processo_id, titulo, descricao, status, usuario)
        )
        task_id = cursor.lastrowid
        conn.commit()
        return task_id
    except Exception as e:
        logger.error(f"Erro ao adicionar tarefa Kanban: {e}")
        return None
    finally:
        if conn:
            conn.close()

def db_atualizar_status_tarefa_kanban(task_id: int, novo_status: str) -> bool:
    conn = None
    try:
        conn = db_connect()
        cursor = conn.cursor()
        cursor.execute("UPDATE kanban_tasks SET status = ? WHERE id = ?", (novo_status, task_id))
        conn.commit()
        return True
    except Exception as e:
        logger.error(f"Erro ao atualizar status do Kanban: {e}")
        return False
    finally:
        if conn:
            conn.close()

def db_atualizar_detalhes_tarefa_kanban(task_id: int, titulo: str, descricao: str) -> bool:
    conn = None
    try:
        conn = db_connect()
        cursor = conn.cursor()
        cursor.execute("UPDATE kanban_tasks SET titulo = ?, descricao = ? WHERE id = ?", (titulo, descricao, task_id))
        conn.commit()
        return True
    except Exception as e:
        logger.error(f"Erro ao atualizar detalhes da tarefa Kanban: {e}")
        return False
    finally:
        if conn:
            conn.close()

def db_remover_tarefa_kanban(task_id: int) -> bool:
    conn = None
    try:
        conn = db_connect()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM kanban_tasks WHERE id = ?", (task_id,))
        conn.commit()
        return True
    except Exception as e:
        logger.error(f"Erro ao remover tarefa Kanban: {e}")
        return False
    finally:
        if conn:
            conn.close()

# =====================================================================
# 🧼 LIMPEZA E EXTRAÇÃO AVANÇADA (Padrão applegal.py)
# =====================================================================

from html.parser import HTMLParser

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

import html

def limpar_html(html_text: Optional[str]) -> str:
    if not html_text:
        return "Sem conteúdo cadastrado."
    if "Processo sigiloso" in html_text:
        return "⚠️ CONTEÚDO BLOQUEADO: Processo corre em Segredo de Justiça."
    try:
        # 1. Unescape HTML entities (e.g. &lt; to <, &amp; to &)
        # Fazemos duas vezes para garantir caso venha double-escaped
        text = html.unescape(html_text)
        text = html.unescape(text)
        
        # 2. Substituir tags de bloco comuns e quebras de linha por newlines reais
        text = re.sub(r'<(p|br|br\s*/|div|/p|/div|tr|/tr)>', '\n', text, flags=re.IGNORECASE)
        
        # 3. Remover todas as demais tags HTML
        stripper = HTMLStripper()
        stripper.feed(text)
        stripped_text = stripper.get_data()
        
        # 4. Tratar espaços em branco e substituir non-breaking spaces
        lines = []
        for line in stripped_text.split('\n'):
            line_cleaned = line.strip()
            # Substitui caracteres de espaço inquebrável (NBSP) por espaço normal
            line_cleaned = line_cleaned.replace('\xa0', ' ').replace('&nbsp;', ' ')
            # Limpa múltiplos espaços internos
            line_cleaned = re.sub(r'\s+', ' ', line_cleaned)
            if line_cleaned:
                lines.append(line_cleaned)
                
        return '\n'.join(lines)
    except Exception as e:
        logger.error(f"Erro ao limpar HTML: {e}")
        try:
            return html.unescape(html_text) if html_text else ""
        except:
            return html_text or ""

def extrair_processo_fallback(texto: str) -> str:
    padrao_cnj = r'\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}'
    match = re.search(padrao_cnj, texto)
    return match.group(0) if match else "Não identificado no texto"

def converter_data_str(data_str: str) -> Optional[date]:
    if not data_str:
        return None
    data_str = str(data_str).strip()
    
    try:
        val = float(data_str)
        if val > 1e11:  # milissegundos
            val = val / 1000.0
        return datetime.fromtimestamp(val).date()
    except ValueError:
        pass
        
    data_str = data_str.replace('"', '').replace("'", '').strip()
    
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
        return []

    chunks = []
    atual = d_ini
    while atual <= d_fim:
        proximo = min(atual + timedelta(days=dias_por_bloco - 1), d_fim)
        chunks.append((atual.strftime("%Y-%m-%d"), proximo.strftime("%Y-%m-%d")))
        atual = proximo + timedelta(days=1)
    return chunks

# =====================================================================
# 🗓️ CÁLCULO DE PRAZOS (CPC/2015)
# =====================================================================

def calcular_pascoa(ano: int) -> date:
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
    if dt.weekday() >= 5:
        return False
    if (dt.month == 12 and dt.day >= 20) or (dt.month == 1 and dt.day <= 20):
        return False
        
    feriados_fixos = {
        (1, 1), (4, 21), (5, 1), (9, 7), (10, 12),
        (11, 2), (11, 15), (11, 20), (12, 8), (12, 25)
    }
    if (dt.month, dt.day) in feriados_fixos:
        return False
        
    pascoa_dt = calcular_pascoa(dt.year)
    feriados_moveis = {
        pascoa_dt - timedelta(days=48),  # Segunda Carnaval
        pascoa_dt - timedelta(days=47),  # Terça Carnaval
        pascoa_dt - timedelta(days=46),  # Quarta de Cinzas
        pascoa_dt - timedelta(days=3),   # Quinta Santa
        pascoa_dt - timedelta(days=2),   # Sexta da Paixão
        pascoa_dt + timedelta(days=60)   # Corpus Christi
    }
    if dt in feriados_moveis:
        return False
        
    return True

def proximo_dia_util(dt: date) -> date:
    curr = dt + timedelta(days=1)
    while not e_dia_util(curr):
        curr += timedelta(days=1)
    return curr

def calcular_prazo_processual(data_disponibilizacao: str, prazo_dias: int, prazo_dilacao_edital: int = 0) -> str:
    try:
        d0 = converter_data_str(data_disponibilizacao)
        if not d0:
            return f"Erro: Formato de data inválido ({data_disponibilizacao})."
            
        dias_uteis = int(prazo_dias)
        dilacao = int(prazo_dilacao_edital)
        
        if dias_uteis <= 0:
            return "**Data Limite Estimada:** N/A\n\n**Justificativa:** Trata-se de mero expediente ou despacho sem determinação de prazo peremptório."
            
        d_pub = proximo_dia_util(d0)
        curr = d_pub
        
        explicacao_dilacao = ""
        if dilacao > 0:
            passos_dilacao = []
            for d in range(1, dilacao + 1):
                curr = proximo_dia_util(curr)
                passos_dilacao.append(f"  - Dilação Dia {d}: {curr.strftime('%d-%m-%Y')}{obter_dia_semana_pt(curr.strftime('%d-%m-%Y'))}")
            explicacao_dilacao = f"\n**Período de Dilação do Edital ({dilacao} dias):**\n" + "\n".join(passos_dilacao) + "\n"
            
        passos_prazo = []
        for p in range(1, dias_uteis + 1):
            curr = proximo_dia_util(curr)
            passos_prazo.append(f"| Dia {p} | {curr.strftime('%d-%m-%Y')} | {obter_dia_semana_pt(curr.strftime('%d-%m-%Y')).replace('(', '').replace(')', '').strip()} |")
            
        data_final_br = curr.strftime("%d-%m-%Y")
        
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
# 🚀 PJe DJEN API CLIENT
# =====================================================================

class DjenApiClient:
    BASE_URL = "https://comunicaapi.pje.jus.br/api/v1/comunicacao"

    def __init__(self, timeout: float = 30.0):
        self.timeout = timeout

    async def buscar_publicacoes_slice(self, params: dict) -> List[dict]:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
        }
        def _fetch():
            import requests
            resp = requests.get(self.BASE_URL, params=params, headers=headers, timeout=self.timeout)
            if resp.status_code == 200:
                return resp.json().get("items", [])
            else:
                logger.error(f"Erro ao consultar bloco: Status {resp.status_code}")
                return []

        try:
            return await asyncio.to_thread(_fetch)
        except Exception as e:
            logger.error(f"Erro ao consultar bloco: {e}")
            return []

client_pje = DjenApiClient()
cache_publicacoes = {}

def formatar_data_com_hora_se_houver(d_disp_raw) -> str:
    if not d_disp_raw or d_disp_raw == "-":
        return "-"
    d_disp_str = str(d_disp_raw).strip()
    
    parsed_dt = None
    for fmt in (
        "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S", 
        "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%d-%m-%Y %H:%M:%S", 
        "%d-%m-%Y %H:%M", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M"
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

async def executar_pesquisa_pje(params: Dict[str, Any]) -> Tuple[str, List[Dict[str, Any]]]:
    global cache_publicacoes
    cache_publicacoes.clear()
    
    data_ini = params.get("data_ini")
    data_fim = params.get("data_fim")
    num_proc = params.get("num_proc")
    tribunal = params.get("tribunal")
    nome = params.get("nome_parte")
    num_oab = params.get("num_oab")
    estado_oab = params.get("estado_oab")
    pag = params.get("pagina", 1)
    qtd_itens = params.get("itens_pagina", 50)
    apenas_monitorados = params.get("apenas_monitorados", False)
    processo_selecionado_id = params.get("processo_selecionado_id")

    try:
        p_num = int(pag)
        if p_num <= 0:
            p_num = 1
    except:
        p_num = 1

    if not data_ini or not data_fim:
        return "⚠️ Erro: As datas Inicial e Final são obrigatórias.", []

    chunks = gerar_chunks_de_datas(data_ini, data_fim, dias_por_bloco=90)
    if not chunks:
        return "❌ Erro ao processar as datas. Verifique o formato.", []

    processos_para_buscar = []
    processos_nomes_dict = {}
    
    if apenas_monitorados:
        df_db = db_listar_processos()
        if not df_db:
            return "⚠️ Erro: Nenhum processo cadastrado no banco do escritório.", []
        for row in df_db:
            p = row["mascara"]
            limpo = "".join(filter(str.isdigit, str(p)))
            if limpo:
                processos_para_buscar.append(limpo)
                processos_nomes_dict[limpo] = {
                    "mascara": p,
                    "cliente": row.get("cliente") or "Escritório"
                }
        if not processos_para_buscar:
            return "⚠️ Erro: Nenhum processo com formato numérico válido no banco.", []
    elif processo_selecionado_id:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("SELECT numero, mascara, cliente FROM processos WHERE id = ?", (processo_selecionado_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            processos_para_buscar = [row[0]]
            processos_nomes_dict[row[0]] = {"mascara": row[1], "cliente": row[2]}
    elif num_proc:
        limpo = "".join(filter(str.isdigit, str(num_proc)))
        if limpo:
            processos_para_buscar = [limpo]
    else:
        processos_para_buscar = [None]

    sem = asyncio.Semaphore(10)
    async def buscar_com_semaforo(p):
        async with sem:
            try:
                return await client_pje.buscar_publicacoes_slice(p)
            except Exception as e:
                logger.error(f"Erro na requisição: {e}")
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
    for lista in resultados_fatiados:
        if lista:
            todos_itens.extend(lista)

    d_ini = converter_data_str(data_ini)
    d_fim = converter_data_str(data_fim)

    itens_unicos = []
    chaves_vistas = set()
    for item in todos_itens:
        texto_raw = item.get("texto", "")
        texto_limpo = limpar_html(texto_raw)
        
        d_disp_raw = item.get("data_disponibilizacao") or item.get("datadisponibilizacao") or item.get("dataDisponibilizacao") or "-"
        d_disp_dt = converter_data_str(d_disp_raw)
        if d_ini and d_fim and d_disp_dt:
            if not (d_ini <= d_disp_dt <= d_fim):
                continue
                
        n_proc = item.get("numeroprocessocommascara") or item.get("numero_processo") or item.get("numeroProcesso") or item.get("numero") or extrair_processo_fallback(texto_limpo)
        d_disp = formatar_data_com_hora_se_houver(d_disp_raw)
        
        chave = (n_proc, d_disp, texto_limpo[:100])
        if chave not in chaves_vistas:
            chaves_vistas.add(chave)
            itens_unicos.append(item)

    # Ordenar cronologicamente
    def obter_data_item(it):
        raw = it.get("data_disponibilizacao") or it.get("datadisponibilizacao") or it.get("dataDisponibilizacao") or "-"
        dt = converter_data_str(raw)
        return dt or date.min
    itens_unicos.sort(key=obter_data_item)

    rows = []
    processos_com_publicacao = set()
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
            
        d_disp = formatar_data_com_hora_se_houver(item.get("data_disponibilizacao") or item.get("datadisponibilizacao") or item.get("dataDisponibilizacao") or "-")
        dest_lista = item.get("destinatarios", []) or item.get("destinatarioadvogados", [])
        dest_nomes = [d.get("nome") for d in dest_lista if isinstance(d, dict) and d.get("nome")]
        destinatarios_str = ", ".join(dest_nomes) if dest_nomes else "Não informado"

        rows.append({
            "linha": linha_num,
            "processo_cnj": n_proc,
            "tribunal": sigla,
            "tipo": tipo,
            "data_disp": d_disp,
            "destinatarios": destinatarios_str,
            "conteudo_resumo": texto_limpo[:100] + "...",
            "conteudo_completo": texto_limpo
        })

    if apenas_monitorados:
        for proc_limpo in processos_para_buscar:
            if proc_limpo not in processos_com_publicacao:
                info = processos_nomes_dict.get(proc_limpo, {"mascara": proc_limpo, "cliente": "Escritório"})
                linha_num = len(rows) + 1
                cache_publicacoes[linha_num] = ""
                rows.append({
                    "linha": linha_num,
                    "processo_cnj": info["mascara"],
                    "tribunal": tribunal.upper() if tribunal and tribunal != "TODOS" else "-",
                    "tipo": "Sem Movimentação",
                    "data_disp": "-",
                    "destinatarios": info.get("cliente", "-"),
                    "conteudo_resumo": "Nenhuma nova publicação localizada.",
                    "conteudo_completo": ""
                })

    status_msg = f"✅ Sucesso! {len(rows)} registros localizados."
    return status_msg, rows

# =====================================================================
# 🧠 ENGENHARIA DE AGENTES (Agno)
# =====================================================================

def carregar_skill_advogado(provedor: str = "", texto_publicacao: str = "") -> str:
    caminho_skill = os.path.join(os.path.dirname(__file__), "SKILL_advogado.md")
    if os.path.exists(caminho_skill):
        try:
            with open(caminho_skill, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            logger.error(f"Erro ao ler arquivo: {e}")
            return "Você é um Advogado Especialista em Direito Civil brasileiro."
    else:
        return "Você é um Advogado Especialista em Direito Civil brasileiro."

    if provedor.strip().lower() not in ("ollama", "groq"):
        return content

    # Poda a skill para Ollama/Groq reduzirem contexto
    lines = content.splitlines()
    pruned_lines = lines[:230]
    texto_busca = str(texto_publicacao).lower()
    
    secoes = [
        {"keys": ["maria da penha", "violência doméstica"], "start": 228, "end": 263},
        {"keys": ["divórcio", "guarda", "alimentos", "pensão", "inventário", "partilha"], "start": 264, "end": 439},
        {"keys": ["moral", "indenização", "responsabilidade civil"], "start": 440, "end": 515},
        {"keys": ["consumidor", "cdc", "cartão", "cobrança", "banco"], "start": 516, "end": 554},
        {"keys": ["imóvel", "locação", "despejo", "usucapião"], "start": 555, "end": 600},
        {"keys": ["trabalhista", "clt", "salário", "horas extras"], "start": 601, "end": 640},
        {"keys": ["previdenciário", "inss", "aposentadoria"], "start": 641, "end": 664},
        {"keys": ["tributo", "tributário", "imposto"], "start": 665, "end": 687},
        {"keys": ["mandado de segurança", "licitação", "concurso"], "start": 688, "end": 710},
        {"keys": ["lgpd", "dados", "privacidade"], "start": 711, "end": 740},
        {"keys": ["falência", "recuperação judicial", "ltda", "s/a"], "start": 741, "end": 770}
    ]
    
    for sec in secoes:
        if any(k in texto_busca for k in sec["keys"]):
            pruned_lines.extend(lines[sec["start"]:sec["end"]])
            
    # Find critical sections to append: Restricoes Absolutas and Advogado
    restricoes_start = -1
    advogado_start = -1
    for idx, line in enumerate(lines):
        if "## Restricoes Absolutas" in line:
            restricoes_start = idx
        elif "## Advogado" in line:
            advogado_start = idx

    if restricoes_start != -1:
        # Adiciona até encontrar o próximo separador '---' ou outra seção
        for line in lines[restricoes_start:]:
            if line.startswith("---") and pruned_lines and pruned_lines[-1] != "---":
                break
            pruned_lines.append(line)
            
    if advogado_start != -1:
        for line in lines[advogado_start:]:
            if line.startswith("---") and pruned_lines and pruned_lines[-1] != "---":
                break
            pruned_lines.append(line)
            
    return "\n".join(pruned_lines)

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
            "2. Identifique o prazo legal em dias.",
            "3. Sempre chame a ferramenta `calcular_prazo_processual` fornecendo a data de disponibilização e o prazo de dias de resposta.",
            "   ATENÇÃO PARA CITAÇÃO POR EDITAL: Em caso de edital com dilação de prazo, passe o prazo de resposta no parâmetro `prazo_dias` e a dilação no parâmetro `prazo_dilacao_edital` em uma ÚNICA chamada da ferramenta.",
            "4. Não realize cálculos mentais ou deduções textuais de datas finais por conta própria.",
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
    
    agente_resumo = Agent(
        model=llm_model,
        description="Você é o Analista Jurídico de Resumos, especializado em extrair o teor de publicações oficiais.",
        instructions=[
            "Sua única tarefa é ler a publicação jurídica e gerar um resumo conciso e objetivo do teor da decisão ou despacho.",
            "O resumo deve ser focado na substância da decisão (exemplo: 'Decisão que deferiu liminar de restabelecimento de plano de saúde sob pena de multa' ou 'Intimação para manifestação sobre laudo pericial').",
            "Instruções cruciais:",
            "1. Escreva o resumo de forma curta, direta e em uma única frase (máximo de 120 caracteres).",
            "2. Não use saudações, introduções ou explicações. Retorne APENAS a frase resumida."
        ],
        markdown=False
    )
    
    return agente_prazos, agente_minutas, agente_agenda, agente_resumo

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
        
    if not (match.startswith("[") and match.endswith("]")):
        start_idx = match.find("[")
        end_idx = match.rfind("]")
        if start_idx != -1 and end_idx != -1 and start_idx < end_idx:
            match = match[start_idx:end_idx+1]
            
    try:
        import json
        dados = json.loads(match)
        if isinstance(dados, list):
            eventos_validos = []
            for item in dados:
                if isinstance(item, dict) and "data" in item and "descricao" in item:
                    dt_val = converter_data_str(item["data"])
                    data_str = dt_val.strftime("%d-%m-%Y") if dt_val else datetime.now().strftime("%d-%m-%Y")
                    hora_str = item.get("hora", "09:00")
                    eventos_validos.append({
                        "data": data_str,
                        "hora": str(hora_str).strip(),
                        "descricao": item["descricao"].strip()
                    })
            return eventos_validos
    except Exception as e:
        logger.info(f"Erro ao parsear JSON de prazos: {e}")
        
    eventos_fallback = []
    datas_encontradas = re.findall(r"\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b\d{4}-\d{1,2}-\d{1,2}\b", texto_llm)
    for d_str in datas_encontradas:
        dt_val = converter_data_str(d_str)
        if dt_val:
            eventos_fallback.append({
                "data": dt_val.strftime("%d-%m-%Y"),
                "hora": "09:00",
                "descricao": f"Prazo sugerido: {d_str}"
            })
    if not eventos_fallback:
        eventos_fallback.append({
            "data": datetime.now().strftime("%d-%m-%Y"),
            "hora": "09:00",
            "descricao": "Prazo Processual"
        })
    return eventos_fallback

# =====================================================================
# 🔌 CONFIGURAÇÃO DO FASTAPI & SCHEMAS DE ENTRADA
# =====================================================================

app = FastAPI(title="LegalMind API", version="6.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Next.js local e testes
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ClientSchema(BaseModel):
    nome: str
    tipo: str = Field(..., pattern="^(Física|Jurídica)$")
    cpf_cnpj: str
    email: Optional[str] = ""
    telefone: Optional[str] = ""
    cep: Optional[str] = ""
    logradouro: Optional[str] = ""
    numero: Optional[str] = ""
    complemento: Optional[str] = ""
    bairro: Optional[str] = ""
    cidade: Optional[str] = ""
    estado: Optional[str] = ""
    observacoes: Optional[str] = ""
    processos: Optional[List[str]] = []  # Lista de CNJs a cadastrar associados
    usuario: Optional[str] = ""

class ProcessSchema(BaseModel):
    numero: str
    cliente_id: Optional[int] = None
    cliente_nome: Optional[str] = ""
    descricao: Optional[str] = ""
    usuario: Optional[str] = ""

class ProcessUpdateSchema(BaseModel):
    resumo: Optional[str] = None
    data_limite_estimada: Optional[str] = None
    status: Optional[str] = None

class PjeSearchSchema(BaseModel):
    data_ini: str
    data_fim: str
    num_proc: Optional[str] = ""
    tribunal: Optional[str] = "TODOS"
    nome_part: Optional[str] = ""
    num_oab: Optional[str] = ""
    estado_oab: Optional[str] = ""
    pagina: Optional[int] = 1
    itens_pagina: Optional[int] = 50
    apenas_monitorados: Optional[bool] = False
    processo_selecionado_id: Optional[int] = None
    selected_process_ids: Optional[List[int]] = []

class RunAgentsSchema(BaseModel):
    provedor: str
    modelo_id: str
    api_key_or_host: Optional[str] = ""
    num_processo: str
    texto_publicacao: str
    tese_defesa: Optional[str] = ""

class SaveDeadlineSchema(BaseModel):
    processo_cnj: str
    data_limite: str
    resumo: str
    usuario: Optional[str] = ""

class KanbanTaskCreateSchema(BaseModel):
    processo_id: int
    titulo: str
    descricao: Optional[str] = ""
    status: str = "todo"
    usuario: Optional[str] = ""

class KanbanTaskUpdateSchema(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    status: Optional[str] = None

# =====================================================================
# 📡 ENDPOINTS FASTAPI
# =====================================================================

@app.get("/api/clients")
def get_clients(usuario: Optional[str] = Query(None)):
    return db_listar_clientes(usuario)

@app.post("/api/clients")
def create_client(client: ClientSchema):
    # Salva cliente no banco
    client_id = db_adicionar_cliente(client.model_dump())
    
    # Salva processos associados
    processos_salvos = []
    for cnj in client.processos:
        if cnj.strip():
            success, msg, proc_id = db_adicionar_processo(cnj, cliente_id=client_id, cliente_nome=client.nome, usuario=client.usuario or "")
            if success:
                processos_salvos.append({"cnj": cnj, "id": proc_id})
                
    return {"message": "Cliente cadastrado com sucesso!", "client_id": client_id, "processos": processos_salvos}

@app.put("/api/clients/{client_id}")
def update_client(client_id: int, client: ClientSchema):
    db_atualizar_cliente(client_id, client.model_dump())
    
    # Sincroniza processos do cliente:
    # 1. Obter processos atuais no banco
    processos_atuais = db_listar_processos(client_id)
    cnjs_atuais = {p["numero"] for p in processos_atuais}
    
    # Normalizar CNJs enviados no payload
    cnjs_enviados_com_mascara = [c.strip() for c in client.processos if c.strip()]
    cnjs_enviados_limpos = {"".join(filter(str.isdigit, c)) for c in cnjs_enviados_com_mascara}
    
    # 2. Remover vínculo dos processos que não foram enviados
    conn = db_connect()
    try:
        cursor = conn.cursor()
        for p in processos_atuais:
            if p["numero"] not in cnjs_enviados_limpos:
                cursor.execute("UPDATE processos SET cliente_id = NULL, cliente = '' WHERE id = ?", (p["id"],))
        conn.commit()
    finally:
        conn.close()
        
    # 3. Adicionar novos vínculos para os processos enviados
    for cnj_mascara in cnjs_enviados_com_mascara:
        cnj_limpo = "".join(filter(str.isdigit, cnj_mascara))
        if cnj_limpo not in cnjs_atuais:
            db_adicionar_processo(cnj_mascara, cliente_id=client_id, cliente_nome=client.nome, usuario=client.usuario or "")
            
    return {"message": "Cadastro de cliente e processos associados atualizados!"}

@app.delete("/api/clients/{client_id}")
def delete_client(client_id: int):
    db_remover_cliente(client_id)
    return {"message": "Cliente removido com sucesso!"}

@app.get("/api/processes")
def get_processes(cliente_id: Optional[int] = None, usuario: Optional[str] = Query(None)):
    return db_listar_processos(cliente_id, usuario)

@app.post("/api/processes")
def create_process(proc: ProcessSchema):
    success, msg, proc_id = db_adicionar_processo(proc.numero, proc.cliente_id, proc.cliente_nome or "", proc.descricao or "", proc.usuario or "")
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg, "processo_id": proc_id}

@app.delete("/api/processes/{proc_id}")
def delete_process(proc_id: int):
    success = db_remover_processo(proc_id)
    if not success:
        raise HTTPException(status_code=400, detail="Erro ao deletar processo.")
    return {"message": "Processo removido com sucesso!"}

@app.put("/api/processes/{proc_id}")
def update_process(proc_id: int, req: ProcessUpdateSchema):
    fields = []
    values = []
    if req.resumo is not None:
        fields.append("resumo = ?")
        values.append(req.resumo)
    if req.data_limite_estimada is not None:
        fields.append("data_limite_estimada = ?")
        values.append(req.data_limite_estimada)
    if req.status is not None:
        fields.append("status = ?")
        values.append(req.status)
        
    if not fields:
        raise HTTPException(status_code=400, detail="Nenhum campo fornecido para atualização.")
        
    values.append(proc_id)
    query = f"UPDATE processos SET {', '.join(fields)} WHERE id = ?"
    
    conn = db_connect()
    try:
        cursor = conn.cursor()
        cursor.execute(query, values)
        conn.commit()
        return {"message": "Processo atualizado com sucesso!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao atualizar processo: {str(e)}")
    finally:
        conn.close()

@app.get("/api/debug-pje")
def debug_pje():
    import requests
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*"
    }
    params = {
        "dataInicial": "19-07-2026",
        "dataFinal": "24-07-2026",
        "siglaTribunal": "TJSP",
        "ufOab": "SP",
        "pagina": 1,
        "itensPorPagina": 10
    }
    try:
        r = requests.get("https://comunicaapi.pje.jus.br/api/v1/comunicacao", params=params, headers=headers, timeout=15)
        return {"status_code": r.status_code, "text_snippet": r.text[:500], "headers": dict(r.headers)}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/search-pje")
async def search_pje(params: PjeSearchSchema):
    # Adapta os parâmetros de entrada
    search_params = {
        "data_ini": params.data_ini,
        "data_fim": params.data_fim,
        "num_proc": params.num_proc,
        "tribunal": params.tribunal,
        "nome_parte": params.nome_part,
        "num_oab": params.num_oab,
        "estado_oab": params.estado_oab,
        "pagina": params.pagina,
        "itens_pagina": params.itens_pagina,
        "apenas_monitorados": params.apenas_monitorados,
        "processo_selecionado_id": params.processo_selecionado_id,
        "selected_process_ids": params.selected_process_ids
    }
    status_msg, data = await executar_pesquisa_pje(search_params)
    return {"status": status_msg, "results": data}

# Dicionário global para monitorar o status das tarefas dos agentes em segundo plano
agent_tasks = {}

def executar_agentes_background(task_id: str, req: RunAgentsSchema):
    try:
        agent_tasks[task_id]["progress"] = 10.0
        agente_prazos, agente_minutas, agente_agenda, agente_resumo = inicializar_agentes(
            req.provedor, req.modelo_id, req.api_key_or_host or "", req.texto_publicacao
        )
        contexto = f"Processos Selecionados: {req.num_processo}\n\nConteúdo das Publicações:\n{req.texto_publicacao}"
        
        agent_tasks[task_id]["progress"] = 25.0
        prompt_resumo = (
            f"Elabore um resumo objective e conciso (máximo de 120 caracteres, uma frase direta) sobre o teor da publicação oficial fornecida.\n"
            f"Foque na determinação do juiz e evite saudações ou palavras desnecessárias.\n\n"
            f"Texto:\n{req.texto_publicacao}"
        )
        res_resumo = agente_resumo.run(prompt_resumo)
        resumo_texto = res_resumo.content.strip().replace('"', '').replace("'", "")
        
        agent_tasks[task_id]["progress"] = 45.0
        prompt_prazos = (
            f"Você recebeu uma análise conjunta de uma ou mais publicações de diário oficial.\n"
            f"Sua função é atuar como Controller Jurídico sênior especialista em prazos do CPC/2015.\n"
            f"Analise CADA publicação separadamente e, para cada processo identificado:\n"
            f"1. Identifique a data de disponibilização oficial (informada no campo 'Data Disp' no contexto).\n"
            f"   IMPORTANTE: Se houver mais de uma publicação fornecida no contexto (de forma conjunta ou para o mesmo processo), você deve determinar e calcular a data limite estimada utilizando como base de contagem a data de disponibilização ('Data Disp') da ÚLTIMA publicação apresentada no contexto (que corresponde à publicação mais recente ou final).\n"
            f"2. Identifique a natureza da intimação e a quantidade de dias úteis do prazo legal aplicável (por exemplo: 15 dias para contestação, réplica, apelação; 5 dias para embargos de declaração; etc.). Se for citação/intimação por edital, verifique se há dias de dilação (ex: 20 dias).\n"
            f"3. Se houver prazo legal, utilize obrigatóriamente a ferramenta `calcular_prazo_processual` em uma única chamada fornecendo a data de disponibilização oficial, o prazo de dias de resposta em `prazo_dias` (ex: 15) e o prazo de edital/dilação em `prazo_dilacao_edital` (ex: 20). NUNCA divida o cálculo chamando a ferramenta para apenas um dos prazos e calculando o outro manualmente no texto. Transcreva e apresente integralmente no seu relatório o passo-a-passo e a tabela de contagem fornecidos pela ferramenta.\n"
            f"   Se for despacho de mero expediente (como juntada de custas retro ou aguardar audiência designada) sem determinação de prazo peremptório, declare explicitamente que não há prazo ou data limite estimada aplicável.\n"
            f"4. Determine o nível de criticidade (Baixo, Médio, Alto, Crítico) e sugira ações preventivas.\n\n"
            f"Apresente o resultado em markdown rico com tabelas ou badges visuais claros para cada processo.\n\n"
            f"Contexto:\n{contexto}"
        )
        res_prazos = agente_prazos.run(prompt_prazos)
        
        agent_tasks[task_id]["progress"] = 70.0
        prompt_minutas = (
            f"Baseado no contexto e na tese de defesa informada, elabore sugestões estruturadas de esqueletos de petições (contendo Fatos, Fundamentação Jurídica baseada no CPC/2015 e Pedidos formais) de forma separada para cada uma das publicações de processos listadas no contexto.\n\n"
            f"Tese de Defesa: {req.tese_defesa}\n\n"
            f"Contexto:\n{contexto}"
        )
        res_minutas = agente_minutas.run(prompt_minutas)
        
        agent_tasks[task_id]["progress"] = 85.0
        prompt_agenda = (
            f"Você é um assistente de agenda jurídica encarregado de extrair e sugerir compromissos da agenda baseando-se no teor das publicações e na análise do Controller Jurídico.\n"
            f"Use obrigatoriamente a 'Data Limite Estimada' calculada pelo Controller Jurídico para preencher os compromissos de prazo fatal correspondentes.\n\n"
            f"Análise de Prazos do Controller Jurídico:\n{res_prazos.content}\n\n"
            f"Use como descrição principal do evento o resumo gerado pelo Analista: '{resumo_texto}'.\n"
            f"Sua tarefa é analisar as publicações fornecidas abaixo e identificar todas as datas de prazos fatais (use a 'Data Limite Estimada' calculada), audiências ou compromissos citados.\n"
            f"ATENÇÃO: Você deve retornar UNICAMENTE o bloco de código JSON abaixo (delimitado por ```json ... ```). Não escreva NADA fora do bloco JSON. Não adicione saudações, introduções ou explicações de rodapé.\n\n"
            f"Retorne o seguinte formato JSON exato:\n"
            f"```json\n"
            f"[\n"
            f"  {{\"data\": \"YYYY-MM-DD\", \"hora\": \"09:00\", \"descricao\": \"[Processo CNJ] Prazo Fatal: {resumo_texto}\"}}\n"
            f"]\n"
            f"```\n\n"
            f"Contexto:\n{contexto}"
        )
        res_agenda_sugestao = agente_agenda.run(prompt_agenda)
        
        agent_tasks[task_id]["progress"] = 95.0
        prazos_lista = extrair_prazos_json(res_agenda_sugestao.content)
        
        agent_tasks[task_id]["result"] = {
            "prazos_markdown": res_prazos.content,
            "minuta_markdown": res_minutas.content,
            "agenda_json_raw": res_agenda_sugestao.content,
            "prazos_detectados": prazos_lista,
            "resumo_teor": resumo_texto
        }
        agent_tasks[task_id]["progress"] = 100.0
        agent_tasks[task_id]["status"] = "completed"
    except Exception as e:
        logger.error(f"Erro ao processar agentes em background: {str(e)}")
        agent_tasks[task_id]["error"] = str(e)
        agent_tasks[task_id]["status"] = "failed"

@app.post("/api/run-agents")
def run_agents(req: RunAgentsSchema, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    agent_tasks[task_id] = {
        "status": "running",
        "progress": 0.0,
        "result": None,
        "error": None
    }
    background_tasks.add_task(executar_agentes_background, task_id, req)
    return {"task_id": task_id, "status": "running"}

@app.get("/api/run-agents/status/{task_id}")
def run_agents_status(task_id: str):
    if task_id not in agent_tasks:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada.")
    return agent_tasks[task_id]

@app.post("/api/save-deadline")
def save_deadline(req: SaveDeadlineSchema):
    db_atualizar_processo_dados_ia(req.processo_cnj, req.data_limite, req.resumo, req.usuario or "")
    return {"message": "Data limite e resumo atualizados no banco de dados!"}

@app.get("/api/kanban/tasks")
def get_kanban_tasks(process_ids: Optional[str] = Query(None), usuario: Optional[str] = Query(None)):
    try:
        ids = [int(x) for x in process_ids.split(",") if x.strip()] if process_ids else None
        return db_obter_tarefas_kanban(ids, usuario=usuario)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Parâmetros de IDs inválidos: {str(e)}")

@app.post("/api/kanban/tasks")
def create_kanban_task(task: KanbanTaskCreateSchema):
    task_id = db_adicionar_tarefa_kanban(task.processo_id, task.titulo, task.descricao or "", task.status, task.usuario or "")
    if not task_id:
        raise HTTPException(status_code=400, detail="Erro ao criar tarefa no Kanban.")
    return {"message": "Tarefa criada!", "task_id": task_id}

@app.put("/api/kanban/tasks/{task_id}")
def update_kanban_task(task_id: int, task: KanbanTaskUpdateSchema):
    fields = []
    values = []
    if task.titulo is not None:
        fields.append("titulo = ?")
        values.append(task.titulo)
    if task.descricao is not None:
        fields.append("descricao = ?")
        values.append(task.descricao)
    if task.status is not None:
        fields.append("status = ?")
        values.append(task.status)
        
    if not fields:
        raise HTTPException(status_code=400, detail="Nenhum campo fornecido para atualização.")
        
    values.append(task_id)
    query = f"UPDATE kanban_tasks SET {', '.join(fields)} WHERE id = ?"
    
    conn = db_connect()
    try:
        cursor = conn.cursor()
        cursor.execute(query, values)
        conn.commit()
        return {"message": "Tarefa atualizada com sucesso!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao atualizar tarefa: {str(e)}")
    finally:
        conn.close()

@app.delete("/api/kanban/tasks/{task_id}")
def delete_kanban_task(task_id: int):
    success = db_remover_tarefa_kanban(task_id)
    if not success:
        raise HTTPException(status_code=400, detail="Erro ao remover tarefa.")
    return {"message": "Tarefa removida com sucesso!"}

class AuthSchema(BaseModel):
    username: str
    password: str

@app.post("/api/auth/register")
def auth_register(req: AuthSchema):
    conn = db_connect()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO usuarios (username, password) VALUES (?, ?)",
            (req.username, req.password)
        )
        conn.commit()
        return {"message": "Usuário registrado com sucesso!"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Este nome de usuário já está cadastrado.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no banco: {str(e)}")
    finally:
        conn.close()

@app.post("/api/auth/login")
def auth_login(req: AuthSchema):
    conn = db_connect()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT username FROM usuarios WHERE username = ? AND password = ?",
            (req.username, req.password)
        )
        row = cursor.fetchone()
        if row:
            return {"message": "Autenticado com sucesso!", "username": row[0]}
        else:
            raise HTTPException(status_code=401, detail="Usuário ou senha incorretos.")
    finally:
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

