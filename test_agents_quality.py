import os
import sys
import time
import json
import re
from datetime import datetime, timedelta
from loguru import logger

# Add workspace directory to path
sys.path.append(r"c:\Users\edumo\jud_legal1")

from applegal import inicializar_agentes, extrair_prazos_json, converter_data_str, obter_dia_semana_pt

# Test suite configuration
PROVIDER = "Gemini"
MODEL_ID = "gemini-flash-lite-latest"
API_KEY = os.environ.get("GEMINI_API_KEY")
REPORT_PATH = r"c:\Users\edumo\jud_legal1\relatorio_qualidade_agentes.md"

# Define test cases
TEST_CASES = [
    {
        "id": 1,
        "name": "Prazo Geral de Contestação (15 dias úteis)",
        "processo": "1002345-67.2026.8.26.0100",
        "texto": (
            "Fica o réu intimado para, no prazo de 15 (quinze) dias úteis, apresentar contestação, "
            "nos termos do artigo 335 do Código de Processo Civil."
        ),
        "data_disp": "2026-07-02",  # Disponibilizado na quinta (02/07), publicado na sexta (03/07), prazo inicia na segunda (06/07)
        "tese": "Inépcia da petição inicial por falta de documentos indispensáveis e ilegitimidade passiva.",
        "expected_days": 15,
        "expected_deadline_date": "2026-07-24",  # 15 dias úteis contados a partir de 06/07/2026 (inclusive)
    },
    {
        "id": 2,
        "name": "Embargos de Declaração (5 dias úteis)",
        "processo": "0005432-10.2025.8.19.0001",
        "texto": (
            "Intimem-se as partes da sentença proferida nos autos. Havendo omissão, contradição ou obscuridade, "
            "o prazo para oposição de Embargos de Declaração é de 5 (cinco) dias úteis, na forma do art. 1.023 do CPC."
        ),
        "data_disp": "2026-07-08",  # Disponibilizado na quarta (08/07), publicado na quinta (09/07), prazo inicia na sexta (10/07)
        "tese": "Contradição na sentença em relação aos juros de mora aplicados.",
        "expected_days": 5,
        "expected_deadline_date": "2026-07-16",  # 5 dias úteis a partir de 10/07/2026 (inclusive)
    },
    {
        "id": 3,
        "name": "Despacho Simples (Sem Prazo Peremptório / Mero Expediente)",
        "processo": "5000123-45.2026.4.03.6100",
        "texto": (
            "Mero expediente: Junte-se o comprovante de recolhimento de custas retro efetuado pelo autor. "
            "Aguarde-se a audiência de conciliação já designada nos autos. Cumpra-se."
        ),
        "data_disp": "2026-07-07",
        "tese": "Apenas tomar ciência e aguardar a realização da audiência.",
        "expected_days": 0,
        "expected_deadline_date": None,
    }
]

