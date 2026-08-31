# Prontidão do Sistema — visão geral

Módulo `Sistema → Prontidão do Sistema` (`backend/src/prontidao/`). Expõe a **Auditoria de
Prontidão dos 9 eixos** (2026-08-12) de forma navegável dentro do Painel: veredito por eixo,
achados por severidade e status, e o sinal **ao vivo** de privacidade da IA.

- **Para quê:** dar uma visão única e viva do quanto o Painel está pronto segundo as melhores
  práticas (segurança, governança, resiliência, agentes autônomos, detecção antes do usuário,
  alucinações, custo por token, fallback, observabilidade). É a materialização, no painel, da
  norma §21-A do `PADRAO-DESENVOLVIMENTO-RECH.md`.
- **Quem vê:** só o Administrador (menu de Sistema, `fixaAdm`).
- **Fonte dos dados:** `prontidao.dados.ts` (retrato datado, versionado com o código) + o
  `IaService` (sinal ao vivo). Não há banco: o módulo não persiste nada.

Arquivos: `prontidao.dados.ts` (dados), `prontidao.service.ts` (orquestração + contagens +
sinal ao vivo), `prontidao.controller.ts` (`GET /api/prontidao`), `prontidao.module.ts`.
