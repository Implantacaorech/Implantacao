/** Anexo de e-mail — caminho de um arquivo em disco (mesma forma de
 * webapp/mailer.py:enviar, que recebe uma lista de caminhos; arquivos inexistentes são
 * ignorados silenciosamente, mesmo comportamento do original). */
export interface Anexo {
  caminho: string;
  nomeArquivo?: string;
}
