/** Resultado de uma tentativa de envio de e-mail. Todo caminho de saída dos serviços de
 * envio devolve isto — nunca uma exceção: quem chama costuma ser uma notificação disparada
 * em segundo plano (`void`), e uma exceção ali sumiria do histórico em vez de virar um
 * evento de falha na timeline do projeto (achado de 2026-08-05). */
export interface ResultadoEnvio {
  ok: boolean;
  erro: string | null;
}
