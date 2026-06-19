---
name: dossie-cliente
description: >
  Dossiê do cliente — documento vivo que consolida o estado de cada implantação (identificação,
  escopo, status por etapa, RNS vinculadas, artefatos gerados e links). Use para criar/atualizar o
  registro único de um projeto. Palavras-gatilho: dossiê, ficha do cliente, estado do projeto,
  consolidar implantação, status geral, onde está o projeto.
---

# Dossiê do Cliente

**Transversal** · **Responsável:** Consultor (mantém atualizado)
**Por quê (P2):** faltava um lugar único onde "mora" o estado de cada implantação. O dossiê
consolida tudo em um documento.

## O que contém
- **Identificação** — cliente, SICLA, CNPJ/sigla, RNS(I), consultor, usuário líder, virada.
- **Escopo** — módulos.
- **Status por etapa** — do levantamento ao encerramento.
- **RNS vinculadas** — tipo, número, descrição, status.
- **Artefatos gerados** — Kit de Mudança, Roteiros SIT/UAT, Reconciliação, Hypercare, Fit/Gap, KPIs, RAID.
- **Links** — Drive (levantamento), SharePoint (cronograma), pasta do cliente (rede R:).

## Como gerar (Office)
```bash
# ajuste tools/data/exemplo_cliente.yaml e tools/data/dossie.yaml
python tools/gerar_dossie_cliente.py   # -> exemplos/Dossie_<cliente>.docx
```

## Uso
- Atualize a cada mudança de status relevante (é o "raio-x" do projeto).
- Serve de base para a transição ao Suporte e para o e-mail de encerramento (3.8.4).
- Dado-base (`tools/data/`) é o mesmo usado pelos demais geradores — mantém tudo consistente.
