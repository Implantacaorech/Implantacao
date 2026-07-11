# Mapa de dependências

## 1. Dependências de código (Python, `tools/requirements.txt`)

| Pacote | Uso | Crítico? |
|---|---|---|
| `Flask>=3.0` | Framework web do painel | Sim |
| `SQLAlchemy>=2.0` | ORM, modelos, migração aditiva | Sim |
| `psycopg2-binary>=2.9` | Driver Postgres (produção) | Sim |
| `waitress>=3.0` | Servidor WSGI de produção | Sim |
| `python-docx>=1.1` | Geração/leitura de `.docx` (documentos oficiais) | Sim |
| `openpyxl>=3.1` | Geração de `.xlsx` | Sim |
| `PyYAML>=6.0` | Config/dados dos geradores (`tools/data/*.yaml`) | Sim |
| `google-auth`, `google-auth-oauthlib` | Gmail API (fallback de SMTP) | Médio — só se SMTP bloqueado |
| `httpx>=0.27` | Chamadas HTTPS à Gmail API | Médio (mesmo caso acima) |
| `anthropic>=0.40` | Modo IA opcional (tempo verbal/ortografia) | Baixo — opcional, só com chave |
| `pywin32>=306` (condicional Windows) | Preview fiel via Word COM | Baixo — só preview |
| `faster-whisper>=1.0` | Transcrição local de vídeos de treinamento | Baixo — funcionalidade específica |

**Nenhum pacote tem teto de versão** (`>=` sem `<`) — ver F-10/M-05 (Dependabot).

## 2. Dependências de infraestrutura

| Dependência | Tipo | Ponto único de falha? |
|---|---|---|
| Docker Desktop / WSL2 | Runtime do container Postgres | Sim — sem Docker, sem banco |
| Postgres 16 (container `painel-db`) | Banco transacional | Sim — único banco, sem réplica |
| Máquina Windows do usuário `everton` | Servidor + watchdog + cron do backup | Sim — SPOF já documentado (F-02) |
| Rede interna Rech | Acesso da equipe ao painel | Sim para acesso, não para o app rodar |
| OneDrive/SharePoint (`PROTOCOLOS_DIR`) | Fonte de vídeos de treinamento | Só para o robô de protocolos |

## 3. Dependências externas (serviços de terceiros)

| Serviço | Uso | Fallback existente? |
|---|---|---|
| SMTP (Gmail/Outlook) | Envio de e-mail principal | Sim — Gmail API (porta 443) se SMTP bloqueado |
| Gmail API (OAuth) | Fallback de envio | Não tem outro fallback além do SMTP |
| Base Oracle/SQL (disponibilidade dos consultores) | Consulta de agenda | Não — se cair, tela de disponibilidade fica sem dado (degradação, não crash) |
| Anthropic API | Modo IA opcional | Sim, por design — funcionalidade é opcional |
| GitHub (`Implantacaorech/Implantacao`) | Versionamento + CI | Não tem fallback — é a fonte de verdade do código |

## 4. Dependências entre módulos internos (acopladas por design, ver `docs/agentes-software.md`)

```
routes_*.py  →  app.py / db.py            (via register(app, **deps) — nunca import direto)
gerar_layout.py (fachada)  →  gl_comum / gl_levantamento / gl_projeto / gl_termo / gl_xlsx
routes_geracao.py  →  gerar_layout.py
tools/preencher_layout.py  ←  usado por webapp/gerar_layout.py E pelos geradores standalone (tools/gerar_*.py)
webapp/fluxo.py  →  imap_intake.py (parse do e-mail de fechamento) → cria projeto via db.py
robo_integridade.py  →  verificar_app.py + verificar_tudo.py + pytest (orquestra os 3)
```

## 5. Dependências entre agentes (de software)

Ver `docs/agentes-software.md` §"Regra de ouro" — fronteiras já formalizadas por arquivo,
sem sobreposição. `qualidade` depende do trabalho de todos os outros (revisa antes do push);
`documentacao-contexto` depende de todos (documenta o que foi feito) — dependências de fluxo,
não de código.

## 6. Risco agregado

O maior risco de dependência não é técnico, é de **concentração**: código (GitHub), banco
(1 container), servidor (1 máquina) e watchdog (mesma máquina) formam uma cadeia onde a falha
da máquina do usuário `everton` afeta 3 dos 4 elos simultaneamente. Ver F-02/M-11.
