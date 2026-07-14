import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workbook } from 'exceljs';
import { join } from 'path';
import { MatrizCompetencia } from '../database/entities/matriz-competencia.entity';
import { MatrizTecnico } from '../database/entities/matriz-tecnico.entity';
import { parseMatrizWorksheet } from './matriz-import.util';

export interface ResultadoImportacao {
  novasCompetencias: number;
  novosTecnicos: number;
  ignorados: number;
}

/** Matriz de Conhecimento (notas 0-10 por técnico x competência). Espelha
 * webapp/db.py (modelos + funções `matriz_*`) e webapp/matriz.py (importador da
 * planilha). A planilha de origem (`docs/Matriz de Conhecimento.xlsx`) não é versionada
 * no git (arquivo local do time) — o import é sempre ADITIVO: nunca sobrescreve um
 * técnico já cadastrado, preservando notas editadas na tela. */
@Injectable()
export class MatrizService {
  private readonly logger = new Logger('MatrizService');

  constructor(
    @InjectRepository(MatrizCompetencia)
    private readonly competencias: Repository<MatrizCompetencia>,
    @InjectRepository(MatrizTecnico)
    private readonly tecnicos: Repository<MatrizTecnico>,
  ) {}

  async competenciasListar(): Promise<MatrizCompetencia[]> {
    return this.competencias.find({ order: { ordem: 'ASC' } });
  }

  async listar(): Promise<MatrizTecnico[]> {
    return this.tecnicos.find({ order: { nome: 'ASC' } });
  }

  async buscar(id: number): Promise<MatrizTecnico | null> {
    return this.tecnicos.findOne({ where: { id } });
  }

  notas(t: MatrizTecnico): Record<string, number> {
    try {
      return JSON.parse(t.notas || '{}') as Record<string, number>;
    } catch {
      return {};
    }
  }

  /** Áreas na ordem do catálogo, cada uma com suas competências — usado na ficha. */
  async areasComCompetencias(): Promise<[string, MatrizCompetencia[]][]> {
    const comps = await this.competenciasListar();
    const areas: [string, MatrizCompetencia[]][] = [];
    for (const c of comps) {
      if (areas.length === 0 || areas[areas.length - 1][0] !== c.area) {
        areas.push([c.area, []]);
      }
      areas[areas.length - 1][1].push(c);
    }
    return areas;
  }

  /** A linha da matriz de um usuário: casa pelo Código SICLA ou pelo nome (case-insensitive).
   * Espelha webapp/db.py:matriz_linha_do_usuario — aqui recebe as chaves já resolvidas
   * (o JWT já carrega nome/codigoSicla, sem precisar reconsultar Usuario). */
  async linhaDoUsuario(nome: string, codigoSicla: string): Promise<MatrizTecnico | null> {
    const chaves = new Set(
      [codigoSicla, nome].map((x) => (x || '').trim().toLowerCase()).filter(Boolean),
    );
    if (chaves.size === 0) return null;
    const todos = await this.tecnicos.find();
    return todos.find((t) => chaves.has((t.nome || '').trim().toLowerCase())) ?? null;
  }

  /** Grava notas (0-10; valor vazio remove), setor e dias. Devolve false se o técnico não
   * existe. Espelha webapp/db.py:matriz_salvar_notas. */
  async salvarNotas(
    id: number,
    form: { setor?: string; dias?: string; notas?: Record<string, string> },
    autor: string,
  ): Promise<boolean> {
    const t = await this.tecnicos.findOne({ where: { id } });
    if (!t) return false;

    let notas: Record<string, number> = {};
    try {
      notas = JSON.parse(t.notas || '{}') as Record<string, number>;
    } catch {
      notas = {};
    }
    const siglas = new Set((await this.competencias.find()).map((c) => c.sigla));
    for (const [sigla, bruto] of Object.entries(form.notas ?? {})) {
      if (!siglas.has(sigla)) continue;
      const v = (bruto ?? '').trim().replace(',', '.');
      if (v === '') {
        delete notas[sigla];
        continue;
      }
      const f = parseFloat(v);
      if (Number.isNaN(f)) continue;
      notas[sigla] = Math.max(0, Math.min(10, Math.trunc(f)));
    }
    t.notas = JSON.stringify(notas);
    if (form.setor !== undefined) t.setor = form.setor.trim();
    if (form.dias !== undefined) t.dias = form.dias.trim();
    t.atualizadoEm = new Date();
    t.atualizadoPor = autor || '';
    await this.tecnicos.save(t);
    return true;
  }

  private caminhoPadrao(): string {
    return join(process.cwd(), '..', 'docs', 'Matriz de Conhecimento.xlsx');
  }

  /** Reimporta a planilha (aditivo). Espelha webapp/matriz.py:importar. */
  async importar(autor = 'importação', caminho?: string): Promise<ResultadoImportacao> {
    const wb = new Workbook();
    await wb.xlsx.readFile(caminho ?? this.caminhoPadrao());
    const ws = wb.getWorksheet('Matriz') ?? wb.worksheets[0];
    if (!ws) throw new Error('Planilha sem abas.');
    const { comps, tecnicos } = parseMatrizWorksheet(ws);

    const existentesComp = new Set((await this.competencias.find()).map((c) => c.sigla));
    let novasCompetencias = 0;
    for (const c of comps) {
      if (existentesComp.has(c.sigla)) continue;
      await this.competencias.save(this.competencias.create(c));
      novasCompetencias++;
    }

    const nomesExistentes = new Set(
      (await this.tecnicos.find()).map((t) => (t.nome || '').trim().toLowerCase()),
    );
    let novosTecnicos = 0;
    let ignorados = 0;
    for (const t of tecnicos) {
      if (nomesExistentes.has(t.nome.toLowerCase())) {
        ignorados++;
        continue;
      }
      await this.tecnicos.save(
        this.tecnicos.create({
          nome: t.nome,
          setor: t.setor,
          dias: t.dias,
          notas: JSON.stringify(t.notas),
          atualizadoEm: new Date(),
          atualizadoPor: autor,
        }),
      );
      novosTecnicos++;
    }
    this.logger.log(
      `Matriz: ${novasCompetencias} competências novas, ${novosTecnicos} técnicos novos, ${ignorados} preservados.`,
    );
    return { novasCompetencias, novosTecnicos, ignorados };
  }
}
