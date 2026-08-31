# Casos de uso — módulo `rechedu`

## UC-1 · Primeiro acesso à tela RechEdu

1. O consultor abre **Execução → RechEdu** (menu `rechedu` liberado no painel de
   Permissões).
2. A tela consulta `GET /rechedu/credencial` → `tem: false`.
3. A tela abre a captura de credencial (login + senha) antes de qualquer coisa —
   "Solicitar login e salvar", igual ao 1º uso do Portal Rech na tela Protocolo.
4. O consultor salva (`POST /rechedu/credencial`); a tela passa a mostrar
   "conectado como fulano" e o iframe do site segue disponível.

## UC-2 · Acessos seguintes

1. `GET /rechedu/credencial` → `tem: true`, `login` preenchido.
2. A tela mostra a faixa "conectado como {login}" e o iframe do RechEdu direto, sem pedir
   nada. O login no SITE continua sendo digitado no próprio iframe (cross-origin — o Painel
   não preenche formulário de terceiro).

## UC-3 · Trocar a credencial

1. O consultor clica em **trocar** na faixa de credencial.
2. A captura reabre com o login atual preenchido; senha em branco **mantém** a atual
   (regra 3 de regras-negocio.md) — trocar só o login não exige redigitar a senha.

## UC-4 · Remover a credencial

1. O consultor clica em **remover** e confirma.
2. `DELETE /rechedu/credencial` apaga a entrada dele no arquivo; no próximo acesso a tela
   volta ao UC-1.
