# Plano de virada — Flask → Angular + NestJS

Checklist operacional para trocar o sistema em uso pelo time (`http://I7M1700-01-EVE:5000`,
Flask) pelo stack novo (Angular + NestJS + docservice). **Decisão de negócio de alto risco**
— nenhum passo deste documento deve ser executado de forma autônoma por IA; cada fase tem um
responsável humano. Este documento assume o backlog de conversão fechado (ver
[03-documento-conversao.md](03-documento-conversao.md)) e a migração de dados já validada
(ver [04-procedimento-migracao-dados.md](04-procedimento-migracao-dados.md)).

## Princípio geral

**Zero perda de dado, zero surpresa para o usuário.** Isso significa: o Flask fica no ar e
intocado até o instante exato da virada; a virada tem uma janela curta de "congelamento"
(ninguém grava no Flask enquanto a última sincronização de dados roda); e existe um caminho
de volta claro se algo der errado nas primeiras horas.

---

## Fase 0 — o que faltava antes de sequer marcar uma data

Estas são lacunas reais, não cosméticas — sem elas a virada não deveria ser marcada. Status
em 2026-07-15: os itens de código estão **concluídos e testados** (build/typecheck/suítes
automatizadas); os itens que exigem uma pessoa (navegador real, credenciais reais, agendar
tarefa no Windows) continuam em aberto — ver observação em cada um. **Atualização
2026-07-16**: fechadas as 10 lacunas de tela que restavam + a pré-visualização de
documento (ver [03-documento-conversao.md §14](03-documento-conversao.md)), e as três
variáveis de ambiente foram definidas e o backend novo validado contra o Postgres real
com login de verdade (ver item abaixo) — o navegador real (Fase 1) continua em aberto.
**Atualização 2026-07-16 (2ª rodada)**: as duas Tarefas Agendadas (`"Painel Novo -
Guardiao"` e `"Painel Novo - Verificacao de Integridade"`) foram registradas — todo item de
Fase 0 que dependia só de infraestrutura/automação está fechado. O acesso pela rede
também foi liberado (porta 5100 no Firewall, link `http://I7M1700-01-EVE:5100`) e já está
sendo usado informalmente pela equipe **antes** da validação formal da Fase 1 (ver item
abaixo, ainda `[ ]`) — decisão do responsável do projeto, registrada aqui por
transparência, não decidida de forma autônoma pela IA.

