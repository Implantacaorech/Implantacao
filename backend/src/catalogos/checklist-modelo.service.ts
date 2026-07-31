import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
export class ChecklistModeloService implements OnModuleInit {
  private readonly logger = new Logger('ChecklistModeloService');

  constructor(
    @InjectRepository(ChecklistModelo)
    private readonly repo: Repository<ChecklistModelo>,
  ) {}

  /** Semeia automaticamente no boot — mesmo padrão do `init_db()` do Flask, que chama
   * `_seed_checklist_modelo()` a cada subida. Nunca falha o boot (só loga). Pulado em
   * ambiente de teste (Jest força `NODE_ENV=test`) — os testes controlam seus próprios
   * dados sintéticos e nunca devem carregar o catálogo real da empresa sem querer. */
  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    try {
      await this.seedDoYaml();
    } catch (e) {
      this.logger.error(
        'Falha ao semear checklist_modelo no boot',
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  /** Linhas do roteiro dos módulos/adicionais contratados.
   *
   * O catálogo tem DOIS níveis: `modulo` é o módulo-pai (FAT) e `adicional` é o item fino
   * (NFE, BRO, UFX…). Cada linha traz os dois — nas linhas do próprio módulo, `adicional`
   * repete o `modulo` (FAT/FAT).
   *
   * O contrato é fechado no nível do ADICIONAL quando ele existe (mesma regra do passo 1,
   * ver `modulos-sicla.constants.ts`), então casar por `adicional` é o que devolve
   * exatamente o que o cliente comprou: quem contratou FAT recebe as linhas FAT/FAT, e não
   * também as de NFE e BRO, que ele não tem. O `OR` por `modulo` é só a rede de segurança
   * para linhas antigas sem `adicional` preenchido. */
  async listarPorModulos(siglas: string[]): Promise<ChecklistModelo[]> {
    if (siglas.length === 0) return [];
    return this.repo
      .createQueryBuilder('c')
      .where(
        '(c.adicional IN (:...siglas) OR (c.modulo IN (:...siglas) AND (c.adicional IS NULL OR c.adicional = :vazio)))',
        { siglas, vazio: '' },
      )
      .orderBy('c.modulo', 'ASC')
      .addOrderBy('c.ordem', 'ASC')
      .addOrderBy('c.id', 'ASC')
      .getMany();
  }

  async listar(
    filtro: {
      modulo?: string;
      q?: string;
      offset?: number;
      limite?: number;
    } = {},
  ): Promise<{ linhas: ChecklistModelo[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('c')
      .orderBy('c.ordem', 'ASC')
      .addOrderBy('c.id', 'ASC');
    if (filtro.modulo) {
      qb.andWhere('(c.modulo = :modulo OR c.adicional = :modulo)', {
        modulo: filtro.modulo,
      });
    }
    if (filtro.q) {
      qb.andWhere(
        '(LOWER(c.item) LIKE :q OR LOWER(c.acao) LIKE :q OR LOWER(c.menu) LIKE :q)',
        {
          q: `%${filtro.q.toLowerCase()}%`,
        },
      );
    }
    const total = await qb.getCount();
    if (filtro.offset) qb.skip(filtro.offset);
    if (filtro.limite) qb.take(filtro.limite);
    const linhas = await qb.getMany();
    return { linhas, total };
  }

  /** Códigos distintos (módulo/adicional) para o filtro da tela de Cadastros. */
  async modulosDistintos(): Promise<string[]> {
    const modulos = await this.repo
      .createQueryBuilder('c')
      .select('DISTINCT c.modulo', 'modulo')
      .getRawMany<{ modulo: string }>();
    const adicionais = await this.repo
      .createQueryBuilder('c')
      .select('DISTINCT c.adicional', 'adicional')
      .getRawMany<{ adicional: string }>();
    const set = new Set<string>();
    for (const m of modulos) if (m.modulo) set.add(m.modulo);
    for (const a of adicionais) if (a.adicional) set.add(a.adicional);
    return [...set].sort();
  }

  async salvar(
    dto: Partial<ChecklistModelo> & { id?: number },
  ): Promise<ChecklistModelo> {
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

  /** Idempotente — não faz nada se a tabela já tiver dados (mesmo comportamento do Flask). */
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
