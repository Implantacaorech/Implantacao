import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  DestinatariosPassoResposta,
  EmailDoPasso,
  EmailRegistrado,
  GradeView,
  PassoAtualDoProjeto,
  PapelProjeto,
  Passo,
  PessoaProjeto,
  PessoasProjeto,
  Rns,
  TipoRns,
} from '../models/passo.model';

/** O que a tela manda ao concluir um passo, além do simples "concluí". */
export interface DadosConclusao {
  observacao?: string;
  marcado?: boolean;
  dataMarcada?: string;
  email?: { para?: string[]; assunto?: string; corpo?: string };
}

/** Os 21 passos do processo, as pessoas por papel e as RNS do projeto. */
@Injectable({ providedIn: 'root' })
export class PassosService {
  private readonly http = inject(HttpClient);
  private readonly base = (projetoId: number) =>
    `${environment.apiUrl}/projetos/${projetoId}`;

  /** Em que passo cada projeto está — uma chamada só, para o quadro por fase. */
  async atuais(): Promise<PassoAtualDoProjeto[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<PassoAtualDoProjeto[]>>(
        `${environment.apiUrl}/passos/atuais`,
      ),
    );
    return res.data;
  }

  /** Grade Cliente × fases (status de cada passo por projeto) — alimenta a visão em grade. */
  async grade(): Promise<GradeView> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<GradeView>>(
        `${environment.apiUrl}/passos/grade`,
      ),
    );
    return res.data;
  }

  /** Nomes dos usuários que TÊM o papel — para os seletores dos passos. */
  async pessoasPorPapel(papel: string): Promise<string[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<string[]>>(
        `${environment.apiUrl}/passos/pessoas-por-papel/${papel}`,
      ),
    );
    return res.data;
  }

  async listar(projetoId: number): Promise<Passo[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<Passo[]>>(`${this.base(projetoId)}/passos`),
    );
    return res.data;
  }

  async concluir(
    projetoId: number,
    numero: number,
    dados: DadosConclusao = {},
  ): Promise<Passo[]> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<Passo[]>>(
        `${this.base(projetoId)}/passos/${numero}/concluir`,
        dados,
      ),
    );
    return res.data;
  }

  /** E-mail do passo já montado pelo backend, para a tela abrir preenchida. `null` quando o
   * passo não envia e-mail. */
  /** @param descricao O que a pessoa está escrevendo AGORA (passo 5). Vai junto para o corpo
   * já chegar com `{{DESCRICAO_PASSO}}` preenchido — a tela devolve esse corpo ao concluir,
   * então uma prévia montada sem ele mandava a descrição do Comercial em branco (RN-7). */
  async previaEmail(
    projetoId: number,
    numero: number,
    descricao?: string,
  ): Promise<EmailDoPasso | null> {
    const params: Record<string, string> = descricao?.trim()
      ? { descricao: descricao.trim() }
      : {};
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<EmailDoPasso | null>>(
        `${this.base(projetoId)}/passos/${numero}/email`,
        { params },
      ),
    );
    return res.data;
  }

  /** Os e-mails já gerados no projeto — consulta liberada a quem enxerga a carteira. */
  async emailsGerados(projetoId: number): Promise<EmailRegistrado[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<EmailRegistrado[]>>(
        `${this.base(projetoId)}/emails`,
      ),
    );
    return res.data;
  }

  /** Reenvia um e-mail de passo que falhou (A13). Devolve o resultado do envio. */
  async reenviarEmail(
    projetoId: number,
    emailId: number,
  ): Promise<{ ok: boolean; erro: string }> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<{ ok: boolean; erro: string }>>(
        `${this.base(projetoId)}/emails/${emailId}/reenviar`,
        {},
      ),
    );
    return res.data;
  }

  // --- Destinatários por passo (Sistema → Ferramentas, só ADM) ---

  async destinatarios(): Promise<DestinatariosPassoResposta> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<DestinatariosPassoResposta>>(
        `${environment.apiUrl}/config/destinatarios-passo`,
      ),
    );
    return res.data;
  }

  async salvarDestinatarios(
    passo: number,
    dados: { grupos: string[]; extras: string[]; ativo: boolean },
  ): Promise<void> {
    await firstValueFrom(
      this.http.put<ApiEnvelope<unknown>>(
        `${environment.apiUrl}/config/destinatarios-passo/${passo}`,
        dados,
      ),
    );
  }

  async restaurarDestinatarios(passo: number): Promise<void> {
    await firstValueFrom(
      this.http.delete<ApiEnvelope<unknown>>(
        `${environment.apiUrl}/config/destinatarios-passo/${passo}`,
      ),
    );
  }

  async conferir(projetoId: number, numero: number): Promise<Passo[]> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<Passo[]>>(
        `${this.base(projetoId)}/passos/${numero}/conferir`,
        {},
      ),
    );
    return res.data;
  }

  async reabrir(projetoId: number, numero: number): Promise<Passo[]> {
    const res = await firstValueFrom(
      this.http.delete<ApiEnvelope<Passo[]>>(
        `${this.base(projetoId)}/passos/${numero}`,
      ),
    );
    return res.data;
  }

  /** Anexa o e-mail encaminhado do Outlook (.msg/.eml) como registro dos passos 3 e 4. */
  async anexarEmail(
    projetoId: number,
    numero: number,
    arquivo: File,
  ): Promise<void> {
    const form = new FormData();
    form.append('arquivo', arquivo);
    await firstValueFrom(
      this.http.post<ApiEnvelope<unknown>>(
        `${this.base(projetoId)}/passos/${numero}/anexar-email`,
        form,
      ),
    );
  }

  /** Anexa um arquivo AO E-MAIL que o passo vai enviar (passo 16). Diferente de
   * `anexarEmail`: aqui o arquivo vai JUNTO no e-mail que o Painel manda. */
  async anexarArquivoDoEmail(
    projetoId: number,
    numero: number,
    arquivo: File,
  ): Promise<void> {
    const form = new FormData();
    form.append('arquivo', arquivo);
    await firstValueFrom(
      this.http.post<ApiEnvelope<unknown>>(
        `${this.base(projetoId)}/passos/${numero}/anexo-email`,
        form,
      ),
    );
  }

  async pessoas(projetoId: number): Promise<PessoasProjeto> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<PessoasProjeto>>(`${this.base(projetoId)}/pessoas`),
    );
    return res.data;
  }

  async definirPessoas(
    projetoId: number,
    papel: PapelProjeto,
    pessoas: string[],
  ): Promise<PessoaProjeto[]> {
    const res = await firstValueFrom(
      this.http.patch<ApiEnvelope<PessoaProjeto[]>>(
        `${this.base(projetoId)}/pessoas`,
        { papel, pessoas },
      ),
    );
    return res.data;
  }

  async listarRns(projetoId: number): Promise<Rns[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<Rns[]>>(`${this.base(projetoId)}/rns`),
    );
    return res.data;
  }

  async criarRns(
    projetoId: number,
    dados: { tipo: TipoRns; numero?: string; descricao?: string; situacao?: string },
  ): Promise<Rns> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<Rns>>(`${this.base(projetoId)}/rns`, dados),
    );
    return res.data;
  }

  async removerRns(projetoId: number, rnsId: number): Promise<void> {
    await firstValueFrom(
      this.http.delete<ApiEnvelope<{ ok: boolean }>>(
        `${this.base(projetoId)}/rns/${rnsId}`,
      ),
    );
  }
}