- [x] **Infraestrutura de produção do stack novo.** Decisão: o NestJS agora serve o build de
  produção do Angular direto (`@nestjs/serve-static`, `frontendDistPath` em
  `configuration.ts`) — um único processo/porta em produção (**5100**, mesma máquina
  `I7M1700-01-EVE`), evitando CORS/reverse proxy, mesmo espírito de origem única do Flask.
  Validado de ponta a ponta: `/api/health`, `/` (Angular), deep link `/login` (fallback SPA),
  `/api/docs` (Swagger) e um asset estático, todos servidos corretamente pelo mesmo processo.
  Criados: `Build_Painel_Novo.bat` (build backend+frontend), `Iniciar_Painel_Novo.bat`
  (sobe docservice se preciso + backend, valida `MIGRACAO_DB_URL`/`MIGRACAO_JWT_SECRET`/
  `MIGRACAO_JWT_REFRESH_SECRET` antes de subir), `Guardiao_Painel_Novo.vbs` (mesmo padrão do
  guardião do Flask, checa `/api/health` na porta 5100), `tools/Painel_Novo_Backup.ps1`
  (backup do `painel-db-novo`, retenção 14 dias — testado ponta a ponta, mecânica confirmada
  contra um Postgres descartável) e `tools/Verificar_Integridade_Novo.ps1` (site no ar +
  backup recente + suíte de testes do backend — testado, roda e detecta falha corretamente).
  ~~**Falta** (ação humana, não código): definir as três variáveis de usuário
  (`MIGRACAO_DB_URL`/`MIGRACAO_JWT_SECRET`/`MIGRACAO_JWT_REFRESH_SECRET`) no Windows antes
  do primeiro `Iniciar_Painel_Novo.bat` real~~ — **feito em 2026-07-16**: as três
  definidas como variável de **usuário** do Windows na máquina `I7M1700-01-EVE`, backend
  reiniciado apontando para `painel-db-novo` (Postgres, dados reais migrados) e validado
  com login real (`/api/health` → `"db":"postgres"`, `POST /auth/login` → token JWT
  válido). **Atenção**: são variáveis de **usuário**, não de máquina/serviço — se o
  processo for subido por uma Tarefa Agendada rodando como outro usuário (ex.: `SYSTEM`),
  ele não vai enxergá-las; confirmar isso ao registrar as Tarefas Agendadas abaixo.
  ~~**Ainda falta** (ação humana): agendar `Guardiao_Painel_Novo.vbs`~~ — **feito em
  2026-07-16**: Tarefa Agendada `"Painel Novo - Guardiao"` registrada (mesmo padrão da
  tarefa `"Painel - Guardiao"` do Flask — logon do usuário `RECHINFO\everton` + repetição a
  cada 5 min, sem duração/fim), testada ao vivo (derrubou o processo por um crash do
  Oracle thick mode e o guardião reergueu sozinho em ~15s, log em
  `C:\PainelBackups\guardiao_novo.log`). ~~**Ainda falta**: agendar
  `Verificar_Integridade_Novo.ps1`~~ — **feito em 2026-07-16**: Tarefa Agendada
  `"Painel Novo - Verificacao de Integridade"` registrada (mesmo padrão/horário — diária às
  07:30 — da tarefa `"Painel - Verificacao de Integridade"` do Flask), log em
  `C:\PainelBackups\integridade_novo.log`. As duas automações persistentes da Fase 0 estão
  no ar.
- [ ] **Nenhuma tela foi vista rodando num navegador real** (registrado em
  [03-documento-conversao.md §13](03-documento-conversao.md)). Toda validação até aqui foi
  build limpo + testes automatizados (115 specs frontend, 310 testes backend) + chamadas
  `curl`/contrato JSON. Isso não substitui abrir `http://localhost:5100` (ou `:4200` em dev)
  e usar o sistema — segue como Fase 1, só uma pessoa consegue fazer isso.
- [x] **Telas Config → E-mail/IMAP/Gmail API/IA construídas** (antes só existiam via
  Swagger). Cada uma segue o padrão já usado em Config → Disponibilidade (status +
  formulário; Gmail tem fluxo próprio de upload de credencial + redirecionamento OAuth).
  **Segredos de integração continuam não migrando pelo script de dados** (não são tabelas do
  Postgres — viviam em `DATA_WRITE/*.json`/env do Flask) — isso não muda; a diferença é que
  agora o ADM tem onde digitar os valores reais pela UI em vez de só pela API. **Falta**
  (ação humana): preencher host/usuário/senha reais de cada integração antes da virada, ou o
  sistema novo sobe sem e-mail/robô de caixa/disponibilidade/análise de protocolos no
  primeiro dia.
- [x] **Tela de Cadastros (Check List/Índice/Modelos) construída** (`/cadastros`, 3 abas —
  antes só existia via Swagger/reimportar YAML). CRUD completo por linha + reimportar do
  modelo (Check List/Índice) e, em Modelos, histórico de versões + upload de nova versão +
  mapa de campos.
- [x] **Tela de autoatendimento "trocar minha senha" construída** (`POST /auth/trocar-senha`
  no backend, exige a senha atual; link no cabeçalho para qualquer usuário logado). Os 20
  usuários reais migrados (senha temporária aleatória, ver Fase 4) agora conseguem trocar a
  própria senha sem depender do ADM editar um por um — esse caminho continua existindo
  (ADM → Usuários) como alternativa.

---

## Fase 1 — Validação funcional (UAT manual, navegador real)

Um responsável humano (sugestão: `qualidade` + `coordenador-implantacao`) percorre o sistema
novo de ponta a ponta, com dados reais já migrados, antes de qualquer decisão de data:

