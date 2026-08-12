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
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Cabeçalhos que carregam o NOME do menu, em ordem de prioridade — o primeiro que existir
 * na tabela manda.
 *
 * A lista é grande porque os 87 documentos do Dicionário usam **81 formatos diferentes de
 * cabeçalho** (medido em 2026-08-12 sobre a base de produção). Só `Opcao` e `Menu` eram
 * reconhecidos, e o resultado era um catálogo com 275 dos 416 menus SEM NOME — ou seja,
 * impossíveis de casar contra uma transcrição, já que o consultor fala o nome da tela, não
 * o código dela.
 *
 * `configuracao` e `papel` ficam no fim de propósito: em algumas tabelas eles são o nome da
 * rotina ("Documento financeiro"), em outras são descrição ("Parametros gerais do AUE").
 * Como nome descritivo ainda é melhor do que nome nenhum, entram — mas só quando não há
 * candidato melhor.
 */
const COLUNAS_NOME = [
  'opcao',
  'menu',
  'rotina',
  'area',
  'o que faz',
  'configuracao',
  'papel',
];

/** Cabeçalhos de descrição/uso — nunca servem de nome, mas alimentam `funcao`. */
const COLUNAS_FUNCAO = ['funcao', 'uso', 'descric', 'o que faz', 'efeito'];

/**
 * Cabeçalhos que NUNCA são o nome do menu, por mais que casem com a lista de prioridade.
 *
 * `Programa/rotina` contém "rotina" e por isso era escolhido antes de `Area` na tabela
 * `| Caminho | Area | Programa/rotina | Papel tecnico |` — o nome vinha vazio e o menu
 * entrava anônimo no catálogo. Pego por teste, não em produção.
 */
const NUNCA_NOME = ['programa', 'fonte', 'artefato'];

/**
 * Tira o código de menu de uma célula da coluna "Caminho", que no Dicionário aparece de
 * todo jeito:
 *
 *   `2.3-N`                      -> 2.3-N
 *   `1.1`                        -> 1.1        (a maioria; era descartada antes)
 *   `FAT 1.2`                    -> 1.2        (prefixo do módulo)
 *   `1.7 Parametros dos Servicos`-> 1.7 + nome "Parametros dos Servicos"
 *   `FIN 2.2` / `AUE 3.2`        -> 2.2        (fica o primeiro; o resto não vira nome)
 *   `WMS > Cadastros > Tipos`    -> null       (caminho textual, sem código)
 *
 * O nome embutido é ouro: em várias tabelas ele é o ÚNICO lugar onde o nome da tela existe.
 */
/**
 * Célula que parece nome mas é lista de PROGRAMA (`AUE102, SRIEMF`, `SRHCMP`, `COM301/SRIEOC`).
 *
 * Algumas tabelas do Dicionário põem o programa na coluna que, em outras, é o nome da tela —
 * e um "nome" desses vira lixo no catálogo: nunca casa com o que se fala numa reunião e ainda
 * ocupa espaço na lista entregue à IA. Detecta pelo formato: só maiúsculas, dígitos e
 * separadores, sem nenhuma palavra em minúsculas.
 */
export function ehListaDePrograma(texto: string): boolean {
  const t = (texto || '').trim();
  if (!t) return false;
  return /^[A-Z0-9][A-Z0-9\s,/.\-_]*$/.test(t) && !/[a-z]/.test(t);
}

export function extrairCaminho(
  celula: string,
): { codigo: string; nome: string } | null {
  const limpo = (celula || '').replace(/`/g, '').trim();
  if (!limpo) return null;
  const m = /(\d{1,2}\.\d{1,2}(?:-[A-Za-z](?:\/[A-Za-z])*)?)/.exec(limpo);
  if (!m) return null;

  const resto = limpo
    .slice(m.index + m[1].length)
    .replace(/^[\s>/\-–—:.,]+/, '')
    .trim();
  // Se o resto tem OUTRO código, a célula lista vários caminhos ("FIN 2.2 / AUE 3.2") e o
  // texto não é nome de nada.
  const nome = /^[A-Za-zÀ-ÿ]/.test(resto) && !/\d\.\d/.test(resto) ? resto : '';
  return { codigo: m[1].toUpperCase(), nome };
}

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
        // A coluna do nome é a PRIMEIRA da lista de prioridade que existir e não for a
        // própria coluna do caminho — é o que faz as 81 variações de cabeçalho caírem numa
        // regra só, em vez de só `Opcao` funcionar.
        const acharColuna = (
          candidatos: string[],
          proibidos: string[] = [],
        ): number => {
          for (const c of candidatos) {
            const i = h.findIndex(
              (x, idx) =>
                idx !== cod &&
                x.includes(c) &&
                !proibidos.some((p) => x.includes(p)),
            );
            if (i >= 0) return i;
          }
          return -1;
        };
        cols =
          cod >= 0
            ? {
                cod,
                opc: acharColuna(COLUNAS_NOME, NUNCA_NOME),
                prog: h.findIndex((x) => x.includes('programa')),
                fun: acharColuna(COLUNAS_FUNCAO),
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
        const caminho = extrairCaminho(cells[cols.cod] || '');
        if (!caminho) continue;
        const chave = caminho.codigo.toLowerCase();
        if (vistos.has(chave)) continue; // sem duplicar código no mesmo módulo
        vistos.add(chave);
        const bruto = cols.opc >= 0 ? (cells[cols.opc] || '').trim() : '';
        const daColuna = ehListaDePrograma(bruto) ? '' : bruto;
        menus.push({
          codigo: caminho.codigo,
          // Coluna própria vence o nome embutido no caminho; sem coluna, o embutido salva a
          // linha de virar mais um menu anônimo.
          opcao: daColuna || caminho.nome,
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
