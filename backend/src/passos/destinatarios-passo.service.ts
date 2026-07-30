import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DestinatarioPassoConfig } from '../database/entities/destinatario-passo.entity';
import {
  DestinatarioPasso,
  EMAIL_POR_PASSO,
  ROTULO_DESTINATARIO,
} from './passos-email.constants';
import { PASSOS } from './passos.constants';

/** Configuração de destinatários por passo, como a tela de Ferramentas a enxerga. */
export interface DestinatarioPassoView {
  passo: number;
  titulo: string;
  responsavel: string;
  /** Grupos dinâmicos marcados. */
  grupos: DestinatarioPasso[];
  /** Endereços fixos (os grupos de e-mail da Rech). */
  extras: string[];
  ativo: boolean;
  /** `false` = nunca foi configurado, está valendo o padrão do código. */
  configurado: boolean;
}

const GRUPOS_VALIDOS = new Set(Object.keys(ROTULO_DESTINATARIO));

/** Quebra a lista guardada em texto. Aceita vírgula, ponto-e-vírgula e quebra de linha
 * porque quem cola uma lista de e-mails cola em qualquer um dos três formatos. */
function separar(texto: string): string[] {
  return (texto || '')
    .split(/[,;\n\r]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Para quem vai o e-mail de cada passo.
 *
 * O padrão vive no código (`EMAILS_POR_PASSO.para`) e resolve o que o projeto conhece: o GCI
 * designado, os consultores, o contato no cliente. O que o código não tem como saber são os
 * endereços fixos da Rech — os dois grupos avisados no passo 1 são listas internas que mudam
 * sem release. Este serviço é a camada que deixa isso configurável sem tirar o padrão do ar:
 * passo sem linha na tabela continua usando exatamente o que sempre usou. */
@Injectable()
export class DestinatariosPassoService {
  constructor(
    @InjectRepository(DestinatarioPassoConfig)
    private readonly repo: Repository<DestinatarioPassoConfig>,
  ) {}

  /** Todos os passos que enviam e-mail, com a configuração atual ou o padrão do código. */
  async listar(): Promise<DestinatarioPassoView[]> {
    const salvos = await this.repo.find();
    const porPasso = new Map(salvos.map((s) => [s.passo, s]));

    return PASSOS.filter((p) => EMAIL_POR_PASSO.has(p.numero)).map((def) => {
      const salvo = porPasso.get(def.numero);
      const padrao = EMAIL_POR_PASSO.get(def.numero);
      return {
        passo: def.numero,
        titulo: def.titulo,
        responsavel: def.responsavel,
        grupos: salvo
          ? (separar(salvo.grupos).filter((g) =>
              GRUPOS_VALIDOS.has(g),
            ) as DestinatarioPasso[])
          : (padrao?.para ?? []),
        extras: salvo ? separar(salvo.extras) : [],
        ativo: salvo ? salvo.ativo : true,
        configurado: !!salvo,
      };
    });
  }

  /** Grava a configuração de um passo. Grupo desconhecido é descartado em silêncio — a tela
   * só oferece os válidos, então só chega lixo por chamada manual à API. */
  async salvar(
    passo: number,
    dados: { grupos?: string[]; extras?: string[]; ativo?: boolean },
  ): Promise<DestinatarioPassoView[]> {
    const grupos = (dados.grupos ?? []).filter((g) => GRUPOS_VALIDOS.has(g));
    const extras = (dados.extras ?? [])
      .flatMap((e) => separar(e))
      .filter((e) => e.includes('@'));

    const existente = await this.repo.findOne({ where: { passo } });
    const linha = existente ?? this.repo.create({ passo });
    linha.grupos = grupos.join(',');
    linha.extras = extras.join(',');
    linha.ativo = dados.ativo ?? true;
    await this.repo.save(linha);
    return this.listar();
  }

  /** Volta o passo ao padrão do código, apagando a linha. */
  async restaurarPadrao(passo: number): Promise<DestinatarioPassoView[]> {
    await this.repo.delete({ passo });
    return this.listar();
  }

  /** O que o serviço de notificação precisa saber na hora de montar o e-mail: quais grupos
   * dinâmicos resolver, quais endereços fixos acrescentar e se o e-mail está ligado. */
  async paraOPasso(passo: number): Promise<{
    grupos: DestinatarioPasso[];
    extras: string[];
    ativo: boolean;
  }> {
    const salvo = await this.repo.findOne({ where: { passo } });
    if (!salvo) {
      return {
        grupos: EMAIL_POR_PASSO.get(passo)?.para ?? [],
        extras: [],
        ativo: true,
      };
    }
    return {
      grupos: separar(salvo.grupos).filter((g) =>
        GRUPOS_VALIDOS.has(g),
      ) as DestinatarioPasso[],
      extras: separar(salvo.extras),
      ativo: salvo.ativo,
    };
  }

  /** Os grupos disponíveis, para a tela montar as opções. */
  gruposDisponiveis(): { valor: string; rotulo: string }[] {
    return Object.entries(ROTULO_DESTINATARIO).map(([valor, rotulo]) => ({
      valor,
      rotulo,
    }));
  }
}