- [ ] Login com um usuário real (senha temporária da migração) → trocar a senha pelo
  autoatendimento (link "Trocar senha" no cabeçalho).
- [ ] Listar/filtrar Projetos, abrir a ficha do projeto real migrado (Melbros).
- [ ] Gerar os 4 documentos oficiais (Levantamento/Projeto/Cronograma/Termo) pelo layout
  fiel e conferir visualmente o `.docx`/`.xlsx` resultante contra o que o Flask geraria.
- [ ] Agendador de Visitas: rodar Distribuir/Refazer/Desfazer, alocar manualmente, checar o
  calendário semanal.
- [ ] Cronograma/Check List editáveis: adicionar/remover/reordenar linha.
- [ ] Designação: definir GCI, agendar, listar consultores.
- [ ] Matriz de Conhecimento: importar planilha, abrir ficha de um técnico.
- [ ] Painel de Coordenação, Capacidade da Equipe, Atividade da Operação, Monitoramento
  Operacional, Home — conferir que os números batem com o que o Flask mostra hoje para o
  mesmo cliente.
- [ ] Auto-cadastro público (fluxo completo: código por e-mail, expira em 30min).
- [ ] Protocolos de Treinamento: upload manual de um vídeo de teste, transcrição, análise
  por IA, aprovação.
- [ ] Testar cada perfil (ADM/Coordenador/Administrativo/GCI/Consultor) — confirmar que os
  guards de rota e as visibilidades (`_so_meus`) batem com o Flask.
- [ ] **Registrar toda divergência encontrada** — decidir, por item, se bloqueia a virada ou
  vira pendência pós-virada aceita.

---

## Fase 2 — Segurança

- [x] **Revisão final de permissões do stack novo** (agente `seguranca-permissoes`,
  2026-07-16): guards por perfil, expiração/rotação do JWT, CORS e exposição do
  `docservice` conferidos — confirmado OK (CORS restrito, `docservice` nunca público,
  rotas públicas limitadas às 4 esperadas, JWT access/refresh corretos, senha nunca
  serializada). Dois achados reais, já corrigidos (ver
  [03-documento-conversao.md §16](03-documento-conversao.md)): fallback fraco de
  `MIGRACAO_JWT_SECRET`/`MIGRACAO_JWT_REFRESH_SECRET` em produção (agora falha o boot sem
  a env var) e gate por tipo de documento ausente em `gerar-layout`/`importar-levantamento`
  (agora replica `_GERA` do Flask). Achado baixo (acesso a projeto/documento por ID sem
  checar posse) confirmado como comportamento idêntico ao Flask legado, não regressão —
  registrado, não corrigido.
- [ ] **Pendência P0 não relacionada, mas correr atrás antes/durante a virada**: rotacionar a
  senha real do Postgres do Flask (achado da auditoria de 2026-07-10, código já corrigido,
  falta trocar a senha em produção — `docs/runbooks-operacao.md` §9). Não bloqueia
  tecnicamente a virada, mas é o momento natural de fechar, já que a atenção da equipe já
  está voltada para a infraestrutura.
- [ ] Confirmar que a senha do Postgres novo (`painel-db-novo`) está guardada em local
  seguro (gestor de senhas da equipe) — **rotacionada em 2026-07-16** (a original vivia só
  num Docker secret ilegível de fora do container; a nova foi gerada e gravada apenas na
  variável de usuário `MIGRACAO_DB_URL` do Windows, nunca em arquivo). Ainda não está em
  nenhum gestor de senhas da equipe — só na variável de ambiente da máquina
  `I7M1700-01-EVE`.
- [ ] **Novo em 2026-07-16**: a senha da conta `ADM` (`implantacao.rechsistemas@gmail.com`)
  também foi resetada (login travado, credenciais anteriores não funcionavam) — trocar
  pela definitiva no primeiro acesso (autoatendimento "Trocar senha") e não deixar a
  temporária registrada em histórico de conversa/chat.
- [ ] Depois de distribuídas (Fase 4), **apagar** `dados/migracao-senhas-temporarias.csv`.

---

