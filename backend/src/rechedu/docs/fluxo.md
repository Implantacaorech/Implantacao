# Fluxo — módulo `rechedu`

Sequência da tela Execução → RechEdu com o backend e o arquivo de credenciais:

```
Consultor           Tela (Angular)                Backend (Nest)              dados/
   │  abre /rechedu      │                             │                        │
   │────────────────────▶│  GET /rechedu/credencial    │                        │
   │                     │────────────────────────────▶│  ler mapa por usuário  │
   │                     │                             │───────────────────────▶│ rechedu_credenciais.json
   │                     │◀────────────────────────────│  { tem, login }        │
   │                     │                             │                        │
   │   tem == false ──▶ captura de login/senha (obrigatória no 1º uso)          │
   │  preenche e salva   │  POST /rechedu/credencial   │                        │
   │────────────────────▶│────────────────────────────▶│  salvar (senha em      │
   │                     │                             │  branco mantém atual)  │
   │                     │◀────────────────────────────│  { tem: true, login }  │
   │                     │                             │                        │
   │   tem == true ──▶ faixa "conectado como {login}" + iframe                  │
   │                     │                             │                        │
   │  usa o RechEdu no iframe (www.rechedu.com.br — cross-origin, o login do    │
   │  SITE é digitado lá dentro; o Painel não injeta nada no domínio deles)     │
```

Pontos que já quebraram em telas irmãs e aqui nascem resolvidos:

- **CSP**: `https://www.rechedu.com.br` precisa estar no `frame-src` (main.ts) — sem isso o
  navegador troca o iframe por "Este conteúdo está bloqueado", sem erro no backend (achado
  da tela Protocolo, 2026-08-13). Guarda: teste de CSP em
  `common/conformidade-arquitetura.spec.ts`.
- **403 em perfil só-consulta**: POST/DELETE de credencial herdam consulta de propósito
  (exceção M2 catalogada) — ver regras-negocio.md.
