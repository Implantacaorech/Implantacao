import { ResultadoBruto } from '../conexoes/conexoes.service';

/** Token de injeção do delegado remoto. É `@Optional()` no `DadosService` de propósito: o
 * **Portal API** (instância interna) não monta o módulo de consumo — ele é a ponta que
 * *executa*, não a que *consome*. Sem delegado, tudo roda como sempre rodou, local. */
export const DELEGADO_REMOTO = 'DELEGADO_REMOTO';

/** O que o `DadosService` precisa saber sobre o consumo remoto — nada além disto, para o
 * executor não ficar sabendo de token, URL ou HTTP. */
export interface DelegadoRemoto {
  /** Há token ativo cadastrado? Enquanto não houver, o Painel consulta o banco direto, como
   * sempre fez — cadastrar o primeiro token é o que vira a chave. */
  ativo(): Promise<boolean>;

  /** Este token alcança esta consulta? Consulta não coberta por token nenhum continua
   * indo pelo caminho local, em vez de virar erro — é o que permite migrar aos poucos. */
  cobre(nome: string): Promise<boolean>;

  /** Executa no Portal API e devolve o resultado INTEIRO (paginando por baixo, se preciso),
   * no mesmo shape do executor local. */
  consultar(
    nome: string,
    parametros: Record<string, unknown>,
  ): Promise<ResultadoBruto>;
}
