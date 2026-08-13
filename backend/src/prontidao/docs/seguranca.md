# Prontidão do Sistema — segurança

- **Acesso:** menu de Sistema (`prontidao`, `fixaAdm`) — só o Administrador. A rota
  `GET /api/prontidao` é protegida por `JwtAuthGuard` + `PermissaoGuard` com
  `@Permissao('prontidao', 'consulta')`. Como o menu é `fixaAdm`, o ADM sempre tem acesso
  (trava de segurança: nunca se tranca fora), e nenhum outro papel enxerga a tela por padrão.
- **Não vaza segredo:** o payload traz apenas texto editorial da auditoria (evidência em
  `arquivo:linha`, sem valores de segredo) e, do sinal ao vivo, apenas `finalidade`/`provider`/
  `viaEnv` — **nunca** a chave de IA. O `IaService` já garante que a chave não sai (ver o módulo
  `ia`); este módulo só lê `avisosPrivacidade()`, que não expõe chave.
- **Sem escrita:** o módulo é somente-leitura (um único `GET`). Não há rota de mutação, logo não
  há superfície de escrita a proteger.
- **LGPD:** não persiste nem transmite dado de cliente. Pelo contrário — a tela existe em parte
  para **denunciar** quando uma finalidade sensível de IA está mandando dado de cliente para
  fora da rede (achado A1, sinal `privacidadeAoVivo`).
