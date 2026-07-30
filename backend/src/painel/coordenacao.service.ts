import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { Documento } from '../database/entities/documento.entity';
import { ETAPAS, SITUACOES } from '../common/constants/perfis';
import {
  Alerta,
  MetricasService,
  ResultadoMetricas,
} from '../metricas/metricas.service';
import { construirDocsMap } from './docs-map.util';

export interface PainelCoordenacao {
  m: ResultadoMetricas;
  alertas: Alerta[];
  etapas: readonly string[];
  situacoes: readonly string[];
}

/** Painel de Coordenação: visão executiva da carteira INTEIRA (KPIs, funil por etapa,
 * distribuição por situação, atrasados, carga por consultor, alertas proativos). Espelha
 * webapp/routes_painel.py:coordenacao. O envio do resumo por e-mail ("digest") fica a
 * cargo do job agendado (pendência registrada — ver item de Jobs agendados).
 *
 * ESCOPO (correção de 2026-07-28): não passa mais por `soMeus`. Quem chega aqui já passou
 * pelo gate `@Permissao('coordenacao')` — quem tem o menu liberado no painel de Permissões
 * vê o portfólio todo. Antes, só ADM/Coordenador/Administrativo viam algo: o GCI (que tem
 * o menu por padrão) e qualquer outro papel liberado pelo painel caíam no filtro de
 * designação e abriam a tela vazia ("Nenhum projeto cadastrado ainda"). A visão PESSOAL
 * (filtrada por designação) continua sendo a Home. */
@Injectable()
export class CoordenacaoService {
  constructor(
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    @InjectRepository(Documento)
    private readonly documentos: Repository<Documento>,
    private readonly metricas: MetricasService,
  ) {}

  async painel(): Promise<PainelCoordenacao> {
    const todos = await this.projetos.find();
    const docsMap = construirDocsMap(await this.documentos.find());
    return {
      m: this.metricas.metricas(todos, docsMap),
      alertas: this.metricas.alertas(todos, docsMap),
      etapas: ETAPAS,
      situacoes: SITUACOES,
    };
  }
}