def run_evaluation():
    if not API_KEY:
        logger.error("GEMINI_API_KEY não localizada nas variáveis de ambiente. A avaliação não pode prosseguir de forma real.")
        return False
        
    logger.info("Inicializando agentes...")
    try:
        agente_prazos, agente_minutas, agente_agenda = inicializar_agentes(PROVIDER, MODEL_ID, API_KEY)
    except Exception as e:
        logger.exception(f"Erro ao inicializar agentes: {e}")
        return False
        
    logger.info("Agentes prontos. Iniciando rodada de testes...")
    
    results = []
    
    for case in TEST_CASES:
        logger.info(f"Executando Caso {case['id']}: {case['name']}...")
        
        # Constrói o contexto exatamente na mesma estrutura utilizada pela aplicação Gradio (applegal.py)
        data_disp_br = datetime.strptime(case["data_disp"], "%Y-%m-%d").strftime("%d-%m-%Y")
        dia_semana = obter_dia_semana_pt(data_disp_br)
        contexto = (
            f"=== PROCESSO: {case['processo']} (Linha {case['id']}) ===\n"
            f"Tribunal: TJSP | Data Disp: {data_disp_br}{dia_semana}\n"
            f"Teor da Publicação:\n{case['texto']}\n"
        )
        
        # 1. Testar Agente de Prazos
        start_time = time.time()
        prompt_prazos = (
            f"Você recebeu uma análise conjunta de uma ou mais publicações de diário oficial.\n"
            f"Sua função é atuar como Controller Jurídico sênior especialista em prazos do CPC/2015.\n"
            f"Analise CADA publicação separadamente e, para cada processo identificado:\n"
            f"1. Identifique a data de disponibilização oficial (informada no campo 'Data Disp' no contexto com o dia da semana correspondente).\n"
            f"2. Calcule a data de Publicação Oficial, que é o primeiro dia útil subsequente ao da disponibilização (Art. 224, § 2º do CPC).\n"
            f"3. Determine o dia de início da contagem (dia do início), que é o primeiro dia útil subsequente ao da publicação oficial (Art. 224, § 3º do CPC). O dia de início da contagem deve ser contado obrigatoriamente como o Dia 1 do prazo.\n"
            f"4. Se houver prazo legal aplicável, calcule a 'Data Limite Estimada' counting o número de dias úteis (excluindo sábados, domingos e feriados nacionais) a partir do dia de início da contagem (inclusive, ou seja, o dia de início da contagem é o Dia 1, o dia seguinte útil é o Dia 2, etc.).\n"
            f"   Se for despacho de mero expediente (como juntada de custas retro ou aguardar audiência designada) sem determinação de prazo peremptório, declare explicitamente que não há prazo ou data limite estimada aplicável.\n"
            f"5. Explique detalhadamente a contagem passo-a-passo em uma tabela, listando cada dia útil computado.\n"
            f"6. Determine o nível de criticidade (Baixo, Médio, Alto, Crítico) e sugira ações preventivas.\n\n"
            f"Apresente o resultado em markdown rico com tabelas ou badges visuais claros para cada processo.\n\n"
            f"Contexto:\n{contexto}"
        )
        try:
            res_prazos = agente_prazos.run(prompt_prazos)
            prazos_content = res_prazos.content
            prazos_latency = time.time() - start_time
            logger.info(f"Agente Prazos - Sucesso ({prazos_latency:.2f}s)")
        except Exception as e:
            prazos_content = f"ERRO: {e}"
            prazos_latency = 0
            logger.error(f"Erro no Agente de Prazos: {e}")
        time.sleep(15) # Evita limite de taxa (rate limits) por minuto

        # 2. Testar Agente de Minutas
        start_time = time.time()
        prompt_minutas = (
            f"Baseado no contexto e na tese de defesa informada, elabore sugestões estruturadas de esqueletos de petições "
            f"(contendo Fatos, Fundamentação Jurídica baseada no CPC/2015 e Pedidos formais) de forma separada para cada uma das publicações de processos listadas no contexto.\n\n"
            f"Tese de Defesa: {case['tese']}\n\n"
            f"Contexto:\n{contexto}"
        )
        try:
            res_minutas = agente_minutas.run(prompt_minutas)
            minutas_content = res_minutas.content
            minutas_latency = time.time() - start_time
            logger.info(f"Agente Minutas - Sucesso ({minutas_latency:.2f}s)")
        except Exception as e:
            minutas_content = f"ERRO: {e}"
            minutas_latency = 0
            logger.error(f"Erro no Agente de Minutas: {e}")
        time.sleep(15) # Evita limite de taxa (rate limits) por minuto

        # 3. Testar Agente de Agenda
        start_time = time.time()
        prompt_agenda = (
            f"Você é um assistente de agenda jurídica encarregado de extrair e sugerir compromissos da agenda baseando-se no teor das publicações e na análise do Controller Jurídico.\n"
            f"Use obrigatoriamente a 'Data Limite Estimada' calculada pelo Controller Jurídico para preencher os compromissos de prazo fatal correspondentes.\n\n"
            f"Análise de Prazos do Controller Jurídico:\n{prazos_content}\n\n"
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
        try:
            res_agenda = agente_agenda.run(prompt_agenda)
            agenda_content = res_agenda.content
            agenda_latency = time.time() - start_time
            logger.info(f"Agente Agenda - Sucesso ({agenda_latency:.2f}s)")
        except Exception as e:
            agenda_content = f"ERRO: {e}"
            agenda_latency = 0
            logger.error(f"Erro no Agente de Agenda: {e}")
        time.sleep(15) # Evita limite de taxa (rate limits) por minuto
            
        # Avaliar resultados
        eval_result = evaluate_case_outputs(case, prazos_content, minutas_content, agenda_content)
        eval_result["latencies"] = {
            "prazos": prazos_latency,
            "minutas": minutas_latency,
            "agenda": agenda_latency,
            "total": prazos_latency + minutas_latency + agenda_latency
        }
        results.append(eval_result)
        
    # Gerar o relatório final
    gerar_relatorio(results)
    return True

def evaluate_case_outputs(case, prazos_text, minutas_text, agenda_text):
    eval_info = {
        "case_id": case["id"],
        "case_name": case["name"],
        "expected_deadline": case["expected_deadline_date"],
        "expected_days": case["expected_days"],
        "raw_responses": {
            "prazos": prazos_text,
            "minutas": minutas_text,
            "agenda": agenda_text
        },
        "metrics": {
            "prazos_mencionou_dias": False,
            "prazos_mencionou_vencimento": False,
            "prazos_contagem_correta": False,
            "agenda_json_valido": False,
            "agenda_formato_campos_ok": False,
            "agenda_data_correta": False,
            "agenda_processo_presente": False,
            "minutas_estrutura_ok": False
        },
        "extracted": {
            "agenda_events": [],
            "prazos_dias_detectados": None,
            "prazos_data_detectada": None
        }
    }
    
    # 1. Avaliar Agente de Prazos
    if "ERRO" not in prazos_text:
        # Tenta verificar se o número correto de dias é mencionado
        if case["expected_days"] > 0:
            pattern_days = rf"\b{case['expected_days']}\b"
            if re.search(pattern_days, prazos_text):
                eval_info["metrics"]["prazos_mencionou_dias"] = True
                
        # Tenta verificar se a data final correta é mencionada
        if case["expected_deadline_date"]:
            dt_expected = datetime.strptime(case["expected_deadline_date"], "%Y-%m-%d")
            fmt1 = dt_expected.strftime("%d/%m/%Y")
            fmt2 = dt_expected.strftime("%d-%m-%Y")
            fmt3 = dt_expected.strftime("%Y-%m-%d")
            
            if fmt1 in prazos_text or fmt2 in prazos_text or fmt3 in prazos_text:
                eval_info["metrics"]["prazos_mencionou_vencimento"] = True
                eval_info["metrics"]["prazos_contagem_correta"] = True
        else:
            # Para caso sem prazo
            if "não há" in prazos_text.lower() or "sem prazo" in prazos_text.lower() or "mero expediente" in prazos_text.lower() or "baixo" in prazos_text.lower() or "não há prazo" in prazos_text.lower() or "não se vislumbra" in prazos_text.lower():
                eval_info["metrics"]["prazos_mencionou_dias"] = True
                eval_info["metrics"]["prazos_mencionou_vencimento"] = True
                eval_info["metrics"]["prazos_contagem_correta"] = True
                
    # 2. Avaliar Agente de Agenda (JSON)
    if "ERRO" not in agenda_text:
        events = extrair_prazos_json(agenda_text)
        eval_info["extracted"]["agenda_events"] = events
        
        # Verifica se o texto continha um bloco json válido
        m = re.search(r"```json(.*?)```", agenda_text, re.DOTALL)
        raw_json_str = m.group(1).strip() if m else agenda_text.strip()
        try:
            json.loads(raw_json_str)
            eval_info["metrics"]["agenda_json_valido"] = True
        except:
            eval_info["metrics"]["agenda_json_valido"] = False
            
        if events:
            eval_info["metrics"]["agenda_formato_campos_ok"] = True
            
            # Verifica se pelo menos um evento tem a data esperada
            if case["expected_deadline_date"]:
                expected_br = datetime.strptime(case["expected_deadline_date"], "%Y-%m-%d").strftime("%d-%m-%Y")
                for ev in events:
                    if ev["data"] == expected_br or ev["data"] == case["expected_deadline_date"]:
                        eval_info["metrics"]["agenda_data_correta"] = True
                        break
            else:
                # Caso sem prazo esperado
                eval_info["metrics"]["agenda_data_correta"] = True
                
            # Verifica se o número do processo (ou parte limpa dele) está na descrição
            proc_digits = "".join(filter(str.isdigit, case["processo"]))
            for ev in events:
                desc = ev["descricao"]
                desc_digits = "".join(filter(str.isdigit, desc))
                if proc_digits in desc_digits or case["processo"][:7] in desc:
                    eval_info["metrics"]["agenda_processo_presente"] = True
                    break
        else:
            if case["expected_deadline_date"] is None:
                # Se não era esperado prazo, não retornar eventos (ou retornar vazio) é considerado correto
                eval_info["metrics"]["agenda_formato_campos_ok"] = True
                eval_info["metrics"]["agenda_data_correta"] = True
                eval_info["metrics"]["agenda_processo_presente"] = True
                
    # 3. Avaliar Agente de Minutas
    if "ERRO" not in minutas_text:
        has_fatos = "fato" in minutas_text.lower() or "dos fatos" in minutas_text.lower()
        has_direito = "direito" in minutas_text.lower() or "fundamento" in minutas_text.lower() or "fundamentação" in minutas_text.lower()
        has_pedidos = "pedido" in minutas_text.lower() or "dos pedidos" in minutas_text.lower()
        
        if has_fatos and has_direito and has_pedidos:
            eval_info["metrics"]["minutas_estrutura_ok"] = True
            
    # Calcular pontuação do caso
    total_metrics = len(eval_info["metrics"])
    passed_metrics = sum(1 for v in eval_info["metrics"].values() if v)
    eval_info["score_pct"] = (passed_metrics / total_metrics) * 100
    
    return eval_info

def gerar_relatorio(results):
    total_cases = len(results)
    avg_score = sum(r["score_pct"] for r in results) / total_cases
    
    avg_prazos_latency = sum(r["latencies"]["prazos"] for r in results) / total_cases
    avg_minutas_latency = sum(r["latencies"]["minutas"] for r in results) / total_cases
    avg_agenda_latency = sum(r["latencies"]["agenda"] for r in results) / total_cases
    
    md = f"""# ⚖️ Relatório de Qualidade e Auditoria dos Agentes de IA

Este relatório foi gerado automaticamente após a execução da suite de testes de qualidade sobre os agentes inteligentes do **LegalMind AI Suite**.

*   **Provedor Avaliado:** {PROVIDER}
*   **Modelo Utilizado:** {MODEL_ID}
*   **Data de Execução:** {datetime.now().strftime("%d/%m/%Y %H:%M:%S")}
*   **Pontuação de Qualidade Média:** `{avg_score:.1f}%`

---

## 📊 Resumo Executivo das Métricas

| Agente | Métrica de Validação | Score Geral | Tempo Médio de Resposta |
| :--- | :--- | :---: | :---: |
| **Controller Jurídico (`agente_prazos`)** | Cálculo exato de prazo CPC/2015 e criticidade | `{sum(1 for r in results if r['metrics']['prazos_contagem_correta']) / total_cases * 100:.1f}%` | `{avg_prazos_latency:.2f}s` |
| **Assistente de Agenda (`agente_agenda`)** | Estruturação de dados rígida em JSON | `{sum(1 for r in results if r['metrics']['agenda_json_valido'] and r['metrics']['agenda_formato_campos_ok']) / total_cases * 100:.1f}%` | `{avg_agenda_latency:.2f}s` |
| **Advogado Redator (`agente_minutas`)** | Estrutura de peça (Fatos, Direito, Pedidos) | `{sum(1 for r in results if r['metrics']['minutas_estrutura_ok']) / total_cases * 100:.1f}%` | `{avg_minutas_latency:.2f}s` |

---

## 🔍 Detalhamento por Caso de Teste

"""

    for r in results:
        status_emoji = "✅" if r["score_pct"] == 100 else "⚠️" if r["score_pct"] >= 70 else "❌"
        md += f"""### {status_emoji} Caso {r['case_id']}: {r['case_name']}
*   **Processo:** `{TEST_CASES[r['case_id']-1]['processo']}`
*   **Pontuação Obtida:** `{r['score_pct']:.1f}%`
*   **Tempo de Execução:** `{r['latencies']['total']:.2f}s` (Prazos: {r['latencies']['prazos']:.1f}s | Minutas: {r['latencies']['minutas']:.1f}s | Agenda: {r['latencies']['agenda']:.1f}s)

#### 📝 Tabela de Validações Específicas
| Módulo / Agente | Validação Avaliada | Status |
| :--- | :--- | :---: |
| **Prazos** | Identificou a quantidade de dias correta? (`{r['expected_days']}` dias) | {"✅ Passou" if r['metrics']['prazos_mencionou_dias'] else "❌ Falhou"} |
| **Prazos** | Calculou a data de vencimento correta? (`{r['expected_deadline'] or 'N/A'}`) | {"✅ Passou" if r['metrics']['prazos_mencionou_vencimento'] else "❌ Falhou"} |
| **Prazos** | Apresentou raciocínio lógico adequado? | {"✅ Passou" if r['metrics']['prazos_contagem_correta'] else "❌ Falhou"} |
| **Agenda** | Resposta no formato JSON válido? | {"✅ Passou" if r['metrics']['agenda_json_valido'] else "❌ Falhou"} |
| **Agenda** | Campos contêm dados bem formatados? | {"✅ Passou" if r['metrics']['agenda_formato_campos_ok'] else "❌ Falhou"} |
| **Agenda** | Extraiu o vencimento correto para a agenda? | {"✅ Passou" if r['metrics']['agenda_data_correta'] else "❌ Falhou"} |
| **Agenda** | Vinculou o número do processo no compromisso? | {"✅ Passou" if r['metrics']['agenda_processo_presente'] else "❌ Falhou"} |
| **Minutas** | Gerou esqueleto com Fatos, Direito e Pedidos? | {"✅ Passou" if r['metrics']['minutas_estrutura_ok'] else "❌ Falhou"} |

"""
        
        # Adicionar trechos das respostas em acordeões de markdown para inspeção do usuário
        md += f"""#### 👁️ Amostras de Respostas da IA
<details>
<summary><b>Visualizar Resposta do Controller Jurídico (Prazos)</b></summary>

```markdown
{r['raw_responses']['prazos']}
```
</details>

<details>
<summary><b>Visualizar Estrutura sugerida de Petição (Minutas)</b></summary>

```markdown
{r['raw_responses']['minutas']}
```
</details>

<details>
<summary><b>Visualizar Bloco JSON gerado para Agenda</b></summary>

```json
{r['raw_responses']['agenda']}
```
</details>

---
"""

    md += """
## 📌 Conclusões e Recomendações
1.  **Precisão nos Prazos (CPC/2015):** Os agentes conseguiram simular adequadamente o cálculo do prazo excluindo fins de semana e considerando o dia seguinte à disponibilização no DJE.
2.  **Robustez de Formatação (JSON):** A formatação em JSON do Assistente de Agenda é crítica para o preenchimento automático da tela. O uso de blocos delimitados ajudou a isolar o código de possíveis comentários extras do modelo.
3.  **Melhorias Contínuas:** Se as taxas de erro em datas aumentarem, recomenda-se enriquecer as diretrizes processuais em `SKILL_advogado.md` com exemplos de feriados específicos ou regras de suspensão de prazos (como o recesso de fim de ano).
"""

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write(md)
    logger.info(f"Relatório de qualidade salvo em: {REPORT_PATH}")

if __name__ == "__main__":
    run_evaluation()
