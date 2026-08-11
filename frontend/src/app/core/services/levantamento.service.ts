import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  GravacoesLevantamento,
  LevantamentoDados,
  LevantamentoRespostaLinha,
  LevantamentoResumo,
  ResultadoSugestoes,
  SincronizacaoLevantamento,
} from '../models/levantamento.model';

@Injectable({ providedIn: 'root' })
export class LevantamentoService {
  private readonly http = inject(HttpClient);

  private base(projetoId: number): string {
    return `${environment.apiUrl}/projetos/${projetoId}/levantamento`;
  }

  async obter(projetoId: number): Promise<LevantamentoDados> {
    const r = await firstValueFrom(this.http.get<ApiEnvelope<LevantamentoDados>>(this.base(projetoId)));
    return r.data;
  }

  /** Autosave de UMA pergunta — único caminho de gravação da tela desde que o botão "Salvar
   * respostas" saiu. `versao` é a que estava em tela: o backend responde 409 se outro técnico
   * gravou nesse meio tempo. (O PUT em lote continua existindo no backend para importação e
   * uso administrativo, fora do navegador.) */
  async salvarLinha(
    projetoId: number,
    linhaId: number,
    dados: { resposta?: string; naoUtilizado?: boolean; versao: number },
  ): Promise<{ linha: LevantamentoRespostaLinha; resumo: LevantamentoResumo }> {
    const r = await firstValueFrom(
      this.http.patch<ApiEnvelope<{ linha: LevantamentoRespostaLinha; resumo: LevantamentoResumo }>>(
        `${this.base(projetoId)}/${linhaId}`,
        dados,
      ),
    );
    return r.data;
  }

  /** Tique da edição a várias mãos: publica onde este técnico está e traz o que mudou. */
  async sincronizar(
    projetoId: number,
    dados: { linhaId: number | null; desde?: string },
  ): Promise<SincronizacaoLevantamento> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<SincronizacaoLevantamento>>(
        `${this.base(projetoId)}/sincronizar`,
        dados,
      ),
    );
    return r.data;
  }

  /** Gravações do projeto que têm transcrição — a origem possível das sugestões. */
  async gravacoes(projetoId: number): Promise<GravacoesLevantamento> {
    const r = await firstValueFrom(
      this.http.get<ApiEnvelope<GravacoesLevantamento>>(`${this.base(projetoId)}/gravacoes`),
    );
    return r.data;
  }

  /** Pede as sugestões a partir de uma reunião gravada. **Nada é gravado**: o que volta são
   * propostas, e a gravação continua acontecendo pelo `salvarLinha` de sempre — com versão e
   * autoria de quem aceitou. */
  async sugerir(projetoId: number, protocoloId: number): Promise<ResultadoSugestoes> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<ResultadoSugestoes>>(`${this.base(projetoId)}/sugerir`, {
        protocoloId,
      }),
    );
    return r.data;
  }

  /** Saída da tela — o colega para de ver este técnico na hora, sem esperar o TTL. */
  async sair(projetoId: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base(projetoId)}/presenca`));
  }
}
