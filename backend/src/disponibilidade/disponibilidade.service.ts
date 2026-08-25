import { Injectable, Logger } from '@nestjs/common';
import { textoAparado } from '../common/utils/texto.util';
import { DadosService } from '../dados/dados.service';

export interface LinhaOcupacao {
  tecnico: string;
  data: string;
  turno: '' | 'manha' | 'tarde';
}

const CACHE_TTL_MS = 180_000; // 180s — ver webapp/disponibilidade.py:_CACHE_TTL
const TEC_TTL_MS = 600_000; // 600s — ver webapp/disponibilidade.py:_TEC_TTL

/** DISPONIBILIDADE DOS CONSULTORES — o domínio, e só ele.
 *
 * Ocupação por slot (data × turno) e o mapa código↔nome dos técnicos do SICLA, usados pelo
 * Agendador de Visitas, pela distribuição do cronograma e pela capacidade do Centro
 * Operacional.
 *
 * **Não fala Oracle.** Até a fase 1 do ADR-0003 este arquivo era o dono do driver
 * (`oracledb`), da configuração da conexão e do executor de SQL — e por isso virou a porta
 * dos fundos pela qual 10 módulos consultavam o SICLA. Na fase 2 tudo isso mudou para
 * `dados/conexoes/conexao-sicla.service.ts`; aqui ficou o que é REGRA DE NEGÓCIO:
 * traduzir código em nome, expandir turno vazio nos dois turnos, indexar por slot e
 * cachear. As duas consultas vêm do catálogo (`sicla.disponibilidade.*`), cujo SELECT o
 * Administrador continua editando na tela Sistema → Ferramentas → Disponibilidade. */
@Injectable()
export class DisponibilidadeService {
  private readonly logger = new Logger('DisponibilidadeService');

  private cacheOcupacao = new Map<
    string,
    { ts: number; valor: Record<string, boolean> }
  >();
  private cacheTecnicos: { ts: number; mapa: Record<string, string> } = {
    ts: 0,
    mapa: {},
  };

  constructor(private readonly dados: DadosService) {}

  /** A conexão com o SICLA está cadastrada e ativa? Continua exposta aqui porque quem
   * agenda pergunta ANTES de montar a grade — sem conexão, a tela mostra a grade sem o
   * cruzamento de ocupação, em vez de N erros. */
  configurado(): boolean {
    return this.dados.conexaoConfigurada('sicla');
  }

  private normalizarLinha(
    row: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[k.toLowerCase()] = v;
    return out;
  }

  /** Ocupação no intervalo, opcionalmente filtrada pelos técnicos informados — devolve as
   * linhas já normalizadas. A expansão de `:tecnicos` numa lista de binds é do catálogo
   * (parâmetro `lista_texto`); aqui só se informa a lista. */
  async consultar(
    dataIni: string,
    dataFim: string,
    tecnicos?: string[],
  ): Promise<LinhaOcupacao[]> {
    const r = await this.dados.consultar('sicla.disponibilidade.ocupacao', {
      data_ini: dataIni,
      data_fim: dataFim,
      tecnicos: tecnicos ?? [],
    });
    if (!r.ok) {
      // Diferente do resto do domínio, aqui a falha PRECISA subir: quem chama está
      // validando uma alocação e "sem ocupação" seria lido como "livre" — liberaria uma
      // agenda em cima de outra. Falhar alto é o comportamento seguro, e é o que a versão
      // anterior fazia (a exceção do driver vazava para o chamador).
      throw new Error(r.mensagem);
    }
    return r.linhas.map((row) => {
      const d = this.normalizarLinha(row);
      const turno = textoAparado(d.turno).toLowerCase();
      return {
        tecnico: textoAparado(d.tecnico),
        data: textoAparado(d.data).slice(0, 10),
        turno: turno === 'manha' || turno === 'tarde' ? turno : '',
      };
    });
  }

