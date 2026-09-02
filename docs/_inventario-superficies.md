# Inventário de superfícies — Painel de Implantação

> **Arquivo gerado.** Saída da Fase 1 de [`GERARTESTEINTEGRADOPLAYWRIGHT.md`](../GERARTESTEINTEGRADOPLAYWRIGHT.md).
> É a matéria-prima bruta da varredura — a leitura de trabalho é
> [`TESTES-INTEGRADOS.md`](TESTES-INTEGRADOS.md), que diz o que está coberto.
> **Não edite à mão:** regenere pela Fase 1 e reconcilie a Seção 3 do documento.

| Item | Valor |
| --- | --- |
| Gerado em | 2026-09-02 |
| Estado de referência | `5dcb50f` (branch `feat/controle-acessos`) |
| Rotas de API | 306 |
| Telas (Angular) | 89 |

**Critério de saída da Fase 1** — a contagem abaixo tem de bater com o `grep`:

```bash
# 309 ocorrências, 3 delas dentro de comentário → 306 rotas reais
grep -rhoE "@(Get|Post|Put|Patch|Delete|All)\(" --include="*.controller.ts" \
  backend/src --exclude="*.spec.ts" | wc -l

# 89 telas
grep -cE "^\s*path:" frontend/src/app/app.routes.ts
```

## 1. APIs (`backend/src/**/*.controller.ts`)

Prefixo global: **`/api`**. A coluna *Auth* traz a guarda efetiva (classe + método).

