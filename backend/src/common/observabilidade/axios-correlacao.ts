import { HttpService } from '@nestjs/axios';
import { CABECALHO_REQUEST_ID, requestIdAtual } from './correlacao';

/**
 * Faz o axios de um `HttpService` carimbar o `x-request-id` da requisição ATUAL em toda chamada
 * de saída (M9). Usado nos serviços que falam com o docservice, para o log/diagnóstico do
 * outro lado poder correlacionar com a requisição que a originou. Chamar UMA vez, no construtor
 * do serviço (o axios do HttpService é a mesma instância durante toda a vida do processo).
 *
 * Fora de um request (robô/boot), `requestIdAtual()` é vazio e nenhum cabeçalho é adicionado.
 */
export function propagarRequestId(http: HttpService): void {
  http.axiosRef.interceptors.request.use((cfg) => {
    const id = requestIdAtual();
    if (id) cfg.headers.set(CABECALHO_REQUEST_ID, id);
    return cfg;
  });
}
