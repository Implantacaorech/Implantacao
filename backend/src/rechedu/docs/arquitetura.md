# Arquitetura — módulo `rechedu`

## Camadas

```
RecheduController        entrada HTTP: /rechedu/credencial (GET/POST/DELETE)
  └─ RecheduCredencialService   regra + persistência em arquivo (dados/rechedu_credenciais.json)
```

- **Controller** (`rechedu.controller.ts`) — valida o DTO, identifica o usuário pelo token
  (`@CurrentUser`) e delega. Nunca toca arquivo nem regra.
- **Service** (`rechedu-credencial.service.ts`) — guarda e lê o mapa
  `usuarioId → {login, senha}`. É cópia deliberada do `PortalCredencialService` do módulo
  `protocolos` (mesmas regras, arquivo próprio), mantida separada para nenhum dos dois
  módulos depender do outro por causa de um par login/senha.

## Por que não há Repository nem entity

A credencial não é dado de negócio do Painel — é segredo de acesso a um sistema EXTERNO,
pessoal de cada consultor. Segue o padrão de segredo-em-repouso já usado por
`disponibilidade.json` e pela credencial do Portal Rech: arquivo JSON em `dados/` (fora do
git, rede interna), não tabela no banco. Sem entity, não há camada Repository a criar —
mesma decisão registrada no módulo `protocolos`.

## Segurança

- A senha **nunca volta** numa resposta HTTP — só `tem` (boolean) e `login`.
- As rotas exigem JWT + gate de menu `rechedu` (`JwtAuthGuard` + `PermissaoGuard`).
- POST/DELETE herdam o nível **consulta** da classe de propósito: mexer na própria
  credencial é configuração pessoal. Exceção M2 catalogada em
  `common/conformidade-permissoes-escrita.spec.ts`.
