import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LevantamentoResposta } from '../database/entities/levantamento-resposta.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { IndiceTopicoService } from '../catalogos/indice-topico.service';

/** Questionário do Levantamento: uma linha por tópico do Índice, semeada dos módulos
 * contratados do projeto, com a resposta digitada pelo consultor. Espelha webapp/db.py
 * (levantamento_seed, levantamento_respostas, levantamento_salvar, levantamento_resumo). */
@Injectable()
export class LevantamentoRespostaService {
  constructor(
    @InjectRepository(LevantamentoResposta)
    private readonly repo: Repository<LevantamentoResposta>,
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    private readonly indice: IndiceTopicoService,
  ) {}

  /** Garante o seed a partir dos módulos contratados do projeto — chamado antes de
   * qualquer leitura das respostas (mesmo padrão do `garantirSeed` do Agendador). */
  async garantirSeed(projetoId: number): Promise<void> {
    const projeto = await this.projetos.findOne({ where: { id: projetoId } });
    if (!projeto) return;
    await this.seed(projetoId, projeto.modulos || '');
  }

  /** Idempotente — não recria nem apaga respostas já digitadas. Devolve o total. */
  async seed(projetoId: number, modulosStr: string): Promise<number> {
    const ja = await this.repo.count({ where: { projetoId } });
    if (ja > 0) return ja;

    const siglas = [
      ...new Set(
        (modulosStr || '')
          .split(/[,;\n]+/)
          .map((m) => m.trim().toUpperCase())
          .filter(Boolean),
      ),
    ];
    const modulos = await this.indice.modulos();
    const nomes = new Map(modulos.map((m) => [m.sigla.toUpperCase(), m.nome]));

    const linhas: LevantamentoResposta[] = [];
    for (const sig of siglas) {
      const { linhas: topicos } = await this.indice.listar({ modulo: sig });
      for (const t of topicos) {
        linhas.push(
          this.repo.create({
            projetoId,
            ordem: linhas.length,
            moduloSigla: sig,
            modulo: nomes.get(sig) ?? t.modulo,
            adicional: t.adicional,
            topico: t.topico,
          }),
        );
      }
    }
    if (linhas.length > 0) await this.repo.save(linhas);
    return linhas.length;
  }

  async listar(projetoId: number): Promise<LevantamentoResposta[]> {
    return this.repo.find({
      where: { projetoId },
      order: { ordem: 'ASC', id: 'ASC' },
    });
  }

  /** `respostas` = { [id da linha]: resposta }. Devolve o nº de respostas preenchidas. */
  async salvar(
    projetoId: number,
    respostas: Record<string, string>,
  ): Promise<number> {
    const linhas = await this.repo.find({ where: { projetoId } });
    let n = 0;
    for (const r of linhas) {
      const v = (respostas[String(r.id)] ?? '').trim();
      r.resposta = v;
      if (v) n++;
    }
    await this.repo.save(linhas);
    return n;
  }

  /** Casa cada tópico já semeado com a frase do Levantamento (.docx) que o menciona —
   * a resposta é o texto que vem DEPOIS do tópico na mesma linha. Não apaga respostas já
   * preenchidas manualmente (só sobrescreve quando encontra algo no documento). Devolve o
   * nº de respostas preenchidas a partir do arquivo. Recebe os parágrafos já extraídos
   * (não lê o .docx aqui — quem lê é o gerador legado via subprocesso, ver
   * LegadoCliService; esta camada nunca toca em arquivo, só nas próprias linhas).
   * Equivalente a webapp/db.py:levantamento_importar_respostas. */
  async importarDeParagrafos(projetoId: number, paragrafos: string[]): Promise<number> {
    const linhas = await this.repo.find({ where: { projetoId } });
    let n = 0;
    for (const r of linhas) {
      const topico = (r.topico || '').trim();
      if (!topico) continue;
      let resposta = '';
      for (const bruta of paragrafos) {
        resposta = this.depoisDoTopico(bruta, topico);
        if (resposta) break;
      }
      if (resposta) {
        r.resposta = resposta;
        n++;
      }
    }
    if (n > 0) await this.repo.save(linhas);
    return n;
  }

  private depoisDoTopico(bruta: string, topico: string): string {
    const brutaMin = bruta.toLowerCase();
    const topicoMin = topico.toLowerCase();
    const i = brutaMin.indexOf(topicoMin);
    if (i < 0) return '';
    const resto = bruta
      .slice(i + topico.length)
      .replace(/^[\s\t:;\-–—•·]+/, '')
      .trim();
    // ignora placeholders do modelo em branco (ex.: "<xxxx>")
    if (!resto || (resto.startsWith('<') && resto.endsWith('>'))) return '';
    return resto;
  }

  async resumo(
    projetoId: number,
  ): Promise<{ respondidas: number; total: number }> {
    const linhas = await this.repo.find({ where: { projetoId } });
    return {
      respondidas: linhas.filter((l) => (l.resposta || '').trim()).length,
      total: linhas.length,
    };
  }

  /** Chamado por `ProjetosService.excluir` — ver comentário equivalente em
   * cronograma.service.ts. */
  async limparProjeto(projetoId: number): Promise<void> {
    await this.repo.delete({ projetoId });
  }
}
