# Decisão de arquitetura — migração do Painel de Implantação

## Contexto

O Painel atual é um monólito Flask + Jinja2 + SQLAlchemy (~12.5k linhas Python, 54 templates,
24 modelos, 11 módulos de rota), usado internamente pelo time de implantação da Rech, com
Postgres em produção. A migração substitui o frontend por Angular e o backend por uma API
separada, preservando 100% das regras de negócio já documentadas em
[01-inventario-tecnico.md](01-inventario-tecnico.md).

## Backend: NestJS (padrão), não Spring Boot

Critério do próprio pedido de migração: usar NestJS por padrão; só ir para Spring Boot se
houver requisito técnico que justifique. Não há nenhum:

- Não existe nenhuma integração corporativa Java hoje (nem Spring, nem JPA, nem infra Java).
- As únicas dependências "difíceis" (Oracle via `oracledb`, Gmail OAuth, IMAP, SMTP, Anthropic
  SDK) têm bindings Node de primeira classe, idênticos em maturidade aos equivalentes Java.
- O time já mantém Python (não Java) como segunda linguagem — NestJS/TypeScript reduz mais a
  distância cognitiva (rotas → controllers, `db.py` → entities/services) do que uma reescrita
  em Java puro.

**Decisão: NestJS + TypeScript + TypeORM + Postgres**, mantendo o mesmo banco Postgres já em
produção (schema novo, com FKs reais — ver §Banco).

## Frontend: Angular (mais recente estável), standalone components

Repositório não tinha frontend Angular antes (era Jinja2 renderizado no servidor). Não há
Angular 16 legado neste projeto para preservar — logo a trava de compatibilidade descrita no
prompt ("hoje usamos Angular 16") não se aplica aqui; parte-se direto da versão estável mais
atual disponível no ambiente (Angular 19+, standalone components, `inject()`, Signals onde
fizer sentido — ex. estado do calendário de agenda, badges de contagem), sem NgModules
legados.

## Arquitetura híbrida — onde e por quê

O pedido de migração autoriza microsserviços "apenas quando houver benefício comprovado".
Dois pontos do inventário **não têm equivalente maduro em Node nem em Java**:

1. **Geração fiel de documentos Word/Excel** (`python-docx`, `openpyxl`) e **conversão
   `.docx → PDF` fiel via Word COM** (`pywin32`, Windows-only). Reescrever a lógica de
   preenchimento de layout (placeholders, blocos condicionais por módulo contratado,
   tabelas dinâmicas) em `docx4j`/`docxtemplater` seria um projeto à parte, com risco real de
   quebrar a fidelidade visual que o time depende hoje (documentos vão para o cliente).
2. **Transcrição local de vídeo/áudio** (`faster-whisper`) — biblioteca Python, roda local
   (CPU) por exigência de não enviar os vídeos de treinamento para fora da rede.

**Decisão**: manter um **serviço interno Python** (FastAPI, HTTP puro, sem SQLAlchemy/Flask)
só para essas duas responsabilidades, chamado pela API NestJS via HTTP interno (nunca exposto
publicamente). Todo o resto (autenticação, regras de negócio, CRUD, agendador de visitas,
dashboards, matriz, cadastros) fica 100% em NestJS. Isso é uma arquitetura híbrida
**justificada por uma dependência técnica real**, não duplicação de backend.

## Banco de dados

- Mesmo Postgres de produção, schema novo (`migrations` TypeORM, sem `synchronize: true`).
- Toda relação hoje implícita por `projeto_id` solto vira `@ManyToOne(() => Projeto, { onDelete: 'CASCADE' })`
  real — elimina a limpeza manual de 9 tabelas em `projeto_excluir`.
- Auto-migração aditiva do Flask (`_auto_migrar`) vira migrations versionadas normais
  (`npm run migration:generate` / `migration:run` / `migration:revert`), com script de
  importação de dados do banco Postgres atual (mesma instância, novo schema em paralelo)
  para a virada de produção.

## Autenticação

JWT (access curto + refresh token), `bcrypt` para hash de senha, guards por perfil
(`ADM/Coordenador/Administrativo/GCI/Consultor`) equivalentes a `pode_ver`/`pode_gerar`/
`pode_designar`/`_so_meus`. **O modo "login desabilitado = acesso total"** do Flask (instalação
nova sem usuários) **não é replicado** no novo backend — é um risco de segurança
desnecessário; a semente inicial (seed) cria o primeiro usuário ADM no primeiro boot.
CSRF: como o novo frontend é SPA com JWT em header (não cookie de sessão), o risco de CSRF
tradicional não se aplica da mesma forma — mitigado por CORS restrito + SameSite no refresh
token quando este for hospedado em cookie.

## Jobs agendados

`@nestjs/schedule` (cron in-process) substitui as threads daemon do Flask — mesmo volume de
jobs (digest diário, robô de caixa IMAP, robô de protocolos), sem necessidade de fila externa
(BullMQ) neste estágio; revisar se algum dia o volume justificar.

## Escopo desta fase da migração (honestidade de escopo)

Uma conversão de paridade total (11 módulos de rota, 54 telas, 24 entidades, geração de
documentos, transcrição, e-mail/IMAP/Gmail, matriz, dashboards) é um projeto de várias
semanas — não cabe de forma verdadeira em uma única sessão. Esta primeira entrega prioriza:

1. Esqueleto real e funcional de `backend/` (NestJS) e `frontend/` (Angular), buildável.
2. **Autenticação completa** (login, JWT, guards por perfil) — base de tudo o resto.
3. **Módulo Projetos** (entidade raiz do sistema) convertido ponta a ponta — CRUD, listagem
   com filtro por perfil (`_so_meus`), como referência viva do padrão a repetir nos demais
   módulos.
4. Testes automatizados do que foi convertido, rodando de verdade.

O restante (Agendador de Visitas, geração de documentos, protocolos, matriz, dashboards,
cadastros, e-mail/IMAP/Gmail) fica listado como pendência explícita, priorizada, em
[03-documento-conversao.md](03-documento-conversao.md) — não como funcionalidade
"silenciosamente esquecida".
