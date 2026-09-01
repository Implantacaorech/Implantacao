# Migração do Painel para servidor dedicado — plano

> Escrito em 2026-08-19, a partir do inventário completo de acoplamentos à máquina atual
> (`I7M1700-01-EVE`, notebook pessoal do `everton`). **Complementa** — não substitui —
> [servidor-producao.md](servidor-producao.md), que é a especificação de hardware/software
> para levar à TI. Este documento diz **o que amarra o sistema à máquina de hoje, o que
> migra, o que morre e em que ordem**.
>
> Princípio: profissionalizar. A produção deixa de morar num notebook pessoal, dentro de uma
> pasta OneDrive, viva só enquanto uma pessoa está logada — e passa a ser um serviço: conta
> de serviço, segredos em nível de máquina, deploy a partir do git, DNS próprio e HTTPS.

## 1. Os 10 acoplamentos críticos (por que a migração não é "copiar a pasta")

1. **A produção depende do logon do `everton`.** O Guardião é uma Tarefa Agendada com
   gatilho *no logon* e os segredos (`MIGRACAO_DB_URL`, JWT) são variáveis de ambiente **de
   usuário** — máquina deslogada = painel fora do ar (risco F-02, catalogado desde julho).
2. **A senha do MariaDB existe num único lugar**: a variável de usuário deste perfil.
   Extraí-la é o primeiro passo de tudo.
3. **`backend/dados/documentos_gerados/` (658 arquivos de cliente)** está fora do git e o
   caminho **absoluto** de cada arquivo está gravado na coluna `documentos.caminho` do
   banco. Migrar banco sem a pasta (ou para caminho diferente sem UPDATE) = 658 links
   quebrados.
4. **`MIGRACAO_PROTOCOLOS_DIR` tem default hardcoded** apontando para o OneDrive desta
   máquina (`configuration.ts:170`); sem a env no servidor, o robô de protocolos **falha em
   silêncio** (`configurado()` só testa `existsSync`).
5. **OneDrive (pasta Treinamentos) e Word COM (preview fiel) exigem sessão interativa** —
   não são coisas de serviço. É a decisão D5 abaixo.
6. **HTTPS ausente**: a gravação de reunião está pronta e inutilizável desde 2026-07-30
   porque o navegador exige origem segura. O servidor novo é a hora de resolver via CA
   interna (`Certificado_CA_Interna_Painel.bat`) — e aposentar o
   `Testar_Gravacao_Microfone.bat`.
7. **`C:\PainelBackups` hardcoded em 5 scripts** que não leem `MIGRACAO_BACKUP_DIR`
   (Iniciar, docservice/iniciar, Guardião, Backup, Verificação) — mudar só a env deixa a
   tela Saúde vigiando pasta vazia.
8. **Oracle SICLA em modo thick**: exige `C:\Oracle\instantclient_23_0` (x64 + VC++
   Redistributable) no servidor; o IP (`192.168.255.199:1521`) e o SELECT curado de 20
   linhas vivem só em `backend/dados/disponibilidade.json` (gitignored).
9. **`F:\CONSULTOR-SIGER` é drive mapeado** — mapeamento de drive é por sessão de usuário;
   numa conta de serviço o `F:` não existe. Trocar para caminho UNC
   (`\\servidor\CONSULTOR-SIGER\data\consultor.db`) via `MIGRACAO_CONSULTOR_SIGER_DB`.
   Atenção: o módulo também **grava** `feedback-portal.jsonl` nesse share.
10. **Layouts fiéis e templates .docx estão fora do git e são lidos no BOOT**
    (`modelo-documento.service.ts` semeia os 4 modelos a partir de
    `tools/templates/layouts/`). Um `git clone` limpo sobe um Painel sem os modelos de
    documento, com erro só no log.

## 2. Decisões a tomar ANTES (com recomendação)

