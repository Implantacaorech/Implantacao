import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Designacao } from '../database/entities/designacao.entity';
import { AtividadeCronograma } from '../database/entities/atividade-cronograma.entity';

export interface DesignacaoDto {
  modulo: string;
  consultor: string;
  ordem: number;
  naoDistribuir: boolean;
  analista: string;
}

/** Consultor/ordem de treinamento/analista por módulo. Espelha
 * webapp/db.py:designacoes_do_projeto e cronograma_tecnico_modulo. */
@Injectable()
export class DesignacoesService {
  constructor(
    @InjectRepository(Designacao) private readonly repo: Repository<Designacao>,
    @InjectRepository(AtividadeCronograma)
    private readonly atividadesRepo: Repository<AtividadeCronograma>,
  ) {}

  async doProjeto(projetoId: number): Promise<DesignacaoDto[]> {
    const linhas = await this.repo.find({
      where: { projetoId },
      order: { ordem: 'ASC', modulo: 'ASC' },
    });
    return linhas.map((d) => ({
      modulo: d.modulo,
      consultor: d.consultor,
      ordem: d.ordem || 0,
      naoDistribuir: !!d.naoDistribuir,
      analista: d.analista || '',
    }));
  }

  /** `tecnico` undefined = não mexe no técnico/cartões; `null`/"" reservado para o sentinela
   * "Não distribuir" ser tratado no controller. Demais campos: undefined = não mexe. Devolve
   * o nº de cartões cujo técnico foi alterado. */
  async tecnicoModulo(
    projetoId: number,
    moduloBruto: string,
    tecnico: string | undefined,
    opcoes: { ordem?: number; naoDistribuir?: boolean; analista?: string } = {},
  ): Promise<number> {
    const modulo = (moduloBruto || '').trim().toUpperCase();
    if (!modulo) return 0;

    let n = 0;
    if (tecnico !== undefined) {
      const resultado = await this.atividadesRepo.update(
        { projetoId, modulo },
        { tecnico: tecnico.trim() },
      );
      n = resultado.affected ?? 0;
    }

    let d = await this.repo.findOne({ where: { projetoId, modulo } });
    if (!d) {
      d = this.repo.create({ projetoId, modulo });
    }
    if (tecnico !== undefined) d.consultor = tecnico.trim();
    if (opcoes.ordem !== undefined) d.ordem = opcoes.ordem;
    if (opcoes.naoDistribuir !== undefined)
      d.naoDistribuir = opcoes.naoDistribuir;
    if (opcoes.analista !== undefined) d.analista = opcoes.analista.trim();
    await this.repo.save(d);
    return n;
  }

  /** Chamado por `ProjetosService.excluir` — ver comentário equivalente em
   * cronograma.service.ts. */
  async limparProjeto(projetoId: number): Promise<void> {
    await this.repo.delete({ projetoId });
  }
}
