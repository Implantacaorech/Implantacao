import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CronogramaItem } from '../database/entities/cronograma-item.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { ModificacoesService } from './modificacoes.service';
import { DisponibilidadeService } from '../disponibilidade/disponibilidade.service';
import { diffLinhas } from './linhas-diff.util';
import { resolverModulos } from './catalogo-modulos.util';
import {
  formatarBr,
  parseDataPlano,
  proximoUtil,
  somarUteis,
} from './datas-plano.util';
import { addDays } from '../cronograma/datas.util';
import { LinhaCronogramaDto } from './dto/linha-cronograma.dto';

const CAMPOS = ['etapa', 'topicos', 'horas', 'data', 'modalidade', 'status'];

/** Dias úteis entre uma visita e a seguinte (mesma cadência do gerador original). */
const CADENCIA_UTEIS = 5;

/** Date (UTC) -> 'AAAA-MM-DD', para casar com o formato da Disponibilidade do SICLA. */
function isoUtc(d: Date): string {
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

interface EtapaPlano {
  etapa: string;
  topicos: string;
  peso: number;
}

function pnum(s: string | null | undefined): number {
  const m = /\d+(?:[.,]\d+)?/.exec(String(s ?? ''));
  return m ? parseFloat(m[0].replace(',', '.')) : 0;
}

/** Reparte `total` horas pelos pesos (método do maior resto), em inteiros. Sem total
 * informado, usa peso*2 como horas. Espelha tools/gerar_cronograma.py:_distribuir. */
function distribuir(total: number, pesos: number[]): number[] {
  if (total <= 0) return pesos.map((p) => Math.max(1, Math.round(p * 2)));
  const soma = pesos.reduce((a, b) => a + b, 0) || 1;
  const exatos = pesos.map((p) => (total * p) / soma);
  const base = exatos.map((x) => Math.trunc(x));
  let resto = Math.round(total) - base.reduce((a, b) => a + b, 0);
  const ordem = pesos
    .map((_, i) => i)
    .sort((a, b) => exatos[b] - base[b] - (exatos[a] - base[a]));
  let i = 0;
  while (resto > 0 && ordem.length > 0) {
    base[ordem[i % ordem.length]] += 1;
    resto -= 1;
    i += 1;
  }
  return base;
}

/** Plano padrão da implantação SIGER®: lista de (etapa, macro tópicos, peso). Espelha
 * tools/gerar_cronograma.py:_plano_automatico. */
function planoAutomatico(modulos: string[]): EtapaPlano[] {
  const achados = resolverModulos(modulos);
  const plano: EtapaPlano[] = [
    {
      etapa: 'Abertura + Parametrização inicial',
      topicos:
        'Criação de empresas e siglas; parâmetros gerais (1.1.P) e por empresa (1.2.A); ' +
        'compartilhamento de cadastros (1.2.M); tabelas genéricas.',
      peso: 2.0,
    },
  ];
  for (const m of achados) {
    const desc = m.descricao || m.abrev || 'Módulo';
    plano.push({
      etapa: `Treinamento — ${desc}`,
      topicos:
        'Tabelas e cadastros do módulo; importações via layout do SIGER®; rotinas do processo; relatórios.',
      peso: 2.0,
    });
  }
  if (achados.length === 0) {
    plano.push({
      etapa: 'Treinamento das rotinas',
      topicos:
        'Tabelas e cadastros; importações via layout; rotinas dos processos.',
      peso: 4.0,
    });
  }
  plano.push(
    {
      etapa: 'Simulação de microprocessos',
      topicos: 'Teste das rotinas treinadas por processo; ajustes finos.',
      peso: 1.5,
    },
    {
      etapa: 'Simulação do macroprocesso',
      topicos:
        'Ensaio do processo completo (cenário real); validação ponta a ponta.',
      peso: 1.5,
    },
    {
      etapa: 'Conversão — prévia',
      topicos:
        'Carga de teste; reconciliação origem × destino; validação de amostras.',
      peso: 1.0,
    },
    {
      etapa: 'Conversão — oficial / ponto de corte',
      topicos:
        'Conversão oficial; conferência de saldos; definição do ponto de corte.',
      peso: 1.0,
    },
    {
      etapa: 'Virada oficial (go-live)',
      topicos:
        'Início do uso em produção; acompanhamento full time; primeiros lançamentos.',
      peso: 1.5,
    },
    {
      etapa: 'Acompanhamento / Hypercare',
      topicos: 'Estabilização; micro ajustes; primeiros fechamentos.',
      peso: 1.0,
    },
    {
      etapa: 'Encerramento',
      topicos:
        'Revisão de pendências; Termo de Encerramento; transição ao Suporte.',
      peso: 0.5,
    },
  );
  return plano;
}

/** Linhas editáveis do Cronograma (`CronogramaItem`) — CRUD "apaga tudo e reinsere" com
 * histórico de diffs, e o plano automático usado como ponto de partida editável. Espelha
 * webapp/routes_cronograma.py (`projeto_cronograma`/`_seed_cronograma`) +
 * webapp/db.py:salvar_linhas (fatia "cronograma"). */
@Injectable()
export class CronogramaItensService {
  constructor(
    @InjectRepository(CronogramaItem)
    private readonly repo: Repository<CronogramaItem>,
    private readonly modificacoes: ModificacoesService,
    private readonly disponibilidade: DisponibilidadeService,
  ) {}

  async doProjeto(projetoId: number): Promise<CronogramaItem[]> {
    return this.repo.find({ where: { projetoId }, order: { ordem: 'ASC' } });
  }

  /** Substitui todas as linhas do projeto pelas `linhas` enviadas, registrando um
   * `Modificacao` por linha/campo alterado (comparação POSICIONAL — ver linhas-diff.util
   * para a limitação conhecida, preservada de propósito por fidelidade). Devolve o nº de
   * alterações registradas. */
  async salvar(
    projetoId: number,
    linhas: LinhaCronogramaDto[],
    autor: string,
  ): Promise<number> {
    const antigas = await this.doProjeto(projetoId);
    const diffs = diffLinhas(
      antigas as unknown as Record<string, unknown>[],
      linhas as unknown as Record<string, unknown>[],
      CAMPOS,
      ['etapa', 'topicos'],
    );
    for (const d of diffs) {
      await this.modificacoes.registrar(
        projetoId,
        'cronograma',
        d.ref,
        d.campo,
        d.de,
        d.para,
        autor,
      );
    }
    await this.repo.delete({ projetoId });
    if (linhas.length > 0) {
      await this.repo.save(
        linhas.map((l, i) =>
          this.repo.create({
            projetoId,
            ordem: i,
            etapa: l.etapa ?? '',
            topicos: l.topicos ?? '',
            horas: l.horas ?? '',
            data: l.data ?? '',
            modalidade: l.modalidade ?? '',
            status: l.status ?? 'Previsto',
          }),
        ),
      );
    }
    return diffs.length;
  }

  /** Plano automático (mesma lógica do gerador standalone) como ponto de partida editável.
   * As visitas caem nos DIAS ÚTEIS LIVRES do(s) consultor(es) designado(s), segundo a
   * agenda do SICLA (pula dias ocupados). Sem disponibilidade configurada/ativa, cai no
   * comportamento antigo (cadência fixa de dias úteis). Espelha
   * webapp/routes_cronograma.py:_seed_cronograma. */
  async gerarPlanoAutomatico(projeto: Projeto): Promise<LinhaCronogramaDto[]> {
    const mods = (projeto.modulos || '').split(/[,;\n\s]+/).filter(Boolean);
    const plano = planoAutomatico(mods);
    const horas = pnum(projeto.horasCobradas) + pnum(projeto.horasBonificadas);
    const hs = distribuir(
      horas,
      plano.map((p) => p.peso),
    );
    const dt0 = proximoUtil(parseDataPlano(projeto.dataInicio));
    const ocupados = await this.diasOcupadosSicla(projeto, dt0, plano.length);
    const datas = this.distribuirEmDiasLivres(dt0, plano.length, ocupados);
    return plano.map((p, i) => ({
      etapa: p.etapa,
      topicos: p.topicos,
      horas: String(hs[i]),
      data: formatarBr(datas[i]),
      modalidade: 'A combinar',
      status: 'Previsto',
    }));
  }

  /** Dias (AAAA-MM-DD) em que ALGUM consultor designado está ocupado na agenda do SICLA,
   * numa janela a partir de `dt0`. Melhor esforço: sem consultor, sem disponibilidade ou
   * com falha na consulta, devolve conjunto vazio (o plano segue pela cadência fixa). */
  private async diasOcupadosSicla(
    projeto: Projeto,
    dt0: Date,
    nVisitas: number,
  ): Promise<Set<string>> {
    const consultores = (projeto.consultor || '')
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (consultores.length === 0) return new Set();
    // Janela generosa: cobre todas as visitas (cadência) + folga para pular ocupações.
    const fim = addDays(dt0, Math.max(90, nVisitas * CADENCIA_UTEIS * 3 + 30));
    try {
      const linhas = await this.disponibilidade.consultar(
        isoUtc(dt0),
        isoUtc(fim),
        consultores,
      );
      return new Set(linhas.map((l) => l.data).filter(Boolean));
    } catch {
      return new Set();
    }
  }

  /** Datas das visitas: a 1ª no primeiro dia útil livre a partir de `dt0`; as seguintes a
   * `CADENCIA_UTEIS` dias úteis da anterior, avançando até o próximo dia útil livre. */
  private distribuirEmDiasLivres(
    dt0: Date,
    n: number,
    ocupados: Set<string>,
  ): Date[] {
    const proximoLivre = (d: Date): Date => {
      let x = proximoUtil(d);
      while (ocupados.has(isoUtc(x))) x = proximoUtil(addDays(x, 1));
      return x;
    };
    const datas: Date[] = [];
    let atual = proximoLivre(dt0);
    for (let i = 0; i < n; i++) {
      if (i > 0) atual = proximoLivre(somarUteis(atual, CADENCIA_UTEIS));
      datas.push(atual);
    }
    return datas;
  }
}
