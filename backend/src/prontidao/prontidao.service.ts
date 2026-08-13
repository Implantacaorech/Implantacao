import { Injectable } from '@nestjs/common';
import { IaService } from '../ia/ia.service';
import {
  AchadoProntidao,
  EixoProntidao,
  PRONTIDAO_ACHADOS,
  PRONTIDAO_DATA_AUDITORIA,
  PRONTIDAO_EIXOS,
  Severidade,
  StatusAchado,
} from './prontidao.dados';

/** Aviso vivo de privacidade: finalidade sensível de IA que está saindo da rede AGORA. */
export interface AvisoPrivacidadeVivo {
  finalidade: string;
  provider: string;
  viaEnv: boolean;
}

/** Payload completo do módulo Prontidão do Sistema. */
export interface ResumoProntidao {
  dataAuditoria: string;
  eixos: EixoProntidao[];
  achados: AchadoProntidao[];
  /** Contagens para os cartões de topo. */
  totais: {
    porSeveridade: Record<Severidade, number>;
    porStatus: Record<StatusAchado, number>;
    maturidadeMedia: number;
  };
  /** Sinal AO VIVO (calculado no request), não congelado nos dados da auditoria: se houver
   * itens aqui, dado de cliente está indo para provedor externo neste exato momento. */
  privacidadeAoVivo: AvisoPrivacidadeVivo[];
}

/**
 * Prontidão do Sistema — expõe a Auditoria de Prontidão dos 9 eixos (2026-08-12) de forma
 * navegável, e cruza os dados datados com o estado AO VIVO do sistema (hoje, o único sinal ao
 * vivo é a privacidade da IA — se uma finalidade sensível está configurada para sair da rede).
 *
 * O service só ORQUESTRA: os dados vêm de `prontidao.dados.ts` (retrato datado, versionado com
 * o código) e o sinal ao vivo vem do `IaService`. Sem acesso a banco — por isso o módulo não
 * tem repository (não há entidade que persista). Ver `docs/regras-negocio.md`.
 */
@Injectable()
export class ProntidaoService {
  constructor(private readonly ia: IaService) {}

  resumo(): ResumoProntidao {
    const porSeveridade: Record<Severidade, number> = {
      critico: 0,
      alto: 0,
      medio: 0,
      baixo: 0,
    };
    const porStatus: Record<StatusAchado, number> = {
      corrigido: 0,
      mitigado: 0,
      aberto: 0,
    };
    for (const a of PRONTIDAO_ACHADOS) {
      porSeveridade[a.severidade] += 1;
      porStatus[a.status] += 1;
    }
    const maturidadeMedia =
      PRONTIDAO_EIXOS.reduce((s, e) => s + e.maturidade, 0) /
      PRONTIDAO_EIXOS.length;

    return {
      dataAuditoria: PRONTIDAO_DATA_AUDITORIA,
      eixos: PRONTIDAO_EIXOS,
      achados: PRONTIDAO_ACHADOS,
      totais: {
        porSeveridade,
        porStatus,
        maturidadeMedia: Math.round(maturidadeMedia * 10) / 10,
      },
      // Recalcula a cada request: a config de IA pode mudar sem redeploy.
      privacidadeAoVivo: this.ia.avisosPrivacidade(),
    };
  }
}
