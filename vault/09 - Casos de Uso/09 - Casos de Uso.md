---
titulo: "Casos de Uso"
tipo: indice
status: em-andamento
criado: 2026-07-19
atualizado: 2026-07-19
responsavel: "Arquiteto Principal (IA)"
tags:
  - vault
  - casos-de-uso
relacionados:
  - "[[08 - Regras de Negócio]]"
  - "[[10 - Fluxogramas]]"
  - "[[11 - Testes]]"
---

# Casos de Uso

> [!info] Sobre esta seção
> Casos de uso do sistema (atores, fluxos principais e alternativos) que orientam backend,
> frontend e testes. Extraídos do código real (controllers/services), não do processo de
> negócio em si (ver [[08 - Regras de Negócio]] para isso).

## UC-01 — Auto-cadastro (sem login prévio)

**Ator:** pessoa nova, sem conta no Painel. **Código:** `cadastro.controller.ts`.

1. `POST /api/cadastro` — informa nome, e-mail, senha, código SICLA. Sistema valida que o
   e-mail ainda não tem conta, gera código de 6 dígitos, grava em `cadastros_pendentes` e
   envia por e-mail (janela de 30min).
2. `POST /api/cadastro/confirmar` — informa e-mail + código. Se válido, **cria o `Usuario`
   direto** (perfil sempre `Consultor`, sem fila de aprovação do ADM) e **já devolve os
   tokens** (login automático na confirmação).
3. **Alternativo:** `POST /api/cadastro/reenviar` — gera novo código, renova a janela.

**Regra notável:** endpoint propositalmente **sem** `JwtAuthGuard` — é assim que alguém sem
conta ganha acesso. E-mail precisa estar configurado (`Config → E-mail/Gmail`) ou o
cadastro falha com mensagem explícita.

## UC-02 — Login e renovação de sessão

**Ator:** qualquer usuário. **Código:** `auth.service.ts` — ver sequência completa em
[[10 - Fluxogramas]].

1. `POST /api/auth/login` (login, senha) → valida com bcrypt → emite `accessToken` +
   `refreshToken` (segredos JWT distintos) → grava hash do refresh em `refresh_tokens`.
2. Quando o `accessToken` expira: `POST /api/auth/refresh` → valida o JWT e o hash no
   banco → **rotaciona** (revoga o antigo, emite par novo) → reduz a janela de replay.
3. `POST /api/auth/logout` → marca o refresh token atual como revogado.

## UC-03 — CRUD de Projeto (Hub da implantação)

**Ator:** perfis variam por ação. **Código:** `projetos.controller.ts`.

| Ação | Rota | Quem pode |
| --- | --- | --- |
| Listar (paginado, filtrado pelo próprio perfil) | `GET /api/projetos` | Todos autenticados — GCI só vê os seus |
| Ver ficha | `GET /api/projetos/:id` | Todos autenticados |
| Criar | `POST /api/projetos` | `PERFIS_DESIGNA` (ADM/Coordenador/Administrativo) |
| Atualizar ficha | `PUT /api/projetos/:id` | Todos autenticados (sem `@Roles` — service decide regra fina) |
| Excluir (cascata nas tabelas filhas) | `DELETE /api/projetos/:id` | `PERFIS_DESIGNA` |

**Regra notável:** a listagem replica `_so_meus()` do Flask original — filtro de
visibilidade por linha, não só por menu (ver `PERFIS_VEEM_TODOS_PROJETOS` em
[[08 - Regras de Negócio]]).

## UC-04 — Avançar a etapa do Projeto

**Ator:** varia por etapa (gates reais, não um "avançar" genérico). Ver máquina de estados
completa em [[10 - Fluxogramas]] §1.

- Etapa **Agendamento**: só `ADM`/`Administrativo` (`PERFIS_AGENDAMENTO`) definem o GCI e
  agendam o Levantamento.
- Etapa **Designação**: só `ADM`/`GCI` (`PERFIS_DESIGNA_CONSULTORES`) designam os
  consultores por módulo — Coordenador/Administrativo ficam de fora **de propósito**
  (confirmado com o usuário, não é bug — ver comentário em `perfis.ts`).
- **Documentos obrigatórios por etapa** (Projeto de Implantação, Cronograma, Termo de
  Encerramento) bloqueiam o avanço até existirem — ver [[08 - Regras de Negócio]].

## UC-05 — Geração de documentos oficiais

**Ator:** perfis de `PERFIS_GERA_LEVANTAMENTO`/`PERFIS_GERA_CRONOGRAMA` conforme o
documento. **Código:** `geracao/geracao-documentos.service.ts`, alimentado por
`doc_conteudo` (ver [[05 - Banco de Dados]]).

1. Consultor/GCI preenche os campos estruturados do Levantamento/Projeto (telas espelho do
   layout oficial) — grava em `doc_conteudo`.
2. Ao gerar, o serviço troca os placeholders do modelo vigente (`modelos_documento.arquivo`)
   pelos dados reais — **geração fiel**, não um modelo genérico.
3. Documento gerado é registrado em `documentos` (`origem: 'gerado'`) e aparece na timeline
   (`eventos`).

## UC-06 — Protocolo de treinamento (vídeo → transcrição → IA → revisão)

**Ator:** Consultor (envia vídeo) + revisor humano (aprova/reprova). **Código:**
`protocolos/` (`processamento-protocolos.service.ts`, `protocolo-ia.service.ts`,
`robo-protocolos.service.ts`).

1. Upload de vídeo → dedup por hash (nome+tamanho+1MB, campo `video_hash`) evita registrar
   o mesmo vídeo duas vezes.
2. Transcrição local (faster-whisper) com timestamps por bloco.
3. IA estrutura o conteúdo nos campos do protocolo (objetivo, pré-requisitos, passo a
   passo, regras de negócio, pontos de atenção) e **audita o que descartou** (campo
   `assuntos_removidos`) e o que ficou ambíguo (`pendencias`).
4. Fluxo de status: `Pendente → Transcrevendo → Analisando → Em revisão → Aprovado` (ou
   `Reprovado / Ajustar` / `Erro`). Só entra na base de conhecimento (`protocolos`,
   independente de projeto/cliente) após aprovação humana.

## Relacionados no Vault

- [[08 - Regras de Negócio]]
- [[10 - Fluxogramas]]
- [[11 - Testes]]
- [[05 - Banco de Dados]]

## Aponta para (conteúdo real do repositório)

- `../backend/src/cadastro/cadastro.controller.ts`
- `../backend/src/auth/auth.service.ts`
- `../backend/src/projetos/projetos.controller.ts`
- `../backend/src/geracao/geracao-documentos.service.ts`
- `../backend/src/protocolos/`

## Status

6 casos de uso reais documentados em 2026-07-19, a partir dos controllers/services. Ver
[[00 - Dashboard]].