  /** Mapa `codigo|nome (minúsculo) → NOME canônico` dos técnicos do SICLA, com cache de
   * 600s. Falha aqui NÃO sobe: sem o mapa, a ocupação ainda funciona casando por nome. */
  async mapaTecnicos(): Promise<Record<string, string>> {
    if (
      this.cacheTecnicos.mapa &&
      Date.now() - this.cacheTecnicos.ts < TEC_TTL_MS
    ) {
      if (Object.keys(this.cacheTecnicos.mapa).length > 0)
        return this.cacheTecnicos.mapa;
    }
    const mapa: Record<string, string> = {};
    const r = await this.dados.consultar('sicla.disponibilidade.tecnicos');
    if (!r.ok) {
      this.logger.error(
        `Falha ao montar o mapa de técnicos do SICLA (código<->nome): ${r.mensagem}`,
      );
      return mapa;
    }
    for (const row of r.linhas) {
      const d = this.normalizarLinha(row);
      const nome = textoAparado(d.tecnico);
      const cod = textoAparado(d.codigo);
      if (!nome) continue;
      mapa[nome.toLowerCase()] = nome;
      if (cod) mapa[cod.toLowerCase()] = nome;
    }
    this.cacheTecnicos = { ts: Date.now(), mapa };
    return mapa;
  }

  /** `{chaveLower|data|turno: true}` dos compromissos, sem cache — use na validação final de
   * alocação. Aceita em `tecnicos` o CÓDIGO numérico OU o nome: traduz para o nome antes de
   * consultar (o SELECT casa por nome) e re-indexa o resultado TAMBÉM pela chave original. */
  async ocupacaoPorSlot(
    dataIni: string,
    dataFim: string,
    tecnicos?: string[],
  ): Promise<Record<string, boolean>> {
    const entradas = (tecnicos ?? [])
      .map((t) => String(t).trim())
      .filter(Boolean);
    const mapa = entradas.length > 0 ? await this.mapaTecnicos() : {};
    const nomes: string[] = [];
    const alias = new Map<string, Set<string>>();
    for (const e of entradas) {
      const nome = mapa[e.toLowerCase()] ?? e;
      nomes.push(nome);
      const chave = nome.trim().toLowerCase();
      if (!alias.has(chave)) alias.set(chave, new Set());
      alias.get(chave)!.add(e.toLowerCase());
    }
    const ocup: Record<string, boolean> = {};
    const linhas = await this.consultar(
      dataIni,
      dataFim,
      nomes.length > 0 ? nomes : undefined,
    );
    for (const r of linhas) {
      const tec = r.tecnico.trim().toLowerCase();
      if (!tec || !r.data) continue;
      const chaves = new Set([tec, ...(alias.get(tec) ?? [])]);
      const turnos: ('manha' | 'tarde')[] = r.turno
        ? [r.turno]
        : ['manha', 'tarde'];
      for (const turno of turnos) {
        for (const k of chaves) ocup[`${k}|${r.data}|${turno}`] = true;
      }
    }
    return ocup;
  }

  /** Como `ocupacaoPorSlot`, com cache de 180s por (janela, técnicos) — use nas TELAS
   * (navegação rápida); a validação final de alocação usa a direta. */
  async ocupacaoPorSlotCache(
    dataIni: string,
    dataFim: string,
    tecnicos?: string[],
  ): Promise<Record<string, boolean>> {
    const chave = JSON.stringify([
      dataIni,
      dataFim,
      [...(tecnicos ?? [])].map((t) => String(t).trim().toLowerCase()).sort(),
    ]);
    const hit = this.cacheOcupacao.get(chave);
    const agora = Date.now();
    if (hit && agora - hit.ts < CACHE_TTL_MS) return hit.valor;
    const ocup = await this.ocupacaoPorSlot(dataIni, dataFim, tecnicos);
    this.cacheOcupacao.set(chave, { ts: agora, valor: ocup });
    if (this.cacheOcupacao.size > 64) {
      const entradas = [...this.cacheOcupacao.entries()].sort(
        (a, b) => a[1].ts - b[1].ts,
      );
      for (const [k] of entradas.slice(0, 32)) this.cacheOcupacao.delete(k);
    }
    return ocup;
  }

  /** Testa conexão + consulta numa janela de 30 dias — o botão "Testar" da tela. */
  async testar(): Promise<{
    ok: boolean;
    mensagem: string;
    amostra: LinhaOcupacao[];
  }> {
    const hoje = new Date();
    const fim = new Date(hoje);
    fim.setDate(fim.getDate() + 30);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    try {
      const linhas = await this.consultar(iso(hoje), iso(fim));
      return {
        ok: true,
        mensagem: `Conexão OK — ${linhas.length} compromisso(s) no período de teste.`,
        amostra: linhas.slice(0, 8),
      };
    } catch (e) {
      return {
        ok: false,
        mensagem: e instanceof Error ? e.message : String(e),
        amostra: [],
      };
    }
  }
}