| # | Decisão | Recomendação |
|---|---|---|
| D1 | **Sistema operacional** | **Windows Server** (ou Windows 11 Pro em hardware dedicado). Motivo bloqueante: a pré-visualização fiel `.docx→PDF` abre o Word de verdade via COM (`docservice/docview.py`) — em Linux isso degrada para HTML e a fidelidade é requisito de negócio. Todo o operacional (.bat/.ps1/schtasks/ACL/CA do domínio) também é Windows. |
| D2 | **Conta de serviço** | Conta de domínio dedicada (ex.: `RECHINFO\svc-painel`), sem expiração de senha, com acesso ao share do SICLA/F:. Segredos como variáveis **de máquina** (precedente já existe: `Gerar_Certificado_Painel.ps1` grava `MIGRACAO_HTTPS_*` em nível Machine). |
| D3 | **Nome e endereço** | DNS próprio (ex.: `painel.rechinfo.local`) + IP fixo. Manter **CNAME do nome antigo** (`I7M1700-01-EVE`) por um período — todo mundo tem o endereço velho salvo. |
| D4 | **HTTPS** | Certificado pela **CA interna do domínio** (`rechinfo-PR-ADCS-VS25-CA`), emitido para o DNS novo, porta 5443 publicada. Destrava a gravação de reunião para a equipe toda. |
| D5 | **Entrada de vídeos (Treinamentos)** | Curto prazo: sessão do usuário de serviço com **logon automático + tela travada** e OneDrive sincronizando (combinar com a TI como isso sobrevive a reboot). Alvo: mover a entrada para **pasta de rede UNC** compartilhada (o código já trata volumes diferentes — fallback EXDEV) e aposentar o OneDrive do servidor. O Word COM também precisa da sessão — mesma solução serve para os dois. |
| D6 | **Deploy** | **Fim do "produção builda da árvore de trabalho".** O servidor NUNCA é máquina de desenvolvimento: entrega = commit + push; no servidor, `git pull` + `Build_Painel_Novo.bat` (build + migrations) + reinício. O notebook volta a ser só estação de trabalho. (É também a hora natural de executar a pendência GitLab §3 e pendurar deploy no CI.) |
| D7 | **Hardware** | Já especificado em [servidor-producao.md](servidor-producao.md) §4-5: 8-16 núcleos homogêneos, 32 GB (64 com IA local), NVMe 1 TB, GPU NVIDIA 16-24 GB se a IA local/transcrição rápida ficar no mesmo host, nobreak, 24/7. |

## 3. O que migra (inventário fechado em 2026-08-19)

Números do dia: banco `painel_novo` = **39 tabelas / 8,6 MB** · `documentos_gerados` = 658
arquivos (18 MB em `backend/dados/`) · templates fiéis ≈ 2,2 MB · modelos de diarização
44 MB · `C:\PainelBackups` 54 MB · Node 24.15 / Python 3.12.10 / MariaDB 12.2.

**3.1 Copiar obrigatoriamente (insubstituível):**
- Dump do MariaDB (gerar na hora da virada com `tools/Painel_Novo_Backup_MariaDB.ps1`).
- `backend/dados/documentos_gerados/` inteira + UPDATE de `documentos.caminho` se o
  caminho-base mudar (ver §5 F4).
- `backend/dados/modelos_documento/` (versões v2+ enviadas pela tela).
- `tools/templates/layouts/` + `tools/templates/*.docx` + `tools/data/checklist_modulos.yaml`.
- Valores de `MIGRACAO_DB_URL` (a senha!), extraídos do perfil do `everton` **antes** de
  qualquer mudança na máquina atual. JWT secrets: gerar **novos** no servidor (invalida
  sessões ativas — aceitável e até desejável).
- Conteúdo de `Treinamentos/` (Videos Pendentes/Processados/Com Erro/Gravacoes) — vive no
  SharePoint/OneDrive, então "migrar" = garantir que o servidor enxerga a mesma pasta (D5).

**3.2 Copiar (credenciais recriáveis, mas trabalhosas):** os JSONs de `backend/dados/` —
`disponibilidade.json` (Oracle + SELECT curado + `oracle_lib_dir`), `graph.json`,
`smtp.json`, `imap.json`, `ia_config.json` (+`anthropic_key.txt`), `portal_db.json`,
`portal_credenciais.json`, `rechedu_credenciais.json`, `digest_para.txt`.

