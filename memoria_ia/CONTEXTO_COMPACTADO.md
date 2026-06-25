# Contexto compactado (snapshot de retomada)

> Snapshot técnico para retomar a sessão sem reler tudo. O **mais recente fica no topo**.
> Complementa (não substitui) `estado-atual.md`, `decisoes.md`, `pendencias.md`, `historico-sessoes.md`.
> ⚠️ **Nunca** gravar segredos aqui (senhas, tokens). Referenciar só por nome/local.

---

## 2026-06-24 22:38 — Agendador de Visitas + gate de origem do Projeto (commit f093eda)

### Objetivo atual
Entregue o **Agendador de Visitas** (calendário por dia+turno) que **substitui** o cronograma
linear, e o **gate de origem do Projeto**. Tudo commitado/pushado em `f093eda`
(`a1795d2..f093eda main -> main`); suíte **66 passed**.

### Decisões já tomadas (desta etapa)
- **Visitas vêm do Check-list** (`checklist_modelo`): a coluna **`seq` = nº da Visita (V{seq})**,
  agrupando por `(modulo, seq)`; atividade = `Menu - Item` (+ `tipo`). `modulo` já usa as siglas
  contratadas (FAT, EST...). Decisão do usuário: "A V1 significa a coluna Sequencia do Check List".
- **Agendador substitui** o cronograma linear na fase "Cronograma e Check-list" (botão primário
  "Agenda de Visitas" na ficha; "Plano (lista)" antigo mantido por ora).
