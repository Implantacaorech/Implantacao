import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DisponibilidadeService } from '../disponibilidade/disponibilidade.service';
import { ConsultaBdService } from '../disponibilidade/consulta-bd.service';
import {
  FuncaoSicla,
  GRUPO_SEM_MODULO,
  ModuloFuncoes,
  NOME_LISTA_FUNCOES,
  siglaDoToken,
  SLUG_LISTA_FUNCOES,
  SQL_LISTA_FUNCOES_PADRAO,
} from './funcoes-sicla.constants';

/** Taxonomia da Matriz por Menu — Funções SICLA: lê `SICLA.LISTA_FUNCOES` (mesma conexão
 * Oracle da Disponibilidade) e agrupa pela coluna STRMENUS.
 *
 * Equivale ao `MenusSigerService` da Matriz por Menu do Dicionário, com a mesma estratégia
 * de cache em memória — a base muda raramente e a consulta é remota. */
@Injectable()
export class FuncoesSiclaService implements OnModuleInit {
  private readonly logger = new Logger('FuncoesSiclaService');
  private cache: ModuloFuncoes[] | null = null;

  constructor(
    private readonly disponibilidade: DisponibilidadeService,
    private readonly consultas: ConsultaBdService,
  ) {}

  /** Semeia o SQL (idempotente) para o Administrador editar em Consultas BD. */
  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const existe = await this.consultas.porSlug(SLUG_LISTA_FUNCOES);
      if (!existe) {
        await this.consultas.salvar(SLUG_LISTA_FUNCOES, {
          nome: NOME_LISTA_FUNCOES,
          sql: SQL_LISTA_FUNCOES_PADRAO,
          ordem: 96,
          mostrarGrafico: false,
        });
      }
    } catch (e) {
      this.logger.error(
        'Falha ao semear a consulta da lista de funções do SICLA',
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  limparCache(): void {
    this.cache = null;
  }

  private async sqlLista(): Promise<string> {
    const c = await this.consultas.porSlug(SLUG_LISTA_FUNCOES);
    const sql = (c?.sql ?? '').trim();
    return sql || SQL_LISTA_FUNCOES_PADRAO;
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

    const sql = await this.sqlLista();
    const r = await this.disponibilidade.executarSql(sql, {}, undefined, 5000);
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