## Fase 3 — Congelar o Flask e sincronizar os dados finais

Esta é a única fase com uma janela de indisponibilidade real. Fazer fora do horário de
trabalho do time.

1. [ ] Avisar o time com antecedência (data/hora da janela, ver Fase 5).
2. [ ] **Parar o Flask de aceitar escrita** — forma mais simples: desligar o processo
   (`Iniciar_Servidor.bat`) e desativar o guardião (
   `schtasks /Change /TN "Painel - Guardiao" /DISABLE`) para não subir sozinho no meio da
   sincronização. Alternativa mais suave (se disponível): modo somente-leitura no Flask.
3. [ ] Rodar a migração de dados **de novo**, com `--continuar`, para capturar tudo que
   mudou em produção desde a última rodada (2026-07-15) — ver
   [04-procedimento-migracao-dados.md](04-procedimento-migracao-dados.md). Confirmar
   dry-run limpo antes do `--aplicar`.
4. [ ] Conferir contagens finais (script já imprime origem vs. migrados por tabela) e a
   ausência de referências órfãs (mesma checagem manual usada para validar a rodada de
   2026-07-15 — `projeto_id`/`modelo_id` de cada tabela filha existe na tabela pai).
5. [ ] Copiar fisicamente os arquivos ainda não copiados (documentos gerados, vídeos de
   protocolo) — **esta etapa nunca foi testada contra um caminho de rede real** (só
   caminhos inexistentes, no ambiente de teste). Validar com uma amostra pequena antes de
   confiar no lote inteiro.
6. [ ] Backup manual extra do Postgres do Flask (`tools/painel-backup.sh`) e do Postgres
   novo, ambos rotulados com a data da virada, guardados fora dos 14 dias de rotação normal.

---

## Fase 4 — Comunicação e acesso dos usuários

- [ ] Definir e testar o endereço final do sistema novo (mesmo padrão do Flask — nome da
  máquina, não `localhost`, para funcionar de qualquer PC da rede).
- [ ] Para cada um dos 20 usuários reais: entregar a senha temporária (do
  `migracao-senhas-temporarias.csv`) por canal seguro e individual (não e-mail em texto
  claro para o grupo) e orientar a trocar pelo autoatendimento ("Trocar senha" no
  cabeçalho) no primeiro acesso — alternativa: ADM já troca antecipadamente via
  ADM → Usuários e entrega a senha definitiva.
- [ ] Aviso curto ao time: novo endereço, que a senha foi resetada, o que mudou de
  visivelmente diferente (login sem "senha mestra" de emergência — não existe mais esse
  modo no sistema novo, ver §Autenticação do
  [02-decisao-arquitetura.md](02-decisao-arquitetura.md)).
- [ ] Canal de suporte definido para os primeiros dias (quem responde dúvida/bug urgente).

---

## Fase 5 — A virada em si

1. [ ] Confirmar Fases 0-4 concluídas (ou pendências aceitas explicitamente registradas).
2. [ ] Subir o stack novo em produção (backend + frontend + docservice) com a infra da
   Fase 0 já pronta.
3. [ ] Smoke test rápido no ambiente real: `/health` do backend novo, login de um usuário
   real, abrir um projeto real, gerar um documento.
4. [ ] Trocar o endereço que o time usa (comunicar o novo link — ou, se possível, apontar o
   hostname/atalho antigo para o novo endereço, para reduzir atrito).
5. [ ] Manter o Flask **no ar, mas sem uso ativo** (não desligar nem desinstalar ainda) —
   ele é o plano de rollback da Fase 6.
6. [ ] Liberar o acesso ao time.

---

## Fase 6 — Pós-virada: observação e rollback

- [ ] Janela de observação ativa (sugestão: 2-3 dias úteis) — acompanhar de perto:
  erros no backend, e-mails não enviados, robôs (caixa/protocolos/digest) rodando nos
  horários certos, disponibilidade externa respondendo.
