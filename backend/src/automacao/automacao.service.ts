import { Injectable } from '@nestjs/common';
import { EstadoAutomacao, killSwitch } from '../common/automacao/kill-switch';

/** Fachada de Service para o kill switch de runtime (eixo 4). O estado real vive no singleton
 * de módulo `killSwitch` (persistido em `dados/`), consultado direto por IaService e pelos
 * robôs; aqui é só a porta pela qual o ADM lê e altera pela API. */
@Injectable()
export class AutomacaoService {
  estado(): EstadoAutomacao {
    return killSwitch.estado();
  }

  pausar(motivo: string, por: string): EstadoAutomacao {
    return killSwitch.pausar(motivo, por);
  }

  retomar(por: string): EstadoAutomacao {
    return killSwitch.retomar(por);
  }
}