**3.3 Reinstalar/regerar no servidor (não copiar):** Node 24 + `npm ci`, Python 3.12 +
venv do docservice, MariaDB 12.2, Microsoft Word (licença!), Oracle Instant Client x64 +
VC++ Redistributable em `C:\Oracle\instantclient_23_0`, modelos de diarização (download
k2-fsa/sherpa-onnx), certificado HTTPS **novo** (o atual tem SAN da máquina velha),
`vault_embeddings.json` (`--indexar`), builds (`Build_Painel_Novo.bat`).

**3.4 NÃO copiar:** `.env` da raiz (rotacionar a `GEMINI_API_KEY`),
`migracao-senhas-temporarias.csv` (apagar — ordem antiga do plano de virada),
`mariadb.env`, `backup_pre_21passos_*.sql`, `painel.sqlite`, `ia_config.backup-*.json`,
`tools/data/{secret.key,acesso.txt}` (resíduo Gmail/Flask), vault Obsidian pessoal
(`dados/`), `BI/*.pbix`, YAMLs de teste.

## 4. As "coisinhas" locais que morrem — e o que entra no lugar

| Coisinha de hoje | Substituto profissional |
|---|---|
| Guardião no **logon do `everton`** (5 min, VBScript) | Tarefa "ao iniciar o sistema" com conta de serviço — ou serviço Windows de verdade (NSSM/`sc.exe`) para NestJS e docservice, com restart automático |
| Segredos em variável **de usuário** | Variáveis **de máquina** (ou cofre da TI), setadas uma vez no provisionamento |
| Repositório **dentro do OneDrive** | `git clone` em pasta local do servidor (ex.: `C:\Painel\Implantacao`), fora de qualquer sincronizador |
| **Produção buildada da árvore de trabalho** (HEAD ≠ o que roda) | Deploy a partir do git: push → pull no servidor → build → reinício. A árvore do servidor está sempre limpa |
| `http://I7M1700-01-EVE:5100` na boca de todo mundo | DNS `painel.rechinfo.local` + HTTPS 5443 + CNAME temporário do nome antigo |
| `Testar_Gravacao_Microfone.bat` (origem insegura na marra) | Morre — HTTPS real resolve a gravação para todos |
| `Ativar_HTTPS_Painel.bat` / cert autoassinado | Morre — fica só o caminho da CA interna |
| Drive `F:` mapeado por sessão | Caminho UNC em `MIGRACAO_CONSULTOR_SIGER_DB` |
| Default `C:\SEG-EVE\OneDrive...` no código | Envs explícitas no servidor + correção dos defaults (§5 F1) |
| Backup que não roda porque "a máquina estava desligada às 22h" | Servidor 24/7 com nobreak; backup + verificação de integridade nos mesmos horários |
| Máquina pessoal = dev + produção juntos | Notebook vira só estação de dev; e2e/testes continuam locais, produção intocável |

## 5. Plano faseado

**F0 — Decisões e pedidos à TI (bloqueia tudo):** aprovar D1-D7; provisionar máquina no
domínio; criar conta de serviço; DNS + IP fixo; emitir certificado pela CA interna;
**autorizar o IP novo no relay SMTP** (se o envio por relay estiver em uso); conceder à
conta de serviço acesso ao share do `F:` e à pasta de vídeos; licença do Word.

**F1 — Ajustes de código ANTES da virada — EXECUTADA em 2026-08-19:**
- [x] Defaults machine-specific: aviso no boot (produção) quando `MIGRACAO_PROTOCOLOS_DIR`/
      `MIGRACAO_CONSULTOR_SIGER_DB`/`MIGRACAO_BACKUP_DIR` estão ausentes, e o robô de
      protocolos passou a DENUNCIAR no boot quando a pasta de vídeos não existe (era a
      falha mais silenciosa do inventário).
- [x] Os 5 scripts de operação (Iniciar, docservice/iniciar, Guardião, Backup MariaDB,
      Verificação) leem `MIGRACAO_BACKUP_DIR` (fallback `C:\PainelBackups`); Guardião e
      Verificação também respeitam `MIGRACAO_PORT`.