### `agenda` — 2 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/agenda/calendario` | [agenda/agenda.controller.ts:21](../backend/src/agenda/agenda.controller.ts#L21) | JWT + menu `agenda` | GET |
| API | `/api/agenda/usuarios` | [agenda/agenda.controller.ts:29](../backend/src/agenda/agenda.controller.ts#L29) | JWT + menu `agenda` | GET |

### `agentes` — 4 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/agentes/execucoes` | [agentes/agentes.controller.ts:57](../backend/src/agentes/agentes.controller.ts#L57) | JWT + menu `centro_operacional` (alteracao) | GET |
| API | `/api/agentes/execucoes` | [agentes/agentes.controller.ts:33](../backend/src/agentes/agentes.controller.ts#L33) | JWT | POST |
| API | `/api/agentes/execucoes/:id` | [agentes/agentes.controller.ts:45](../backend/src/agentes/agentes.controller.ts#L45) | JWT + menu `centro_operacional` (alteracao) | PATCH |
| API | `/api/agentes/grafo` | [agentes/agentes.controller.ts:68](../backend/src/agentes/agentes.controller.ts#L68) | JWT + menu `centro_operacional` | GET |

### `auth` — 7 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/auth/esqueci-senha` | [auth/auth.controller.ts:87](../backend/src/auth/auth.controller.ts#L87) | JWT | POST |
| API | `/api/auth/login` | [auth/auth.controller.ts:34](../backend/src/auth/auth.controller.ts#L34) | **pública** | POST |
| API | `/api/auth/logout` | [auth/auth.controller.ts:53](../backend/src/auth/auth.controller.ts#L53) | **pública** | POST |
| API | `/api/auth/me` | [auth/auth.controller.ts:62](../backend/src/auth/auth.controller.ts#L62) | JWT | GET |
| API | `/api/auth/redefinir-senha` | [auth/auth.controller.ts:104](../backend/src/auth/auth.controller.ts#L104) | **pública** | POST |
| API | `/api/auth/refresh` | [auth/auth.controller.ts:44](../backend/src/auth/auth.controller.ts#L44) | **pública** | POST |
| API | `/api/auth/trocar-senha` | [auth/auth.controller.ts:72](../backend/src/auth/auth.controller.ts#L72) | JWT | POST |

### `automacao` — 3 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/automacao` | [automacao/automacao.controller.ts:30](../backend/src/automacao/automacao.controller.ts#L30) | JWT | GET |
| API | `/api/automacao/pausar` | [automacao/automacao.controller.ts:39](../backend/src/automacao/automacao.controller.ts#L39) | JWT + menu `centro_operacional` | POST |
| API | `/api/automacao/retomar` | [automacao/automacao.controller.ts:50](../backend/src/automacao/automacao.controller.ts#L50) | JWT + menu `centro_operacional` (alteracao) | POST |

### `bi-agenda-alocacao` — 2 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/bi-agenda-alocacao/calendario` | [bi-agenda-alocacao/bi-agenda-alocacao.controller.ts:23](../backend/src/bi-agenda-alocacao/bi-agenda-alocacao.controller.ts#L23) | JWT + menu `dashboards` | GET |
| API | `/api/bi-agenda-alocacao/horas-aplicadas` | [bi-agenda-alocacao/bi-agenda-alocacao.controller.ts:29](../backend/src/bi-agenda-alocacao/bi-agenda-alocacao.controller.ts#L29) | JWT + menu `dashboards` | GET |

### `bi-implantacao` — 8 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/bi-implantacao/agendas` | [bi-implantacao/bi-implantacao.controller.ts:115](../backend/src/bi-implantacao/bi-implantacao.controller.ts#L115) | JWT + menu `bi_implantacao` | GET |
| API | `/api/bi-implantacao/extrato` | [bi-implantacao/bi-implantacao.controller.ts:92](../backend/src/bi-implantacao/bi-implantacao.controller.ts#L92) | JWT + menu `bi_implantacao` | GET |
| API | `/api/bi-implantacao/extrato/descricao` | [bi-implantacao/bi-implantacao.controller.ts:127](../backend/src/bi-implantacao/bi-implantacao.controller.ts#L127) | JWT + menu `bi_implantacao` | GET |
| API | `/api/bi-implantacao/resumo` | [bi-implantacao/bi-implantacao.controller.ts:45](../backend/src/bi-implantacao/bi-implantacao.controller.ts#L45) | JWT + menu `bi_implantacao` | GET |
| API | `/api/bi-implantacao/rns` | [bi-implantacao/bi-implantacao.controller.ts:105](../backend/src/bi-implantacao/bi-implantacao.controller.ts#L105) | JWT + menu `bi_implantacao` | GET |
| API | `/api/bi-implantacao/visitas-portal` | [bi-implantacao/bi-implantacao.controller.ts:55](../backend/src/bi-implantacao/bi-implantacao.controller.ts#L55) | JWT + menu `bi_implantacao` | GET |
| API | `/api/bi-implantacao/visitas-portal/enviar-email` | [bi-implantacao/bi-implantacao.controller.ts:78](../backend/src/bi-implantacao/bi-implantacao.controller.ts#L78) | JWT + menu `bi_implantacao` | POST |
| API | `/api/bi-implantacao/visitas-portal/modelo-email` | [bi-implantacao/bi-implantacao.controller.ts:68](../backend/src/bi-implantacao/bi-implantacao.controller.ts#L68) | JWT + menu `bi_implantacao` | GET |

### `bi-indicadores` — 1 rota

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/bi-indicadores` | [bi-indicadores/bi-indicadores.controller.ts:21](../backend/src/bi-indicadores/bi-indicadores.controller.ts#L21) | JWT + menu `dashboards` | GET |

### `bi-movimentos` — 1 rota

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/bi-movimentos` | [bi-movimentos/bi-movimentos.controller.ts:20](../backend/src/bi-movimentos/bi-movimentos.controller.ts#L20) | JWT + menu `dashboards` | GET |

### `cadastro` — 3 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/cadastro` | [cadastro/cadastro.controller.ts:34](../backend/src/cadastro/cadastro.controller.ts#L34) | **pública** | POST |
| API | `/api/cadastro/confirmar` | [cadastro/cadastro.controller.ts:69](../backend/src/cadastro/cadastro.controller.ts#L69) | **pública** | POST |
| API | `/api/cadastro/reenviar` | [cadastro/cadastro.controller.ts:81](../backend/src/cadastro/cadastro.controller.ts#L81) | **pública** | POST |

### `catalogos` — 14 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/cadastros/checklist` | [catalogos/catalogos.controller.ts:56](../backend/src/catalogos/catalogos.controller.ts#L56) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/cadastros/checklist` | [catalogos/catalogos.controller.ts:76](../backend/src/catalogos/catalogos.controller.ts#L76) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/cadastros/checklist/:id` | [catalogos/catalogos.controller.ts:82](../backend/src/catalogos/catalogos.controller.ts#L82) | JWT + perfis ...PERFIS_SISTEMA | DELETE |
| API | `/api/cadastros/checklist/reimportar` | [catalogos/catalogos.controller.ts:89](../backend/src/catalogos/catalogos.controller.ts#L89) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/cadastros/indice` | [catalogos/catalogos.controller.ts:101](../backend/src/catalogos/catalogos.controller.ts#L101) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/cadastros/indice` | [catalogos/catalogos.controller.ts:111](../backend/src/catalogos/catalogos.controller.ts#L111) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/cadastros/indice/:id` | [catalogos/catalogos.controller.ts:117](../backend/src/catalogos/catalogos.controller.ts#L117) | JWT + perfis ...PERFIS_SISTEMA | DELETE |
| API | `/api/cadastros/indice/reimportar` | [catalogos/catalogos.controller.ts:124](../backend/src/catalogos/catalogos.controller.ts#L124) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/cadastros/modelos` | [catalogos/catalogos.controller.ts:136](../backend/src/catalogos/catalogos.controller.ts#L136) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/cadastros/modelos/:id` | [catalogos/catalogos.controller.ts:144](../backend/src/catalogos/catalogos.controller.ts#L144) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/cadastros/modelos/:id/baixar` | [catalogos/catalogos.controller.ts:187](../backend/src/catalogos/catalogos.controller.ts#L187) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/cadastros/modelos/:id/campos` | [catalogos/catalogos.controller.ts:207](../backend/src/catalogos/catalogos.controller.ts#L207) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/cadastros/modelos/:id/campos/:campoId` | [catalogos/catalogos.controller.ts:216](../backend/src/catalogos/catalogos.controller.ts#L216) | JWT + perfis ...PERFIS_SISTEMA | DELETE |
| API | `/api/cadastros/modelos/:id/versao` | [catalogos/catalogos.controller.ts:157](../backend/src/catalogos/catalogos.controller.ts#L157) | JWT + perfis ...PERFIS_SISTEMA | POST |

### `clientes-sicla` — 2 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/clientes-sicla` | [clientes-sicla/clientes-sicla.controller.ts:30](../backend/src/clientes-sicla/clientes-sicla.controller.ts#L30) | JWT + menu `novo_cliente` | POST |
| API | `/api/clientes-sicla/buscar` | [clientes-sicla/clientes-sicla.controller.ts:23](../backend/src/clientes-sicla/clientes-sicla.controller.ts#L23) | JWT | GET |

### `contatos-sicla` — 3 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/contatos-sicla` | [contatos-sicla/contatos-sicla.controller.ts:25](../backend/src/contatos-sicla/contatos-sicla.controller.ts#L25) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/contatos-sicla/liberar` | [contatos-sicla/contatos-sicla.controller.ts:41](../backend/src/contatos-sicla/contatos-sicla.controller.ts#L41) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/contatos-sicla/revogar` | [contatos-sicla/contatos-sicla.controller.ts:50](../backend/src/contatos-sicla/contatos-sicla.controller.ts#L50) | JWT + perfis ...PERFIS_SISTEMA | POST |

### `controle-atividades` — 34 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/atividades/busca` | [controle-atividades/controle-atividades.controller.ts:404](../backend/src/controle-atividades/controle-atividades.controller.ts#L404) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | GET |
| API | `/api/atividades/cartoes` | [controle-atividades/controle-atividades.controller.ts:207](../backend/src/controle-atividades/controle-atividades.controller.ts#L207) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | POST |
| API | `/api/atividades/cartoes/:id` | [controle-atividades/controle-atividades.controller.ts:254](../backend/src/controle-atividades/controle-atividades.controller.ts#L254) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | DELETE |
| API | `/api/atividades/cartoes/:id` | [controle-atividades/controle-atividades.controller.ts:218](../backend/src/controle-atividades/controle-atividades.controller.ts#L218) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | PATCH |
| API | `/api/atividades/cartoes/:id/anexos` | [controle-atividades/controle-atividades.controller.ts:327](../backend/src/controle-atividades/controle-atividades.controller.ts#L327) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | POST |
| API | `/api/atividades/cartoes/:id/anexos/:anexoId` | [controle-atividades/controle-atividades.controller.ts:379](../backend/src/controle-atividades/controle-atividades.controller.ts#L379) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | DELETE |
| API | `/api/atividades/cartoes/:id/anexos/:anexoId` | [controle-atividades/controle-atividades.controller.ts:358](../backend/src/controle-atividades/controle-atividades.controller.ts#L358) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | GET |
| API | `/api/atividades/cartoes/:id/anexos/link` | [controle-atividades/controle-atividades.controller.ts:346](../backend/src/controle-atividades/controle-atividades.controller.ts#L346) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | POST |
| API | `/api/atividades/cartoes/:id/checklist` | [controle-atividades/controle-atividades.controller.ts:291](../backend/src/controle-atividades/controle-atividades.controller.ts#L291) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | POST |
| API | `/api/atividades/cartoes/:id/checklist/:itemId` | [controle-atividades/controle-atividades.controller.ts:314](../backend/src/controle-atividades/controle-atividades.controller.ts#L314) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | DELETE |
| API | `/api/atividades/cartoes/:id/checklist/:itemId` | [controle-atividades/controle-atividades.controller.ts:301](../backend/src/controle-atividades/controle-atividades.controller.ts#L301) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | PATCH |
| API | `/api/atividades/cartoes/:id/comentarios` | [controle-atividades/controle-atividades.controller.ts:392](../backend/src/controle-atividades/controle-atividades.controller.ts#L392) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | POST |
| API | `/api/atividades/cartoes/:id/membros` | [controle-atividades/controle-atividades.controller.ts:266](../backend/src/controle-atividades/controle-atividades.controller.ts#L266) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | POST |
| API | `/api/atividades/cartoes/:id/membros/:membroId` | [controle-atividades/controle-atividades.controller.ts:278](../backend/src/controle-atividades/controle-atividades.controller.ts#L278) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | DELETE |
| API | `/api/atividades/cartoes/:id/mover` | [controle-atividades/controle-atividades.controller.ts:228](../backend/src/controle-atividades/controle-atividades.controller.ts#L228) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | PATCH |
| API | `/api/atividades/cartoes/:id/visibilidade` | [controle-atividades/controle-atividades.controller.ts:242](../backend/src/controle-atividades/controle-atividades.controller.ts#L242) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | PATCH |
| API | `/api/atividades/clientes` | [controle-atividades/controle-atividades.controller.ts:506](../backend/src/controle-atividades/controle-atividades.controller.ts#L506) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | GET |
| API | `/api/atividades/consultores` | [controle-atividades/controle-atividades.controller.ts:500](../backend/src/controle-atividades/controle-atividades.controller.ts#L500) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | GET |
| API | `/api/atividades/contatos/:codigo` | [controle-atividades/controle-atividades.controller.ts:512](../backend/src/controle-atividades/controle-atividades.controller.ts#L512) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | GET |
| API | `/api/atividades/etiquetas` | [controle-atividades/controle-atividades.controller.ts:494](../backend/src/controle-atividades/controle-atividades.controller.ts#L494) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | GET |
| API | `/api/atividades/listas/:id` | [controle-atividades/controle-atividades.controller.ts:195](../backend/src/controle-atividades/controle-atividades.controller.ts#L195) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | DELETE |
| API | `/api/atividades/listas/:id` | [controle-atividades/controle-atividades.controller.ts:185](../backend/src/controle-atividades/controle-atividades.controller.ts#L185) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | PATCH |
| API | `/api/atividades/notificacoes` | [controle-atividades/controle-atividades.controller.ts:425](../backend/src/controle-atividades/controle-atividades.controller.ts#L425) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | GET |
| API | `/api/atividades/notificacoes/lidas` | [controle-atividades/controle-atividades.controller.ts:433](../backend/src/controle-atividades/controle-atividades.controller.ts#L433) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | POST |
| API | `/api/atividades/projetos-disponiveis` | [controle-atividades/controle-atividades.controller.ts:96](../backend/src/controle-atividades/controle-atividades.controller.ts#L96) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | GET |
| API | `/api/atividades/quadros` | [controle-atividades/controle-atividades.controller.ts:88](../backend/src/controle-atividades/controle-atividades.controller.ts#L88) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | GET |
| API | `/api/atividades/quadros` | [controle-atividades/controle-atividades.controller.ts:104](../backend/src/controle-atividades/controle-atividades.controller.ts#L104) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | POST |
| API | `/api/atividades/quadros/:codigo` | [controle-atividades/controle-atividades.controller.ts:122](../backend/src/controle-atividades/controle-atividades.controller.ts#L122) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | GET |
| API | `/api/atividades/quadros/:codigo/importar/trello` | [controle-atividades/controle-atividades.controller.ts:466](../backend/src/controle-atividades/controle-atividades.controller.ts#L466) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | POST |
| API | `/api/atividades/quadros/:codigo/importar/trello/previa` | [controle-atividades/controle-atividades.controller.ts:447](../backend/src/controle-atividades/controle-atividades.controller.ts#L447) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | POST |
| API | `/api/atividades/quadros/:codigo/listas` | [controle-atividades/controle-atividades.controller.ts:168](../backend/src/controle-atividades/controle-atividades.controller.ts#L168) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | POST |
| API | `/api/atividades/quadros/:codigo/responsaveis` | [controle-atividades/controle-atividades.controller.ts:131](../backend/src/controle-atividades/controle-atividades.controller.ts#L131) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | POST |
| API | `/api/atividades/quadros/:codigo/responsaveis/:usuarioId` | [controle-atividades/controle-atividades.controller.ts:142](../backend/src/controle-atividades/controle-atividades.controller.ts#L142) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | DELETE |
| API | `/api/atividades/quadros/:codigo/responsaveis/sincronizar` | [controle-atividades/controle-atividades.controller.ts:153](../backend/src/controle-atividades/controle-atividades.controller.ts#L153) | JWT + menu `MENU_CONTROLE_ATIVIDADES` | POST |

### `cronograma` — 26 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/projetos/:projetoId/agenda/acompanhamento` | [cronograma/cronograma.controller.ts:442](../backend/src/cronograma/cronograma.controller.ts#L442) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | GET |
| API | `/api/projetos/:projetoId/agenda/alocar-visita` | [cronograma/cronograma.controller.ts:288](../backend/src/cronograma/cronograma.controller.ts#L288) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | POST |
| API | `/api/projetos/:projetoId/agenda/alocar/:atividadeId` | [cronograma/cronograma.controller.ts:246](../backend/src/cronograma/cronograma.controller.ts#L246) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | POST |
| API | `/api/projetos/:projetoId/agenda/atividades` | [cronograma/cronograma.controller.ts:67](../backend/src/cronograma/cronograma.controller.ts#L67) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | GET |
| API | `/api/projetos/:projetoId/agenda/atividades/:atividadeId` | [cronograma/cronograma.controller.ts:423](../backend/src/cronograma/cronograma.controller.ts#L423) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | DELETE |
| API | `/api/projetos/:projetoId/agenda/atividades/:atividadeId/status` | [cronograma/cronograma.controller.ts:363](../backend/src/cronograma/cronograma.controller.ts#L363) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | PUT |
| API | `/api/projetos/:projetoId/agenda/bloqueios` | [cronograma/cronograma.controller.ts:224](../backend/src/cronograma/cronograma.controller.ts#L224) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | GET |
| API | `/api/projetos/:projetoId/agenda/config` | [cronograma/cronograma.controller.ts:143](../backend/src/cronograma/cronograma.controller.ts#L143) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | GET |
| API | `/api/projetos/:projetoId/agenda/config` | [cronograma/cronograma.controller.ts:152](../backend/src/cronograma/cronograma.controller.ts#L152) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | PUT |
| API | `/api/projetos/:projetoId/agenda/desfazer-tudo` | [cronograma/cronograma.controller.ts:340](../backend/src/cronograma/cronograma.controller.ts#L340) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | POST |
| API | `/api/projetos/:projetoId/agenda/designacoes` | [cronograma/cronograma.controller.ts:84](../backend/src/cronograma/cronograma.controller.ts#L84) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | GET |
| API | `/api/projetos/:projetoId/agenda/designacoes` | [cronograma/cronograma.controller.ts:100](../backend/src/cronograma/cronograma.controller.ts#L100) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | PUT |
| API | `/api/projetos/:projetoId/agenda/distribuir` | [cronograma/cronograma.controller.ts:322](../backend/src/cronograma/cronograma.controller.ts#L322) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | POST |
| API | `/api/projetos/:projetoId/agenda/gerar` | [cronograma/cronograma.controller.ts:470](../backend/src/cronograma/cronograma.controller.ts#L470) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | POST |
| API | `/api/projetos/:projetoId/agenda/horarios` | [cronograma/cronograma.controller.ts:121](../backend/src/cronograma/cronograma.controller.ts#L121) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | GET |
| API | `/api/projetos/:projetoId/agenda/horarios` | [cronograma/cronograma.controller.ts:127](../backend/src/cronograma/cronograma.controller.ts#L127) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | PUT |
| API | `/api/projetos/:projetoId/agenda/periodos` | [cronograma/cronograma.controller.ts:170](../backend/src/cronograma/cronograma.controller.ts#L170) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | GET |
| API | `/api/projetos/:projetoId/agenda/periodos` | [cronograma/cronograma.controller.ts:178](../backend/src/cronograma/cronograma.controller.ts#L178) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | POST |
| API | `/api/projetos/:projetoId/agenda/periodos/:periodoId` | [cronograma/cronograma.controller.ts:200](../backend/src/cronograma/cronograma.controller.ts#L200) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | DELETE |
| API | `/api/projetos/:projetoId/agenda/postergar` | [cronograma/cronograma.controller.ts:382](../backend/src/cronograma/cronograma.controller.ts#L382) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | POST |
| API | `/api/projetos/:projetoId/agenda/postergar-visita` | [cronograma/cronograma.controller.ts:400](../backend/src/cronograma/cronograma.controller.ts#L400) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | POST |
| API | `/api/projetos/:projetoId/agenda/prontidao` | [cronograma/cronograma.controller.ts:215](../backend/src/cronograma/cronograma.controller.ts#L215) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | GET |
| API | `/api/projetos/:projetoId/agenda/redistribuir` | [cronograma/cronograma.controller.ts:331](../backend/src/cronograma/cronograma.controller.ts#L331) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | POST |
| API | `/api/projetos/:projetoId/agenda/reorganizar-modulo` | [cronograma/cronograma.controller.ts:350](../backend/src/cronograma/cronograma.controller.ts#L350) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | POST |
| API | `/api/projetos/:projetoId/agenda/tecnicos` | [cronograma/cronograma.controller.ts:90](../backend/src/cronograma/cronograma.controller.ts#L90) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | GET |
| API | `/api/projetos/:projetoId/agenda/visitas` | [cronograma/cronograma.controller.ts:77](../backend/src/cronograma/cronograma.controller.ts#L77) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | GET |

### `dados` — 33 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/config/consultas-bd` | [dados/config-consultas-bd.controller.ts:46](../backend/src/dados/config-consultas-bd.controller.ts#L46) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/config/consultas-bd` | [dados/config-consultas-bd.controller.ts:60](../backend/src/dados/config-consultas-bd.controller.ts#L60) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/config/consultas-bd/:slug` | [dados/config-consultas-bd.controller.ts:52](../backend/src/dados/config-consultas-bd.controller.ts#L52) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/config/consultas-bd/:slug` | [dados/config-consultas-bd.controller.ts:81](../backend/src/dados/config-consultas-bd.controller.ts#L81) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/config/consultas-bd/:slug/excluir` | [dados/config-consultas-bd.controller.ts:93](../backend/src/dados/config-consultas-bd.controller.ts#L93) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/config/consultas-bd/:slug/testar` | [dados/config-consultas-bd.controller.ts:102](../backend/src/dados/config-consultas-bd.controller.ts#L102) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/dados/v1/admin/cache/limpar` | [dados/dados-admin.controller.ts:224](../backend/src/dados/dados-admin.controller.ts#L224) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/dados/v1/admin/clientes` | [dados/dados-admin.controller.ts:155](../backend/src/dados/dados-admin.controller.ts#L155) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/dados/v1/admin/clientes` | [dados/dados-admin.controller.ts:169](../backend/src/dados/dados-admin.controller.ts#L169) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/dados/v1/admin/clientes/:id` | [dados/dados-admin.controller.ts:209](../backend/src/dados/dados-admin.controller.ts#L209) | JWT + perfis ...PERFIS_SISTEMA | DELETE |
| API | `/api/dados/v1/admin/clientes/:id` | [dados/dados-admin.controller.ts:181](../backend/src/dados/dados-admin.controller.ts#L181) | JWT + perfis ...PERFIS_SISTEMA | PATCH |
| API | `/api/dados/v1/admin/clientes/:id/ativo` | [dados/dados-admin.controller.ts:190](../backend/src/dados/dados-admin.controller.ts#L190) | JWT + perfis ...PERFIS_SISTEMA | PATCH |
| API | `/api/dados/v1/admin/clientes/:id/rotacionar` | [dados/dados-admin.controller.ts:199](../backend/src/dados/dados-admin.controller.ts#L199) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/dados/v1/admin/clientes/consultas-disponiveis` | [dados/dados-admin.controller.ts:161](../backend/src/dados/dados-admin.controller.ts#L161) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/dados/v1/admin/conexoes` | [dados/dados-admin.controller.ts:63](../backend/src/dados/dados-admin.controller.ts#L63) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/dados/v1/admin/conexoes/:chave` | [dados/dados-admin.controller.ts:71](../backend/src/dados/dados-admin.controller.ts#L71) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/dados/v1/admin/conexoes/:chave/testar` | [dados/dados-admin.controller.ts:85](../backend/src/dados/dados-admin.controller.ts#L85) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/dados/v1/admin/consultas` | [dados/dados-admin.controller.ts:107](../backend/src/dados/dados-admin.controller.ts#L107) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/dados/v1/admin/consultas` | [dados/dados-admin.controller.ts:133](../backend/src/dados/dados-admin.controller.ts#L133) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/dados/v1/admin/consultas/:slug` | [dados/dados-admin.controller.ts:147](../backend/src/dados/dados-admin.controller.ts#L147) | JWT + perfis ...PERFIS_SISTEMA | DELETE |
| API | `/api/dados/v1/admin/consultas/:slug` | [dados/dados-admin.controller.ts:113](../backend/src/dados/dados-admin.controller.ts#L113) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/dados/v1/admin/consultas/analisar` | [dados/dados-admin.controller.ts:121](../backend/src/dados/dados-admin.controller.ts#L121) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/dados/v1/admin/metricas` | [dados/dados-admin.controller.ts:218](../backend/src/dados/dados-admin.controller.ts#L218) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/dados/v1/conexoes` | [dados/dados.controller.ts:52](../backend/src/dados/dados.controller.ts#L52) | **pública** | GET |
| API | `/api/dados/v1/consultas` | [dados/dados.controller.ts:40](../backend/src/dados/dados.controller.ts#L40) | **pública** | GET |
| API | `/api/dados/v1/consultas/:nome` | [dados/dados.controller.ts:60](../backend/src/dados/dados.controller.ts#L60) | **pública** | GET |
| API | `/api/dados/v1/consultas/:nome/executar` | [dados/dados.controller.ts:66](../backend/src/dados/dados.controller.ts#L66) | **pública** | POST |
| API | `/api/dados/v1/tokens` | [dados/consumo/tokens-api.controller.ts:50](../backend/src/dados/consumo/tokens-api.controller.ts#L50) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/dados/v1/tokens` | [dados/consumo/tokens-api.controller.ts:81](../backend/src/dados/consumo/tokens-api.controller.ts#L81) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/dados/v1/tokens/:id` | [dados/consumo/tokens-api.controller.ts:111](../backend/src/dados/consumo/tokens-api.controller.ts#L111) | JWT + perfis ...PERFIS_SISTEMA | DELETE |
| API | `/api/dados/v1/tokens/:id` | [dados/consumo/tokens-api.controller.ts:89](../backend/src/dados/consumo/tokens-api.controller.ts#L89) | JWT + perfis ...PERFIS_SISTEMA | PUT |
| API | `/api/dados/v1/tokens/:id/ativo` | [dados/consumo/tokens-api.controller.ts:100](../backend/src/dados/consumo/tokens-api.controller.ts#L100) | JWT + perfis ...PERFIS_SISTEMA | PATCH |
| API | `/api/dados/v1/tokens/sondar` | [dados/consumo/tokens-api.controller.ts:71](../backend/src/dados/consumo/tokens-api.controller.ts#L71) | JWT + perfis ...PERFIS_SISTEMA | POST |

### `designacao` — 6 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/projetos/:id/agendar` | [designacao/designacao.controller.ts:67](../backend/src/designacao/designacao.controller.ts#L67) | JWT + perfis ...PERFIS_DEFINE_GCI | GET |
| API | `/api/projetos/:id/agendar` | [designacao/designacao.controller.ts:76](../backend/src/designacao/designacao.controller.ts#L76) | JWT + perfis ...PERFIS_AGENDAMENTO | POST |
| API | `/api/projetos/:id/consultores` | [designacao/designacao.controller.ts:98](../backend/src/designacao/designacao.controller.ts#L98) | JWT + perfis ...PERFIS_AGENDAMENTO | GET |
| API | `/api/projetos/:id/consultores` | [designacao/designacao.controller.ts:107](../backend/src/designacao/designacao.controller.ts#L107) | JWT + perfis ...PERFIS_DESIGNA_CONSULTORES | POST |
| API | `/api/projetos/:id/definir-gci` | [designacao/designacao.controller.ts:42](../backend/src/designacao/designacao.controller.ts#L42) | JWT | GET |
| API | `/api/projetos/:id/definir-gci` | [designacao/designacao.controller.ts:51](../backend/src/designacao/designacao.controller.ts#L51) | JWT + perfis ...PERFIS_DEFINE_GCI | POST |

### `disponibilidade` — 2 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/dashboards` | [disponibilidade/dashboards.controller.ts:20](../backend/src/disponibilidade/dashboards.controller.ts#L20) | JWT + menu `dashboards` | GET |
| API | `/api/dashboards/:slug` | [disponibilidade/dashboards.controller.ts:31](../backend/src/disponibilidade/dashboards.controller.ts#L31) | JWT + menu `dashboards` | GET |

### `documentos` — 10 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/documentos/:id` | [documentos/documentos.controller.ts:191](../backend/src/documentos/documentos.controller.ts#L191) | JWT + menu `carteira` (alteracao) | DELETE |
| API | `/api/documentos/:id/baixar` | [documentos/documentos.controller.ts:205](../backend/src/documentos/documentos.controller.ts#L205) | JWT + menu `carteira` (alteracao) | GET |
| API | `/api/documentos/:id/preview` | [documentos/documentos.controller.ts:215](../backend/src/documentos/documentos.controller.ts#L215) | JWT | GET |
| API | `/api/projetos/:projetoId/anexar` | [documentos/documentos.controller.ts:160](../backend/src/documentos/documentos.controller.ts#L160) | JWT + menu `carteira` (alteracao) | POST |
| API | `/api/projetos/:projetoId/avancar` | [documentos/documentos.controller.ts:126](../backend/src/documentos/documentos.controller.ts#L126) | JWT | POST |
| API | `/api/projetos/:projetoId/cabecalho` | [documentos/documentos.controller.ts:117](../backend/src/documentos/documentos.controller.ts#L117) | JWT | GET |
| API | `/api/projetos/:projetoId/documentos` | [documentos/documentos.controller.ts:105](../backend/src/documentos/documentos.controller.ts#L105) | JWT | GET |
| API | `/api/projetos/:projetoId/eventos` | [documentos/documentos.controller.ts:111](../backend/src/documentos/documentos.controller.ts#L111) | JWT | GET |
| API | `/api/projetos/:projetoId/gerar-layout/:slug` | [documentos/documentos.controller.ts:240](../backend/src/documentos/documentos.controller.ts#L240) | JWT | POST |
| API | `/api/projetos/:projetoId/nota` | [documentos/documentos.controller.ts:141](../backend/src/documentos/documentos.controller.ts#L141) | JWT + menu `carteira` (alteracao) | POST |

### `email` — 10 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/config/email` | [email/config-email.controller.ts:29](../backend/src/email/config-email.controller.ts#L29) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/config/email` | [email/config-email.controller.ts:38](../backend/src/email/config-email.controller.ts#L38) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/config/graph` | [email/config-graph.controller.ts:30](../backend/src/email/config-graph.controller.ts#L30) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/config/graph` | [email/config-graph.controller.ts:45](../backend/src/email/config-graph.controller.ts#L45) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/config/modelos-email` | [email/modelo-email.controller.ts:33](../backend/src/email/modelo-email.controller.ts#L33) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/config/modelos-email` | [email/modelo-email.controller.ts:46](../backend/src/email/modelo-email.controller.ts#L46) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/config/modelos-email/:id` | [email/modelo-email.controller.ts:40](../backend/src/email/modelo-email.controller.ts#L40) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/config/modelos-email/:id` | [email/modelo-email.controller.ts:56](../backend/src/email/modelo-email.controller.ts#L56) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/config/modelos-email/:id/excluir` | [email/modelo-email.controller.ts:69](../backend/src/email/modelo-email.controller.ts#L69) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/config/modelos-email/:id/toggle` | [email/modelo-email.controller.ts:80](../backend/src/email/modelo-email.controller.ts#L80) | JWT + perfis ...PERFIS_SISTEMA | POST |

### `fluxo` — 8 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/config/imap` | [fluxo/config-imap.controller.ts:29](../backend/src/fluxo/config-imap.controller.ts#L29) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/config/imap` | [fluxo/config-imap.controller.ts:44](../backend/src/fluxo/config-imap.controller.ts#L44) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/fluxo` | [fluxo/fluxo.controller.ts:42](../backend/src/fluxo/fluxo.controller.ts#L42) | JWT | GET |
| API | `/api/fluxo/criar` | [fluxo/fluxo.controller.ts:90](../backend/src/fluxo/fluxo.controller.ts#L90) | JWT + menu `novo_cliente` (alteracao) | POST |
| API | `/api/fluxo/inbox` | [fluxo/fluxo.controller.ts:67](../backend/src/fluxo/fluxo.controller.ts#L67) | JWT | POST |
| API | `/api/fluxo/parse` | [fluxo/fluxo.controller.ts:55](../backend/src/fluxo/fluxo.controller.ts#L55) | JWT | POST |
| API | `/api/projetos/:projetoId/email` | [fluxo/projeto-email.controller.ts:39](../backend/src/fluxo/projeto-email.controller.ts#L39) | JWT | GET |
| API | `/api/projetos/:projetoId/email` | [fluxo/projeto-email.controller.ts:49](../backend/src/fluxo/projeto-email.controller.ts#L49) | JWT + menu `carteira` (consulta) | POST |

### `health` — 2 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/health` | [health/health.controller.ts:17](../backend/src/health/health.controller.ts#L17) | **pública** | GET |
| API | `/api/instancia` | [health/health.controller.ts:35](../backend/src/health/health.controller.ts#L35) | **pública** | GET |

### `ia` — 3 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/config/ia` | [ia/ia.controller.ts:32](../backend/src/ia/ia.controller.ts#L32) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/config/ia` | [ia/ia.controller.ts:51](../backend/src/ia/ia.controller.ts#L51) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/config/ia/modelos-openrouter` | [ia/ia.controller.ts:43](../backend/src/ia/ia.controller.ts#L43) | JWT + perfis ...PERFIS_SISTEMA | GET |

### `ia-telemetria` — 1 rota

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/ia/telemetria` | [ia-telemetria/ia-telemetria.controller.ts:19](../backend/src/ia-telemetria/ia-telemetria.controller.ts#L19) | JWT | GET |

### `legado` — 11 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/legado/baixar/:token` | [legado/legado.controller.ts:186](../backend/src/legado/legado.controller.ts#L186) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/legado/catalogo` | [legado/legado.controller.ts:69](../backend/src/legado/legado.controller.ts#L69) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/legado/cliente` | [legado/legado.controller.ts:77](../backend/src/legado/legado.controller.ts#L77) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/legado/criar-templates` | [legado/legado.controller.ts:86](../backend/src/legado/legado.controller.ts#L86) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/legado/form-modulos` | [legado/legado.controller.ts:128](../backend/src/legado/legado.controller.ts#L128) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/legado/gerar` | [legado/legado.controller.ts:164](../backend/src/legado/legado.controller.ts#L164) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/legado/ia-status` | [legado/legado.controller.ts:52](../backend/src/legado/legado.controller.ts#L52) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/legado/importar` | [legado/legado.controller.ts:144](../backend/src/legado/legado.controller.ts#L144) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/legado/saude` | [legado/legado.controller.ts:60](../backend/src/legado/legado.controller.ts#L60) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/legado/verbal/docx` | [legado/legado.controller.ts:105](../backend/src/legado/legado.controller.ts#L105) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/legado/verbal/texto` | [legado/legado.controller.ts:96](../backend/src/legado/legado.controller.ts#L96) | JWT + perfis ...PERFIS_SISTEMA | POST |

### `levantamento` — 9 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/projetos/:projetoId/doc-conteudo/:doc` | [levantamento/levantamento.controller.ts:172](../backend/src/levantamento/levantamento.controller.ts#L172) | JWT + perfis ...PERFIS_GERA_LEVANTAMENTO | GET |
| API | `/api/projetos/:projetoId/doc-conteudo/:doc` | [levantamento/levantamento.controller.ts:184](../backend/src/levantamento/levantamento.controller.ts#L184) | JWT + perfis ...PERFIS_GERA_LEVANTAMENTO | PUT |
| API | `/api/projetos/:projetoId/levantamento` | [levantamento/levantamento.controller.ts:46](../backend/src/levantamento/levantamento.controller.ts#L46) | JWT + perfis ...PERFIS_GERA_LEVANTAMENTO | GET |
| API | `/api/projetos/:projetoId/levantamento` | [levantamento/levantamento.controller.ts:60](../backend/src/levantamento/levantamento.controller.ts#L60) | JWT + perfis ...PERFIS_GERA_LEVANTAMENTO | PUT |
| API | `/api/projetos/:projetoId/levantamento/:linhaId` | [levantamento/levantamento.controller.ts:74](../backend/src/levantamento/levantamento.controller.ts#L74) | JWT + perfis ...PERFIS_GERA_LEVANTAMENTO | PATCH |
| API | `/api/projetos/:projetoId/levantamento/gravacoes` | [levantamento/levantamento.controller.ts:95](../backend/src/levantamento/levantamento.controller.ts#L95) | JWT + perfis ...PERFIS_GERA_LEVANTAMENTO | GET |
| API | `/api/projetos/:projetoId/levantamento/presenca` | [levantamento/levantamento.controller.ts:162](../backend/src/levantamento/levantamento.controller.ts#L162) | JWT + perfis ...PERFIS_GERA_LEVANTAMENTO | DELETE |
| API | `/api/projetos/:projetoId/levantamento/sincronizar` | [levantamento/levantamento.controller.ts:129](../backend/src/levantamento/levantamento.controller.ts#L129) | JWT + perfis ...PERFIS_GERA_LEVANTAMENTO | POST |
| API | `/api/projetos/:projetoId/levantamento/sugerir` | [levantamento/levantamento.controller.ts:109](../backend/src/levantamento/levantamento.controller.ts#L109) | JWT + perfis ...PERFIS_GERA_LEVANTAMENTO | POST |

### `matriz` — 4 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/matriz` | [matriz/matriz.controller.ts:68](../backend/src/matriz/matriz.controller.ts#L68) | JWT + menu `matriz` | GET |
| API | `/api/matriz/:id` | [matriz/matriz.controller.ts:101](../backend/src/matriz/matriz.controller.ts#L101) | JWT + menu `matriz` | GET |
| API | `/api/matriz/:id/salvar` | [matriz/matriz.controller.ts:130](../backend/src/matriz/matriz.controller.ts#L130) | JWT + menu `matriz` | POST |
| API | `/api/matriz/importar` | [matriz/matriz.controller.ts:157](../backend/src/matriz/matriz.controller.ts#L157) | JWT + menu `matriz` | POST |

### `matriz-detalhada` — 3 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/matriz-detalhada` | [matriz-detalhada/matriz-detalhada.controller.ts:64](../backend/src/matriz-detalhada/matriz-detalhada.controller.ts#L64) | JWT + menu `matriz_detalhada` | GET |
| API | `/api/matriz-detalhada/:id` | [matriz-detalhada/matriz-detalhada.controller.ts:95](../backend/src/matriz-detalhada/matriz-detalhada.controller.ts#L95) | JWT + menu `matriz_detalhada` | GET |
| API | `/api/matriz-detalhada/:id/salvar` | [matriz-detalhada/matriz-detalhada.controller.ts:116](../backend/src/matriz-detalhada/matriz-detalhada.controller.ts#L116) | JWT + menu `matriz_detalhada` | POST |

### `matriz-funcoes` — 4 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/matriz-funcoes` | [matriz-funcoes/matriz-funcoes.controller.ts:76](../backend/src/matriz-funcoes/matriz-funcoes.controller.ts#L76) | JWT + menu `matriz_funcoes` | GET |
| API | `/api/matriz-funcoes/:id` | [matriz-funcoes/matriz-funcoes.controller.ts:126](../backend/src/matriz-funcoes/matriz-funcoes.controller.ts#L126) | JWT + menu `matriz_funcoes` | GET |
| API | `/api/matriz-funcoes/:id/salvar` | [matriz-funcoes/matriz-funcoes.controller.ts:151](../backend/src/matriz-funcoes/matriz-funcoes.controller.ts#L151) | JWT + menu `matriz_funcoes` | POST |
| API | `/api/matriz-funcoes/recarregar` | [matriz-funcoes/matriz-funcoes.controller.ts:106](../backend/src/matriz-funcoes/matriz-funcoes.controller.ts#L106) | JWT + menu `matriz_funcoes` | POST |

### `modulos-sicla` — 1 rota

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/modulos-sicla/buscar` | [modulos-sicla/modulos-sicla.controller.ts:17](../backend/src/modulos-sicla/modulos-sicla.controller.ts#L17) | JWT | GET |

### `painel` — 6 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/painel/atividade` | [painel/painel.controller.ts:85](../backend/src/painel/painel.controller.ts#L85) | JWT + menu `coordenacao` | GET |
| API | `/api/painel/coordenacao` | [painel/painel.controller.ts:54](../backend/src/painel/painel.controller.ts#L54) | JWT | GET |
| API | `/api/painel/coordenacao/capacidade` | [painel/painel.controller.ts:63](../backend/src/painel/painel.controller.ts#L63) | JWT + menu `coordenacao` | GET |
| API | `/api/painel/coordenacao/digest` | [painel/painel.controller.ts:94](../backend/src/painel/painel.controller.ts#L94) | JWT + menu `atividade` | POST |
| API | `/api/painel/home` | [painel/painel.controller.ts:45](../backend/src/painel/painel.controller.ts#L45) | JWT | GET |
| API | `/api/painel/monitoramento` | [painel/painel.controller.ts:105](../backend/src/painel/painel.controller.ts#L105) | JWT + menu `coordenacao` (alteracao) | GET |

### `passos` — 21 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/config/destinatarios-passo` | [passos/destinatarios-passo.controller.ts:31](../backend/src/passos/destinatarios-passo.controller.ts#L31) | JWT + perfis ADM | GET |
| API | `/api/config/destinatarios-passo/:passo` | [passos/destinatarios-passo.controller.ts:52](../backend/src/passos/destinatarios-passo.controller.ts#L52) | JWT + perfis ADM | DELETE |
| API | `/api/config/destinatarios-passo/:passo` | [passos/destinatarios-passo.controller.ts:43](../backend/src/passos/destinatarios-passo.controller.ts#L43) | JWT + perfis ADM | PUT |
| API | `/api/passos/atuais` | [passos/passos-painel.controller.ts:48](../backend/src/passos/passos-painel.controller.ts#L48) | JWT | GET |
| API | `/api/passos/grade` | [passos/passos-painel.controller.ts:57](../backend/src/passos/passos-painel.controller.ts#L57) | JWT | GET |
| API | `/api/passos/pessoas-por-papel/:papel` | [passos/passos-painel.controller.ts:33](../backend/src/passos/passos-painel.controller.ts#L33) | JWT | GET |
| API | `/api/projetos/:id/emails` | [passos/passos.controller.ts:116](../backend/src/passos/passos.controller.ts#L116) | JWT + menu `carteira` | GET |
| API | `/api/projetos/:id/emails/:emailId/reenviar` | [passos/passos.controller.ts:126](../backend/src/passos/passos.controller.ts#L126) | JWT + menu `carteira` | POST |
| API | `/api/projetos/:id/passos` | [passos/passos.controller.ts:54](../backend/src/passos/passos.controller.ts#L54) | JWT + menu `carteira` | GET |
| API | `/api/projetos/:id/passos/:numero` | [passos/passos.controller.ts:157](../backend/src/passos/passos.controller.ts#L157) | JWT + menu `carteira` | DELETE |
| API | `/api/projetos/:id/passos/:numero/anexar-email` | [passos/passos.controller.ts:171](../backend/src/passos/passos.controller.ts#L171) | JWT + menu `carteira` | POST |
| API | `/api/projetos/:id/passos/:numero/anexo-email` | [passos/passos.controller.ts:197](../backend/src/passos/passos.controller.ts#L197) | JWT + menu `carteira` | POST |
| API | `/api/projetos/:id/passos/:numero/concluir` | [passos/passos.controller.ts:78](../backend/src/passos/passos.controller.ts#L78) | JWT + menu `carteira` | POST |
| API | `/api/projetos/:id/passos/:numero/conferir` | [passos/passos.controller.ts:143](../backend/src/passos/passos.controller.ts#L143) | JWT + menu `carteira` | POST |
| API | `/api/projetos/:id/passos/:numero/email` | [passos/passos.controller.ts:98](../backend/src/passos/passos.controller.ts#L98) | JWT + menu `carteira` | GET |
| API | `/api/projetos/:id/pessoas` | [passos/passos.controller.ts:220](../backend/src/passos/passos.controller.ts#L220) | JWT + menu `carteira` | GET |
| API | `/api/projetos/:id/pessoas` | [passos/passos.controller.ts:230](../backend/src/passos/passos.controller.ts#L230) | JWT + menu `carteira` | PATCH |
| API | `/api/projetos/:id/rns` | [passos/passos.controller.ts:257](../backend/src/passos/passos.controller.ts#L257) | JWT + menu `carteira` + perfis ADM,Coordenador,Administrativo | GET |
| API | `/api/projetos/:id/rns` | [passos/passos.controller.ts:264](../backend/src/passos/passos.controller.ts#L264) | JWT + menu `carteira` | POST |
| API | `/api/projetos/:id/rns/:rnsId` | [passos/passos.controller.ts:284](../backend/src/passos/passos.controller.ts#L284) | JWT + menu `carteira` + perfis ...PERFIS_AGENDAMENTO | DELETE |
| API | `/api/projetos/:id/rns/:rnsId` | [passos/passos.controller.ts:272](../backend/src/passos/passos.controller.ts#L272) | JWT + menu `carteira` + perfis ...PERFIS_AGENDAMENTO | PATCH |

### `permissoes` — 4 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/permissoes` | [permissoes/permissoes.controller.ts:46](../backend/src/permissoes/permissoes.controller.ts#L46) | JWT | GET |
| API | `/api/permissoes/me` | [permissoes/permissoes.controller.ts:38](../backend/src/permissoes/permissoes.controller.ts#L38) | JWT | GET |
| API | `/api/permissoes/papel` | [permissoes/permissoes.controller.ts:63](../backend/src/permissoes/permissoes.controller.ts#L63) | JWT + menu `permissoes` | PUT |
| API | `/api/permissoes/usuario` | [permissoes/permissoes.controller.ts:72](../backend/src/permissoes/permissoes.controller.ts#L72) | JWT + menu `permissoes` (alteracao) | PUT |

### `plano-cronograma` — 6 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/projetos/:id/checklist` | [plano-cronograma/plano-cronograma.controller.ts:86](../backend/src/plano-cronograma/plano-cronograma.controller.ts#L86) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | GET |
| API | `/api/projetos/:id/checklist` | [plano-cronograma/plano-cronograma.controller.ts:92](../backend/src/plano-cronograma/plano-cronograma.controller.ts#L92) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | POST |
| API | `/api/projetos/:id/checklist/seed` | [plano-cronograma/plano-cronograma.controller.ts:108](../backend/src/plano-cronograma/plano-cronograma.controller.ts#L108) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | POST |
| API | `/api/projetos/:id/cronograma` | [plano-cronograma/plano-cronograma.controller.ts:49](../backend/src/plano-cronograma/plano-cronograma.controller.ts#L49) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | GET |
| API | `/api/projetos/:id/cronograma` | [plano-cronograma/plano-cronograma.controller.ts:55](../backend/src/plano-cronograma/plano-cronograma.controller.ts#L55) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | POST |
| API | `/api/projetos/:id/cronograma/seed` | [plano-cronograma/plano-cronograma.controller.ts:71](../backend/src/plano-cronograma/plano-cronograma.controller.ts#L71) | JWT + perfis ...PERFIS_GERA_CRONOGRAMA | POST |

### `preferencias` — 3 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/preferencias` | [preferencias/preferencias.controller.ts:33](../backend/src/preferencias/preferencias.controller.ts#L33) | JWT | GET |
| API | `/api/preferencias/:chave` | [preferencias/preferencias.controller.ts:55](../backend/src/preferencias/preferencias.controller.ts#L55) | JWT | DELETE |
| API | `/api/preferencias/:chave` | [preferencias/preferencias.controller.ts:43](../backend/src/preferencias/preferencias.controller.ts#L43) | JWT | PUT |

### `presenca` — 4 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/presenca` | [presenca/presenca.controller.ts:61](../backend/src/presenca/presenca.controller.ts#L61) | JWT | GET |
| API | `/api/presenca/ping` | [presenca/presenca.controller.ts:35](../backend/src/presenca/presenca.controller.ts#L35) | JWT | POST |
| API | `/api/presenca/quantos` | [presenca/presenca.controller.ts:70](../backend/src/presenca/presenca.controller.ts#L70) | JWT + perfis ADM | GET |
| API | `/api/presenca/sair` | [presenca/presenca.controller.ts:51](../backend/src/presenca/presenca.controller.ts#L51) | JWT | POST |

### `projetos` — 5 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/projetos` | [projetos/projetos.controller.ts:38](../backend/src/projetos/projetos.controller.ts#L38) | JWT + menu `carteira` | GET |
| API | `/api/projetos` | [projetos/projetos.controller.ts:57](../backend/src/projetos/projetos.controller.ts#L57) | JWT + menu `carteira` | POST |
| API | `/api/projetos/:id` | [projetos/projetos.controller.ts:84](../backend/src/projetos/projetos.controller.ts#L84) | JWT + menu `carteira` | DELETE |
| API | `/api/projetos/:id` | [projetos/projetos.controller.ts:51](../backend/src/projetos/projetos.controller.ts#L51) | JWT + menu `carteira` | GET |
| API | `/api/projetos/:id` | [projetos/projetos.controller.ts:73](../backend/src/projetos/projetos.controller.ts#L73) | JWT + menu `carteira` + perfis ...PERFIS_DESIGNA | PUT |

### `prontidao` — 1 rota

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/prontidao` | [prontidao/prontidao.controller.ts:22](../backend/src/prontidao/prontidao.controller.ts#L22) | JWT | GET |

### `protocolos` — 25 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/protocolos` | [protocolos/protocolos.controller.ts:87](../backend/src/protocolos/protocolos.controller.ts#L87) | JWT + menu `protocolos` | GET |
| API | `/api/protocolos/:id` | [protocolos/protocolos.controller.ts:488](../backend/src/protocolos/protocolos.controller.ts#L488) | JWT + menu `protocolos` + perfis ...PERFIS_APROVA_PROTOCOLO | DELETE |
| API | `/api/protocolos/:id` | [protocolos/protocolos.controller.ts:331](../backend/src/protocolos/protocolos.controller.ts#L331) | JWT + menu `protocolos` | GET |
| API | `/api/protocolos/:id/aprovar` | [protocolos/protocolos.controller.ts:456](../backend/src/protocolos/protocolos.controller.ts#L456) | JWT + menu `protocolos` | POST |
| API | `/api/protocolos/:id/cancelar` | [protocolos/protocolos.controller.ts:440](../backend/src/protocolos/protocolos.controller.ts#L440) | JWT + menu `protocolos` | POST |
| API | `/api/protocolos/:id/enviar-portal` | [protocolos/protocolos.controller.ts:575](../backend/src/protocolos/protocolos.controller.ts#L575) | JWT + menu `protocolos` | POST |
| API | `/api/protocolos/:id/locutores` | [protocolos/protocolos.controller.ts:359](../backend/src/protocolos/protocolos.controller.ts#L359) | JWT + menu `protocolos` | POST |
| API | `/api/protocolos/:id/processar` | [protocolos/protocolos.controller.ts:415](../backend/src/protocolos/protocolos.controller.ts#L415) | JWT + menu `protocolos` | POST |
| API | `/api/protocolos/:id/rascunho-visita` | [protocolos/protocolos.controller.ts:540](../backend/src/protocolos/protocolos.controller.ts#L540) | JWT + menu `protocolos` | GET |
| API | `/api/protocolos/:id/reprovar` | [protocolos/protocolos.controller.ts:472](../backend/src/protocolos/protocolos.controller.ts#L472) | JWT + menu `protocolos` + perfis ...PERFIS_APROVA_PROTOCOLO | POST |
| API | `/api/protocolos/:id/salvar` | [protocolos/protocolos.controller.ts:400](../backend/src/protocolos/protocolos.controller.ts#L400) | JWT + menu `protocolos` | POST |
| API | `/api/protocolos/:id/status` | [protocolos/protocolos.controller.ts:512](../backend/src/protocolos/protocolos.controller.ts#L512) | JWT + menu `protocolos` + perfis ...PERFIS_APROVA_PROTOCOLO | GET |
| API | `/api/protocolos/:id/video` | [protocolos/protocolos-midia.controller.ts:51](../backend/src/protocolos/protocolos-midia.controller.ts#L51) | **pública** | GET |
| API | `/api/protocolos/:id/video-ticket` | [protocolos/protocolos.controller.ts:630](../backend/src/protocolos/protocolos.controller.ts#L630) | JWT + menu `protocolos` | GET |
| API | `/api/protocolos/clientes` | [protocolos/protocolos.controller.ts:183](../backend/src/protocolos/protocolos.controller.ts#L183) | JWT + menu `protocolos` | GET |
| API | `/api/protocolos/clientes-com-protocolo` | [protocolos/protocolos.controller.ts:192](../backend/src/protocolos/protocolos.controller.ts#L192) | JWT + menu `protocolos` | GET |
| API | `/api/protocolos/gravacao` | [protocolos/protocolos.controller.ts:251](../backend/src/protocolos/protocolos.controller.ts#L251) | JWT + menu `protocolos` | POST |
| API | `/api/protocolos/gravacao/:id` | [protocolos/protocolos.controller.ts:317](../backend/src/protocolos/protocolos.controller.ts#L317) | JWT + menu `protocolos` | DELETE |
| API | `/api/protocolos/gravacao/:id` | [protocolos/protocolos.controller.ts:290](../backend/src/protocolos/protocolos.controller.ts#L290) | JWT + menu `protocolos` | GET |
| API | `/api/protocolos/gravacao/:id/finalizar` | [protocolos/protocolos.controller.ts:302](../backend/src/protocolos/protocolos.controller.ts#L302) | JWT + menu `protocolos` | POST |
| API | `/api/protocolos/gravacao/:id/trecho` | [protocolos/protocolos.controller.ts:265](../backend/src/protocolos/protocolos.controller.ts#L265) | JWT + menu `protocolos` | POST |
| API | `/api/protocolos/novo` | [protocolos/protocolos.controller.ts:108](../backend/src/protocolos/protocolos.controller.ts#L108) | JWT + menu `protocolos` | POST |
| API | `/api/protocolos/portal/credencial` | [protocolos/protocolos.controller.ts:240](../backend/src/protocolos/protocolos.controller.ts#L240) | JWT + menu `protocolos` | DELETE |
| API | `/api/protocolos/portal/credencial` | [protocolos/protocolos.controller.ts:208](../backend/src/protocolos/protocolos.controller.ts#L208) | JWT + menu `protocolos` | GET |
| API | `/api/protocolos/portal/credencial` | [protocolos/protocolos.controller.ts:220](../backend/src/protocolos/protocolos.controller.ts#L220) | JWT + menu `protocolos` | POST |

### `rechedu` — 3 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/rechedu/credencial` | [rechedu/rechedu.controller.ts:65](../backend/src/rechedu/rechedu.controller.ts#L65) | JWT + menu `rechedu` | DELETE |
| API | `/api/rechedu/credencial` | [rechedu/rechedu.controller.ts:35](../backend/src/rechedu/rechedu.controller.ts#L35) | JWT + menu `rechedu` | GET |
| API | `/api/rechedu/credencial` | [rechedu/rechedu.controller.ts:47](../backend/src/rechedu/rechedu.controller.ts#L47) | JWT + menu `rechedu` | POST |

### `rns` — 2 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/rns` | [rns/rns.controller.ts:22](../backend/src/rns/rns.controller.ts#L22) | JWT + menu `rns` | GET |
| API | `/api/rns/detalhe` | [rns/rns.controller.ts:31](../backend/src/rns/rns.controller.ts#L31) | JWT + menu `rns` | GET |

### `saude` — 2 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/saude` | [saude/saude.controller.ts:25](../backend/src/saude/saude.controller.ts#L25) | JWT | GET |
| API | `/api/saude/metricas` | [saude/saude.controller.ts:35](../backend/src/saude/saude.controller.ts#L35) | JWT + menu `centro_operacional` | GET |

### `tecnicos-sicla` — 2 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/tecnicos-sicla` | [tecnicos-sicla/tecnicos-sicla.controller.ts:21](../backend/src/tecnicos-sicla/tecnicos-sicla.controller.ts#L21) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/tecnicos-sicla/importar` | [tecnicos-sicla/tecnicos-sicla.controller.ts:33](../backend/src/tecnicos-sicla/tecnicos-sicla.controller.ts#L33) | JWT + perfis ...PERFIS_SISTEMA | POST |

### `users` — 5 rotas

| Tipo | Identificador | Origem | Auth | Método |
| --- | --- | --- | --- | --- |
| API | `/api/usuarios` | [users/users.controller.ts:49](../backend/src/users/users.controller.ts#L49) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/usuarios` | [users/users.controller.ts:63](../backend/src/users/users.controller.ts#L63) | JWT + perfis ...PERFIS_SISTEMA | POST |
| API | `/api/usuarios/:id` | [users/users.controller.ts:91](../backend/src/users/users.controller.ts#L91) | JWT + perfis ...PERFIS_SISTEMA | DELETE |
| API | `/api/usuarios/:id` | [users/users.controller.ts:57](../backend/src/users/users.controller.ts#L57) | JWT + perfis ...PERFIS_SISTEMA | GET |
| API | `/api/usuarios/:id` | [users/users.controller.ts:81](../backend/src/users/users.controller.ts#L81) | JWT + perfis ...PERFIS_SISTEMA | PUT |

## 2. Telas (`frontend/src/app/app.routes.ts`)

Guardas herdadas do nó pai aparecem repetidas quando a varredura as alcançou; o nó
raiz do shell aplica `authGuard` a **tudo** que está sob ele.

| Tipo | Identificador | Origem | Auth | Componente |
| --- | --- | --- | --- | --- |
| Página | `/esqueci-senha` | [app.routes.ts:15](../frontend/src/app/app.routes.ts#L15) | auth | `features/esqueci-senha/esqueci-senha.component` |
| Página | `/apresentacao` | [app.routes.ts:22](../frontend/src/app/app.routes.ts#L22) | auth | `features/apresentacao/apresentacao.component` |
| Página | `/cadastro` | [app.routes.ts:30](../frontend/src/app/app.routes.ts#L30) | auth rotaInicial | `features/cadastro/cadastro.component` |
| Página | `/` | [app.routes.ts:34](../frontend/src/app/app.routes.ts#L34) | auth permissao:carteira rotaInicial | `features/home/home.component` |
| Página | `/home` | [app.routes.ts:40](../frontend/src/app/app.routes.ts#L40) | permissao:carteira rotaInicial | `features/home/home.component` |
| Página | `/projetos` | [app.routes.ts:47](../frontend/src/app/app.routes.ts#L47) | permissao:carteira | `features/projetos/projetos-lista.component` |
| Página | `/clientes/novo` | [app.routes.ts:57](../frontend/src/app/app.routes.ts#L57) | permissao:novo_cliente | `features/clientes-sicla/consulta-cliente.component` |
| Página | `/projetos/novo` | [app.routes.ts:66](../frontend/src/app/app.routes.ts#L66) | permissao:carteira | `features/projetos/projeto-form.component` |
| Página | `/projetos/:id` | [app.routes.ts:75](../frontend/src/app/app.routes.ts#L75) | permissao:carteira | `features/passos/passos.component` |
| Página | `/projetos/:id/dados` | [app.routes.ts:84](../frontend/src/app/app.routes.ts#L84) | perfil:ADM,Coordenador,Administrativo,GCI,Levantador | `features/projetos/projeto-form.component` |
| Página | `/projetos/:id/levantamento` | [app.routes.ts:90](../frontend/src/app/app.routes.ts#L90) | perfil:ADM,Coordenador,Administrativo,GCI,Levantador | `features/levantamento/levantamento.component` |
| Página | `/projetos/:id/editar/:doc` | [app.routes.ts:97](../frontend/src/app/app.routes.ts#L97) | perfil:ADM,Coordenador,Administrativo,GCI,Levantador | `features/doc-editar/doc-editar.component` |
| Página | `/projetos/:id/documentos/:docId/ver` | [app.routes.ts:109](../frontend/src/app/app.routes.ts#L109) | _herda do pai_ | `features/projetos/doc-preview.component` |
| Página | `/projetos/:id/email` | [app.routes.ts:115](../frontend/src/app/app.routes.ts#L115) | _herda do pai_ | `features/projeto-email/projeto-email.component` |
| Página | `/projetos/:id/agenda` | [app.routes.ts:121](../frontend/src/app/app.routes.ts#L121) | _herda do pai_ | `features/agenda/agenda.component` |
| Página | `/projetos/:id/agenda/acompanhamento` | [app.routes.ts:126](../frontend/src/app/app.routes.ts#L126) | _herda do pai_ | `features/agenda/agenda-acompanhamento.component` |
| Página | `/projetos/:id/passos` | [app.routes.ts:141](../frontend/src/app/app.routes.ts#L141) | perfil:ADM,Coordenador,Administrativo,Consultor | `features/passos/passos.component` |
| Página | `/projetos/:id/cronograma` | [app.routes.ts:149](../frontend/src/app/app.routes.ts#L149) | perfil:ADM,Coordenador,Administrativo,Consultor | `features/plano-cronograma/cronograma-plano.component` |
| Página | `/projetos/:id/checklist` | [app.routes.ts:158](../frontend/src/app/app.routes.ts#L158) | permissao:coordenacao perfil:ADM,Coordenador,Administrativo,Consultor | `features/plano-cronograma/checklist-plano.component` |
| Página | `/coordenacao` | [app.routes.ts:167](../frontend/src/app/app.routes.ts#L167) | permissao:coordenacao | `features/coordenacao/coordenacao.component` |
| Página | `/coordenacao/capacidade` | [app.routes.ts:174](../frontend/src/app/app.routes.ts#L174) | permissao:coordenacao | `features/coordenacao/capacidade.component` |
| Página | `/atividade` | [app.routes.ts:181](../frontend/src/app/app.routes.ts#L181) | permissao:atividade | `features/atividade/atividade.component` |
| Página | `/monitoramento` | [app.routes.ts:188](../frontend/src/app/app.routes.ts#L188) | permissao:centro_operacional | `features/monitoramento/monitoramento.component` |
| Página | `/protocolos` | [app.routes.ts:195](../frontend/src/app/app.routes.ts#L195) | permissao:protocolos | `features/protocolos/protocolos.component` |
| Página | `/protocolos/gravar` | [app.routes.ts:202](../frontend/src/app/app.routes.ts#L202) | permissao:protocolos | `features/protocolos/gravacao.component` |
| Página | `/protocolo` | [app.routes.ts:210](../frontend/src/app/app.routes.ts#L210) | permissao:protocolo | `features/protocolo/protocolo.component` |
| Página | `/atividades` | [app.routes.ts:220](../frontend/src/app/app.routes.ts#L220) | permissao:controle_atividades | `features/controle-atividades/controle-atividades.component` |
| Página | `/atividades/:codigo` | [app.routes.ts:229](../frontend/src/app/app.routes.ts#L229) | permissao:controle_atividades | `features/controle-atividades/controle-atividades.component` |
| Página | `/rechedu` | [app.routes.ts:240](../frontend/src/app/app.routes.ts#L240) | permissao:rechedu | `features/rechedu/rechedu.component` |
| Página | `/agenda` | [app.routes.ts:249](../frontend/src/app/app.routes.ts#L249) | permissao:agenda | `features/agenda-calendario/agenda-calendario.component` |
| Página | `/rns` | [app.routes.ts:260](../frontend/src/app/app.routes.ts#L260) | permissao:rns | `features/rns/rns.component` |
| Página | `/protocolos/:id` | [app.routes.ts:266](../frontend/src/app/app.routes.ts#L266) | permissao:protocolos | `features/protocolos/protocolo-ficha.component` |
| Página | `/matriz` | [app.routes.ts:273](../frontend/src/app/app.routes.ts#L273) | permissao:matriz | `features/matriz/matriz-lista.component` |
| Página | `/matriz/:id` | [app.routes.ts:280](../frontend/src/app/app.routes.ts#L280) | permissao:matriz | `features/matriz/matriz-ficha.component` |
| Página | `/matriz-detalhada` | [app.routes.ts:287](../frontend/src/app/app.routes.ts#L287) | permissao:matriz_detalhada | `features/matriz/matriz-detalhada.component` |
| Página | `/matriz-funcoes` | [app.routes.ts:294](../frontend/src/app/app.routes.ts#L294) | permissao:matriz_funcoes perfil:ADM | `features/matriz/matriz-funcoes.component` |
| Página | `/config/email` | [app.routes.ts:305](../frontend/src/app/app.routes.ts#L305) | perfil:ADM | `features/config/config-email.component` |
| Página | `/config/graph` | [app.routes.ts:312](../frontend/src/app/app.routes.ts#L312) | perfil:ADM | `features/config/config-graph.component` |
| Página | `/config/imap` | [app.routes.ts:319](../frontend/src/app/app.routes.ts#L319) | perfil:ADM | `features/config/config-imap.component` |
| Página | `/config/ia` | [app.routes.ts:326](../frontend/src/app/app.routes.ts#L326) | perfil:ADM | `features/config/config-ia.component` |
| Página | `/cadastros` | [app.routes.ts:333](../frontend/src/app/app.routes.ts#L333) | perfil:ADM | `features/cadastros/cadastros.component` |
| Página | `/cadastros/:aba` | [app.routes.ts:339](../frontend/src/app/app.routes.ts#L339) | perfil:ADM | `features/cadastros/cadastros.component` |
| Página | `/config/modelos-email` | [app.routes.ts:345](../frontend/src/app/app.routes.ts#L345) | perfil:ADM | `features/config/modelos-email.component` |
| Página | `/config/modelos-email/:id` | [app.routes.ts:352](../frontend/src/app/app.routes.ts#L352) | perfil:ADM | `features/config/modelo-email-form.component` |
| Página | `/config/destinatarios-passo` | [app.routes.ts:359](../frontend/src/app/app.routes.ts#L359) | perfil:ADM | `features/config/destinatarios-passo.component` |
| Página | `/config/tokens-api` | [app.routes.ts:375](../frontend/src/app/app.routes.ts#L375) | permissao:dashboards perfil:ADM | `features/config/tokens-api.component` |
| Página | `/bi/implantacao` | [app.routes.ts:389](../frontend/src/app/app.routes.ts#L389) | permissao:dashboards | `features/dashboards/dashboard.component` |
| Página | `/bi/implantacao/painel/:slug` | [app.routes.ts:398](../frontend/src/app/app.routes.ts#L398) | permissao:dashboards | `features/dashboards/dashboard.component` |
| Página | `/bi/implantacao/contratacao` | [app.routes.ts:406](../frontend/src/app/app.routes.ts#L406) | permissao:dashboards | `features/bi-indicadores/bi-contratacao.component` |
| Página | `/bi/implantacao/conclusao` | [app.routes.ts:415](../frontend/src/app/app.routes.ts#L415) | permissao:dashboards | `features/bi-indicadores/bi-conclusao.component` |
| Página | `/bi/implantacao/utilizacao` | [app.routes.ts:424](../frontend/src/app/app.routes.ts#L424) | permissao:dashboards | `features/bi-indicadores/bi-utilizacao.component` |
| Página | `/bi/implantacao/alocacao-calendario` | [app.routes.ts:433](../frontend/src/app/app.routes.ts#L433) | permissao:dashboards | `features/bi-indicadores/bi-alocacao-calendario.component` |
| Página | `/bi/implantacao/alocacao-horas` | [app.routes.ts:442](../frontend/src/app/app.routes.ts#L442) | permissao:dashboards | `features/bi-indicadores/bi-alocacao-horas.component` |
| Página | `/bi/implantacao/movimentos` | [app.routes.ts:451](../frontend/src/app/app.routes.ts#L451) | permissao:dashboards | `features/bi-indicadores/bi-movimentos.component` |
| Página | `/bi/clientes-siger` | [app.routes.ts:460](../frontend/src/app/app.routes.ts#L460) | permissao:bi_implantacao | `features/bi-implantacao/bi-implantacao.component` |
| Página | `/bi/clientes-siger/resumo` | [app.routes.ts:467](../frontend/src/app/app.routes.ts#L467) | permissao:bi_implantacao | `features/bi-implantacao/bi-implantacao.component` |
| Página | `/bi/clientes-siger/extrato` | [app.routes.ts:476](../frontend/src/app/app.routes.ts#L476) | permissao:bi_implantacao | `features/bi-implantacao/bi-extrato.component` |
| Página | `/bi/clientes-siger/rns` | [app.routes.ts:485](../frontend/src/app/app.routes.ts#L485) | permissao:bi_implantacao | `features/bi-implantacao/bi-rns.component` |
| Página | `/bi/clientes-siger/agendas` | [app.routes.ts:492](../frontend/src/app/app.routes.ts#L492) | permissao:bi_implantacao | `features/bi-implantacao/bi-agendas.component` |
| Página | `/ferramentas` | [app.routes.ts:510](../frontend/src/app/app.routes.ts#L510) | permissao:ferramentas | `features/ferramentas/ferramentas.component` |
| Página | `/prontidao` | [app.routes.ts:520](../frontend/src/app/app.routes.ts#L520) | permissao:prontidao | `features/prontidao/prontidao.component` |
| Página | `/permissoes` | [app.routes.ts:529](../frontend/src/app/app.routes.ts#L529) | permissao:permissoes | `features/permissoes/permissoes.component` |
| Página | `/fluxo` | [app.routes.ts:536](../frontend/src/app/app.routes.ts#L536) | _herda do pai_ | `features/fluxo/fluxo-inicio.component` |
| Página | `/fluxo/confirmar` | [app.routes.ts:541](../frontend/src/app/app.routes.ts#L541) | _herda do pai_ | `features/fluxo/fluxo-confirmar.component` |
| Página | `/perfil` | [app.routes.ts:547](../frontend/src/app/app.routes.ts#L547) | _herda do pai_ | `features/perfil/perfil.component` |
| Página | `/mapa` | [app.routes.ts:552](../frontend/src/app/app.routes.ts#L552) | perfil:ADM | `features/mapa/mapa.component` |
| Página | `/trocar-senha` | [app.routes.ts:557](../frontend/src/app/app.routes.ts#L557) | perfil:ADM | `features/trocar-senha/trocar-senha.component` |
| Página | `/legado` | [app.routes.ts:563](../frontend/src/app/app.routes.ts#L563) | perfil:ADM | `features/legado/legado-index.component` |
| Página | `/legado/cliente` | [app.routes.ts:569](../frontend/src/app/app.routes.ts#L569) | perfil:ADM | `features/legado/cliente.component` |
| Página | `/legado/:rid` | [app.routes.ts:575](../frontend/src/app/app.routes.ts#L575) | perfil:ADM | `features/legado/role.component` |
| Página | `/legado/:rid/saude` | [app.routes.ts:581](../frontend/src/app/app.routes.ts#L581) | perfil:ADM | `features/legado/saude.component` |
| Página | `/legado/:rid/criar-templates` | [app.routes.ts:587](../frontend/src/app/app.routes.ts#L587) | perfil:ADM | `features/legado/criar-templates.component` |
| Página | `/legado/:rid/verbal` | [app.routes.ts:594](../frontend/src/app/app.routes.ts#L594) | perfil:ADM | `features/legado/verbal.component` |
| Página | `/legado/:rid/modulos/:aid` | [app.routes.ts:600](../frontend/src/app/app.routes.ts#L600) | perfil:ADM | `features/legado/selecao-modulos.component` |
| Página | `/legado/:rid/importar/:aid` | [app.routes.ts:607](../frontend/src/app/app.routes.ts#L607) | permissao:acesso_clientes perfil:ADM | `features/legado/importar.component` |
| Página | `/legado/:rid/gerar/:aid` | [app.routes.ts:613](../frontend/src/app/app.routes.ts#L613) | permissao:acesso_clientes perfil:ADM | `features/legado/gerar.component` |
| Página | `/acesso-clientes` | [app.routes.ts:620](../frontend/src/app/app.routes.ts#L620) | permissao:acesso_clientes perfil:ADM | `features/acesso-clientes/acesso-clientes.component` |
| Página | `/usuarios/online` | [app.routes.ts:631](../frontend/src/app/app.routes.ts#L631) | perfil:ADM | `features/usuarios/online.component` |
| Página | `/usuarios` | [app.routes.ts:638](../frontend/src/app/app.routes.ts#L638) | perfil:ADM | `features/usuarios/usuarios.component` |
| Página | `/esqueci-senha` | [app.routes.ts:666](../frontend/src/app/app.routes.ts#L666) | auth | `features/esqueci-senha/esqueci-senha.component` |
| Página | `/` | [app.routes.ts:673](../frontend/src/app/app.routes.ts#L673) | auth perfil:ADM | `features/config/api-dados.component` |
| Página | `/config/conexoes` | [app.routes.ts:682](../frontend/src/app/app.routes.ts#L682) | perfil:ADM | `features/config/api-dados.component` |
| Página | `/config/api-dados` | [app.routes.ts:689](../frontend/src/app/app.routes.ts#L689) | perfil:ADM | `features/config/api-dados.component` |
| Página | `/config/tokens` | [app.routes.ts:696](../frontend/src/app/app.routes.ts#L696) | perfil:ADM | `features/config/api-dados.component` |
| Página | `/config/api-dados/consulta` | [app.routes.ts:703](../frontend/src/app/app.routes.ts#L703) | perfil:ADM | `features/config/api-dados-consulta.component` |
| Página | `/config/consultas-bd` | [app.routes.ts:715](../frontend/src/app/app.routes.ts#L715) | perfil:ADM | `features/config/consultas-bd.component` |
| Página | `/config/consultas-bd/:slug` | [app.routes.ts:724](../frontend/src/app/app.routes.ts#L724) | perfil:ADM | `features/config/consultas-bd.component` |
| Página | `/config/api-dados/consulta/:slug` | [app.routes.ts:733](../frontend/src/app/app.routes.ts#L733) | perfil:ADM | `features/config/api-dados-consulta.component` |
| Página | `/perfil` | [app.routes.ts:742](../frontend/src/app/app.routes.ts#L742) | _herda do pai_ | `features/perfil/perfil.component` |
## 3. Trabalho assíncrono (robôs)

Todos registrados por `setInterval` no `SchedulerRegistry` e **pulados quando
`NODE_ENV=test`** — por isso não sobem na instância isolada da 5199 e não são exercitáveis
pelo Playwright. A cobertura deles é de teste unitário (Jest), não integrada.

| Tipo | Identificador | Origem | Auth | Método | Observação |
| --- | --- | --- | --- | --- | --- |
| Job | `robo-prazos-atividades` | [controle-atividades/robo-prazos.service.ts:41](../backend/src/controle-atividades/robo-prazos.service.ts#L41) | — | agendado | checa de hora em hora; avisa às 8h, no máx. 1×/dia |
| Job | `robo-digest` | [digest/robo-digest.service.ts:38](../backend/src/digest/robo-digest.service.ts#L38) | — | agendado | a cada 30 min; declara batimento à tela de Saúde |
| Job | `robo-caixa` | [fluxo/robo-caixa.service.ts:57](../backend/src/fluxo/robo-caixa.service.ts#L57) | — | agendado | leitura IMAP da caixa de entrada |
| Job | `robo-protocolos` | [protocolos/robo-protocolos.service.ts:55](../backend/src/protocolos/robo-protocolos.service.ts#L55) | — | agendado | intervalo configurável em runtime |

## 4. Integrações externas

Fronteiras que **não** sobem na instância isolada. O comportamento sob teste é a
**degradação** — a tela precisa avisar, não quebrar.

| Tipo | Identificador | Origem | Observação |
| --- | --- | --- | --- |
| Integração externa | Oracle do SICLA | [dados/conexoes/conexao-sicla.service.ts](../backend/src/dados/conexoes/conexao-sicla.service.ts) | só via API de Dados (ADR-0003); sem credencial na 5199 → 503 |
| Integração externa | MySQL do Portal Rech | [dados/conexoes/conexao-portal.service.ts](../backend/src/dados/conexoes/conexao-portal.service.ts) | idem |
| Integração externa | Portal API (5110 prod / 5198 teste) | [dados/consumo/dados-remoto.service.ts](../backend/src/dados/consumo/dados-remoto.service.ts) | administração do catálogo mora lá; sem ela, os casos de admin **pulam** |
| E-mail | SMTP | [email/mailer.service.ts](../backend/src/email/mailer.service.ts) | `smtp.json` deliberadamente inalcançável na 5199 (`cwd` fora de `backend/`) |
| E-mail | Microsoft Graph | [email/graph.service.ts](../backend/src/email/graph.service.ts) | idem |
| E-mail | IMAP (entrada) | [fluxo/imap-intake.service.ts](../backend/src/fluxo/imap-intake.service.ts) | robô desligado em teste |
| Integração externa | docservice (Python) | [saude/repositories/docservice-saude.repository.ts](../backend/src/saude/repositories/docservice-saude.repository.ts) | geração fiel e transcrição; nunca exposto publicamente |
| Integração externa | Portal Rech (protocolo) | [protocolos/portal-rech.service.ts](../backend/src/protocolos/portal-rech.service.ts) | `POST /api/v1/visita` |
| Integração externa | LLM (OpenRouter/Ollama) | [ia/ia.service.ts](../backend/src/ia/ia.service.ts) | chave por finalidade; sem chave → recurso desligado |
| Integração externa | Trello | [controle-atividades](../backend/src/controle-atividades/) | importação de quadro; token do usuário |
| Integração externa | Disponibilidade (base externa) | [disponibilidade/disponibilidade.service.ts](../backend/src/disponibilidade/disponibilidade.service.ts) | — |
| Integração externa | assistente legado (subprocesso) | [legado/legado.controller.ts](../backend/src/legado/legado.controller.ts) | ponte para `webapp/legado_cli.py` + `tools/` |

## 5. Superfícies públicas (sem `JwtAuthGuard`)

A lista mais sensível do inventário: é o que um anônimo alcança. Qualquer rota nova que
apareça aqui sem estar nesta tabela é achado de segurança, não de teste.

| Método | Identificador | Origem | Observação |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | [auth/auth.controller.ts:34](../backend/src/auth/auth.controller.ts#L34) | porta de entrada |
| POST | `/api/auth/refresh` | [auth/auth.controller.ts:44](../backend/src/auth/auth.controller.ts#L44) | rotação do refresh token |
| POST | `/api/auth/esqueci-senha` | [auth/auth.controller.ts:87](../backend/src/auth/auth.controller.ts#L87) | não pode revelar se o login existe |
| POST | `/api/auth/redefinir-senha` | [auth/auth.controller.ts:104](../backend/src/auth/auth.controller.ts#L104) | consome token de uso único |
| POST | `/api/cadastro` | [cadastro/cadastro.controller.ts:34](../backend/src/cadastro/cadastro.controller.ts#L34) | auto-cadastro (sem porta no login desde 2026-07-30) |
| POST | `/api/cadastro/confirmar` | [cadastro/cadastro.controller.ts:69](../backend/src/cadastro/cadastro.controller.ts#L69) | — |
| POST | `/api/cadastro/reenviar` | [cadastro/cadastro.controller.ts:81](../backend/src/cadastro/cadastro.controller.ts#L81) | — |
| GET | `/api/health` | [health/health.controller.ts:17](../backend/src/health/health.controller.ts#L17) | diz o driver de banco em uso |
| GET | `/api/instancia` | [health/health.controller.ts:35](../backend/src/health/health.controller.ts#L35) | decide o menu (painel × portal-api) |
| GET | `/api/protocolos/:id/video` | [protocolos/protocolos-midia.controller.ts:51](../backend/src/protocolos/protocolos-midia.controller.ts#L51) | mídia por token assinado na URL, não por sessão |
