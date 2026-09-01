/** Um contato de cliente vindo de `SICLA.LISTA_CONTATOS`, já normalizado pelo backend.
 *
 * A identidade é o E-MAIL: a tabela não expõe código de contato, e o e-mail já é o login
 * no Painel (docs/acesso-cliente-bi.md). */
export interface ContatoSicla {
  nome: string;
  cargo: string;
  email: string;
  /** Código do cliente no SICLA — vínculo e recorte do BI de quem receber acesso. */
  cliente: string;
  ativo: string;
  status: string;
  liberacaoPortal: string;
  jaLiberado: boolean;
  desativado: boolean;
  bruto: Record<string, unknown>;
}

export interface ListaContatosSicla {
  ok: boolean;
  mensagem: string;
  contatos: ContatoSicla[];
}

export interface ResultadoLiberacao {
  ok: boolean;
  mensagem: string;
  liberados: number;
  reativados: number;
  ignorados: { nome: string; email: string; motivo: string }[];
}

export interface ResultadoRevogacao {
  ok: boolean;
  mensagem: string;
  revogados: number;
}
