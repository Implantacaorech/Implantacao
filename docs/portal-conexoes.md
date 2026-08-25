# Portal de Conexões — as duas instâncias

> Desenho definido pelo usuário em **2026-08-25**, para permitir publicar o Painel fora da
> rede da empresa sem levar junto nenhum dado de conexão com banco.
>
> Regra de origem (ADR-0003): *"Toda e qualquer consulta realizada em banco de dados terá uma
> API para comunicação."*
> Exigência que gerou este documento: *"Para que eu consiga liberar o painel para acesso
> externo da empresa, a conexão e leitura deve ser totalmente API. Não poderei deixar no
> portal e em lugar nenhum os dados de conexão com o banco."*

## O problema

O Painel é uma ferramenta interna que hoje roda na rede da Rech e abre conexão direta com o
Oracle do SICLA e o MySQL do Portal Rech. Publicá-lo num servidor em nuvem, do jeito que
está, significaria levar as credenciais desses bancos para uma máquina exposta à internet.
O risco não é o Painel: é o **banco de terceiro** atrás dele.

A resposta não é criptografar melhor o segredo — é **não ter o segredo lá**.

## O desenho

Duas instâncias, cada uma com uma função:

| | **Instância 1 — Portal de Conexões** | **Instância 2 — o Painel** |
|---|---|---|
| Onde roda | rede **interna** da Rech | servidor em **nuvem** |
| Tem credencial de banco externo? | **sim**, é a única | **não**, nenhuma |
| O que expõe | `/api/dados/v1` + telas de administração | o Painel inteiro |
| Como fala com a outra | — | **token** (`X-API-Key`), pelo túnel |
| Porta padrão | **5110** (nunca publicada) | 5100 |
| Entrypoint | `dist/main-dados.js` (`Iniciar_Portal_Conexoes.bat`) | `dist/main.js` (`Iniciar_Painel_Novo.bat`) |

O ganho não é de código — é de **superfície**. O processo que segura a senha do Oracle expõe
só a API de Dados, autenticação, permissões e health. Se a instância da nuvem for
comprometida, o que o invasor alcança é uma lista de consultas nomeadas, com parâmetros
tipados e teto de linhas. Não um banco.

Por isso a raiz de módulos da instância 1
([`backend/src/dados/dados-app.module.ts`](../backend/src/dados/dados-app.module.ts)) é curta
**de propósito**, e o teste `dados-app.module.spec.ts` recusa qualquer módulo novo ali: cada
módulo acrescentado é rota exposta na máquina que tem a senha do banco.

## O que a instância 2 nunca vê

- string de conexão, usuário e senha de banco;
- o **texto SQL** de qualquer consulta (o catálogo publica nome, parâmetros, colunas e teto —
  nunca o SQL: ele revelaria o schema do sistema de terceiro);
- qualquer endpoint que aceite SQL. **Não existe** — nem para o Administrador da nuvem.

## O token é por CONSULTA, não por conexão

Decisão do usuário. Um token autoriza **exatamente os nomes marcados** no cadastro. Um token
emitido para o painel de RNS não alcança o extrato de horas, mesmo sendo da mesma conexão —
há caso de teste e2e provando justamente isso.

Cadastro em **Sistema → API de Dados → Clientes de máquina**. A chave aparece **uma vez**, na
criação e na rotação: o banco guarda só o hash (bcrypt). Revogar preserva o histórico de uso;
apagar não.

## Criar consulta pela TELA (sem release)

Também decisão do usuário: publicar consulta nova não pode depender de um deploy.

**Sistema → API de Dados → Nova consulta** (`/config/api-dados/consulta`):

1. escolha a conexão e cole o **SELECT**;
2. clique em **Testar** — a consulta roda com limite 1 e o sistema descobre sozinho os
   `:binds` que o texto cita e as **colunas** que o banco devolveu. Ninguém digita a lista de
   campos;
3. escolha o **tipo** de cada parâmetro (é ele que valida a entrada antes de chegar ao banco)
   e o **teto de linhas**;
4. marque **Publicar** para ela entrar no catálogo e poder ser autorizada num token.

Publicar exige contrato completo, e as checagens são as mesmas que o CI faz no catálogo de
código — aplicadas na hora de salvar, porque aqui não há PR:

- só `SELECT` (ou `WITH … SELECT`) — nada de DML/DDL;
- nome público no padrão `<origem>.<assunto>.<ação>`, e que **não colida** com o catálogo de
  código (em conflito, **o código vence** — consulta de tela não sequestra nome revisado);
- **bind × parâmetro casando exatamente**, nos dois sentidos;
- teto de linhas presente e dentro do limite (5.000 para consulta de tela; as de código vão a
  20.000 porque cada uma foi dimensionada e revisada).

Enquanto **não** publicada, a consulta é rascunho: serve aos Dashboards, como as que já
existiam, e não aparece no catálogo nem pode ser autorizada.

