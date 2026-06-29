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
- **App no ar?** `GET /health` deve responder `{"status":"ok"}` (200). `degraded`/503 = banco inacessível.
- **Rotas/registro ok?** `python webapp/verificar_app.py` (segundos).
- **Logs:** o app loga em arquivo (modo servidor). Backup do Postgres loga em `C:\PainelBackups\backup.log`.
- **Configurado?** cada conector tem `configurado()`: e-mail/IMAP/Gmail/disponibilidade só atuam quando verdadeiro.

## 2. E-mail SMTP não envia
**Sintoma:** envio pela ficha falha; eventos de e-mail viram "Notificação pendente".
1. Config em **Config → E-mail** (`smtp.json`) ou env `SMTP_*` (host, porta, usuário, senha, from).
2. Teste o envio por uma ficha (`/projetos/<id>/email`).
3. **Rede corporativa costuma bloquear SMTP** (portas 465/587). Se for o caso → use a **Gmail API** (seção 3), que sai pela 443.
4. Toda tentativa (sucesso/falha) fica registrada na timeline do projeto.

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
- Não dispararam? confirme que **há destinatários/IMAP configurado** e que o processo subiu em **modo servidor** (não em `flask run` de dev).

## 8. Trocar a senha padrão do Postgres
> Pendência de segurança conhecida (padrão `painel2026`). Faça nos **três** lugares:
1. **No banco:** `docker exec -it painel-db psql -U painel -d painel -c "ALTER USER painel WITH PASSWORD 'NOVA_SENHA';"`
2. **Na app:** atualizar `PAINEL_DB_URL` (variável de usuário) com a nova senha.
3. **No backup:** atualizar `PGPASSWORD` em `tools/painel-backup.sh` (não comitar a senha real).
Reinicie o Painel e rode `tools/painel-backup.sh` uma vez para validar.

## 9. Variáveis de ambiente e arquivos de config

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
