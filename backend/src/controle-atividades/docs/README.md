# Controle de Atividades

Quadro de atividades **por cliente**, no molde do Trello, dentro do Painel. O consultor
organiza o trabalho da implantação e **designa tarefas ao cliente**; o cliente entra no mesmo
Painel (perfil `Cliente`) e vê apenas o que lhe foi designado.

Menu: **Execução → Controle de Atividades** · chave `controle_atividades`.

> Não confundir com **Gestão → Atividade** (chave `atividade`), que é outra tela: o feed e os
> KPIs de uso da operação. As chaves são deliberadamente distintas.

## Documentos

| Arquivo | O que responde |
|---|---|
| [arquitetura.md](arquitetura.md) | Como o módulo é montado (camadas, tabelas, arquivos) |
| [regras-negocio.md](regras-negocio.md) | Quem pode o quê, e por quê |
| [api.md](api.md) | Rotas, contratos e códigos de resposta |
| [fluxo.md](fluxo.md) | O caminho de uma atividade, do consultor ao cliente |
| [casos-de-uso.md](casos-de-uso.md) | Os cenários reais que o módulo atende |

O desenho original, com as decisões e as alternativas descartadas, está em
[`docs/controle-atividades.md`](../../../../docs/controle-atividades.md) na raiz do repositório.

## Em uma frase

**A leitura é geral e a escrita é do responsável; o cartão nasce fechado e só o cliente
enxerga menos.**

## Onde mexer

| Quero… | Vá em |
|---|---|
| Mudar quem pode o quê | `acesso.ts` (funções puras, com teste exaustivo) |
| Mudar a ordenação dos cartões | `ordem.util.ts` |
| Acrescentar rota | `controle-atividades.controller.ts` + `dto/` |
| Mudar o que a tela recebe | `controle-atividades.service.ts` (fachada de leitura) |
| Mudar aviso/e-mail | `notificacoes-atividade.service.ts` e `robo-prazos.service.ts` |
| Acrescentar consulta ao banco | `repositories/` — **nunca** no service |
