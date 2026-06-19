# memoria_ia/ — memória curta, versionada e pesquisável

Memória **do projeto** (versionada no Git), para responder rápido **sem ler o projeto inteiro**.
Não confunda com a memória pessoal do assistente; esta é a fonte de contexto compartilhada do repo.

## Consultar ANTES de buscas amplas
No início de qualquer tarefa, leia primeiro:
1. [`estado-atual.md`](estado-atual.md) — o que existe hoje
2. [`pendencias.md`](pendencias.md) — o que falta (P0/P1/P2)
3. [`arquivos-chave.md`](arquivos-chave.md) — onde mexer / o que evitar carregar

Só depois faça Glob/Grep por arquivos específicos. **Evite varredura completa** sem justificativa.
Para máquina, há também [`indice-busca.yaml`](indice-busca.yaml) (palavras-chave → arquivos).

## Arquivos
| Arquivo | Para quê |
|--------|----------|
| `estado-atual.md` | Resumo curto do estado real do projeto |
| `decisoes.md` | Decisões tomadas (data, motivo, impacto) |
| `pendencias.md` | Pendências priorizadas (P0/P1/P2) |
| `arquivos-chave.md` | Mapa dos arquivos importantes e quando ler/evitar |
| `historico-sessoes.md` | Registro resumido por sessão |
| `indice-busca.yaml` | Índice machine-readable (keywords → arquivos) |
| `handoffs/` | Handoffs de sessão (`AAAA-MM-DD-objetivo.md`) |
| `adr/` | Decisões arquiteturais (`ADR-AAAAMMDD-titulo.md`) |

## Convenção de versionamento
- Cada **decisão relevante** → entrada em [`decisoes.md`](decisoes.md).
- **Decisão arquitetural maior** → `adr/ADR-AAAAMMDD-titulo.md`.
- **Handoff** (tarefa longa/incompleta) → `handoffs/AAAA-MM-DD-objetivo.md` (use o
  [template](../docs/template-handoff-sessao.md)).
- Nova área importante → atualizar `indice-busca.yaml`.
- Cada sessão relevante → resumo em `historico-sessoes.md`.

## Regras
- **Não duplicar** documentação longa — aponte para o arquivo, não copie.
- Cada entrada: **curta, objetiva e datada**.
- Ao concluir mudanças relevantes, **atualize a memória** (e dê commit + push).
