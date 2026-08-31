import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Kill switch de RUNTIME da automação e da IA — achado do eixo 4 (Agentes autônomos) da
 * auditoria de 2026-08-12. O sistema tinha salvaguardas reais (nada é gravado sozinho, dedup),
 * mas não havia como PARAR os atores autônomos sem redeploy: se um robô entrasse em laço, se a
 * IA começasse a gastar/errar em série, ou se um incidente de privacidade exigisse cortar o
 * fluxo AGORA, a única saída era derrubar o processo — e o Guardião o reergueria em 5 min.
 *
 * Este switch é um freio que o ADM aciona em runtime (Sistema → Automação). Quando PAUSADO:
 * - `IaService.completar` recusa qualquer chamada de IA com erro claro;
 * - os robôs de fundo (protocolos, caixa, digest) pulam o trabalho do ciclo (o laço segue vivo).
 *
 * PERSISTIDO em `dados/automacao_pausada.json` DE PROPÓSITO: um "parar de emergência" que
 * sumisse no restart seria inútil — o Guardião reiniciaria o painel e a automação pausada
 * voltaria sozinha. Persistindo, a pausa atravessa o restart até um humano retomar.
 *
 * Singleton de módulo (como `contador5xx`/`heartbeatRobos`): precisa ser consultado por
 * serviços de módulos diferentes (ia, digest, fluxo, protocolos) sem acoplá-los por DI. Lê o
 * arquivo a cada consulta — o custo é irrisório perto de uma chamada de IA ou de um tick de
 * robô, e garante que a pausa vale NA HORA, sem cache para invalidar.
 */
export interface EstadoAutomacao {
  pausado: boolean;
  /** Por que foi pausado — aparece no erro que a IA/robô devolve e na tela. */
  motivo: string;
  /** Quem pausou/retomou por último. */
  por: string;
  /** ISO da última mudança, ou `null` se nunca mexeram. */
  em: string | null;
}

const ATIVO: EstadoAutomacao = {
  pausado: false,
  motivo: '',
  por: '',
  em: null,
};

class KillSwitch {
  private arquivo(): string {
    // Isolado por JEST_WORKER_ID em teste (mesmo padrão de IaService), para uma pausa de um
    // caso não vazar para outro worker.
    if (process.env.NODE_ENV === 'test') {
      return join(
        process.cwd(),
        'dados',
        `automacao_pausada_test_${process.env.JEST_WORKER_ID ?? '0'}.json`,
      );
    }
    return join(process.cwd(), 'dados', 'automacao_pausada.json');
  }

  private ler(): EstadoAutomacao {
    try {
      const p = JSON.parse(
        readFileSync(this.arquivo(), 'utf8'),
      ) as Partial<EstadoAutomacao>;
      if (p && typeof p === 'object' && typeof p.pausado === 'boolean') {
        return {
          pausado: p.pausado,
          motivo: p.motivo ?? '',
          por: p.por ?? '',
          em: p.em ?? null,
        };
      }
    } catch {
      /* sem arquivo, ou arquivo inválido/em escrita → tratado como ATIVO */
    }
    return { ...ATIVO };
  }

  private gravar(e: EstadoAutomacao): void {
    mkdirSync(join(process.cwd(), 'dados'), { recursive: true });
    writeFileSync(this.arquivo(), JSON.stringify(e, null, 2), 'utf8');
  }

  /** Barato o bastante para chamar a cada tick/chamada de IA. */
  pausado(): boolean {
    return this.ler().pausado;
  }

  estado(): EstadoAutomacao {
    return this.ler();
  }

  pausar(motivo: string, por: string): EstadoAutomacao {
    const e: EstadoAutomacao = {
      pausado: true,
      motivo: (motivo ?? '').trim().slice(0, 300) || 'sem motivo informado',
      por: (por ?? '').trim() || 'sistema',
      em: new Date().toISOString(),
    };
    this.gravar(e);
    return e;
  }

  retomar(por: string): EstadoAutomacao {
    const e: EstadoAutomacao = {
      pausado: false,
      motivo: '',
      por: (por ?? '').trim() || 'sistema',
      em: new Date().toISOString(),
    };
    this.gravar(e);
    return e;
  }

  /** Só para teste — apaga o arquivo de estado do worker. */
  _resetar(): void {
    try {
      unlinkSync(this.arquivo());
    } catch {
      /* já não existia */
    }
  }
}

export const killSwitch = new KillSwitch();
