# Time de Implantação — SIGER® (Rech)

Estrutura de **agentes**, **skills** e **documentação** para o Claude Code apoiar e
padronizar o processo de implantação do ERP **SIGER®**, conforme o processo
**GRM:Implantação**.

Repositório: <https://github.com/Implantacaorech/Implantacao>

## O que é isto

O processo de implantação foi traduzido para três camadas que o Claude Code entende:

- **Agentes** (`.claude/agents/`) = os **papéis** do time (Coordenação, Setor Adm,
  Consultor, Gerente do Projeto, Equipe de Conversão).
- **Skills** (`.claude/skills/`) = as **etapas** do processo, cada uma com passo a passo,
  responsáveis, entradas/saídas e templates.
- **Docs** (`docs/`) e **Templates** (`templates/`) = o conhecimento de apoio (processo
  completo, glossário, matriz de responsabilidades, e-mails e termos prontos).

## Como usar no Claude Code

1. Abra esta pasta (`Implantacao`) como projeto no Claude Code.
2. **Acionar um papel:** peça algo como *"como Coordenador da Implantação, designe a equipe
   para o cliente X"* — o Claude usa o subagente `coordenador-implantacao`.
3. **Acionar uma etapa:** peça *"elabore o cronograma de implantação do cliente X"* — a skill
   `cronograma-implantacao` é carregada automaticamente.
4. **Consultar o processo:** os arquivos em `docs/` são a fonte de verdade.

## Mapa rápido

| Fase | Etapas (skills) |
|------|-----------------|
| Pré-implantação | `levantamento-processos`, `apoio-comercial-demonstracao` |
| Início | `abertura-implantacao`, `manutencao-rns-implantacao`, `registros-sicla` |
| Aderência | `levantamento-micro`, `aderencia-siger`, `encaminhar-conversoes`, `encaminhar-desenvolvimentos` |
| Planejamento | `projeto-implantacao`, `cronograma-implantacao` |
| Execução | `parametrizacoes`, `treinamento-rotinas` |
| Simulações/Virada | `simulacoes`, `virada-oficial` |
| Produção | `acompanhamento-producao` |
| Encerramento | `encerramento-implantacao` |

## Documentação

- [Processo completo](docs/processo-implantacao.md)
- [Glossário](docs/glossario.md)
- [Papéis e responsabilidades](docs/papeis-responsabilidades.md)
- [Fluxo macro](docs/fluxo-macro.md)
- [Recursos e caminhos (templates corporativos)](docs/recursos-e-caminhos.md)

---
🤖 Estrutura gerada com [Claude Code](https://claude.com/claude-code)
