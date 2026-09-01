# Runbooks de operação — Painel de Implantação

> Procedimentos de diagnóstico e resolução para a operação contínua do Painel. Território do
> agente **integracoes-operacao**. Não coloque credenciais aqui (nem em commits).
>
> **Segredos** ficam em `DATA_WRITE/*.json` (gitignored) ou em variáveis de ambiente:
> `graph.json` (Microsoft 365) · `smtp.json` (SMTP) · `imap.json` (IMAP) ·
> `disponibilidade.json` (base externa). No servidor, as variáveis de ambiente têm prioridade.

## Índice
1. [Diagnóstico rápido](#1-diagnóstico-rápido) · [1b. Acesso pela rede](#1b-acesso-de-outros-computadores-da-rede) · [1c. Guardião](#1c-servidor-sempre-no-ar-guardião)
2a. [E-mail Microsoft 365 (Graph)](#2a-e-mail-microsoft-365-graph)
2. [E-mail SMTP não envia](#2-e-mail-smtp-não-envia)
3. [Gmail API (removida)](#3-gmail-api-removida)
4. [IMAP e robô da caixa](#4-imap-e-robô-da-caixa)
5. [Disponibilidade / Oracle](#5-disponibilidade--oracle)
6. [Banco MariaDB — backup e restauração](#6-banco-mariadb--backup-e-restauração)
7. [Robôs / agendadores](#7-robôs--agendadores)
8. [Robô de integridade](#8-robô-de-integridade-verificação-diária-automática)
9. [Variáveis de ambiente e arquivos de config](#9-variáveis-de-ambiente-e-arquivos-de-config)

---

## 1. Diagnóstico rápido
- **Comece por aqui (stack novo, 2026-08-11):** abra **Centro de Monitoramento → Saúde do
  sistema**, ou chame `GET /api/saude`. Seis checagens com o que fazer em cada uma: banco,
  **backup** (idade e tamanho do último zip), **Guardião** (reinícios em 24 h), **docservice**,
  transcrições presas e e-mails que falharam. O mesmo resumo vai no **digest diário** — não é
  preciso lembrar de olhar. Detalhe em `backend/src/saude/docs/`.
- **App no ar?** `GET /api/health` deve responder 200; `degraded`/503 = banco inacessível.
- **Configurado?** cada conector tem `configurado()`: e-mail/IMAP/disponibilidade só atuam quando verdadeiro.
- **Logs:** backup do MariaDB em `C:\PainelBackups\backup_novo_mariadb.log`; guardião em
  `C:\PainelBackups\guardiao_novo.log`.
> Os antigos `webapp/verificar_*.py` eram do painel **Flask** (desligado em 2026-07-19,
> removido do repositório em 2026-07-29) — só no histórico do git.

## 1b. Acesso de outros computadores da rede
Endereço para a equipe (o servidor roda na máquina `I7M1700-01-EVE`):
- **`http://I7M1700-01-EVE:5100`** (preferido — sobrevive a troca de IP) ou `http://192.168.1.43:5100`.
- **`http://localhost:5100` NÃO funciona em outro PC** — localhost aponta para o próprio
  computador de quem digita. Vale só na máquina do servidor.

Se não abrir de outro PC, na ordem:
1. Na máquina do servidor: `GET /api/health` responde? Servidor precisa estar **escutando a
   rede** (conferir: `Get-NetTCPConnection -LocalPort 5100 -State Listen` deve mostrar
   `0.0.0.0`, não `127.0.0.1`).
2. Firewall do Windows: regra de **entrada** liberando o `node.exe` (ou a porta 5100) nos perfis
   **Domínio/Privado**. Conferir: `Get-NetFirewallRule -Direction Inbound | ? DisplayName -match node`.
3. No outro PC: `Test-NetConnection I7M1700-01-EVE -Port 5100`. Falhou com 1 e 2 ok = rede
   diferente (Wi-Fi de visitantes, VPN, outra VLAN) — chamar a TI da rede.

## 1c. Servidor sempre no ar (guardião)
Tarefa do Windows **"Painel Novo - Guardiao"** (gatilho: no logon do `everton` + repetição a
cada 5 min, oculta, sem senha armazenada) roda `Guardiao_Painel_Novo.vbs`, que vigia **três**
serviços e sobe **oculto** (sem janela para fechar por engano) o que estiver fora do ar:

| Serviço | Porta | Sobe por |
|---|---|---|
| Painel | 5100 | `Iniciar_Painel_Novo.bat` |
| docservice | 8001 | `docservice\iniciar.bat` |
| **Portal API** | 5110 | `Iniciar_Portal_Conexoes.bat` |

Log em `C:\PainelBackups\guardiao_novo.log`.

> O Portal API entrou na vigilância em **2026-08-26**, um dia depois de subir: caiu durante a
> noite e ninguém o reergueu. Ele só é vigiado depois de ter subido ao menos uma vez nesta
> máquina (existir `portal_conexoes_stdout.log` na pasta de backup) — numa máquina que não
> quer o Portal API, o guardião não fica tentando subi-lo para sempre.
- Roda no contexto do usuário `everton` (necessário: a conexão do banco vem do env do usuário).
- Testar/forçar agora: `schtasks /Run /TN "Painel Novo - Guardiao"`.
- Conferir: `schtasks /Query /TN "Painel Novo - Guardiao" /V /FO LIST` (Último resultado = 0 = ok).
- Parar de subir sozinho (manutenção): `schtasks /Change /TN "Painel Novo - Guardiao" /DISABLE`.
- **Ainda cai?** O guardião só age enquanto o `everton` está logado. Se a máquina fica
  deslogada/desligada, o site fica fora — é o limite de rodar no notebook (ver migração p/
  servidor fixo). Reinício do Windows: sobe de novo no próximo logon.
> As tarefas antigas **"Painel - Guardiao"** e **"Painel - Verificacao de Integridade"**
> (era Flask) seguem cadastradas, DESABILITADAS, apontando para scripts que não existem mais
> — podem ser excluídas: `schtasks /Delete /TN "Painel - Guardiao" /F`.

## 2a. E-mail Microsoft 365 (Graph)

**É o caminho oficial da caixa `implantacao@rech.com.br`** desde 2026-08-17, quando a
autenticação básica do Exchange Online (usuário e senha no SMTP) deixou de ser aceita. Roda
só em HTTPS/443 — não depende de porta SMTP nenhuma. Quando esta configuração está completa,
o `MailerService` a usa **antes** do SMTP.

Config em **Ferramentas → E-mail (Microsoft 365)** (`graph.json`) ou nas variáveis de
ambiente, que têm prioridade: `EMAIL_GRAPH_TENANT_ID`, `EMAIL_GRAPH_CLIENT_ID`,
`EMAIL_GRAPH_CLIENT_SECRET` e `EMAIL_REMETENTE`. Os quatro valores vêm do TI (registro de
aplicativo no Entra ID, permissão `Mail.Send` com consentimento de administrador e restrição
por `ApplicationAccessPolicy` à caixa de implantação).

| Erro na timeline / na tela | Causa | Ação |
|---|---|---|
| **"Segredo do aplicativo … EXPIRADO"** (`AADSTS7000215`) | client secret venceu — tem prazo de validade | pedir um novo ao TI e salvar na tela; nada mais muda |
| **"Sem permissão para enviar como …"** (403) | remetente diferente do autorizado, ou a política de acesso não inclui a caixa | conferir o campo Remetente; se estiver certo, é a `ApplicationAccessPolicy` no TI |
| **401 ao enviar** | falta consentimento de administrador na permissão `Mail.Send` | TI concede o consentimento no Entra ID |
| **"Aplicativo não encontrado no tenant"** | Client ID ou Tenant ID trocados | conferir os dois com o TI |
| **"Não foi possível alcançar a Microsoft"** | saída HTTPS bloqueada no servidor | liberar 443 para `login.microsoftonline.com` e `graph.microsoft.com` |
| **"Anexos somam X MB"** | acima de ~2,5 MB por mensagem (limite do `sendMail`) | mandar o arquivo por link (OneDrive/SharePoint) ou dividir o envio |

O access token fica **em memória** e é renovado sozinho ao expirar; reiniciar o backend
apenas força um token novo no primeiro envio. Salvar a configuração descarta o token em
cache — é o que faz um segredo trocado valer na hora.

## 2. E-mail SMTP não envia
**Sintoma:** envio pela ficha falha; eventos de e-mail viram "Notificação pendente".
- **"Notificação pendente (…): TimeoutError: timed out"** na timeline = a **rede bloqueia a
  porta SMTP** de saída (465/587). É a causa nº 1 → use o **Microsoft 365** (seção 2a), que
  sai só pela 443.
- **"gaierror" / host não encontrado** = host SMTP errado em Config → E-mail.
- **"Falha de autenticação"** = o Microsoft 365 não aceita mais usuário e senha no SMTP
  (seção 2a). Num relay interno, deixe o usuário em branco: ele autoriza pelo IP.

1. Config em **Config → E-mail** (`smtp.json`) ou env `SMTP_*` (host, porta, usuário, senha, from).
2. Teste o envio por uma ficha (`/projetos/<id>/email`).
3. Toda tentativa (sucesso/falha) fica registrada na timeline do projeto.

> **As notificações por evento são assíncronas:** o envio roda em segundo plano (thread), então
> um SMTP lento/bloqueado **não atrasa mais** a etapa (gerar documento, designar, etc.). A entrega
> em si só ocorre quando o e-mail estiver realmente configurado (Microsoft 365 ou SMTP liberado).

## 3. Gmail API (removida)
O envio pela API do Gmail foi **removido do projeto em 2026-08-17**, quando a caixa oficial
passou a ser a da Microsoft (seção 2a). Não existem mais a tela `/config/gmail`, o
`GmailService` nem a dependência `google-auth-library`; os arquivos `gmail_client.json` e
`gmail_token.json` que sobraram em `DATA_WRITE` podem ser apagados do servidor — nada os lê.
O código está no histórico do git, caso o fluxo OAuth delegado volte a ser necessário.

## 4. IMAP e robô da caixa
**O que faz:** o robô (`_agendador_caixa`) lê, a cada `IMAP_POLL_MIN` min (padrão 10), os e-mails
**não lidos** marcados `[IMPLANTA…]`, **cria a ficha do projeto**, marca o e-mail como lido (não
reprocessa) e notifica a Coordenação. Liga sozinho no modo servidor quando o IMAP está configurado.
1. Config em **Config → IMAP** (`imap.json`) ou env `IMAP_*` (host, usuário, senha de app, pasta).
2. Use **senha de app** quando o provedor exigir (não a senha normal da conta).
3. **Não cria projetos?** verifique: IMAP `configurado()`; e-mails realmente marcados `[IMPLANTA…]` e
   **não lidos**; cliente/CNPJ ainda não existente (duplicado é ignorado de propósito).
4. Teste manual sem o robô: `/fluxo` → **buscar na caixa** (`buscar_fechamento`).

## 5. Disponibilidade / Oracle
Config em **Config → Disponibilidade** (`disponibilidade.json`): `tipo`/`host`/`porta`/`banco`/
`usuario`/`senha` **ou** `url` (SQLAlchemy), mais o `select` e (Oracle) `oracle_thick`/`oracle_lib_dir`.
O `select` deve devolver `tecnico` (= **Código SICLA** do cadastro), `data`, `turno`.
Parâmetros: `:data_ini`/`:data_fim` (o painel passa **hoje…+18 meses**) e `:tecnicos` (lista de
códigos dos consultores da visita). **Use `… IN :tecnicos`** para o banco devolver só eles — é o
que dá agilidade. Sem `:tecnicos`, o painel restringe à semana visível (não puxa 18 meses de todos).
Ex.: `SELECT cod AS tecnico, dia AS data, turno FROM agenda WHERE dia BETWEEN :data_ini AND :data_fim AND cod IN :tecnicos`.

| Erro | Causa | Ação |
|---|---|---|
| **DPY-3015** | senha Oracle com verificador antigo (modo thin não aceita) | marque **Modo thick** + informe `oracle_lib_dir` (pasta com `oci.dll`), OU peça ao DBA p/ redefinir a senha (verificador 11g/12c) |
| **DPI-1047 / erro 126** | Instant Client não carregou | (1) instalar **Visual C++ Redistributable x64** (causa nº 1); (2) client deve ser **64-bit**; (3) a pasta deve conter `oci.dll`; reiniciar o servidor |
| `ModuleNotFoundError` do driver | driver do dialeto ausente | `pip install` do pacote: Postgres `psycopg2-binary` · MySQL `pymysql` · SQL Server `pyodbc` · Oracle `oracledb` |

Teste pela própria tela (botão **Testar** → consulta 30 dias e mostra amostra).

## 6. Banco MariaDB — backup e restauração
- **Serviço:** MariaDB 12.2 **nativo do Windows** (porta 3306, base `painel_novo`) — não há
  mais Docker nesta máquina. App aponta via `MIGRACAO_DB_URL` (`mysql://...`); qualquer outro
  dialeto **falha o boot** de propósito (§4.8).
- **Backup:** Tarefa **"Painel Novo - Backup MariaDB"** (diária, 22:00) roda
  `tools/Painel_Novo_Backup_MariaDB.ps1` → `C:\PainelBackups\painel_novo_mariadb_*.zip`
  (retenção 14 dias). Log em `backup_novo_mariadb.log`; a idade/tamanho do último zip é
  vigiada pela tela **Saúde do sistema**.
- **Restaurar um backup:** instruções no cabeçalho do próprio
  `tools/Painel_Novo_Backup_MariaDB.ps1` (`Expand-Archive` + cliente `mariadb`).
- **SQLite (modo local):** sem `MIGRACAO_DB_URL`, o backend usa SQLite descartável — só
  dev/teste, nunca produção.
- **Migração de schema:** TypeORM migrations (`npm run migration:run` em `backend/`).

## 7. Robôs / agendadores
Rotinas de fundo do backend NestJS (`@nestjs/schedule`), ligadas quando configuradas:
- **Digest diário**: envia o resumo na hora `MIGRACAO_DIGEST_HORA` (padrão 8h) aos
  destinatários `MIGRACAO_DIGEST_PARA`/`dados/digest_para.txt`. Envio manual: botão na tela
  **Coordenação**.
- **Robô da caixa** (`ImapIntakeService`): seção 4.
- **Robô de protocolos**: a cada `MIGRACAO_PROTOCOLOS_POLL_MIN` min (padrão 10, piso 2),
  varre `Treinamentos/Videos Pendentes` (pasta do SharePoint sincronizada pelo OneDrive),
  registra vídeos novos (dedup por hash), **transcreve localmente** (faster-whisper, via
  docservice) e **analisa com a IA** (chave do Config → IA) → status *Em revisão*; move o
  vídeo para `Videos Processados` ou `Videos Com Erro`. Pasta raiz:
  `MIGRACAO_PROTOCOLOS_DIR` (padrão `...\PortalImplantacao\Treinamentos`).
  **Não processa?** confira: a pasta existe/sincroniza; a chave de IA está configurada;
  o status/erro aparecem na tela do protocolo. Transcrição de 1h ≈ 15–30 min (CPU).
- Não dispararam? confirme que **há destinatários/IMAP configurado** e que o processo de
  produção subiu pelo `Iniciar_Painel_Novo.bat` (não um `npm run start:dev` avulso).

## 8. Robô de integridade (verificação diária automática)
Tarefa do Windows **"Painel Novo - Verificacao de Integridade"** (diária, 07:30) roda
`tools/Verificar_Integridade_Novo.ps1` — o detalhe do que ela cobre está no cabeçalho do
próprio script. Resultado em `C:\PainelBackups`; a tela **Saúde do sistema** consolida as
mesmas checagens.
Conferir o agendamento: `schtasks /Query /TN "Painel Novo - Verificacao de Integridade"`.

## 9. Variáveis de ambiente e arquivos de config

Referência completa das chaves `MIGRACAO_*` em `backend/.env.example` e
`backend/src/config/configuration.ts`. As mais usadas na operação:

| Item | Onde | Para quê |
|---|---|---|
| `MIGRACAO_DB_URL` | env | URL do MariaDB (`mysql://...`). Sem ela → SQLite (só dev/teste) |
| `MIGRACAO_PORT` | env | porta do processo único (produção: 5100) |
| `MIGRACAO_JWT_SECRET` / `MIGRACAO_JWT_REFRESH_SECRET` | env | segredos do JWT — o iniciador valida antes de subir |
| `MIGRACAO_DIGEST_PARA` / `MIGRACAO_DIGEST_HORA` | env / `dados/digest_para.txt` | destinatários e hora do resumo diário |
| `MIGRACAO_IMAP_POLL_MIN` | env | intervalo do robô da caixa (min, padrão 10) |
| `EMAIL_GRAPH_*` / `EMAIL_REMETENTE` / `dados/graph.json` | env / arquivo | conta de envio oficial (Microsoft 365) |
| `MIGRACAO_SMTP_*` / `dados/smtp.json` | env / arquivo | conta de envio SMTP (alternativa) |
| `MIGRACAO_IMAP_*` / `dados/imap.json` | env / arquivo | conta de leitura IMAP |
| `dados/disponibilidade.json` | arquivo | conexão + SELECT da base externa (Oracle) |
| `MIGRACAO_BACKUP_DIR` | env | pasta dos backups (padrão `C:\PainelBackups`) |

---
*Atualize este runbook ao adicionar/alterar uma integração ou rotina de operação.*