> ⚠️ **Pré-requisito duro:** o que este caminho **não** consegue garantir é *qual tabela* o
> SELECT lê — isso é privilégio do usuário no banco, não do nosso código. Criar consulta pela
> tela só é seguro com um usuário Oracle de **privilégio mínimo** (ver abaixo). Enquanto a
> conexão usar o `powerbi`, quem cria consulta na tela alcança tudo o que ele alcança.

## Pré-requisito: usuário Oracle de leitura mínima (`painel_ro`)

Auditoria de 2026-08-25 na credencial em uso (`powerbi`):

- privilégios de sistema: `SELECT ANY TABLE`, `SELECT ANY DICTIONARY`, `DROP ANY VIEW`,
  `CREATE PROCEDURE/TRIGGER/TABLE/…`; papéis `CONNECT, RESOURCE, SELECT_CATALOG_ROLE, SODA_APP`;
- alcance efetivo: **4.980 objetos em 39 schemas**;
- necessário pelas consultas do catálogo: **16 objetos**.

O pedido ao TI é criar `painel_ro` com `CREATE SESSION` e `SELECT` **apenas** nesses objetos,
sem `ANY`, sem `RESOURCE`, sem privilégio de escrita. Isso transforma o teto da instância 1 de
"o Oracle inteiro" em "16 views" — e é o que torna a criação de consulta pela tela um recurso
e não um risco.

## Subir a instância 1

```bat
Build_Painel_Novo.bat           :: compila backend + Angular (main-dados.js sai do mesmo build)
Iniciar_Portal_Conexoes.bat     :: sobe na 5110
```

Variáveis (de **usuário** do Windows, nunca no `.bat`):

| Variável | Para quê |
|---|---|
| `MIGRACAO_DB_URL` | `painel_novo` — clientes de API, consultas salvas, usuários |
| `MIGRACAO_JWT_SECRET` / `..._REFRESH_SECRET` | login de pessoa (as mesmas do Painel) |
| `MIGRACAO_DADOS_PORT` | porta (padrão **5110**) |
| `MIGRACAO_DADOS_CORS` | origem do Painel da nuvem, se ele chamar pelo navegador |

Administração no navegador, **só pela rede interna**:
`http://I7M1700-01-EVE:5110/config/api-dados`.

> Ela serve o **mesmo build** do Angular do Painel, mas só as telas da área Sistema → API de
> Dados funcionam ali — o resto do menu chama endpoints que este processo não expõe. É
> intencional: entre um menu completo e uma superfície pequena na máquina que tem a senha do
> banco, escolhemos a superfície pequena. O endereço de trabalho é `/config/api-dados`.

⚠️ **Firewall:** libere a 5110 **apenas** para o endereço do túnel. Ela nunca deve ser
publicada.

## O que ainda falta para as duas instâncias existirem de fato

Hoje o código das duas está pronto e o processo da instância 1 sobe — mas **as duas ainda
rodam na mesma máquina**, e o Painel continua consultando o banco pelo próprio processo (o
`DadosService` local). Falta:

- [ ] **`painel_ro`** no Oracle (pedido ao TI) — pré-requisito do resto;
- [ ] **`DadosRemotoService`** no Painel: quando `MIGRACAO_DADOS_URL` estiver definida, pedir a
  consulta por HTTP à instância 1 em vez de executar localmente. Mesma interface do
  `DadosService`, para nenhum módulo de negócio perceber a troca;
- [ ] **túnel** entre nuvem e rede interna (decisão do TI: VPN site-to-site, Cloudflare Tunnel
  ou equivalente) — a 5110 nunca fica exposta diretamente;
- [ ] **TLS** nas duas pontas (hoje o tráfego interno é HTTP puro);
- [ ] **inversão de confiança pendente:** hoje a instância interna lê as chaves *e o SQL
  editável* do mesmo `painel_novo` que o Painel administra. Se a nuvem passar a compartilhar
  esse banco, um comprometimento lá poderia reescrever `consultas_bd` e a instância interna
  executaria. Ou o `painel_novo` fica **na rede interna**, ou a instância 1 passa a ter banco
  próprio para catálogo e tokens.

## Onde está cada coisa

| Assunto | Arquivo |
|---|---|
| Decisão | [ADR-0003](<../vault/17 - ADR/ADR-0003 - API de Dados como fronteira unica de banco.md>) |
| Contrato da API | [`backend/src/dados/docs/api.md`](../backend/src/dados/docs/api.md) |
| Regras (tipos, tetos, autorização) | [`backend/src/dados/docs/regras-negocio.md`](../backend/src/dados/docs/regras-negocio.md) |
| Raiz da instância 1 | [`backend/src/dados/dados-app.module.ts`](../backend/src/dados/dados-app.module.ts) |
| Entrypoint | [`backend/src/main-dados.ts`](../backend/src/main-dados.ts) |
| Backlog | [`docs/pendencias.md`](pendencias.md) §API de Dados |
