import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';
import { Repository } from 'typeorm';
import { ChecklistModelo } from '../database/entities/checklist-modelo.entity';

interface LinhaYaml {
  modulo?: string;
  adicional?: string;
  tipo?: string;
  integracoes?: string;
  golive?: string;
  menu?: string;
  item?: string;
  acao?: string;
  seq?: string | number;
}

/** Catálogo de referência (roteiro/check-list por módulo), fonte da agrupação em Visitas do
 * Agendador. Dado local (não versionado, específico da Rech) — populado a partir do mesmo
 * arquivo `tools/data/checklist_modulos.yaml` já usado pelo Painel Flask
 * (`webapp/db.py:_seed_checklist_modelo`), nunca embutido no código-fonte do backend. */
@Injectable()
export class ChecklistModeloService {
  private readonly logger = new Logger('ChecklistModeloService');

  constructor(
    @InjectRepository(ChecklistModelo)
    private readonly repo: Repository<ChecklistModelo>,
  ) {}

  async listarPorModulos(siglas: string[]): Promise<ChecklistModelo[]> {
    if (siglas.length === 0) return [];
    return this.repo
      .createQueryBuilder('c')
      .where('c.modulo IN (:...siglas)', { siglas })
      .orderBy('c.modulo', 'ASC')
      .addOrderBy('c.ordem', 'ASC')
      .addOrderBy('c.id', 'ASC')
      .getMany();
  }

  /** Idempotente — não faz nada se a tabela já tiver dados (mesmo comportamento do Flask). */
  async seedDoYaml(caminhoYaml?: string): Promise<number> {
    const jaExiste = await this.repo.count();
    if (jaExiste > 0) return jaExiste;

    const caminho =
      caminhoYaml ??
      join(process.cwd(), '..', 'tools', 'data', 'checklist_modulos.yaml');
    if (!existsSync(caminho)) {
      this.logger.warn(
        `checklist_modulos.yaml não encontrado em ${caminho} — catálogo fica vazio.`,
      );
      return 0;
    }
    const conteudo = readFileSync(caminho, 'utf8');
    const doc = load(conteudo) as { linhas?: LinhaYaml[] } | undefined;
    const linhas = doc?.linhas ?? [];

    const entidades = linhas.map((l, i) =>
      this.repo.create({
        ordem: i,
        modulo: String(l.modulo ?? ''),
        adicional: String(l.adicional ?? ''),
        tipo: String(l.tipo ?? ''),
        integracoes: String(l.integracoes ?? ''),
        golive: String(l.golive ?? ''),
        menu: String(l.menu ?? ''),
        item: String(l.item ?? ''),
        acao: String(l.acao ?? ''),
        seq: String(l.seq ?? ''),
      }),
    );
    if (entidades.length > 0) await this.repo.save(entidades);
    return entidades.length;
  }
}
