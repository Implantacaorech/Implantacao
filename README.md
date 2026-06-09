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
| Qualidade e adoção (P0) | `gestao-mudanca`, `testes-sit-uat` |
| Dados e estabilização (P1) | `validacao-conversao`, `hypercare`, fit/gap em `aderencia-siger` |
| Gestão e medição (P2) | `metricas-kpi`, `gestao-riscos-raid`, `dossie-cliente` |

## Geradores Office (.xlsx/.docx)

Agentes geradores produzem artefatos prontos a partir de dados em `tools/data/*.yaml`:

```bash
python -m pip install -r tools/requirements.txt   # uma vez
python tools/gerar_kit_mudanca.py                 # Kit de Gestão da Mudança (Excel)
python tools/gerar_roteiros_teste.py              # Roteiros SIT/UAT (Excel)
python tools/gerar_aceite_uat.py                  # Termo de Aceite (Word)
python tools/gerar_reconciliacao_conversao.py     # Reconciliação de Conversão (Excel)
python tools/gerar_painel_hypercare.py            # Painel de Hypercare (Excel)
python tools/gerar_log_fitgap.py                  # Log de Fit/Gap (Excel)
python tools/gerar_painel_kpi.py                  # Painel de KPIs (Excel)
python tools/gerar_raid.py                        # RAID — riscos/issues (Excel)
python tools/gerar_dossie_cliente.py              # Dossiê do cliente (Word)
python tools/gerar_projeto_implantacao.py         # Projeto de Implantação (Word, FIEL ao template Rech)
python tools/gerar_termo_encerramento.py          # Termo de Encerramento (Word, FIEL ao template Rech)
python tools/gerar_levantamento.py                # Levantamento/Mapeamento (Word, FIEL ao template Rech)
python tools/extrair_levantamento.py <doc.docx>   # Ponte Levantamento -> Projeto (seed p/ IA)
```

Saída em `exemplos/`. Detalhes em [tools/README.md](tools/README.md).

## Documentação

- [Processo completo](docs/processo-implantacao.md)
- [Glossário](docs/glossario.md)
- [Papéis e responsabilidades](docs/papeis-responsabilidades.md)
- [Fluxo macro](docs/fluxo-macro.md)
- [Recursos e caminhos (templates corporativos)](docs/recursos-e-caminhos.md)

---
🤖 Estrutura gerada com [Claude Code](https://claude.com/claude-code)
