# Time de Implantação — SIGER® (Rech)

Estrutura de **agentes**, **skills** e **documentação** para o Claude Code apoiar e
padronizar o processo de implantação do ERP **SIGER®**, conforme o processo
**GRM:Implantação**.

Repositório: <https://github.com/Implantacaorech/Implantacao>

> Este projeto segue os
> [Padrões de Desenvolvimento da Rech](https://gitlab.rech.com.br/gitlab/rech/ia/padrao-ia/raw/master/PADRAO-RECH.md).

## Acesso

**Painel de Implantação (aplicação web)** — em produção desde 2026-07-19:

| Ambiente | URL | Host |
|---|---|---|
| Produção (rede interna) | <http://I7M1700-01-EVE:5100> | `I7M1700-01-EVE` |

Um único processo/porta: o backend **NestJS** serve o build do **Angular**
(`@nestjs/serve-static`), conforme §4.8.5 do padrão.

## Como executar

```bash
# 1) Build (sempre que atualizar o código)
Build_Painel_Novo.bat          # ou: cd backend && npm run build ; cd ../frontend && npm run build -- --configuration production

# 2) Subir o servidor (valida as variáveis obrigatórias antes)
Iniciar_Painel_Novo.bat

# Testes (obrigatórios antes de todo push)
cd backend  && npm test && npm run test:e2e
cd frontend && npm test

# Banco: aplicar migrations
cd backend && npm run migration:run
```

O guardião (`Guardiao_Painel_Novo.vbs`) e a verificação de integridade rodam como Tarefas
Agendadas do Windows e reiniciam o serviço se `/api/health` não responder.

## Dependências de runtime

| Dependência | Versão / observação |
|---|---|
| **Node.js** | LTS ativa (**24.x**) — ver `.nvmrc` e `engines` do `package.json` |
| **MariaDB** | 11.x — banco `painel_novo` (container `painel-db-mariadb`, porta 3307) |
| **Python** | 3.12 — apenas para `docservice/` e `tools/` (ver "Exceções ao padrão") |

**Variáveis de ambiente obrigatórias** (definidas como variáveis de USUÁRIO do Windows;
nunca versionadas — ver `backend/.env.example`):

| Variável | Para que serve |
|---|---|
| `MIGRACAO_DB_URL` | Conexão do MariaDB (`mysql://…/painel_novo`) |
| `MIGRACAO_JWT_SECRET` | Segredo de assinatura do token de acesso |
| `MIGRACAO_JWT_REFRESH_SECRET` | Segredo do token de renovação (diferente do anterior) |
| `MIGRACAO_PORT` | Porta do Painel (produção: `5100`) |

Chaves de IA **não** são variáveis de ambiente: ficam por finalidade em `dados/ia_config.json`
(fora do Git), configuradas na tela **Ferramentas → Modo IA**.

## Exceções ao padrão (§4.3 / §4.8)

Este projeto tem componentes **Python** fora da stack homologada, em processo de adequação
(auditoria de 2026-07-21 contra o `PADRAO-RECH.md` rev. 2.0.0):

| Componente | Situação |
|---|---|
| `tools/`, `docservice/gerador/`, ponte `webapp/` | **A portar para Node/TypeScript** (§4.7) — geração de Office tem equivalente na stack; não configura exceção. |
| `docservice/transcricao/` | **Candidato à exceção da §4.3** (inferência local de modelo, faster-whisper). Pendente de verificação das alternativas em Rust (`whisper-rs`, `candle`, `ort`) e de validação com o **DevTools**. |
| `projeto_old/` | Arquivo morto do Painel Flask desligado — fora do runtime. |

**Por que não foi feito no SICLA (§9.1):** o Painel automatiza o processo de implantação
(fluxo por etapas, geração fiel dos documentos oficiais da Rech, gates de documentos
obrigatórios e integração com SIGER/RNS) — domínio que não é coberto pela agenda/tarefas do
SICLA. As pendências de conformidade estão em [docs/pendencias.md](docs/pendencias.md).

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
python tools/gerar_projeto_implantacao.py         # Projeto de Implantação (engine de tokens, FIEL ao template Rech)
python tools/gerar_termo_encerramento.py          # Termo de Encerramento (Word, FIEL ao template Rech)
python tools/gerar_levantamento.py                # Levantamento/Mapeamento (Word, FIEL ao template Rech)
python tools/importar_mapeamento.py <doc.docx>    # Levantamento -> projeto_<cliente>.yaml (+ conversão verbal)
python tools/conversor_verbal.py "<texto>"        # Converte Presente -> Futuro (motor offline)
```

Saída em `exemplos/`. Detalhes em [tools/README.md](tools/README.md).

## Documentação

- [**Painel de Implantação — apresentação ao usuário-chave**](docs/apresentacao-usuario-chave.md) (visão de negócio, para apresentar ao time) · [slides .pptx](docs/Painel_Implantacao_Apresentacao.pptx)
- [**Painel de Implantação — documentação do sistema**](docs/painel-sistema.md) (a aplicação web e todos os recursos)
- [Parecer para RNS (documento vivo)](docs/parecer-rns.md) (texto pronto p/ colar no parecer de uma RNS)
- [Agentes de software (.claude/agents)](docs/agentes-software.md) (estrutura de agentes p/ manter e evoluir o Painel)
- [Runbooks de operação](docs/runbooks-operacao.md) (e-mail/IMAP/Gmail, Oracle, Postgres/backup, robôs)
- [Processo completo](docs/processo-implantacao.md)
- [Glossário](docs/glossario.md)
- [Papéis e responsabilidades](docs/papeis-responsabilidades.md)
- [Fluxo macro](docs/fluxo-macro.md)
- [Recursos e caminhos (templates corporativos)](docs/recursos-e-caminhos.md)

---
🤖 Estrutura gerada com [Claude Code](https://claude.com/claude-code)
