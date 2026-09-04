import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AtividadeCartao } from '../../database/entities/atividade-cartao.entity';

/** Persistência dos cartões.
 *
 * **`somenteCompartilhados` é obrigatório nas leituras de conjunto, e de propósito.** É o
 * recorte do usuário-cliente, e um parâmetro opcional com default `false` seria exatamente
 * o tipo de descuido que vaza bastidor: quem esquecesse de passar receberia tudo. Exigindo
 * o argumento, esquecer não compila. */
@Injectable()
export class CartoesRepository {
  constructor(
    @InjectRepository(AtividadeCartao)
    private readonly repo: Repository<AtividadeCartao>,
  ) {}

  async doQuadro(
    quadroId: number,
    somenteCompartilhados: boolean,
  ): Promise<AtividadeCartao[]> {
    return this.repo.find({
      where: somenteCompartilhados
        ? { quadroId, arquivado: false, visivelCliente: true }
        : { quadroId, arquivado: false },
      order: { ordem: 'ASC', id: 'ASC' },
    });
  }

  async dosQuadros(
    quadroIds: number[],
    somenteCompartilhados: boolean,
  ): Promise<AtividadeCartao[]> {
    if (!quadroIds.length) return [];
    return this.repo.find({
      where: somenteCompartilhados
        ? { quadroId: In(quadroIds), arquivado: false, visivelCliente: true }
        : { quadroId: In(quadroIds), arquivado: false },
      order: { ordem: 'ASC', id: 'ASC' },
    });
  }

  async daLista(listaId: number): Promise<AtividadeCartao[]> {
    return this.repo.find({
      where: { listaId, arquivado: false },
      order: { ordem: 'ASC', id: 'ASC' },
    });
  }

  async porId(id: number): Promise<AtividadeCartao | null> {
    return this.repo.findOne({ where: { id } });
  }

  async criar(dados: Partial<AtividadeCartao>): Promise<AtividadeCartao> {
    return this.repo.save(this.repo.create(dados));
  }

  async salvar(cartao: AtividadeCartao): Promise<AtividadeCartao> {
    return this.repo.save(cartao);
  }

  async salvarVarios(cartoes: AtividadeCartao[]): Promise<void> {
    if (!cartoes.length) return;
    await this.repo.save(cartoes);
  }

  async contarNaLista(listaId: number): Promise<number> {
    return this.repo.count({ where: { listaId, arquivado: false } });
  }
}
