/** Acesso do CLIENTE ao Painel a partir de `SICLA.LISTA_CONTATOS`.
 *
 * Quem entra pelo lado do cliente não é "o cliente": é um CONTATO dele, e quem diz quais
 * contatos podem entrar no portal é o SICLA, pela coluna `PORTAL_RECH_CLIENTES = 1`
 * (definição do usuário em 2026-08-31). O Painel não inventa essa lista — ele a lê.
 *
 * De/para do contato para o usuário do Painel:
 *   NOME    -> Nome    (`usuarios.nome`)
 *   EMAIL   -> E-mail  (`usuarios.email`) e Login (`usuarios.login`) — o login É o e-mail
 *   CLIENTE -> Código do cliente (`usuarios.codigo_cliente_sicla`), que é o recorte do BI
 *   —          perfil fixo em `Cliente`, sempre
 *
 * `CARGO`, `ATIVODES`, `STATUSDES` e `PORTAL_RECH_CLIENTES_DES` não viram campo de usuário:
 * são o contexto que o ADM lê para decidir a quem dar acesso, e ficam só na tela.
 *
 * Espelha `tecnicos-sicla/`, que faz o mesmo por `LISTA_TECNICOS` para gente da casa. As
 * duas diferenças que importam: o papel criado aqui é EXTERNO (e exclusivo), e a senha é
 * ALEATÓRIA — ver `SENHA_ALEATORIA_BYTES` abaixo. */
export const SLUG_LISTA_CONTATOS = 'contatos_sicla_lista';

export const NOME_LISTA_CONTATOS =
  'Contatos liberados no Portal (SICLA) — Acesso de Clientes';

/** Tamanho da senha aleatória do contato recém-liberado (bytes de entropia).
 *
 * Decisão do usuário (2026-08-31): a senha NÃO é escolhida por ninguém da Rech e nunca é
 * exibida. O contato define a dele pelo "Esqueci minha senha" que o Painel já tem (código
 * de 6 dígitos por e-mail) — o mesmo caminho de quem esquece a senha, sem mecanismo novo,
 * e sem a senha trafegar por WhatsApp ou telefone.
 *
 * Consequência prática: o e-mail do contato no SICLA precisa estar certo, porque é por ele
 * que o acesso se completa. Contato sem e-mail não vira usuário — entra em `ignorados`. */
export const SENHA_ALEATORIA_BYTES = 24;

/** Um contato do SICLA já normalizado. `bruto` traz a linha original (todas as colunas),
 * para a tela mostrar o que quiser sem depender do mapeamento.
 *
 * **A identidade é o E-MAIL**, não um código: `LISTA_CONTATOS` não expõe um identificador
 * de contato (colunas confirmadas em 2026-08-31), e o e-mail já é o login no Painel. Quem
 * não tem e-mail não pode receber acesso — não há por onde entrar. */
export interface ContatoSicla {
  nome: string;
  cargo: string;
  email: string;
  /** Código do cliente no SICLA — o vínculo e o recorte do BI. */
  cliente: string;
  /** `ATIVODES` — situação do contato no SICLA, por extenso. */
  ativo: string;
  /** `STATUSDES` — status do contato, por extenso. */
  status: string;
  /** `PORTAL_RECH_CLIENTES_DES` — a liberação do portal, por extenso. */
  liberacaoPortal: string;
  /** Já tem usuário ATIVO no Painel (casado por e-mail/login). */
  jaLiberado: boolean;
  /** Tem usuário, mas desativado — o caso de quem já teve acesso e o perdeu. */
  desativado: boolean;
  bruto: Record<string, unknown>;
}

/** Resultado de uma liberação — o que a tela mostra depois de rodar. */
export interface ResultadoLiberacao {
  ok: boolean;
  mensagem: string;
  liberados: number;
  reativados: number;
  /** Contatos que não viraram usuário, com o motivo (sem e-mail, por exemplo). */
  ignorados: { nome: string; email: string; motivo: string }[];
}

/** Resultado de uma revogação pela tela. */
export interface ResultadoRevogacao {
  ok: boolean;
  mensagem: string;
  revogados: number;
}
