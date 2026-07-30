import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatrizTecnico } from '../database/entities/matriz-tecnico.entity';
import { FuncoesSiclaService } from './funcoes-sicla.service';

export interface FuncaoComNota {
  codigo: string;
  descricao: string;
  menus: string;
  chave: string;
  nota: number | null;
}
export interface ModuloComNotasFuncao {
  sigla: string;
  titulo: string;
  total: number;
  avaliadas: number;
  media: number | null;
  funcoes: FuncaoComNota[];
}

/** Regras de negócio da Matriz por Menu — FUNÇÕES SICLA. Mesma mecânica da Matriz por Menu
 * do Dicionário (nota 0-10 por item, média do módulo = média dos itens avaliados), só que a
 * taxonomia vem de `SICLA.LISTA_FUNCOES` agrupada por STRMENUS, e as notas ficam em
 * `notas_funcao`. */
@Injectable()
export class MatrizFuncoesService {
  constructor(
    @InjectRepository(MatrizTecnico)
    private readonly tecnicos: Repository<MatrizTecnico>,
    private readonly funcoes: FuncoesSiclaService,
  ) {}

  notasFuncao(t: MatrizTecnico): Record<string, number> {
    try {
      return JSON.parse(t.notasFuncao || '{}') as Record<string, number>;
    } catch {
      return {};
    }
  }

  private media(valores: (number | null)[]): number | null {
    const v = valores.filter((n): n is number => n != null);
    if (!v.length) return null;
    return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
  }

  /** Ficha: taxonomia das funções cruzada com as notas do técnico + médias. */
  async ficha(t: MatrizTecnico): Promise<{
    modulos: ModuloComNotasFuncao[];
    resumo: { media: number | null; avaliadas: number; total: number };
  }> {
    const tax = await this.funcoes.taxonomia();
    const notas = this.notasFuncao(t);
    const modulos: ModuloComNotasFuncao[] = tax.map((m) => {
      const linhas: FuncaoComNota[] = m.funcoes.map((f) => ({
        codigo: f.codigo,
        descricao: f.descricao,
        menus: f.menus,
        chave: f.chave,
        nota: f.chave in notas ? notas[f.chave] : null,
      }));
      const avaliadas = linhas.filter((l) => l.nota != null);
      return {
        sigla: m.sigla,
        titulo: m.titulo,
        total: linhas.length,
        avaliadas: avaliadas.length,
        media: this.media(linhas.map((l) => l.nota)),
        funcoes: linhas,
      };
    });
    const resumo = {
      media: this.media(modulos.map((m) => m.media)),
      avaliadas: modulos.reduce((a, m) => a + m.avaliadas, 0),
      total: modulos.reduce((a, m) => a + m.total, 0),
    };
    return { modulos, resumo };
  }

  /** Média GERAL (todos os técnicos) por módulo: para cada técnico, a média dele no módulo;
   * depois a média dessas médias — cada técnico pesa igual, independente de quantas funções
   * avaliou. `tecnicos` = quantos contribuíram. */
  async mediasGerais(): Promise<
    {
      sigla: string;
      titulo: string;
      media: number | null;
      tecnicos: number;
      total: number;
    }[]
  > {
    const tax = await this.funcoes.taxonomia();
    const todos = await this.tecnicos.find();
    const notasPorTecnico = todos.map((t) => this.notasFuncao(t));
    return tax.map((m) => {
      const chaves = m.funcoes.map((f) => f.chave);
      const mediasTecnico: number[] = [];
      for (const notas of notasPorTecnico) {
        const vals = chaves
          .map((c) => (c in notas ? notas[c] : null))
          .filter((n): n is number => n != null);
        if (vals.length) {
          mediasTecnico.push(vals.reduce((a, b) => a + b, 0) / vals.length);
        }
      }
      return {
        sigla: m.sigla,
        titulo: m.titulo,
        media: this.media(mediasTecnico),
        tecnicos: mediasTecnico.length,
        total: m.funcoes.length,
      };
    });
  }

  /** Grava notas por função (0-10; vazio remove). Chaves são "SIGLA|codigo". */
  async salvar(
    id: number,
    notas: Record<string, string>,
    autor: string,
  ): Promise<boolean> {
    const t = await this.tecnicos.findOne({ where: { id } });
    if (!t) return false;
    const atual = this.notasFuncao(t);
    for (const [chave, bruto] of Object.entries(notas ?? {})) {
      const v = (bruto ?? '').toString().trim().replace(',', '.');
      if (v === '') {
        delete atual[chave];
        continue;
      }
      const f = parseFloat(v);
      if (Number.isNaN(f)) continue;
      atual[chave] = Math.max(0, Math.min(10, Math.round(f)));
    }
    t.notasFuncao = JSON.stringify(atual);
    t.atualizadoEm = new Date();
    t.atualizadoPor = autor || '';
    await this.tecnicos.save(t);
    return true;
  }
}