- **Técnico = consultor designado** do módulo (fase Designação) como padrão; editável por cartão.
- **Saída**: gera `.xlsx` das alocações e anexa como Documento `cronograma` (satisfaz o gate).
- **Gate de origem do Projeto** (#1/#2 da etapa anterior consolidados): ao "Gerar Projeto", escolher
  **dados da tela** / **importar .docx do Levantamento** (parser casa tópicos) / **modelo manual**
  (preenchido pelos cadastros/Índice). **Detalhamento das Rotinas** só com áreas/módulos contratados.

### Arquivos / tabelas (commit f093eda — 12 arquivos)
- **db.py**: `class AtividadeCronograma` (cronograma_atividades) + `cronograma_atividades_seed`,
  `cronograma_atividades`, `cronograma_visitas`, `cronograma_alocar` (semântica **None=não mexe / ""=desaloca**);
  coluna `Documento.origem` ("gerado"/"importado"); `levantamento_importado`, `levantamento_importar_respostas`.
- **app.py**: rotas `projeto_agenda` (GET, fds/técnicos), `agenda/alocar`, `agenda/status`,
  `agenda/acompanhamento`, `agenda/gerar`, `agenda/postergar`; `projeto_origem` (gate); cascade de exclusão inclui `AtividadeCronograma`.
- **gerar_layout.py**: `gerar_agenda_xlsx`; `_preencher_detalhamento_projeto` (só contratadas, `_PROJ_GRUPOS`), `modo='modelo'`.
- **doc_edit.py / db.py**: telas estruturadas (DocConteudo). **Templates**: `agenda.html`,
  `agenda_acompanhamento.html`, `projeto_origem.html` (novos); `definir_gci.html`, `projeto_ficha.html` (ajustes).

### Regras de negócio (não esquecer)
- Projeto nasce do Levantamento; Detalhamento só de módulos contratados.
- Visita = `seq` do Check-list; atividade = Menu-Item; turnos Manhã/Tarde; técnico = consultor designado.
- Postergar pula fim de semana (próximo dia útil).

### Pendências / próximos passos
- **Validar a agenda no painel** (Check-list → Visitas → calendário → acompanhamento → .xlsx).
- Futuro (não feito): motor de **sugestão automática de datas** (era stub no protótipo); mapear o
  `.xlsx` para o layout oficial do cronograma; integração **SICLA/SGCIA** (precisa de spec).
- **Fora do commit f093eda** (working tree): `webapp/static/style.css` e `templates/base.html`
  (mudanças do MANUS), `templates/monitoramento_operacional.html` (novo, não meu), pasta `Cronograma_1/` (protótipo).

### Restrições/preferências (inalteradas)
Ver bloco anterior. Conta GitHub **Implantacaorech**; "subir total sempre"; roda da fonte (sem .exe);
commits sem aspas duplas no corpo + `Co-Authored-By: Claude Opus 4.8`.

---

## 2026-06-24 13:02 — #1 (Projeto exige Levantamento) e #2 (telas espelho) concluídos

### Objetivo atual
Painel Flask de implantação (SIGER®). Etapa recém-fechada: tornar o **Levantamento a base
única do Projeto** e dar **telas de edição estruturadas** que espelham os layouts oficiais dos
documentos gerados (Levantamento e Projeto). **Status: aguardando o usuário VALIDAR no painel**
(especialmente os mapas módulo→área) antes de novo código. Última instrução do usuário: *"validar primeiro"*.

### Decisões já tomadas (desta etapa)
- **Projeto só nasce de Levantamento respondido** (#1): `projeto_gerar` para `tipo=="projeto"` faz
  seed + resumo; se há tópicos e 0 respostas, redireciona para responder o Levantamento.
- **Telas de edição = "espelho estrutural"** dos layouts (#2), as duas (Levantamento e Projeto) em paralelo.
  Mecanismo genérico: `DocConteudo` (chave/valor) + `doc_edit.SPEC` + template único `doc_editar.html`
  (suporta seção tipo `tabela`). A geração fiel **lê** esse conteúdo editado.
- **GCI e Consultores são processos separados**: GCI + data no **Agendamento** (permite **vários** GCIs);
  Consultores na **Designação** (rápido: um técnico p/ todos OU dividido por módulo).
- **Caminho linear único**: aba "Andamento" como default da ficha; removido painel paralelo "Documentos oficiais".
- **Auto-avanço permissivo de propósito**: `_auto_avancar` checa só gate de documentos + ação de entrada,
  **não** `campos_faltantes` (a versão estrita travava Agendamento/Designação — foi revertida).
  `consultor` saiu de `CAMPOS_OBRIGATORIOS["Projeto"]` (definido na Designação).
- **Sem `.exe`**: roda da fonte via `Iniciar_Servidor.bat`.

### Arquivos alterados (núcleo)
- `webapp/app.py` — `projeto_gerar` (gate Projeto⇐Levantamento + ramo layout fiel), `_auto_avancar` (permissivo),
  `projeto_definir_gci` (múltiplos GCIs), `projeto_agendar` (notifica todos os GCIs), `projeto_consultores`
  (designação por módulo), `projeto_doc_editar` (telas estruturadas), `projeto_levantamento` (agrupa por área),
  `projeto_excluir` (cascade inclui `LevantamentoResposta` + `DocConteudo`), `home` (fila "Minhas próximas ações").
- `webapp/db.py` — `LevantamentoResposta` (+ `levantamento_seed/respostas/salvar/resumo`),
  `DocConteudo` (+ `doc_conteudo`, `doc_conteudo_salvar`), `CAMPOS_OBRIGATORIOS["Projeto"]` sem `consultor`,
  rótulo `ACAO_ENTRADA["Designação"]`.
- `webapp/gerar_layout.py` — consumo de `DocConteudo` em Levantamento e Projeto; mapas `_SIGLA_BLOCOS`,
  `_BLOCO_DISPLAY`, `area_do_modulo`; `_montar_blocos_levantamento`, `_preencher_detalhamento_projeto`,
  `_preencher_projeto_tabelas`, `_preencher_levantamento_usuarios`; `remover_marcadores_docx` por último.
- `webapp/doc_edit.py` — `SPEC` (Levantamento/Projeto), `_PROJ_AREAS`, `_detalhamento_secoes`,
  `secoes/campos_editaveis/valores` (com tipo `tabela`).
- `webapp/templates/` — `doc_editar.html` (novo), `levantamento.html` (accordion por área),
  `consultores.html` (atribuição rápida), `definir_gci.html` (checkboxes múltiplos), `projeto_ficha.html`, `home.html`.
- `tools/preencher_layout.py` — `remover_marcadores_docx` (regex `<[^<>]{0,300}>`).
- `webapp/test_painel.py` — 59 testes (e2e fluxo, fila, levantamento por área/blocos/tabelas, projeto puxa/detalhamento, doc_editar, múltiplos GCI, projeto exige levantamento).

### Funções / rotas / tabelas importantes
- **Tabelas novas**: `LevantamentoResposta` (projeto_id, ordem, modulo_sigla, modulo, adicional, topico, resposta);
  `DocConteudo` (projeto_id, doc, campo, valor).
- **Fluxo (6 fases)**: Agendamento → Levantamento → Projeto → Designação → Cronograma e Check-list → Encerramento.
  Gates: `GATES` (docs), `ACAO_ENTRADA` (ações), `CAMPOS_OBRIGATORIOS` (campos); `cabecalho`, `proxima`, `pode_avancar`, `_auto_avancar`.
- **Geração fiel**: `tools/preencher_layout.py` + `webapp/gerar_layout.py`; layouts em `tools/templates/layouts/` (gitignored),
  vigentes em `tools/data/modelos_documento/` (gitignored), servidos pelo cadastro "Modelos de Documentos".
- **Mapas módulo→área (NÃO VALIDADOS — dependem do negócio do usuário):**
  - `_SIGLA_BLOCOS` (Levantamento): Vendas/Fat = FAT,PDV,OSE,SAC · Produção = GIN,GCA · Compras/Estoque = EST,COM,TLO ·
    Financeira = FIN,GCO · Fiscal/Contábil/Patrimonial = CTB,LFI,GPA,AUE · FPA · Portais = PWC,PGP · RHU · sem bloco = CEE,CEI,AWR,RME.
  - `_PROJ_AREAS` (Projeto, 6 áreas): Vendas e Faturamento = FAT,PDV,OSE,SAC · Controle de Estoque = EST ·
    Controle de Compras = COM,TLO · Gestão Industrial = GIN,GCA · Controle Financeiro = FIN,GCO · Livros Fiscais = LFI,CTB,GPA,AUE.

### Erros encontrados e soluções
- **Auto-avanço estrito travou o fluxo** (Agendamento/Designação) → revertido para permissivo; mantida só a saída do `consultor` de Projeto.
- **`projeto_excluir` deixava órfãos** de `LevantamentoResposta`/`DocConteudo` + reuso de pid no SQLite → contaminação entre testes. Corrigido: cascade inclui as duas tabelas (bug real de produção).
- **Bloco "FOLHA DE PAGAMENTO" falso-negativo** no teste → ajustado para contar 3 cabeçalhos "mapeamento de processo".
- **"Módulos Previsto" singular** no layout → scan ajustado p/ `startswith("módulos previsto")`.
- **Header "período previsto"** (contém "ríodo", não "rodo") → match por `any("previsto" in h)`.
- **`git commit` com aspas duplas no corpo** → quebrava em pathspecs. Regra: **sem aspas duplas** no assunto/corpo do commit.

### Pendências abertas
- **Validação do usuário no painel** (em curso): percorrer Levantamento → Projeto ponta a ponta e devolver ajustes
  nos mapas `_SIGLA_BLOCOS` e `_PROJ_AREAS` e/ou na ordem das seções das telas.
- (Opcional, oferecido, não iniciado) Tornar editáveis as tabelas "Módulos Contratados (A) / Identificados (B)" do Levantamento.
- (P2 antigos) consolidar `.agents/`/`.codex/` com `.claude/`; popular `ia_admin/uso-cloud.yaml`/`sessoes.md`.

### Próximos passos recomendados
1. Aguardar o retorno da validação (não codar antes).
2. Aplicar correções nos mapas (`webapp/gerar_layout.py` e `webapp/doc_edit.py`) e na estrutura das telas conforme o usuário indicar.
3. Rodar `pytest webapp/test_painel.py` + `tools/verificar.py`; commit + push.

### Regras de negócio que não podem ser esquecidas
- **O Projeto só pode ser criado a partir de um Levantamento realizado** — o Levantamento é a base das informações.
- **As telas de edição do Levantamento e do Projeto devem ser idênticas ao layout dos modelos gerados** (espelho estrutural).
- **No Levantamento**: abrir/fechar (accordion) por área; mostrar **só blocos de módulos contratados**;
  **remover todos os marcadores `<...>`** dos documentos; preencher módulos/horas a partir do e-mail de fechamento.
- **GCI/data = antes do Levantamento (Agendamento, vários GCIs); Consultores = depois (Designação, rápido/prático).**
- Entrega = código no **GitHub** (`Implantacaorech/Implantacao`).

### Preferências do usuário
- Fluxo "mais contínuo" (ações encadeadas, botões diretos, fila de próximas ações).
- "Subir total sempre": `git pull --ff-only` antes; `commit + push` ao terminar (respeita `.gitignore`).
- Roda da fonte (`Iniciar_Servidor.bat`), **sem `.exe`**.
- Frontend editado por fora (MANUS IA) e dado push pelo usuário → **sempre sincronizar antes de mexer**.
- Commits terminam com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; **sem aspas duplas** no corpo.

### Restrições técnicas
- Flask (`webapp/`), waitress, `http://127.0.0.1:5000`; PostgreSQL via `PAINEL_DB_URL` (Docker/WSL2); SQLite local em dev/testes.
- SQLAlchemy 2.0 ORM; `_auto_migrar` (ALTER TABLE ADD COLUMN + create_all); código DB-agnóstico.
- Layouts/.docx/.xlsx e dados sensíveis são **gitignored**; cadastro "Modelos de Documentos" serve os vigentes.
- **Conta GitHub = `Implantacaorech`** (NÃO a pessoal). Credenciais (senha mestra `PAINEL_SENHA`, smtp/imap/gmail)
  ficam em **env/arquivos locais gitignored** ou nas telas do painel — **nunca no chat nem neste arquivo**.

---

<!-- Ao compactar de novo, ADICIONE um novo bloco datado ACIMA desta linha (mais recente no topo). -->
