/** Usuários do Painel a partir de `LISTA_TECNICOS` (SICLA).
 *
 * O cadastro de Usuários deixou de nascer digitado: a fonte passa a ser a lista de técnicos
 * do SICLA, consultada pela MESMA conexão Oracle da Disponibilidade, e importada para a
 * tabela `usuarios` do Painel.
 *
 * De/para pedido pelo usuário (2026-07-28):
 *   CODIGO           -> Código SICLA   (`usuarios.codigo_sicla`)
 *   NOME             -> Nome           (`usuarios.nome`)
 *   MODULOCAPACITADO -> Módulos capacitados (`usuarios.modulos_capacitados`)
 *   EMAIL            -> E-mail         (`usuarios.email`)
 *   EMAIL            -> Login          (`usuarios.login`)  ← o login É o e-mail
 *   SETORDES         -> Setor Atuação  (`usuarios.setor_atuacao`)
 *
 * O SQL é EDITÁVEL pelo Administrador (consulta nomeada, slug abaixo, tela Consultas BD),
 * com o default embutido aqui — se a linha não existir no banco, cai no default e a
 * importação funciona mesmo antes de qualquer ajuste. */
export const SLUG_LISTA_TECNICOS = 'tecnicos_sicla_lista';

export const NOME_LISTA_TECNICOS = 'Lista de Técnicos (SICLA) — Usuários';

/** Senha atribuída a todo técnico importado que ainda não tem cadastro no Painel
 * (definição do usuário em 2026-07-28). Quem já existe NÃO tem a senha resetada — a
 * importação atualiza só os dados vindos do SICLA. */
export const SENHA_PADRAO_TECNICO = 'Rech@2026';

/** Um técnico do SICLA já normalizado para virar usuário. `bruto` traz a linha original
 * (todas as colunas), para a tela mostrar o que quiser sem depender do mapeamento. */
export interface TecnicoSicla {
  codigo: string;
  nome: string;
  modulosCapacitados: string;
  email: string;
  setorAtuacao: string;
  /** Já existe usuário no Painel para este técnico? (casado por código SICLA ou e-mail.) */
  jaCadastrado: boolean;
  bruto: Record<string, unknown>;
}

/** Resultado de uma importação — o que a tela mostra depois de rodar. */
export interface ResultadoImportacao {
  ok: boolean;
  mensagem: string;
  criados: number;
  atualizados: number;
  /** Linhas do SICLA que não viraram usuário (sem e-mail, por exemplo), com o motivo. */
  ignorados: { codigo: string; nome: string; motivo: string }[];
}
