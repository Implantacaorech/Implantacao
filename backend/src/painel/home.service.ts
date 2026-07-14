import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { Documento } from '../database/entities/documento.entity';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { soMeus } from '../common/utils/so-meus.util';
import { Alerta, Cabecalho, MetricasService } from '../metricas/metricas.service';
import { construirDocsMap } from './docs-map.util';

export interface ItemPendenciaHome {
  id: number;
  cliente: string;
  fase: string;
  atraso: number | null;
  acao: string;
  // tipo da próxima ação (mesma chave de cab.proxima.tipo, ex.: "acao:definir_gci",
  // "levantamento"...) ou "avancar" quando o gate já está ok e só falta avançar a etapa —
  // o frontend resolve rota/rótulo do botão a partir desse tipo (substitui os `url_for`
  // do Flask, que não fazem sentido numa API JSON).
  tipo: string;
}

export interface FocoHome {
  projeto: Projeto;
  cabecalho: Cabecalho;
}

export interface DadosHome {
  ativos: number;
  noPrazo: number;
  atrasados: number;
  alertas: number;
  risco: number;
  total: number;
  concluidos: number;
  gatePendente: number;
}

export interface PainelHome {
  dados: DadosHome;
  alertas: Alerta[];
  pendencias: ItemPendenciaHome[];
  foco: FocoHome | null;
}

/** Home (landing pessoal): KPIs resumidos + fila de "próximas ações" (documento/ação
 * pendente ou etapa pronta pra avançar) por projeto ativo, ordenada por urgência (mais
 * atrasado primeiro) + projeto em foco (o ativo atualizado mais recentemente). Sem gate de
 * perfil — todos os perfis autenticados acessam (igual webapp/routes_painel.py:home, que
 * não chama `pode_ver`). Espelha webapp/routes_painel.py:home. */
@Injectable()
export class HomeService {
  constructor(
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    @InjectRepository(Documento) private readonly documentos: Repository<Documento>,
    private readonly metricas: MetricasService,
  ) {}

  async painel(user: AuthUser): Promise<PainelHome> {
    const todos = await this.projetos.find();
    const docsMap = construirDocsMap(await this.documentos.find());
    const meus = soMeus(todos, user);
    const m = this.metricas.metricas(meus, docsMap);
    const alertas = this.metricas.alertas(meus, docsMap);

    const dados: DadosHome = {
      ativos: m.ativos,
      noPrazo: m.noPrazo,
      atrasados: m.nAtrasados,
      alertas: alertas.length,
      risco: m.nRisco,
      total: m.total,
      concluidos: m.concluidos,
      gatePendente: m.gatePendente,
    };

    const ativos = meus.filter((p) => p.situacao !== 'Concluído');
    const pendencias: ItemPendenciaHome[] = [];
    for (const p of ativos) {
      const cab = this.metricas.cabecalho(p, docsMap[p.id] ?? []);
      if (cab.proxima) {
        pendencias.push({
          id: p.id,
          cliente: p.cliente,
          fase: cab.fase,
          atraso: cab.atraso,
          acao: cab.proxima.label,
          tipo: cab.proxima.tipo,
        });
      } else if (cab.proxEtapa && cab.avancarOk) {
        pendencias.push({
          id: p.id,
          cliente: p.cliente,
          fase: cab.fase,
          atraso: cab.atraso,
          acao: `Avançar para ${cab.proxEtapa}`,
          tipo: 'avancar',
        });
      }
    }
    // urgência: atrasados primeiro (maior atraso no topo); sem atraso, por último.
    pendencias.sort((a, b) => {
      const aSemAtraso = a.atraso === null ? 1 : 0;
      const bSemAtraso = b.atraso === null ? 1 : 0;
      if (aSemAtraso !== bSemAtraso) return aSemAtraso - bSemAtraso;
      return (b.atraso ?? 0) - (a.atraso ?? 0);
    });

    const ativosOrd = [...ativos].sort((a, b) => {
      const at = a.atualizadoEm ? new Date(a.atualizadoEm).getTime() : -Infinity;
      const bt = b.atualizadoEm ? new Date(b.atualizadoEm).getTime() : -Infinity;
      return bt - at;
    });
    const foco: FocoHome | null =
      ativosOrd.length > 0
        ? {
            projeto: ativosOrd[0],
            cabecalho: this.metricas.cabecalho(ativosOrd[0], docsMap[ativosOrd[0].id] ?? []),
          }
        : null;

    return { dados, alertas: alertas.slice(0, 6), pendencias: pendencias.slice(0, 8), foco };
  }
}
