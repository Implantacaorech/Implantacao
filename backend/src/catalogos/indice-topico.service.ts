import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';
import { Repository } from 'typeorm';
import { IndiceTopico } from '../database/entities/indice-topico.entity';

interface LinhaYaml {
  ordem?: number;
  modulo_num?: string;
  modulo_sigla?: string;
  modulo?: string;
  adicional_num?: string;
  adicional_sigla?: string;
  adicional?: string;
  topico?: string;
}

export interface ModuloIndice {
  sigla: string;
  nome: string;
}

/** Índice de Tópicos para Mapeamento de Processos — catálogo de referência, editável, fonte
 * do seed de LevantamentoResposta por projeto. Dado local (`tools/data/indice_topicos.yaml`),
 * mesmo padrão de `ChecklistModeloService`. Espelha webapp/db.py (indice_*). */
@Injectable()
export class IndiceTopicoService implements OnModuleInit {
  private readonly logger = new Logger('IndiceTopicoService');

  constructor(
    @InjectRepository(IndiceTopico)
    private readonly repo: Repository<IndiceTopico>,
  ) {}

  /** Semeia automaticamente no boot (mesmo padrão do ChecklistModeloService) — pulado em
   * ambiente de teste. */
  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    try {
      await this.seedDoYaml();
    } catch (e) {
      this.logger.error(
        'Falha ao semear indice_topicos no boot',
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  async listar(
    filtro: { modulo?: string; q?: string } = {},
  ): Promise<{ linhas: IndiceTopico[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('t')
      .orderBy('t.ordem', 'ASC')
      .addOrderBy('t.id', 'ASC');
    if (filtro.modulo)
      qb.andWhere('t.moduloSigla = :modulo', { modulo: filtro.modulo });
    if (filtro.q) {
      qb.andWhere(
        '(LOWER(t.topico) LIKE :q OR LOWER(t.adicional) LIKE :q OR LOWER(t.modulo) LIKE :q)',
        {
          q: `%${filtro.q.toLowerCase()}%`,
        },
      );
    }
    const [linhas, total] = await qb.getManyAndCount();
    return { linhas, total };
  }

  /** Tópicos do Índice que correspondem aos CÓDIGOS contratados — a MESMA numeração do
   * SICLA (LISTA_SISTEMAS) que o seletor de módulos grava em `Projeto.modulos`. Para um
   * código de MÓDULO traz os tópicos BASE do módulo (sem adicional); para um código de
   * ADICIONAL traz os tópicos daquele adicional. Traz exatamente o que foi contratado —
   * se vier módulo e adicional, os dois conjuntos; se vier só um, só o dele. */
  async porCodigos(codigos: string[]): Promise<IndiceTopico[]> {
    const cods = [...new Set(codigos.map((c) => (c ?? '').trim()).filter(Boolean))];
    if (cods.length === 0) return [];
    return this.repo
      .createQueryBuilder('t')
      .where(
        "(t.moduloNum IN (:...cods) AND (t.adicionalNum = '' OR t.adicionalNum IS NULL)) " +
          'OR t.adicionalNum IN (:...cods)',
        { cods },
      )
      .orderBy('t.ordem', 'ASC')
      .addOrderBy('t.id', 'ASC')
      .getMany();
  }

  /** (sigla, nome) distintos dos módulos principais, na ordem em que aparecem no catálogo. */
  async modulos(): Promise<ModuloIndice[]> {
    const linhas = await this.repo.find({ order: { ordem: 'ASC', id: 'ASC' } });
    const vistos = new Set<string>();
    const out: ModuloIndice[] = [];
    for (const r of linhas) {
      const chave = `${r.moduloSigla}|${r.modulo}`;
      if (r.moduloSigla && !vistos.has(chave)) {
        vistos.add(chave);
        out.push({ sigla: r.moduloSigla, nome: r.modulo });
      }
    }
    return out;
  }

  async salvar(
    dto: Partial<IndiceTopico> & { id?: number },
  ): Promise<IndiceTopico> {
    if (dto.id) {
      const existente = await this.repo.findOne({ where: { id: dto.id } });
      if (existente) {
        Object.assign(existente, dto);
        return this.repo.save(existente);
      }
    }
    const ultima = await this.repo.findOne({
      where: {},
      order: { ordem: 'DESC' },
    });
    const novo = this.repo.create({
      ...dto,
      ordem: ultima ? ultima.ordem + 1 : 0,
    });
    return this.repo.save(novo);
  }

  async excluir(id: number): Promise<void> {
    await this.repo.delete(id);
  }

  async seedDoYaml(caminhoYaml?: string): Promise<number> {
    const jaExiste = await this.repo.count();
    if (jaExiste > 0) return jaExiste;
    return this.importarDoYaml(caminhoYaml);
  }

  /** Reimporta do YAML, substituindo TODO o catálogo. Devolve o total de linhas. */
  async reimportar(caminhoYaml?: string): Promise<number> {
    await this.repo.clear();
    return this.importarDoYaml(caminhoYaml);
  }

  private async importarDoYaml(caminhoYaml?: string): Promise<number> {
    const caminho =
      caminhoYaml ??
      join(process.cwd(), '..', 'tools', 'data', 'indice_topicos.yaml');
    if (!existsSync(caminho)) {
      this.logger.warn(
        `indice_topicos.yaml não encontrado em ${caminho} — catálogo fica vazio.`,
      );
      return 0;
    }
    const doc = load(readFileSync(caminho, 'utf8')) as
      { linhas?: LinhaYaml[] } | undefined;
    const linhas = doc?.linhas ?? [];
    const entidades = linhas.map((l, i) =>
      this.repo.create({
        ordem: Number(l.ordem ?? i),
        moduloNum: String(l.modulo_num ?? ''),
        moduloSigla: String(l.modulo_sigla ?? ''),
        modulo: String(l.modulo ?? ''),
        adicionalNum: String(l.adicional_num ?? ''),
        adicionalSigla: String(l.adicional_sigla ?? ''),
        adicional: String(l.adicional ?? ''),
        topico: String(l.topico ?? ''),
      }),
    );
    if (entidades.length > 0) await this.repo.save(entidades);
    return entidades.length;
  }
}
