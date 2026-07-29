import { HttpErrorResponse } from '@angular/common/http';

/** Traduz a falha de uma chamada do BI para algo acionável.
 *
 * Uma mensagem genérica ("não foi possível carregar") esconde justamente o que o usuário
 * precisa saber para destravar: se o backend ainda não subiu com a versão nova (404), se o
 * menu não está liberado (403) ou se a sessão caiu (401). */
export function mensagemErroBi(e: unknown, oQue: string): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) {
      return `Sem resposta do servidor ao carregar ${oQue}. Verifique se o Painel está no ar.`;
    }
    if (e.status === 404) {
      return (
        `Endpoint de ${oQue} não encontrado (404). O backend provavelmente está rodando uma ` +
        'versão anterior — reinicie o Painel para carregar as rotas novas.'
      );
    }
    if (e.status === 401) {
      return 'Sessão expirada. Entre novamente.';
    }
    if (e.status === 403) {
      return (
        'Sem permissão para o BI de Implantação. Libere o menu em Gestão → Permissões ' +
        '(ou reinicie o Painel, que semeia o menu novo no boot).'
      );
    }
    const detalhe =
      typeof e.error?.message === 'string'
        ? e.error.message
        : (e.statusText ?? 'erro desconhecido');
    return `Falha ao carregar ${oQue} (HTTP ${e.status}): ${detalhe}`;
  }
  return `Não foi possível carregar ${oQue}.`;
}
