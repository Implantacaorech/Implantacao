import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { Documento } from '../database/entities/documento.entity';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { soMeus } from '../common/utils/so-meus.util';
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

/** Painel de Coordenação: visão executiva da carteira inteira (KPIs, funil por etapa,
 * distribuição por situação, atrasados, carga por consultor, alertas proativos). Espelha
 * webapp/routes_painel.py:coordenacao. O envio do resumo por e-mail ("digest") fica a
 * cargo do job agendado (pendência registrada — ver item de Jobs agendados). */
@Injectable()
export class CoordenacaoService {
  constructor(
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    @InjectRepository(Documento)
    private readonly documentos: Repository<Documento>,
    private readonly metricas: MetricasService,
  ) {}

  async painel(user: AuthUser): Promise<PainelCoordenacao> {
    const todos = await this.projetos.find();
    const meus = soMeus(todos, user);
    const docsMap = construirDocsMap(await this.documentos.find());
    return {
      m: this.metricas.metricas(meus, docsMap),
      alertas: this.metricas.alertas(meus, docsMap),
      etapas: ETAPAS,
      situacoes: SITUACOES,
    };
  }
}
