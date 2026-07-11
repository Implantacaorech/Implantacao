# Checklist de homologação

> Não há ambiente de homologação formal separado (ver F-08, `DIAGNOSTICO_GERAL_DO_PROJETO.md`
> §7). Este checklist cobre a "homologação" real do projeto: validação local antes do push,
> pelo desenvolvedor, com apoio do agente `qualidade`.

## Antes de abrir/mesclar uma mudança

- [ ] `python -m compileall -q webapp tools` sem erro.
- [ ] `python webapp/verificar_app.py` sem erro (rotas registram, `url_for` ok).
- [ ] `pytest webapp/test_painel.py -q` 100% verde.
- [ ] `cd tools && python verificar.py` sem falha inesperada (best-effort, templates locais).
- [ ] Se a mudança tocou `db.py`: testado contra uma cópia do banco local com dados existentes
  (não só banco vazio) — a migração aditiva não deve quebrar registros antigos.
- [ ] Se a mudança tocou geração de documento: gerado pelo menos 1 exemplo e conferido
  visualmente contra o layout oficial (o "fiel" da geração fiel).
- [ ] Se a mudança tocou integrações (e-mail/disponibilidade): `python webapp/verificar_tudo.py`
  rodado localmente.
- [ ] Nenhuma credencial nova em texto plano no diff (checar `git diff` manualmente).
- [ ] Revisão do agente `qualidade` (ou revisão equivalente) concluída.
- [ ] Documentação relacionada atualizada (`docs/painel-sistema.md`, `memoria_ia/*`) se a
  mudança for relevante o suficiente — território do agente `documentacao-contexto`.

## Critério de aceite para "pronto para produção"

Todos os itens acima marcados + CI verde no GitHub Actions após o push.
