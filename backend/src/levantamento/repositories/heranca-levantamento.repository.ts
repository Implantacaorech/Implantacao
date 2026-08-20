import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocConteudo } from '../../database/entities/doc-conteudo.entity';
import { LevantamentoResposta } from '../../database/entities/levantamento-resposta.entity';

/** Leituras da etapa 3 (Levantamento) que alimentam a etapa 10 (Projeto). SÓ acesso a dado
 * (Guia Mestre §Responsabilidades → Repository): quem decide o que cada campo do Projeto
 * herda, e em que formato, é o `HerancaProjetoService`.
 *
 * Somente leitura de propósito — a gravação do Levantamento continua com
 * `LevantamentoRespostaService`/`DocConteudoService`, e a herança nunca escreve na etapa 3. */
@Injectable()
export class HerancaLevantamentoRepository {
  constructor(
    @InjectRepository(DocConteudo)
    private readonly conteudo: Repository<DocConteudo>,
    @InjectRepository(LevantamentoResposta)
    private readonly respostas: Repository<LevantamentoResposta>,
  ) {}

  /** Campos estruturados do Levantamento do projeto (campo -> valor já aparado). */
  async camposDoLevantamento(
    projetoId: number,
  ): Promise<Map<string, string>> {
    const linhas = await this.conteudo.find({
      where: { projetoId, doc: 'levantamento' },
    });
    return new Map(linhas.map((l) => [l.campo, (l.valor || '').trim()]));
  }

  /** Questionário respondido, na ordem em que aparece na tela do Levantamento. */
  async respostasDoProjeto(
    projetoId: number,
  ): Promise<LevantamentoResposta[]> {
    return this.respostas.find({
      where: { projetoId },
      order: { ordem: 'ASC', id: 'ASC' },
    });
  }
}
