# Módulo `rechedu`

Suporte de backend da tela **Execução → RechEdu**, que emoldura o portal de educação da
Rech (<https://www.rechedu.com.br>) dentro do Painel — irmã da tela **Protocolo** (Portal
Rech), com o mesmo desenho.

O site roda inteiro no iframe (é cross-origin; o Painel não fala com a API dele). O que
este módulo guarda é só a **credencial pessoal** de cada consultor no RechEdu, para a tela
pedir o login no 1º uso e mostrar "conectado como fulano" depois — mesma mecânica da
credencial do Portal Rech em `protocolos/portal-credencial.service.ts`.

## Documentos

| Documento | Conteúdo |
|---|---|
| [arquitetura.md](arquitetura.md) | Camadas, arquivos e por que não há Repository |
| [api.md](api.md) | Endpoints `/rechedu/credencial` |
| [regras-negocio.md](regras-negocio.md) | Regras da credencial (por usuário, senha nunca volta) |
| [casos-de-uso.md](casos-de-uso.md) | 1º uso, edição, remoção |
| [fluxo.md](fluxo.md) | Sequência tela ↔ backend ↔ arquivo |

## Fronteiras

- **Frontend:** `frontend/src/app/features/rechedu/` (tela) e
  `frontend/src/app/core/services/rechedu.service.ts` (HTTP).
- **CSP:** a origem `https://www.rechedu.com.br` está liberada no `frame-src` em
  `src/main.ts` — sem isso o navegador bloqueia a moldura em silêncio (mesmo achado da
  tela Protocolo em 2026-08-13).
- **Permissão:** menu `rechedu` (catálogo em `src/common/constants/menus.ts`), liberado por
  padrão para o time interno, sem o Comercial — ajustável em Gestão → Permissões.
