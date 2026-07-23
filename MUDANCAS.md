# ⚖️ Registro de Mudanças - Upgrade do App LegalOne/LegalMind Suite

Este arquivo documenta todas as melhorias estruturais, de lógica processual, controles de interface gráfica e integrações de Inteligência Artificial implementadas na aplicação [applegal.py](file:///c:/Users/edumo/jud_legal/applegal.py).

---

## 🛠️ Detalhamento das Alterações Realizadas

### 1. 🔍 Correção Crítica na Extração e Busca de Processo (API PJe)
- **Correção de Chave JSON:** Corrigido o mapeamento de chaves retornadas da API do PJe para o número de processo. O MVP anteriormente buscava chaves incorretas e caía em fallbacks por expressão regular. Mapeado para ler diretamente `numeroprocessocommascara` (exibido com pontuação na tabela) ou `numero_processo`.
- **Busca Redundante Exata:** A chamada de busca redundante por processo limpa pontuações e formata a variável para a chave correta `numeroProcesso` aceita pela ComunicaAPI, evitando falhas na pesquisa assíncrona concorrente.

### 2. 📅 Controles de Data e Paginação (UX Fluida)
- **Calendário Ativo de Datas:** Substituídos campos de texto livre por seletores de calendário `gr.DateTime(include_time=False)` nas datas inicial e final de varredura.
- **Mapeador de Timestamps:** Desenvolvido o helper `converter_data_str` para processar e converter automaticamente múltiplos formatos de entrada (`YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY`), incluindo timestamps em formato de ponto flutuante Unix (ex: `1782615600.0` e `1783047600.0`) retornados nativamente por eventos do Gradio.
- **Dropdown de Paginação:** Adicionado dropdown para escolha da quantidade de itens por página com as opções exatas: `10`, `50`, `100`, `300` e `1000`.
- **Hora na Data de Disponibilização:** O sistema agora preserva a informação de horas e minutos (`DD-MM-YYYY HH:MM`) na coluna "Data Disponibilização" se esses dados forem fornecidos pela API do PJe, aplicando fallbacks para `DD-MM-YYYY` caso apenas a data esteja disponível.

### 3. 🗓️ Calendário Geral de Agendamentos (Design Ativo Premium)
Criado um visualizador interativo em HTML/CSS integrado ao banco de dados local com três abas selecionáveis:
- **Modo Mês:** Grid retrato correspondente ao Google Sheets, exibindo dias esmaecidos de meses vizinhos, destaque visual diferenciado para a data atual, listagem de eventos com hora e seção inferior de **NOTAS** com resumo dos prazos.
- **Modo Dia:** Agenda vertical com listagem de horários detalhados das 00:00 às 23:00 e realce visual do horário comercial.
- **Modo Ano:** Visão resumida dos 12 meses do ano exibindo badges contadores do volume de prazos cadastrados em cada mês.
- **Navegação Temporal:** Botões Anterior (`◀`), Hoje e Próximo (`▶`) para avançar ou retroceder no tempo conforme a granularidade da visualização.
- **Interação por Cliques (JS Bridge):** Declaração de callbacks globais em Javascript no launch do Gradio. Clicar em um dia no Mês redireciona instantaneamente para a visualização por Dia correspondente; clicar em um mês no Ano redireciona para a aba do Mês.

### 4. 🗄️ Banco de Dados SQLite Local para Processos do Escritório
- **Módulo SQLite (`processos.db`):** Desenvolvidas as funções `init_db`, `adicionar_processo_db`, `listar_processos_db` e `remover_processo_db` para gerenciamento local persistente.
- **Aba de Gestão Integrada:** Criada aba visual dedicada para cadastrar novos números de processos, clientes vinculados e notas, exibindo a tabela dos monitorados ativos e permitindo sua remoção rápida por ID.
- **Acompanhamento Concorrente em Lote:** Adicionado o checkbox "Apenas Processos Monitorados". Se ativo, o sistema consulta a lista de processos cadastrados no banco local e dispara consultas paralelas à API PJe sob controle de concorrência (`asyncio.Semaphore(10)`).
- **Auto-preenchimento por Dropdown:** Adicionado dropdown de carregamento rápido com opções atualizadas dos processos monitorados para triagem na tela inicial.

### 5. ☑️ Seleção Múltipla e Análise Conjunta de Diários
- **Checkbox Interativo na Tabela:** Adicionada a coluna `"Sel"` à tabela de triagem exibindo marcadores Unicode (`"☐"` e `"☑"`).
- **Callback por Seleção (.select):** Clicar em uma linha inverte o estado do checkbox e atualiza o componente visual na tela de forma reativa.
- **Consolidação em Lote:** O teor completo das publicações das linhas selecionadas é unido com cabeçalhos divisores por processo e disponibilizado para análise da IA.
- **Multi-Agente Adaptado para Lote:** Os prompts em `disparar_agentes_dje` foram adaptados para orientar as LLMs a analisar publicações em lote de forma individualizada para cada processo correspondente.

### 6. ⚙️ Configuração Dinâmica de Provedores e Modelos LLM
- **Seleção de Provedores:** Dropdown integrado com as opções **Gemini**, **Anthropic**, **ChatGPT**, **Ollama** e **Groq**.
- **Modelos Inteligentes Autocarregados:** A seleção do provedor atualiza dinamicamente as opções do dropdown de modelos correspondentes com versões modernas (ex: `gemini-2.5-pro`/`gemini-2.5-flash` para Gemini; `claude-3-5-sonnet` para Anthropic; `gpt-4o`/`gpt-4o-mini` para ChatGPT, etc.).
- **API-Key vs Host do Ollama:** O campo de texto altera reativamente seu rótulo e comportamento. Se **Ollama** estiver selecionado, exibe label e valor padrão para o host local (`http://localhost:11434`). Para os outros provedores, assume o comportamento de input de **Chave API (API Key)**.
- **Adaptação dos Agentes (Framework Agno):** Reescrita a função `inicializar_agentes` para importar e instanciar dinamicamente os wrappers oficiais (`Gemini`, `Claude`, `OpenAIChat`, `Groq` ou `Ollama`) aplicando os tokens configurados pelo usuário na tela.

### 7. 📅 Detecção Estruturada de Prazos e Compromissos da IA
- **Formatador de Agenda JSON:** Modificado o prompt do agente de agenda para retornar uma lista rígida de objetos em formato JSON delimitada por blocos de código markdown.
- **Extrator de Eventos e Dropdown Dinâmico:** Implementadas as funções `extrair_prazos_json` e `executar_ia_e_carregar_prazos` no back-end. Elas leem a resposta em JSON do agente, criam chaves legíveis no formato nacional (`dd-mm-yyyy`) e populam um novo dropdown de prazos detectados na interface.
- **Auto-preenchimento da Agenda:** Escolher uma opção no dropdown preenche automaticamente a **Data Limite Estimada**, a **Hora** e o **Título do Compromisso**.
- **Envio com Horário Personalizado:** Adicionado o campo `Hora` (padrão `09:00`) ao formulário de confirmação de compromisso. O salvamento na agenda previne duplicados idênticos de descrição e ordena os eventos do dia cronologicamente.

### 8. 🚀 Botões em Lote, Listagem Completa de Monitorados e Destaques Visuais
- **Selecionar / Desselecionar Todos:** Inclusão de botões de clique rápido abaixo do grid de resultados. Eles marcam ou desmarcam todos os diários exibidos na tabela instantaneamente.
- **Listagem de Processos Sem Novidades:** A pesquisa por processos monitorados inclui no grid linhas com status `"Sem Movimentação"` para processos locais cadastrados que não registraram novas publicações no período consultado. Isso fornece ao usuário uma visão unificada e status completo do portfólio.
- **Destaque Visual com Sublinhado e Sombreamento:** Adicionado campo de termo de busca reativo. O teor completo da publicação é exibido em um painel `gr.HTML` estilizado. À medida que o usuário digita um termo de busca, a palavra é sublinhada e sombreada com marcação em amarelo suave no texto reativamente.
- **Compatibilidade do Calendário com Data Limite:** Corrigido o bug de lançamento na agenda ajustando o formato das datas de retorno das funções de IA e dropdown do formato nacional (`DD-MM-YYYY`) para o formato ISO (`YYYY-MM-DD`). Isso evita erros de preprocessamento no componente de calendário do Gradio (`gr.DateTime`), mantendo o campo editável de forma interativa.
- **Limpeza Avançada de HTML (Tags de Estilo/Script):** Atualizado o extrator de texto `HTMLStripper` para ignorar completamente o conteúdo de tags `<style>` e `<script>`. Isso elimina blocos de código CSS (ex: `body { font-size: 12pt; ... }`) que poluíam o início do teor textual das publicações na triagem.

---

## 🧪 Validação da Integridade

Todas as alterações foram testadas de forma automatizada por meio do script de testes locais [test_app_logic.py](file:///C:/Users/edumo/.gemini/antigravity-ide/brain/2197fc6a-bca1-4f5c-851d-ecbd9e2868d0/scratch/test_app_logic.py).

### Resultados da Validação:
1. **Date Conversion:** Mapeamento correto de strings, timestamps e calendários ativos.
2. **SQLite Database:** Cadastro, listagem e remoção sem warnings.
3. **PJe API & Monitored Status:** Varredura assíncrona em lote e retorno de placeholders `"Sem Movimentação"`.
4. **Select All/Deselect All:** Alternância correta de todos os checkboxes na tabela.
5. **Search Highlighting:** Geração correta das tags HTML `<mark>` de realce de texto.
6. **Dynamic LLM Providers:** Instanciação e autenticação correta de wrappers de agentes (Gemini, Claude, GPT, Ollama e Groq).
7. **JSON Event Parsing:** Mapeamento dinâmico de chaves e preenchimento de inputs de despacho.
8. **Calendar Rendering:** Estilização retrato CSS premium para Mês, Dia e Ano de forma responsiva.
