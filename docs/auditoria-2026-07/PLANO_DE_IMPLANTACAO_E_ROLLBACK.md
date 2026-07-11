# Plano de implantação (deploy) e rollback

> "Implantação" aqui é **deploy de software** (nova versão do Painel), não confundir com
> "Implantação" do processo de negócio da Rech (cliente do SIGER®) — mesmo termo, contextos
> diferentes. Ver `docs/glossario.md` se houver dúvida.

## 1. Modelo de deploy atual

Não há pipeline de deploy automatizado (CD) — é deliberado: **"Entrega = código no GitHub"**
(commit + push), e o servidor roda a partir da fonte via `git pull` manual + reinício.

```
Dev local → testes locais → commit + push (main) → CI valida (compileall/smoke/pytest)
   → [manual] git pull no servidor → reiniciar Iniciar_Servidor.bat
   → watchdog assume a partir daí
```

## 2. Passo a passo de deploy

1. Rodar localmente: `compileall` → `verificar_app.py` → `pytest` → `tools/verificar.py`
   (ver `PLANO_DE_TESTES.md`).
2. Commit + push para `main` (CI roda automaticamente, valida os mesmos passos).
3. **Confirmar CI verde** antes de atualizar o servidor — nunca atualizar produção com CI
   vermelho.
4. No servidor: `git pull`.
5. Reiniciar o processo (`Iniciar_Servidor.bat` — se já estiver rodando, parar antes; o
   watchdog reinicia sozinho se cair, mas não substitui um processo já rodando com código
   antigo).
6. Confirmar `GET /health` → `{"status":"ok"}`.
7. Rodar `python webapp/verificar_tudo.py` no servidor para validar integrações reais.

## 3. Rollback

Sem blue-green nem versionamento de release formal — rollback é **reverter no Git**:

1. `git log` no servidor para identificar o commit anterior estável.
2. `git revert <commit>` (preferível a `reset --hard`, preserva histórico) ou `git checkout
   <commit-anterior> -- .` em caso de emergência (menos rastreável, evitar se possível).
3. Reiniciar o processo.
4. Se a mudança revertida alterou `db.py` (schema aditivo): colunas novas **não são removidas**
   automaticamente por um rollback de código — `_auto_migrar` só adiciona, nunca remove. Uma
   coluna adicionada por engano permanece no banco até limpeza manual (risco documentado em
   F-06/M-10 — migração sem versionamento formal).
5. Validar com `verificar_tudo.py` pós-rollback.

## 4. Migração de banco

- Migração é **aditiva e automática** (`_auto_migrar` roda no boot, cria colunas que faltam).
- **Sem downgrade automático** — é uma limitação aceita hoje (ver M-10, médio prazo: avaliar
  Alembic).
- Antes de qualquer mudança de schema: **backup manual** além do cron diário
  (`tools/painel-backup.sh` pode ser rodado a qualquer momento).

## 5. Critérios para liberar um deploy

- [ ] CI verde (compileall + smoke + pytest).
- [ ] Revisão do agente `qualidade` (ou revisão humana equivalente) no diff.
- [ ] Se tocou `db.py`: backup manual feito antes do `git pull` em produção.
- [ ] Se tocou integrações (`mailer`/`imap_intake`/`disponibilidade`): `verificar_tudo.py`
  rodado localmente antes do push.
- [ ] Nenhuma credencial nova introduzida em texto plano.

## 6. Diferença deliberada: sem `.exe`

O fluxo `PyInstaller` (`build_painel_exe.py`) é **legado** — não gerar `.exe` salvo pedido
explícito do usuário (regra crítica em `CLAUDE.md`). O deploy é sempre a partir da fonte.
