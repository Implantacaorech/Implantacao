import { Injectable } from '@nestjs/common';
import { DadosService } from '../dados/dados.service';
import {
  FuncaoSicla,
  GRUPO_SEM_MODULO,
  ModuloFuncoes,
  siglaDoToken,
} from './funcoes-sicla.constants';

/** Taxonomia da Matriz por Menu — Funções SICLA: pede `sicla.funcoes.listar` à API de
 * Dados (ADR-0003) e agrupa pela coluna STRMENUS.
 *
 * Equivale ao `MenusSigerService` da Matriz por Menu do Dicionário, com a mesma estratégia
 * de cache em memória — a base muda raramente e a consulta é remota. */
@Injectable()
export class FuncoesSiclaService {
  private cache: ModuloFuncoes[] | null = null;

  constructor(private readonly dados: DadosService) {}

  limparCache(): void {
    this.cache = null;
  }

  private texto(v: unknown): string {
    if (v === undefined || v === null) return '';
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return '';
  }

  /** Módulos com suas funções. `force` refaz a consulta ignorando o cache. */
  async taxonomia(force = false): Promise<ModuloFuncoes[]> {
    if (this.cache && !force) return this.cache;

    const r = await this.dados.consultar('sicla.funcoes.listar');
    if (!r.ok) {
      // Erro de conexão/SQL não vira cache — a próxima chamada tenta de novo.
      throw new Error(r.mensagem);
    }

    const grupos = new Map<string, Map<string, FuncaoSicla>>();
    const pegar = (sigla: string): Map<string, FuncaoSicla> => {
      let g = grupos.get(sigla);
      if (!g) {
        g = new Map<string, FuncaoSicla>();
        grupos.set(sigla, g);
      }
      return g;
    };

    for (const row of r.linhas) {
      const pega = (...chaves: string[]): string => {
        for (const k of chaves) {
          const t = this.texto(
            row[k] ?? row[k.toUpperCase()] ?? row[k.toLowerCase()],
          );
          if (t !== '') return t;
        }
        return '';
      };
      const codigo = pega('CODIGO', 'COD', 'CODFUNCAO');
      const descricao = pega('DESCRICAO', 'FUNCAO', 'NOME');
      const strMenus = pega('STRMENUS', 'MENUS', 'STR_MENUS');
      if (!codigo && !descricao) continue;

      // Um token por menu; a MESMA sigla pode aparecer em vários tokens (CTB94A e CTB95B),
      // então a função entra uma vez só no grupo, acumulando os caminhos.
      const porSigla = new Map<string, string[]>();
      for (const token of strMenus.split(';')) {
        const t = token.trim();
        if (!t) continue;
        const sigla = siglaDoToken(t);
        if (!sigla) continue;
        const lista = porSigla.get(sigla) ?? [];
        lista.push(t);
        porSigla.set(sigla, lista);
      }

      if (porSigla.size === 0) {
        // Sem STRMENUS, ou só com lixo do tipo "." / "94A": vai para o balde de triagem.
        const g = pegar(GRUPO_SEM_MODULO);
        if (!g.has(codigo)) {
          g.set(codigo, {
            codigo,
            descricao,
            menus: strMenus,
            chave: `${GRUPO_SEM_MODULO}|${codigo}`,
          });
        }
        continue;
      }

      for (const [sigla, tokens] of porSigla) {
        const g = pegar(sigla);
        if (!g.has(codigo)) {
          g.set(codigo, {
            codigo,
            descricao,
            menus: tokens.join(', '),
            chave: `${sigla}|${codigo}`,
          });
        }
      }
    }

    // Módulos em ordem alfabética; "Classificar" sempre por último (é triagem, não módulo).
    const modulos: ModuloFuncoes[] = [...grupos.entries()]
      .map(([sigla, funcoes]) => ({
        sigla,
        titulo: sigla === GRUPO_SEM_MODULO ? 'Sem módulo identificado' : sigla,
        funcoes: [...funcoes.values()],
      }))
      .sort((a, b) => {
        if (a.sigla === GRUPO_SEM_MODULO) return 1;
        if (b.sigla === GRUPO_SEM_MODULO) return -1;
        return a.sigla.localeCompare(b.sigla);
      });

    this.cache = modulos;
    return modulos;
  }
}
