# Regras de negócio — módulo `rechedu`

1. **Credencial por usuário.** O acesso ao RechEdu é pessoal: cada consultor guarda o
   próprio login/senha, indexado pelo `sub` do JWT. Ninguém enxerga ou usa a credencial de
   outro (decisão herdada da credencial do Portal Rech, 2026-08-13).

2. **A senha nunca volta ao cliente.** As respostas expõem só `tem` e `login` (para a tela
   mostrar "conectado como fulano"). A senha fica em repouso no arquivo
   `dados/rechedu_credenciais.json` — rede interna, fora do git, mesmo padrão de
   `portal_credenciais.json`, `disponibilidade.json` e `imap`.

3. **Senha em branco na edição mantém a atual.** Permite corrigir só o login sem redigitar
   a senha. Consequência: a credencial só "existe" (`tem: true`) quando login E senha estão
   preenchidos — a tela exige a senha no 1º cadastro.

4. **Salvar credencial é configuração pessoal, não escrita de dados.** POST/DELETE herdam o
   nível *consulta* do gate `rechedu`: quem enxerga a tela precisa poder cadastrar o próprio
   login, senão a tela nasce inutilizável para perfis só-consulta (a mesma lição do 403 do
   Portal Rech em 2026-08-13). Exceção M2 catalogada com motivo em
   `common/conformidade-permissoes-escrita.spec.ts`.

5. **O Painel não fala com o RechEdu.** Não há login automático nem chamada de API: o site
   é cross-origin e roda inteiro no iframe; o consultor digita a senha lá. A credencial
   salva aqui serve à tela (1º uso / "conectado como") e a uma futura integração — se ela
   vier, nasce já com a credencial certa por consultor.
