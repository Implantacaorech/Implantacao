import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { atendeNivel } from '../../common/constants/menus';
import {
  PermissoesService,
  UsuarioPermissao,
} from '../../permissoes/permissoes.service';
import { ClienteApiService } from '../cliente-api.service';
import { consultaPorNome } from '../catalogo/catalogo';
import { IdentidadeChamador } from '../dados.service';

/** O request enriquecido pelo guard. `identidadeDados` é o que o service audita. */
export interface RequisicaoDados {
  headers: Record<string, string | string[] | undefined>;
  params?: Record<string, string>;
  user?: UsuarioPermissao & { nome?: string; email?: string };
  identidadeDados?: IdentidadeChamador;
  /** Escopos do chamador — usado para recortar a listagem do catálogo. `undefined` para
   * usuário do Painel, que não é gateado por escopo e sim por menu. */
  escoposDados?: string[];
}

const CABECALHO_CHAVE = 'x-api-key';

/** Porta de entrada da API de Dados. Aceita DOIS tipos de chamador, com regras distintas:
 *
 * - **Usuário do Painel** (JWT no `Authorization`) — gateado pelos MENUS que a consulta
 *   declara. Quem não enxerga a tela não consulta o dado por baixo dela: sem isso, a API
 *   viraria uma porta lateral em volta do painel de Permissões.
 * - **Cliente de máquina** (`X-API-Key`) — gateado por ESCOPO. Não tem menu nem perfil; o
 *   que ele pode é exatamente o que foi cadastrado.
 *
 * A ordem importa: a chave é verificada primeiro. Um cliente de máquina não deve depender
 * de ter (nem de saber montar) um JWT de pessoa. */
@Injectable()
export class AcessoDadosGuard extends AuthGuard('jwt') {
  constructor(
    private readonly clientes: ClienteApiService,
    private readonly permissoes: PermissoesService,
  ) {
    super();
  }

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const req = contexto.switchToHttp().getRequest<RequisicaoDados>();
    const bruto = req.headers[CABECALHO_CHAVE];
    const chave = Array.isArray(bruto) ? bruto[0] : bruto;

    return chave
      ? this.autorizarCliente(req, chave)
      : this.autorizarUsuario(req, contexto);
  }

  private nomeDaConsulta(req: RequisicaoDados): string | undefined {
    const nome = req.params?.nome;
    return nome ? nome.trim() : undefined;
  }

  private async autorizarCliente(
    req: RequisicaoDados,
    chave: string,
  ): Promise<boolean> {
    const cliente = await this.clientes.autenticar(chave);
    if (!cliente) throw new UnauthorizedException('Chave de API inválida.');

    const escopos = this.clientes.escoposDoCliente(cliente);
    req.escoposDados = escopos;
    req.identidadeDados = {
      tipo: 'cliente_api',
      id: String(cliente.id),
      nome: cliente.nome,
    };

    const nome = this.nomeDaConsulta(req);
    if (nome) {
      const consulta = consultaPorNome(nome);
      // Consulta inexistente NÃO é 403 aqui: quem responde "não existe" é o service, com a
      // mensagem que aponta o catálogo. Barrar no guard esconderia erro de digitação atrás
      // de "sem permissão".
      if (consulta && !escopos.includes(consulta.escopo)) {
        throw new ForbiddenException(
          `Este cliente não tem o escopo "${consulta.escopo}", exigido por ${consulta.nome}.`,
        );
      }
    }
    return true;
  }

  private async autorizarUsuario(
    req: RequisicaoDados,
    contexto: ExecutionContext,
  ): Promise<boolean> {
    // Delega ao passport-jwt: é o mesmo caminho do JwtAuthGuard, e popula `req.user`.
    const autenticado = (await super.canActivate(contexto)) as boolean;
    if (!autenticado) return false;

    const user = req.user;
    if (!user) throw new UnauthorizedException();
    req.identidadeDados = {
      tipo: 'usuario',
      id: String(user.sub),
      nome: user.nome ?? user.email ?? `usuario:${user.sub}`,
    };

    const nome = this.nomeDaConsulta(req);
    if (!nome) return true;
    const consulta = consultaPorNome(nome);
    if (!consulta?.menus?.length) return true;

    const enxerga = consulta.menus.some((menu) =>
      atendeNivel(this.permissoes.nivelEfetivo(user, menu), 'consulta'),
    );
    if (!enxerga) {
      throw new ForbiddenException(
        `Sem permissão para a consulta ${consulta.nome} (exige acesso a: ${consulta.menus.join(' ou ')}).`,
      );
    }
    return true;
  }
}
