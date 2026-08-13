import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { propagarRequestId } from '../../common/observabilidade/axios-correlacao';

/** Consulta o `/health` do docservice (FastAPI, processo separado na 8001).
 *
 * Repository e não Service porque é acesso a uma fonte externa — quem decide o que a
 * resposta SIGNIFICA é o `SaudeService`. Por isso aqui não há exceção: devolve o estado, e
 * "não respondeu" é um estado como outro qualquer.
 *
 * Vale a checagem própria mesmo com o Guardião vigiando a porta: ele roda de tempos em
 * tempos e só age depois que o serviço já caiu — em 2026-08-04 o painel reiniciou às 05:35,
 * o docservice ficou para trás e o sintoma só apareceu horas depois, para o usuário, como
 * "ECONNREFUSED 127.0.0.1:8001" ao tentar gravar uma reunião. */
@Injectable()
export class DocserviceSaudeRepository {
  constructor(private readonly http: HttpService) {
    propagarRequestId(http); // M9: correlation-id na checagem do docservice.
  }

  async responde(): Promise<{ ok: boolean; detalhe: string }> {
    try {
      const res = await firstValueFrom(
        // Timeout curto: isto roda dentro de uma tela e de um e-mail diário. Esperar 30 s
        // por um serviço que está fora só transforma um diagnóstico em uma espera.
        this.http.get('/health', { timeout: 4000 }),
      );
      const status = (res.data as { status?: string })?.status ?? '';
      return status === 'ok'
        ? { ok: true, detalhe: 'respondeu ok' }
        : { ok: false, detalhe: `respondeu "${status || 'sem status'}"` };
    } catch (e) {
      return { ok: false, detalhe: e instanceof Error ? e.message : String(e) };
    }
  }
}
