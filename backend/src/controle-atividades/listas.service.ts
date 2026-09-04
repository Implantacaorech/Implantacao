import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { AtividadeLista } from '../database/entities/atividade-lista.entity';
import { ListasRepository } from './repositories/listas.repository';
import { CartoesRepository } from './repositories/cartoes.repository';
import { QuadrosService } from './quadros.service';
import { ordemEntre } from './ordem.util';

/** Colunas do quadro. Mexer em coluna é sempre do responsável interno — o cliente nunca
 * cria, renomeia nem apaga coluna. */
@Injectable()
export class ListasService {
  constructor(
    private readonly listas: ListasRepository,
    private readonly cartoes: CartoesRepository,
    private readonly quadrosSvc: QuadrosService,
  ) {}

  async criar(
    user: AuthUser,
    codigoCliente: string,
    titulo: string,
    visivelCliente: boolean,
  ): Promise<AtividadeLista> {
    const { quadro } = await this.quadrosSvc.exigirEditavel(
      user,
      codigoCliente,
    );
    const atuais = await this.listas.doQuadro(quadro.id);
    const ultima = atuais.length ? atuais[atuais.length - 1].ordem : null;
    return this.listas.criar({
      quadroId: quadro.id,
      titulo: titulo.trim(),
      visivelCliente,
      ordem: ordemEntre(ultima, null),
    });
  }

  async editar(
    user: AuthUser,
    listaId: number,
    dados: { titulo?: string; visivelCliente?: boolean },
  ): Promise<AtividadeLista> {
    const lista = await this.exigir(user, listaId);
    if (dados.titulo !== undefined) lista.titulo = dados.titulo.trim();
    if (dados.visivelCliente !== undefined) {
      lista.visivelCliente = dados.visivelCliente;
    }
    return this.listas.salvar(lista);
  }

  /** Arquiva a coluna — nunca com cartão dentro.
   *
   * Apagar a coluna cheia levaria os cartões junto, inclusive os que o cliente enxerga e
   * pode estar respondendo. Esvaziar antes é decisão de quem conhece o trabalho. */
  async arquivar(user: AuthUser, listaId: number): Promise<void> {
    const lista = await this.exigir(user, listaId);
    const quantos = await this.cartoes.contarNaLista(lista.id);
    if (quantos > 0) {
      throw new BadRequestException(
        `A coluna ainda tem ${quantos} cartão(ões) — mova-os antes de removê-la.`,
      );
    }
    lista.arquivada = true;
    await this.listas.salvar(lista);
  }

  private async exigir(
    user: AuthUser,
    listaId: number,
  ): Promise<AtividadeLista> {
    const lista = await this.listas.porId(listaId);
    if (!lista) throw new NotFoundException('Coluna não encontrada.');
    const quadro = await this.quadrosSvc.quadroPorId(lista.quadroId);
    if (!quadro) throw new NotFoundException('Coluna não encontrada.');
    await this.quadrosSvc.exigirEditavel(user, quadro.codigoClienteSicla);
    return lista;
  }
}