- [ ] **Critério de rollback**: se um problema bloquear o uso real do sistema (não um bug
  cosmético) nas primeiras 24-48h, decisão de voltar ao Flask é tomada por
  `coordenador-implantacao`/`gerente-projeto`, não pela equipe técnica sozinha.
  - Rollback = religar o Flask (guardião + `Iniciar_Servidor.bat`) e comunicar o time para
    voltar ao endereço antigo.
  - **Atenção**: qualquer dado criado/alterado no sistema novo durante a janela em que ele
    esteve em uso **não existe no Flask** — um rollback depois de uso real precisa de
    reconciliação manual dessas mudanças (avaliar caso a caso; deve ser raro se a janela de
    observação for curta e o smoke test da Fase 5 for levado a sério).
- [ ] Passada a janela de observação sem problema bloqueante: desligar o guardião do Flask
  em definitivo, mas manter o Postgres antigo e um backup final acessíveis por um bom
  tempo (não apagar nada por semanas/meses).
- [ ] Atualizar `memoria_ia/estado-atual.md` (hoje datado de 2026-06-19, ainda descreve só
  o Flask) e os `.bat`/runbooks para refletir o sistema novo como produção.

---

## Registro real da virada (executada em 2026-07-19 — divergências do plano acima)

A virada aconteceu, mas **não seguiu a sequência ideal Fase 2→3→4→5→6** — as circunstâncias
mudaram o plano no meio do caminho. Registro por transparência (mesmo espírito das outras
atualizações deste documento):

- **Fase 1 validada** pelo responsável do projeto, no navegador real, em `http://I7M1700-01-EVE:5100`.
- **Achado durante a Fase 2** (não estava no plano): o Flask estava **fora do ar desde
  18/07 00:04** (site inteiro, 2 dias), o guardião falhando a cada 5 min sem conseguir
  reerguer — causa raiz aparente: o Postgres do Flask (container `painel-db`) desapareceu
  durante a janela da migração de banco do stack novo (17/07 à tarde). Como o Flask esteve
  **inacessível o tempo todo** desde então, não havia como ele ter recebido escrita nova
  nesse período — o risco de perda de dado da Fase 3 ("congelar e sincronizar") ficou
  **sem objeto**: não tinha o que sincronizar de um sistema que não aceitava requisição
  nenhuma. Detalhe da investigação em [[vault/22 - Troubleshooting]].
- **Decisão do responsável do projeto** (2026-07-19, registrada aqui por transparência, não
  tomada de forma autônoma pela IA): pular a tentativa de recuperar o Postgres do Flask e
  ir direto para produção só com o stack novo — Fases 3/4 formais (congelar+ressincronizar,
  comunicação formal aos 20 usuários) não foram executadas como descrito acima; o que
  substituiu a Fase 4 foi o próprio uso já informal que a equipe fazia do sistema novo.
- **Executado (Fase 5/6 comprimidas):**
  - Guardião (`Painel - Guardiao`) e Verificação de Integridade (`Painel - Verificacao de
    Integridade`) do Flask **desabilitados** (Tarefas Agendadas).
  - Processo Flask **finalizado**.
  - Arquivos **só do Flask** movidos para `projeto_old/` (`git mv`, histórico preservado):
    `webapp/app.py`+`routes_*`+`db.py`+`gl_*`+demais módulos, `webapp/templates/`,
    `webapp/static/`, `Iniciar_Servidor.bat`, `Guardiao_Painel.vbs`,
    `Iniciar_Banco_Docker.bat`, `Abrir_Banco.bat`, `Iniciar_Painel.bat`,
    `Verificar_Integridade.bat`, `build_painel_exe.py`,
    `tools/migrar_sqlite_para_pg.py`, `tools/ci_postgres_smoke.py`.
  - **Não movidos** (dependência viva do stack novo, confirmada rastreando imports antes de
    mover): `webapp/legado_cli.py`, `runner.py`, `roles.py`, `forms.py` (ponte de
    subprocesso usada por `LegadoCliService`) e **todo `tools/`** (usado por essa ponte e
    indiretamente pelo `docservice/`, que tem cópia própria dos geradores — não importa de
    `webapp/`).
  - Validado depois da mudança: `npm test` do backend (363/364 — a 1 falha é um teste de
    data sensível a virada de meia-noite, não relacionado) e `legado_cli.py` respondendo
    `{"acao":"saude"}` com 30/30 OK.
  - `.github/workflows/ci.yml` atualizado: jobs `test`/`test-postgres` (Flask) substituídos
    por `tools-smoke` (só o que continua vivo); `backend-test`/`frontend-test` inalterados.
