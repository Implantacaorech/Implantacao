import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsultaBD } from '../database/entities/consulta-bd.entity';

// Espelha webapp/db.py:_SQL_PREVISAO_INICIO_OFICIAL — mesmo texto, mesmos comentários de
// aviso para o Administrador conferir o nome real das colunas na view.
const SQL_PREVISAO_INICIO_OFICIAL = `-- Clientes com Previsao de Inicio Oficial dentro do periodo informado (view POWERBI do SICLA).
-- AJUSTE SE PRECISO: "DATA PREVISAO INICIO OFICIAL" foi o nome adotado seguindo o padrao da
-- view (DATA CRIACAO, DATA CONTRATACAO, DATA ENCERRAMENTO...) -- confirme o nome real da
-- coluna no banco (o Administrador tem acesso a rede/banco para conferir) e corrija aqui.
SELECT
  CODIGO,
  DESCRICAO,
  CLIENTE,
  FANTASIA,
  RESPONSAVELDES AS RESPONSAVEL,
  "DATA CONTRATACAO" AS DATA_CONTRATACAO,
  "DATA PREVISAO INICIO OFICIAL" AS PREVISAO_INICIO_OFICIAL,
  STATUSIMP AS SITUACAO
FROM POWERBI.POWERBI_IMP_RNIMPLANTACAO_2
WHERE "DATA PREVISAO INICIO OFICIAL" BETWEEN :data_ini AND :data_fim
ORDER BY "DATA PREVISAO INICIO OFICIAL"`;

/** Consultas SQL nomeadas (área Sistema, Administrador) — espelha webapp/db.py
 * (ConsultaBD, consultas_bd_listar/consulta_bd_por_slug/consulta_bd_salvar/
 * consulta_bd_excluir, _seed_consultas_bd). `colunaData`/`colunaSituacao`/
 * `mostrarGrafico` são novas (motor de dashboard genérico, ver entidade ConsultaBD). */
@Injectable()
export class ConsultaBdService implements OnModuleInit {
  private readonly logger = new Logger('ConsultaBdService');

  constructor(
    @InjectRepository(ConsultaBD) private readonly repo: Repository<ConsultaBD>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    try {
      await this.seedPadrao();
    } catch (e) {
      this.logger.error(
        'Falha ao semear consultas_bd no boot',
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  /** Idempotente — não sobrescreve se o Administrador já tiver editado. */
  async seedPadrao(): Promise<boolean> {
    const existe = await this.repo.findOne({
      where: { slug: 'previsao_inicio_oficial' },
    });
    if (existe) return false;
    await this.repo.save(
      this.repo.create({
        slug: 'previsao_inicio_oficial',
        nome: 'Previsão Início Oficial',
        sql: SQL_PREVISAO_INICIO_OFICIAL,
        ordem: 1,
        colunaData: 'PREVISAO_INICIO_OFICIAL',
        colunaSituacao: 'SITUACAO',
        mostrarGrafico: true,
      }),
    );
    return true;
  }

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
