import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsultaBD } from '../database/entities/consulta-bd.entity';

/** Consultas SQL nomeadas (área Sistema, Administrador) — espelha webapp/db.py
 * (ConsultaBD, consultas_bd_listar/consulta_bd_por_slug/consulta_bd_salvar/
 * consulta_bd_excluir). `colunaData`/`colunaSituacao`/`mostrarGrafico` são novas (motor de
 * dashboard genérico, ver entidade ConsultaBD).
 *
 * **Não semeia mais.** Desde a fase 1 do ADR-0003 quem cria as consultas padrão é o
 * `CatalogoSeedService`, derivando-as do catálogo da API de Dados — antes cada módulo
 * semeava a sua e o texto de `previsao_inicio_oficial` morava dentro deste arquivo. */
@Injectable()
export class ConsultaBdService {
  constructor(
    @InjectRepository(ConsultaBD) private readonly repo: Repository<ConsultaBD>,
  ) {}

  async listar(): Promise<ConsultaBD[]> {
    return this.repo.find({ order: { ordem: 'ASC', nome: 'ASC' } });
  }

  private normalizarSlug(slug: string): string {
    return (slug || '').trim().toLowerCase().replace(/\s+/g, '_');
  }

  async porSlug(slug: string): Promise<ConsultaBD | null> {
    const s = this.normalizarSlug(slug);
    if (!s) return null;
    return this.repo.findOne({ where: { slug: s } });
  }

  /** Cria (se novo) ou atualiza (se já existe) uma consulta salva — `slug` é a chave.
   * Campos `undefined` não mexem (exceto na criação, que usa nome/sql como estão, mesmo
   * vazios). Devolve o registro salvo, ou `null` se `slug` vier vazio. */
  async salvar(
    slugBruto: string,
    dados: {
      nome?: string;
      sql?: string;
      ordem?: number;
      colunaData?: string;
      colunaSituacao?: string;
      mostrarGrafico?: boolean;
      conexao?: string;
    } = {},
  ): Promise<ConsultaBD | null> {
    const slug = this.normalizarSlug(slugBruto);
    if (!slug) return null;
    let c = await this.repo.findOne({ where: { slug } });
    if (!c) {
      c = this.repo.create({
        slug,
        nome: dados.nome ?? slug,
        sql: dados.sql ?? '',
        colunaData: dados.colunaData ?? '',
        colunaSituacao: dados.colunaSituacao ?? '',
        mostrarGrafico: dados.mostrarGrafico ?? false,
        conexao: dados.conexao ?? 'sicla',
      });
    } else {
      if (dados.nome !== undefined) c.nome = dados.nome;
      if (dados.sql !== undefined) c.sql = dados.sql;
      if (dados.colunaData !== undefined) c.colunaData = dados.colunaData;
      if (dados.colunaSituacao !== undefined)
        c.colunaSituacao = dados.colunaSituacao;
      if (dados.mostrarGrafico !== undefined)
        c.mostrarGrafico = dados.mostrarGrafico;
      if (dados.conexao !== undefined) c.conexao = dados.conexao;
    }
    if (dados.ordem !== undefined) c.ordem = dados.ordem;
    return this.repo.save(c);
  }

  async excluir(slug: string): Promise<boolean> {
    const c = await this.porSlug(slug);
    if (!c) return false;
    await this.repo.remove(c);
    return true;
  }
}