- **Não recuperado**: se havia dado real gravado no Flask entre 15/07 (corte da migração
  original) e a queda (17/07 à noite) e esse dado não está no stack novo, ele **não foi
  reconciliado** — decisão aceita pelo responsável do projeto diante da indisponibilidade
  do Postgres de origem, não uma garantia de "zero perda" cumprida à risca.
- **Rollback deixou de ser trivial**: diferente do desenho original (Fase 6: religar o
  Flask), o Flask não tem mais Postgres nem processo rodando, e boa parte do seu código
  saiu do lugar padrão. Rollback de emergência agora significa: restaurar os arquivos de
  `projeto_old/` para o lugar original (`git mv` reverso) **e** reconstruir o Postgres a
  partir do backup mais recente (`C:\PainelBackups\painel_20260717_220001.sql.gz`) — não é
  mais "ligar de novo", é um procedimento de restauração.

---

## Limitações conhecidas aceitas nesta primeira virada

Lacunas propositais já registradas durante a conversão (ver
[03-documento-conversao.md §8](03-documento-conversao.md)) — não são bugs, são escopo
explicitamente deixado de fora; revisar se algum vira bloqueio antes de assinar a Fase 0:

- ~~Sem arrastar-e-soltar no Agendador~~ — **nunca foi uma lacuna real**: o documento
  afirmava isso por desatualização; `AgendaComponent` já tinha o drag-and-drop completo.
  Corrigido em 2026-07-16 (ver
  [03-documento-conversao.md §16](03-documento-conversao.md)).
- ~~Guard manual + indicador visual de conflito SICLA no calendário~~ — **fechado em
  2026-07-16** (ver [03-documento-conversao.md §16](03-documento-conversao.md)).
- ~~`ModeloDocumentoCampo` sem seed~~ — **fechado em 2026-07-16** (ver
  [03-documento-conversao.md §16](03-documento-conversao.md)).
- ~~Correção verbal/ortográfica opcional por IA (a outra metade de `tools/ia.py`) não
  portada~~ — nota desatualizada: já estava portada desde o §14 (tela `/legado/:rid/
  verbal`); corrigido em 2026-07-17 (ver
  [03-documento-conversao.md §18](03-documento-conversao.md)), com testes de unidade
  novos (não tinha cobertura nenhuma até então).
- `checklist_ok` (e-mail) e geração do documento de Check List em si não existiam no
  Flask original tampouco — não é regressão.
- ~~`fluxo_criar` não dispara automaticamente o pacote de documentos + e-mail-resumo~~ —
  **fechado em 2026-07-16** (`FluxoService.criarComPacote`, ver
  [03-documento-conversao.md §14](03-documento-conversao.md)), incluindo o Check List do
  pacote inicial (gerador legado ligado via bridge — ver
  [03-documento-conversao.md §15](03-documento-conversao.md)).
- ~~Projeto origem: "usar Levantamento importado"/"importar Levantamento (.docx)" sem
  efeito~~ — **fechado em 2026-07-16** (ver
  [03-documento-conversao.md §15](03-documento-conversao.md)).
- ~~`pode_avancar` sem enforcement na escrita~~ — **ativado em 2026-07-17, por decisão do
  usuário** (ver [03-documento-conversao.md §20](03-documento-conversao.md)). O gate real
  (documentos + ação de entrada) já estava certo no botão "Avançar"; o gap era um seletor
  de etapa livre na aba Dados do formulário que pulava esse gate — removido, e
  `ProjetosService.atualizar()` agora rejeita qualquer troca de etapa fora do botão
  dedicado. **Backlog de código da migração fechado por completo.**
