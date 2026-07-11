# Plano de segurança

> Consolida os achados de segurança de `RELATORIO_DE_FALHAS_E_RISCOS.md` (F-01, F-03, F-04,
> F-05, F-10, F-11) em uma política. Escopo: aplicação Flask interna, uso corporativo, não
> exposta à internet pública.

## 1. Modelo de ameaça (resumo)

- **Usuários:** equipe interna da Rech (5 perfis: ADM, Coordenador, Administrativo, GCI,
  Consultor), autenticados via login próprio + senha mestra break-glass.
- **Superfície de exposição:** rede interna corporativa (`http://I7M1700-01-EVE:5000`), sem
  HTTPS/domínio público, sem exposição à internet.
- **Dados sensíveis:** dados de clientes da Rech (LGPD), documentos de implantação, e-mails/
  credenciais de integração.
- **Fora de escopo hoje:** ataques externos via internet (o app não está exposto), DDoS.

## 2. Controle de acesso

- 5 perfis com permissões por ação (`pode_ver`/`pode_gerar`/`pode_designar` — território de
  `seguranca-permissoes`).
- Senha mestra de break-glass (`PAINEL_SENHA`, env) — **sem rate limiting hoje** (F-11).
- **Ação:** adicionar `Flask-Limiter` nas rotas de login/senha mestra (M-03).

## 3. Gestão de segredos

- Já bem estruturada: `.gitignore` cobre `.env`, `*.key`, `*.pem`, todos os `*.json` de
  credencial (`smtp.json`, `imap.json`, `gmail_*.json`, `disponibilidade.json`), `secret.key`,
  `anthropic_key.txt`.
- **Gap:** `docker-compose.yml`/`painel-backup.sh` têm senha padrão em texto plano (F-01,
  crítico) — é a única credencial real hardcoded encontrada na auditoria.
- **Ação imediata:** M-01 (trocar senha, mover para variável de ambiente).

## 4. Sessão e cookies

- `SESSION_COOKIE_HTTPONLY = True` e `SESSION_COOKIE_SAMESITE = "Lax"` já configurados
  conscientemente (`webapp/app.py:64-65`).
- `secret_key`: prioriza `PAINEL_SECRET` (env) → `secret.key` persistido → **fallback fraco
  hardcoded** se ambos falharem (F-03).
- **Ação:** M-02 — falhar explicitamente em vez de usar fallback previsível.

## 5. CSRF

- Mitigação atual: só `SameSite=Lax`, decisão consciente e documentada em comentário no
  código — **não é uma lacuna escondida**, é um risco assumido que esta auditoria torna
  formal.
- **Ação:** M-04 — avaliar token CSRF nas rotas de maior impacto (login, permissões, geração
  de documento) antes de qualquer plano de expor o painel além da rede interna.

## 6. Dependências e vulnerabilidades

- Sem scanner automático (F-10). **Ação:** M-05 (Dependabot, `pip`, weekly) — zero infraestrutura
  nova, resolve o gap.
- `anthropic`/`google-auth*` só carregam credenciais quando configuradas (`configurado()` em
  cada conector) — reduz superfície quando a integração não está em uso.

## 7. Proteção de dados / LGPD

- Dados de cliente ficam fora do controle de versão (`.gitignore`: `clientes/`, `*-cliente-*`,
  `*-confidencial*`) — boa prática já em vigor.
- Território de auditoria de permissões e exposição entre consultores já é papel do agente
  `seguranca-permissoes` (ver `MATRIZ_DE_RESPONSABILIDADES.md`).
- **Sem gap crítico novo identificado** nesta auditoria além dos já cobertos por esse agente.

## 8. Upload e armazenamento

- `MAX_CONTENT_LENGTH` de 4 GB (F-05) — risco baixo dado o uso interno, mas sem monitoramento
  de disco associado. Ver `PLANO_DE_MONITORAMENTO.md`.

## 9. Checklist de segurança antes de expor o painel além da rede interna

Se algum dia houver decisão de negócio para expor o painel fora da rede corporativa (VPN,
acesso remoto, etc.), **os itens abaixo passam de "recomendado" para "bloqueante"**:

- [ ] M-01 executado (senha do Postgres trocada).
- [ ] M-04 executado (token CSRF).
- [ ] M-03 executado (rate limiting no login).
- [ ] HTTPS configurado (hoje inexistente — só HTTP na rede interna).
- [ ] Revisão completa de `seguranca-permissoes` sobre exposição de dado entre perfis.

## 10. Regras permanentes (não negociáveis)

- Nenhuma credencial em código ou commit — sempre `DATA_WRITE/*.json` (gitignored) ou env.
- Nenhum agente de software desativa `SESSION_COOKIE_HTTPONLY`/`SameSite` para "facilitar teste".
- Toda descoberta de exposição de dado é tratada como P0 e reportada ao usuário imediatamente,
  não silenciada até o próximo ciclo de revisão.
