# Runbooks de operação — Painel de Implantação

> Procedimentos de diagnóstico e resolução para a operação contínua do Painel. Território do
> agente **integracoes-operacao**. Não coloque credenciais aqui (nem em commits).
>
> **Segredos** ficam em `DATA_WRITE/*.json` (gitignored) ou em variáveis de ambiente:
> `smtp.json` (SMTP) · `imap.json` (IMAP) · `gmail_client.json`/`gmail_token.json` (Gmail API) ·
> `disponibilidade.json` (base externa). No servidor, as variáveis de ambiente têm prioridade.

## Índice
1. [Diagnóstico rápido](#1-diagnóstico-rápido)
2. [E-mail SMTP não envia](#2-e-mail-smtp-não-envia)
3. [Gmail API (envio quando o SMTP está bloqueado)](#3-gmail-api)
4. [IMAP e robô da caixa](#4-imap-e-robô-da-caixa)
5. [Disponibilidade / Oracle](#5-disponibilidade--oracle)
6. [Banco Postgres — backup e restauração](#6-banco-postgres)
7. [Robôs / agendadores](#7-robôs--agendadores)
8. [Trocar a senha padrão do Postgres](#8-trocar-a-senha-padrão-do-postgres)
9. [Variáveis de ambiente e arquivos de config](#9-variáveis-de-ambiente-e-arquivos-de-config)

---

## 1. Diagnóstico rápido
- **Comece por aqui (stack novo, 2026-08-11):** abra **Centro de Monitoramento → Saúde do
  sistema**, ou chame `GET /api/saude`. Seis checagens com o que fazer em cada uma: banco,
  **backup** (idade e tamanho do último zip), **Guardião** (reinícios em 24 h), **docservice**,
  transcrições presas e e-mails que falharam. O mesmo resumo vai no **digest diário** — não é
  preciso lembrar de olhar. Detalhe em `backend/src/saude/docs/`.
  > O restante desta seção é do painel **Flask**, desligado em 2026-07-19 (porta 5000,
  > `webapp/verificar_*.py`) — mantido como histórico.
- **Tudo de uma vez:** `python webapp/verificar_tudo.py` — um comando, um veredito: rotas (smoke),
  banco, e-mail, disponibilidade e idade do backup. Sai **1** se algo essencial falhou.
- **App no ar?** `GET /health` deve responder `{"status":"ok"}` (200). `degraded`/503 = banco inacessível.
- **Rotas/registro ok?** `python webapp/verificar_app.py` (segundos).
- **E-mail saindo?** `python webapp/verificar_email.py` — checa Gmail/SMTP, destinatários e as
  últimas notificações na timeline (sai **1** se nenhum caminho está configurado ou se a última
  notificação ficou "pendente"/falhou).
- **Logs:** o app loga em arquivo (modo servidor). Backup do Postgres loga em `C:\PainelBackups\backup.log`.
- **Configurado?** cada conector tem `configurado()`: e-mail/IMAP/Gmail/disponibilidade só atuam quando verdadeiro.

## 1b. Acesso de outros computadores da rede
Endereço para a equipe (o servidor roda na máquina `I7M1700-01-EVE`):
- **`http://I7M1700-01-EVE:5000`** (preferido — sobrevive a troca de IP) ou `http://192.168.1.43:5000`.
- **`http://localhost:5000` NÃO funciona em outro PC** — localhost aponta para o próprio
  computador de quem digita. Vale só na máquina do servidor.

Se não abrir de outro PC, na ordem:
1. Na máquina do servidor: `GET /health` responde? Servidor precisa estar **escutando a rede**
   (`PAINEL_HOST=0.0.0.0` no iniciador; conferir: `Get-NetTCPConnection -LocalPort 5000 -State Listen`
   deve mostrar `0.0.0.0`, não `127.0.0.1`).
2. Firewall do Windows: regra de **entrada** liberando o `python.exe` (ou a porta 5000) nos perfis
   **Domínio/Privado**. Conferir: `Get-NetFirewallRule -Direction Inbound | ? DisplayName -match python`.
3. No outro PC: `Test-NetConnection I7M1700-01-EVE -Port 5000`. Falhou com 1 e 2 ok = rede
   diferente (Wi-Fi de visitantes, VPN, outra VLAN) — chamar a TI da rede.

## 1c. Servidor sempre no ar (guardião)
Tarefa do Windows **"Painel - Guardiao"** (gatilho: no logon do `everton` + repetição a cada
5 min, oculta, sem senha armazenada) roda `Guardiao_Painel.vbs`: checa `GET /health` e, se o
Painel estiver fora do ar, sobe pelo `Iniciar_Servidor.bat` **oculto** (sem janela para fechar
por engano). Log em `C:\PainelBackups\guardiao.log`.
- Roda no contexto do usuário `everton` (necessário: a conexão do banco vem do env do usuário).
- Testar/forçar agora: `schtasks /Run /TN "Painel - Guardiao"`.
- Conferir: `schtasks /Query /TN "Painel - Guardiao" /V /FO LIST` (Último resultado = 0 = ok).
- Parar de subir sozinho (manutenção): `schtasks /Change /TN "Painel - Guardiao" /DISABLE`.
- **Ainda cai?** O guardião só age enquanto o `everton` está logado. Se a máquina fica
  deslogada/desligada, o site fica fora — é o limite de rodar no notebook (ver migração p/
  servidor fixo). Reinício do Windows: sobe de novo no próximo logon.

## 2. E-mail SMTP não envia
**Sintoma:** envio pela ficha falha; eventos de e-mail viram "Notificação pendente".
- **"Notificação pendente (…): TimeoutError: timed out"** na timeline = a **rede bloqueia a
  porta SMTP** de saída (465/587). É a causa nº 1 → configure a **Gmail API** (seção 3, porta 443).
- **"gaierror" / host não encontrado** = host SMTP errado em Config → E-mail.
- **"Falha de autenticação"** = Gmail/Outlook exigem **senha de app** (não a senha normal).
1. Config em **Config → E-mail** (`smtp.json`) ou env `SMTP_*` (host, porta, usuário, senha, from).
2. Teste o envio por uma ficha (`/projetos/<id>/email`).
3. Toda tentativa (sucesso/falha) fica registrada na timeline do projeto.

> **As notificações por evento são assíncronas:** o envio roda em segundo plano (thread), então
> um SMTP lento/bloqueado **não atrasa mais** a etapa (gerar documento, designar, etc.). A entrega
> em si só ocorre quando o e-mail estiver realmente configurado (Gmail API ou SMTP liberado).

## 3. Gmail API
Contorna o bloqueio de SMTP (usa só a porta 443). Arquivos em `DATA_WRITE` (gitignored):
`gmail_client.json` (credencial OAuth Desktop) e `gmail_token.json` (gerado na 1ª autorização).
1. No **Google Cloud Console**: criar credencial **OAuth (tipo Desktop)** com escopo `gmail.send`;
   baixar o JSON e salvar como `gmail_client.json`.
2. Em **Config → Gmail API**, **Autorizar** (gera `gmail_token.json`; o refresh é automático depois).
3. **Falhas comuns:**
   - `gmail_token.json` ausente → não autorizado: refazer a autorização.
   - Token revogado/expirado sem refresh → apagar `gmail_token.json` e autorizar de novo.
   - Pacotes ausentes → `pip install google-auth google-auth-oauthlib google-api-python-client`.

## 4. IMAP e robô da caixa
**O que faz:** o robô (`_agendador_caixa`) lê, a cada `IMAP_POLL_MIN` min (padrão 10), os e-mails
**não lidos** marcados `[IMPLANTA…]`, **cria a ficha do projeto**, marca o e-mail como lido (não
reprocessa) e notifica a Coordenação. Liga sozinho no modo servidor quando o IMAP está configurado.
1. Config em **Config → IMAP** (`imap.json`) ou env `IMAP_*` (host, usuário, senha de app, pasta).
2. Gmail: use **senha de app** (não a senha normal).
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

## 6. Banco Postgres
- **Container:** `painel-db` (Docker no WSL2); usuário `painel`, base `painel`. App aponta via `PAINEL_DB_URL`.
- **Backup:** `tools/painel-backup.sh` roda no cron do WSL (diário 22:00) → `C:\PainelBackups\painel_AAAAMMDD_HHMMSS.sql.gz` (mantém 14 dias). Log em `backup.log`.
- **Restaurar um backup:**
  ```bash
  gunzip -c /mnt/c/PainelBackups/painel_AAAAMMDD_HHMMSS.sql.gz \
    | docker exec -i painel-db psql -U painel -d painel
  ```
- **SQLite (modo local):** se não houver `PAINEL_DB_URL`, usa o arquivo `PAINEL_DB` (ou `painel.db`).
- **Migração de schema:** aditiva e automática (`_auto_migrar` cria colunas que faltam no start).

## 7. Robôs / agendadores
Threads de fundo que ligam sozinhas no modo servidor:
- **Digest diário** (`_agendador_digest`): envia o resumo na hora `DIGEST_HORA` (padrão 8h) aos
  destinatários `DIGEST_PARA`/`digest_para.txt`. Envio manual: botão na tela **Coordenação** (`/digest/enviar`).
- **Robô da caixa** (`_agendador_caixa`): seção 4.
- **Robô de protocolos** (`protocolos.agendador`): a cada `PROTOCOLOS_POLL_MIN` min (padrão 10),
  varre `Treinamentos/Videos Pendentes` (pasta do SharePoint sincronizada pelo OneDrive),
  registra vídeos novos (dedup por hash), **transcreve localmente** (faster-whisper, subprocesso)
  e **analisa com a IA** (chave do Config → IA) → status *Em revisão*; move o vídeo para
  `Videos Processados` ou `Videos Com Erro`. Pasta raiz: `PROTOCOLOS_DIR`
  (padrão `C:\SEG-EVE\OneDrive - rech.com.br\PortalImplantacao\Treinamentos`).
  **Não processa?** confira: a pasta existe/sincroniza; a chave de IA está configurada;
  o status/erro aparecem na tela do protocolo (`/protocolos`). Transcrição de 1h ≈ 15–30 min (CPU).
- Não dispararam? confirme que **há destinatários/IMAP configurado** e que o processo subiu em **modo servidor** (não em `flask run` de dev).

## 8. Robô de integridade (verificação diária automática)
Tarefa do Windows **"Painel - Verificacao de Integridade"** (diária, 07:30) roda
`Verificar_Integridade.bat` → `webapp/robo_integridade.py`, que verifica:
1. **Site no ar** (`GET /health` na porta do Painel);
2. **Operação** (`verificar_tudo.py`: rotas, banco, e-mail, disponibilidade, idade do backup);
3. **Suíte completa** (pytest, banco de teste zerado).

Resultado em `C:\PainelBackups\integridade.log`; em falha, e-mail para `INTEGRIDADE_PARA`
(env, `;`-separado) ou para os ADM/Coordenadores do cadastro. Rodar na mão:
`Verificar_Integridade.bat` (ou `python webapp/robo_integridade.py`).
Conferir o agendamento: `schtasks /Query /TN "Painel - Verificacao de Integridade"`.

## 9. Trocar a senha padrão do Postgres
> Achado F-01 da auditoria técnica de 2026-07-10 (`docs/auditoria-2026-07/`) — **corrigido no
> código** (sem mais senha padrão em `docker-compose.yml`/`painel-backup.sh`), mas a rotação da
> senha real no servidor ainda precisa ser executada manualmente. Faça nos **três** lugares:
1. **No banco:** `docker exec -it painel-db psql -U painel -d painel -c "ALTER USER painel WITH PASSWORD 'NOVA_SENHA';"`
   — se o container ainda não foi recriado com a nova senha, primeiro defina
   `PAINEL_DB_SENHA=NOVA_SENHA` (variável de ambiente) e suba de novo com `docker compose up -d`
   (o compose agora **exige** essa variável, não tem mais padrão fixo).
2. **Na app:** atualizar `PAINEL_DB_URL` (variável de usuário) com a nova senha.
3. **No backup:** criar/atualizar `/usr/local/etc/painel-db.env` (no WSL, fora do repositório)
   com a linha `PGPASSWORD=NOVA_SENHA` — `painel-backup.sh` lê daí, não tem mais senha no script.
Reinicie o Painel e rode `tools/painel-backup.sh` uma vez para validar.

## 10. Variáveis de ambiente e arquivos de config

| Item | Onde | Para quê |
|---|---|---|
| `PAINEL_DB_URL` | env | URL SQLAlchemy (Postgres). Sem ela → SQLite |
| `PAINEL_DB` | env | caminho do SQLite (modo local) |
| `PAINEL_HOST` / `PAINEL_PORT` | env | endereço/porta (padrão `127.0.0.1:5000`; `0.0.0.0` p/ rede) |
| `PAINEL_SENHA` | env | senha mestra de 1º acesso (break-glass) |
| `DIGEST_PARA` / `DIGEST_HORA` | env / `digest_para.txt` | destinatários e hora do resumo diário |
| `IMAP_POLL_MIN` | env | intervalo do robô da caixa (min, padrão 10) |
| `SMTP_*` / `smtp.json` | env / `DATA_WRITE` | conta de envio SMTP |
| `IMAP_*` / `imap.json` | env / `DATA_WRITE` | conta de leitura IMAP |
| `gmail_client.json` / `gmail_token.json` | `DATA_WRITE` | credencial e token da Gmail API |
| `disponibilidade.json` | `DATA_WRITE` | conexão + SELECT da base externa |

---
*Atualize este runbook ao adicionar/alterar uma integração ou rotina de operação.*
