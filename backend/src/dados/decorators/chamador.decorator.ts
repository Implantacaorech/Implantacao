import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IdentidadeChamador } from '../dados.service';
import { RequisicaoDados } from '../guards/acesso-dados.guard';

/** Quem está chamando a API de Dados — pessoa (JWT) ou cliente de máquina (X-API-Key),
 * resolvido pelo `AcessoDadosGuard`. Unificar os dois num só tipo é o que permite ao
 * executor auditar sem se importar com o caminho de autenticação. */
export const Chamador = createParamDecorator(
  (_dado: unknown, ctx: ExecutionContext): IdentidadeChamador => {
    const req = ctx.switchToHttp().getRequest<RequisicaoDados>();
    return (
      req.identidadeDados ?? {
        tipo: 'usuario',
        id: 'desconhecido',
        nome: 'desconhecido',
      }
    );
  },
);

/** Escopos do chamador quando ele é cliente de máquina; `undefined` para usuário do
 * Painel (que é gateado por menu, não por escopo). Usado para recortar a listagem do
 * catálogo ao que aquele cliente pode de fato chamar. */
export const EscoposChamador = createParamDecorator(
  (_dado: unknown, ctx: ExecutionContext): string[] | undefined =>
    ctx.switchToHttp().getRequest<RequisicaoDados>().escoposDados,
);
