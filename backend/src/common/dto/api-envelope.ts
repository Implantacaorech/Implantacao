/** Envelope explícito para quando um controller precisa customizar `message`/`pagination` da
 * resposta — nunca use um objeto literal `{ data, message }` para isso: o interceptor
 * precisa de um jeito INEQUÍVOCO de diferenciar "isto é um envelope" de "isto é a entidade
 * retornada, que por acaso tem um campo chamado `data`" (ex.: AtividadeCronograma.data, a
 * data da visita). Um objeto literal sofre exatamente essa colisão; uma classe dedicada,
 * checável com `instanceof`, não.
 *
 * Nome deliberadamente diferente de `ApiResponse` do @nestjs/swagger (decorator de
 * documentação de resposta HTTP) para não colidir por import. */
export class ApiEnvelope<T> {
  constructor(
    public readonly data: T,
    public readonly message?: string,
    public readonly pagination?: unknown,
  ) {}
}
