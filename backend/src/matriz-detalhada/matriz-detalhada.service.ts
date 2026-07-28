import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatrizTecnico } from '../database/entities/matriz-tecnico.entity';
import { MenusSigerService } from './menus-siger.service';

export interface MenuComNota {
  codigo: string;
  opcao: string;
  programa: string;
  funcao: string;
  chave: string;
  nota: number | null;
}
export interface ModuloComNotas {
  sigla: string;
  tipo: 'modulo' | 'adicional';
  titulo: string;
  total: number;
  avaliadas: number;
  media: number | null;
  menus: MenuComNota[];
}

/** Regras de negócio da Matriz DETALHADA (por menu). Reusa a taxonomia do Dicionário
 * (MenusSigerService) e as notas por menu do próprio técnico. A nota de um módulo é a MÉDIA
 * das notas dos seus menus avaliados. */
@Injectable()
export class MatrizDetalhadaService {
  constructor(
    @InjectRepository(MatrizTecnico)
    private readonly tecnicos: Repository<MatrizTecnico>,
    private readonly menus: MenusSigerService,
  ) {}

  notasMenu(t: MatrizTecnico): Record<string, number> {
    try {
      return JSON.parse(t.notasMenu || '{}') as Record<string, number>;
    } catch {
      return {};
    }
  }

  private media(valores: (number | null)[]): number | null {
    const v = valores.filter((n): n is number => n != null);
    if (!v.length) return null;
    return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
  }

  /** Ficha detalhada: taxonomia do SIGER cruzada com as notas do técnico + médias. */
  async ficha(t: MatrizTecnico): Promise<{
    modulos: ModuloComNotas[];
    resumo: { media: number | null; avaliadas: number; total: number };
  }> {
    const tax = await this.menus.taxonomia();
    const notas = this.notasMenu(t);
    const modulos: ModuloComNotas[] = tax.map((m) => {
      const linhas: MenuComNota[] = m.menus.map((menu) => {
        const chave = `${m.sigla}|${menu.codigo}`;
        return {
          ...menu,
          chave,
          nota: chave in notas ? notas[chave] : null,
        };
      });
      const avaliadas = linhas.filter((l) => l.nota != null);
      return {
        sigla: m.sigla,
        tipo: m.tipo,
        titulo: m.titulo,
        total: linhas.length,
        avaliadas: avaliadas.length,
        media: this.media(linhas.map((l) => l.nota)),
        menus: linhas,
      };
    });
    // Resumo geral: média das médias dos módulos que têm nota; cobertura de menus.
    const resumo = {
      media: this.media(modulos.map((m) => m.media)),
      avaliadas: modulos.reduce((a, m) => a + m.avaliadas, 0),
      total: modulos.reduce((a, m) => a + m.total, 0),
    };
    return { modulos, resumo };
  }

  /** Média GERAL (todos os técnicos) por módulo/adicional: para cada técnico calcula a média
   * dele no módulo (dos menus que avaliou) e tira a média dessas médias — cada técnico pesa
   * igual, independente de quantos menus avaliou. `tecnicos` = quantos contribuíram. */
  async mediasGerais(): Promise<
    {
      sigla: string;
      tipo: 'modulo' | 'adicional';
      titulo: string;
      media: number | null;
      tecnicos: number;
      total: number;
    }[]
  > {
    const tax = await this.menus.taxonomia();
    const todos = await this.tecnicos.find();
    const notasPorTecnico = todos.map((t) => this.notasMenu(t));
    return tax.map((m) => {
      const chaves = m.menus.map((menu) => `${m.sigla}|${menu.codigo}`);
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
        tipo: m.tipo,
        titulo: m.titulo,
        media: this.media(mediasTecnico),
        tecnicos: mediasTecnico.length,
        total: m.menus.length,
      };
    });
  }

  /** Grava notas por menu (0-10; vazio remove). Chaves são "SIGLA|codigo". */
  async salvar(
    id: number,
    notas: Record<string, string>,
    autor: string,
  ): Promise<boolean> {
    const t = await this.tecnicos.findOne({ where: { id } });
    if (!t) return false;
    const atual = this.notasMenu(t);
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
    t.notasMenu = JSON.stringify(atual);
    t.atualizadoEm = new Date();
    t.atualizadoPor = autor || '';
    await this.tecnicos.save(t);
    return true;
  }
}
