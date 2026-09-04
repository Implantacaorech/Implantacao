# Arquitetura — Controle de Atividades

Estrutura no molde do módulo-piloto `plano-cronograma`: **Controller → Service → Repository**
(ADR-0002). O controller não conhece ORM; o repository não conhece HTTP.

## Arquivos

```
controle-atividades/
  controle-atividades.controller.ts   entrada: rota, guard, DTO, envelope
  controle-atividades.service.ts      fachada de LEITURA (monta o quadro inteiro)
  quadros.service.ts                  quadros, responsáveis, contexto de acesso
  listas.service.ts                   colunas
  cartoes.service.ts                  cartões, mover, visibilidade, checklist, membros, conversa
  anexos.service.ts                   arquivo, foto e link
  busca.service.ts                    consulta geral de cartões
  notificacoes-atividade.service.ts   avisos in-app + e-mail
  robo-prazos.service.ts              varredura diária de prazo vencido
  acesso.ts                           REGRAS DE ACESSO, em funções puras
  ordem.util.ts                       ordenação por ponto médio
  controle-atividades.constants.ts    menu, etiquetas, colunas padrão, tetos
  dto/                                contratos de entrada (class-validator)
  repositories/                       persistência
  docs/                               este diretório
```

## Por que `acesso.ts` é separado e puro

As regras de acesso são a superfície do módulo onde **um engano não dá erro: dá vazamento**.
Espalhadas pelos services, seriam testáveis só por integração e reescritas a cada rota nova.
Concentradas em funções puras (`podeLerQuadro`, `podeEditarQuadro`, `cartaoVisivel`,
`podeMoverPara`…), dá para cobrir as combinações exaustivamente — é o que `acesso.spec.ts` faz.

## Tabelas (`painel_novo`)

| Tabela | Guarda |
|---|---|
| `atividade_quadros` | Um quadro por cliente, chaveado pelo **código SICLA** (único) |
| `atividade_quadro_responsaveis` | Quem responde pelo quadro — define "meus clientes" |
| `atividade_listas` | Colunas, com `visivel_cliente` para a coluna de bastidor |
| `atividade_cartoes` | Cartões, com `visivel_cliente` **nascendo `0`** |
| `atividade_membros` | Membro interno (usuário) ou cliente (contato do SICLA) |
| `atividade_checklist_itens` | Checklist, com quem marcou cada item |
| `atividade_anexos` | Arquivo/foto (em disco) ou link (só a URL) |
| `atividade_comentarios` | A conversa do cartão |
| `atividade_eventos` | Auditoria — quem compartilhou o quê, e quando |
| `atividade_notificacoes` | Caixa de avisos por pessoa (alimenta o pop-up) |

Migration: `1788060000000-ControleAtividades.ts`. Só ACRESCENTA tabelas — nenhuma existente é
alterada, e por isso é segura de rodar com o Painel no ar.

## Decisões que valem lembrar

**`quadro_id` desnormalizado no cartão.** Deriva de `lista_id → listas.quadro_id`, mas o
recorte por cliente e a busca geral filtram por quadro; sem a coluna, toda leitura pagaria um
JOIN só para descobrir de quem é o cartão.

**`ordem` é `double`, não `decimal`.** A ordenação por ponto médio precisa de número, e o
driver do MariaDB devolve DECIMAL como **string**.

**Etiquetas em catálogo fixo**, numa coluna de texto, e não em tabela. São cinco, do processo
de implantação, iguais em todo quadro. Vira tabela no dia em que houver etiqueta por cliente.

**`atividade_notificacoes` é separada de `atividade_eventos`.** Aquilo é auditoria (o que
aconteceu, para sempre); isto é caixa de entrada (o que ainda não foi visto, por pessoa). Um
evento gera N notificações, uma por destinatário.

## Fronteiras

- **Banco externo:** nenhum. Cliente e contatos vêm do SICLA só pelas consultas nomeadas do
  catálogo (`sicla.clientes.buscar`, `sicla.contatos.listar`) — ADR-0003. O módulo não importa
  driver de banco.
- **Designação:** `DesignadosRepository` só LÊ `projeto_pessoas`/`projetos`. Quem abre um
  quadro é quem atende o cliente, e esse vínculo já existia.
- **Arquivos:** `dados/atividades_anexos/`, com o teto de `LIMITE_UPLOAD_DOC`. O download
  passa obrigatoriamente pelo backend, que reconfere a permissão do cartão.

## Frontend

`frontend/src/app/features/controle-atividades/` — a tela do quadro e o componente de avisos
(pop-up do canto inferior direito, montado no shell para acompanhar o usuário por todas as
telas). Integração em `core/services/controle-atividades.service.ts`; o componente não fala
HTTP direto.