- [x] `ingerir-dicionario-siger.ts` sem default pessoal — exige o argumento da raiz.
- [x] `documentos.caminho` agora é gravado **relativo** ao store
      (`caminho-documento.util.ts`); leitura retrocompatível com os absolutos antigos nos
      4 leitores (download, preview, exclusão, anexos de e-mail do passo). Registros
      antigos continuam funcionando; a virada não precisa mais de UPDATE — basta copiar a
      pasta (os absolutos legados desta máquina são resolvidos como estão, então o ideal é
      rodar uma vez `UPDATE documentos SET caminho = SUBSTRING_INDEX(caminho, '\\\\', -1)
      WHERE caminho LIKE 'C:%'` na virada para normalizar de vez — opcional).
- [x] `MIGRACAO_HTTPS_SOMENTE=1`: HTTP nem abre e o HSTS liga (estado final do servidor);
      sem TLS configurado a flag é ignorada com aviso, para nunca derrubar o painel.

**F2 — Montar o servidor (produção atual intocada):** instalar stack (§3.3); clonar o
repo; copiar §3.1/§3.2; setar envs de máquina; `Build_Painel_Novo.bat`; recriar as 3
Tarefas Agendadas com conta de serviço; `Proteger_Dados_ACL.ps1` como a conta de serviço;
firewall (5100/5443 entrada; 3306/8001/11434 só loopback).

**F3 — Ensaio geral (servidor no ar em paralelo, apontando para RESTORE do dump):**
- Checklist de aceitação do [servidor-producao.md](servidor-producao.md) §12 (inclui as
  duas provas-chave: gravação de reunião inicia = HTTPS ok; preview .docx→PDF = Word ok).
- Suítes completas + **e2e Playwright** na instância isolada 5199 do servidor.
- **Skill `auditoria-geral-sistema`** contra o servidor de ensaio.
- Testar: Oracle (Disponibilidade/Busca Cliente), Graph (e-mail de teste), Portal Rech,
  Consultor SIGER via UNC, robô de protocolos com um vídeo de verdade, backup 22h + Saúde
  lendo a pasta certa, **reboot da máquina** (tudo volta sozinho? — é o teste que mata o
  guardião-por-logon).

**F4 — Virada (janela curta, fora do horário):** congelar mudanças → dump final + cópia
final de `documentos_gerados`/`dados` → restore no servidor → `UPDATE documentos SET
caminho = REPLACE(caminho, '<base antiga>', '<base nova>')` (se F1 do caminho relativo não
tiver chegado antes) → subir → smoke (§12) → apontar DNS/CNAME → comunicado à equipe (URL
nova) → **desabilitar o Guardião local** (não excluir ainda).

**F5 — Pós-virada (1-2 semanas):** máquina local intacta como rollback (religar o guardião
local = voltar ao estado anterior em minutos); monitorar Saúde/backup/digest; depois do
período: excluir as Tarefas locais, desinstalar MariaDB local (após cópia dos backups),
limpar o repo das coisinhas mortas (`Testar_Gravacao_Microfone.bat`,
`Ativar_HTTPS_Painel.bat` + `Gerar_Certificado_Painel.ps1` se a CA interna vingou),
atualizar `CLAUDE.md`/`README`/runbooks (nome novo, pastas novas) e rotacionar as chaves
que passaram pela máquina pessoal.

## 6. Riscos e pontos de atenção

- **Relay SMTP por IP**: esquecê-lo = e-mail para de sair na virada e ninguém liga o alarme
  ao IP. Está no F0 de propósito.
- **Sessão interativa (OneDrive/Word)**: é o risco arquitetural remanescente no Windows
  Server — decidir D5 com a TI ANTES de comprar a máquina, não depois.
- **Oracle thick**: sem Instant Client x64 + VC++, três telas caem com erro obscuro
  (DPI-1047). Teste explícito no F3.
- **`documentos.caminho` absoluto**: qualquer descuido aqui só aparece quando alguém clica
  em "baixar" num documento antigo — testar no F3 com documento velho de verdade.
- **Usuários com URL antiga**: manter o CNAME e um aviso no login por algumas semanas.
- **A máquina atual continua sendo dev**: nada impede `npm run start:dev` local — mas a
  porta 5100 local morre com o guardião; quem abrir o endereço antigo sem CNAME não acha
  nada. Comunicação resolve.

---
*Este plano nasceu do inventário automatizado de 2026-08-19 (38 itens de ação, 10
acoplamentos críticos). Atualize-o conforme as decisões D1-D7 forem fechadas com a TI.*
