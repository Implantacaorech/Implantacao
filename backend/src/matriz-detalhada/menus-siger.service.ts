import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DicionarioDocumento } from '../database/entities/dicionario-documento.entity';

/** Um menu real do SIGER, extraído da tabela "Caminho | Opção | Programa | Função" do
 * documento do módulo/adicional no Dicionário. `codigo` é o código de acesso (ex.: "2.1-P"). */
export interface MenuSiger {
  codigo: string;
  opcao: string;
  programa: string;
  funcao: string;
}

export interface ModuloMenus {
  sigla: string;
  tipo: 'modulo' | 'adicional';
  titulo: string;
  menus: MenuSiger[];
}

const norm = (s: string): string =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * Taxonomia de MENUS do SIGER, derivada do DICIONÁRIO (fonte única). Cada documento
 * (21 módulos + 66 adicionais) traz uma tabela markdown "Caminho | Opção | Programa |
 * Função implantável" — cada linha é um menu, com o código de acesso na coluna Caminho.
 * Faz o parse sob demanda e guarda em memória (a base muda raramente; `limparCache` força
 * releitura, ex.: depois de reingerir o Dicionário).
 */
@Injectable()
export class MenusSigerService {
  constructor(
    @InjectRepository(DicionarioDocumento)
    private readonly docs: Repository<DicionarioDocumento>,
  ) {}

  private cache: ModuloMenus[] | null = null;

  async taxonomia(force = false): Promise<ModuloMenus[]> {
    if (this.cache && !force) return this.cache;
    const docs = await this.docs.find({
      order: { tipo: 'ASC', sigla: 'ASC' },
    });
    this.cache = docs
      .filter((d) => (d.sigla || '').trim())
      .map((d) => ({
        sigla: d.sigla.trim(),
        tipo: d.tipo,
        titulo: d.titulo,
        menus: this.parseMenus(d.conteudo),
      }));
    return this.cache;
  }

  limparCache(): void {
    this.cache = null;
  }

  /** Extrai os menus de todas as tabelas cujo cabeçalho tem a coluna "Caminho". */
  private parseMenus(conteudo: string): MenuSiger[] {
    const linhas = (conteudo || '').split(/\r?\n/);
    const menus: MenuSiger[] = [];
    const vistos = new Set<string>();
    let cols: { cod: number; opc: number; prog: number; fun: number } | null =
      null;

    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i].trim();
      const proxSep =
        i + 1 < linhas.length &&
        /^\|?[\s:|-]+\|?$/.test(linhas[i + 1].trim()) &&
        linhas[i + 1].includes('-');

      // Cabeçalho de tabela (linha | ... | seguida do separador |---|)
      if (l.startsWith('|') && proxSep) {
        const h = l
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => norm(c));
        const cod = h.findIndex((x) => x.includes('caminho'));
        cols =
          cod >= 0
            ? {
                cod,
                opc: h.findIndex((x) => x.includes('opcao') || x === 'menu'),
                prog: h.findIndex((x) => x.includes('programa')),
                fun: h.findIndex(
                  (x) =>
                    x.includes('funcao') ||
                    x.includes('uso') ||
                    x.includes('descric'),
                ),
              }
            : null;
        continue;
      }

      // Linha de dados dentro de uma tabela de menus
      if (l.startsWith('|') && cols) {
        const cells = l
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.replace(/`/g, '').trim());
        const codigo = (cells[cols.cod] || '').trim();
        if (!codigo || /^-+$/.test(codigo) || codigo.length > 16) continue;
        const chave = codigo.toLowerCase();
        if (vistos.has(chave)) continue; // sem duplicar código no mesmo módulo
        vistos.add(chave);
        menus.push({
          codigo,
          opcao: cols.opc >= 0 ? cells[cols.opc] || '' : '',
          programa: cols.prog >= 0 ? cells[cols.prog] || '' : '',
          funcao: cols.fun >= 0 ? cells[cols.fun] || '' : '',
        });
        continue;
      }

      // Saiu da tabela
      if (!l.startsWith('|')) cols = null;
    }
    return menus;
  }
}
