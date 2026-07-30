import { Injectable } from '@nestjs/common';

/** Quem está com a tela do Levantamento aberta e em qual pergunta o cursor está. */
export interface PresencaLevantamento {
  usuarioId: number;
  nome: string;
  /** Linha em que a pessoa está digitando agora — null quando está só olhando. */
  linhaId: number | null;
}

interface Registro extends PresencaLevantamento {
  visto: number;
}

/** Presença dos técnicos na tela do Levantamento ("o Fulano está nesta pergunta").
 *
 * Estado só em memória, de propósito: o Painel roda em processo único (NestJS servindo o
 * build do Angular na 5100) e isto é informação efêmera de segundos — não vale uma tabela,
 * nem sobreviver a restart. Se um dia o Painel escalar para mais de um processo, isto vira
 * cache compartilhado; a interface do serviço não muda.
 *
 * Não é trava: ninguém fica impedido de escrever num campo. Quem protege o dado é a
 * concorrência otimista por `versao` em LevantamentoRespostaService.salvarLinha — a presença
 * só evita o susto de dois digitando no mesmo lugar sem saber. */
@Injectable()
export class LevantamentoPresencaService {
  /** projetoId -> usuarioId -> registro */
  private readonly porProjeto = new Map<number, Map<number, Registro>>();

  /** Sem tique neste prazo, some da lista — cobre fechar a aba/perder a rede sem depender
   * de um "sair" explícito, que navegador nenhum garante entregar. */
  private readonly TTL_MS = 20_000;

  /** Registra o tique deste técnico e devolve os OUTROS que estão na tela agora. */
  bater(
    projetoId: number,
    usuario: { id: number; nome: string },
    linhaId: number | null,
  ): PresencaLevantamento[] {
    let doProjeto = this.porProjeto.get(projetoId);
    if (!doProjeto) {
      doProjeto = new Map();
      this.porProjeto.set(projetoId, doProjeto);
    }
    doProjeto.set(usuario.id, {
      usuarioId: usuario.id,
      nome: usuario.nome,
      linhaId: linhaId ?? null,
      visto: Date.now(),
    });
    return this.ativos(projetoId, usuario.id);
  }

  /** Ativos do projeto, exceto `exceto`. Limpa os vencidos de passagem — a varredura
   * preguiçosa dispensa um job agendado só para isso. */
  ativos(projetoId: number, exceto?: number): PresencaLevantamento[] {
    const doProjeto = this.porProjeto.get(projetoId);
    if (!doProjeto) return [];
    const limite = Date.now() - this.TTL_MS;
    const vivos: PresencaLevantamento[] = [];
    for (const [id, r] of doProjeto) {
      if (r.visto < limite) {
        doProjeto.delete(id);
        continue;
      }
      if (id !== exceto)
        vivos.push({
          usuarioId: r.usuarioId,
          nome: r.nome,
          linhaId: r.linhaId,
        });
    }
    if (doProjeto.size === 0) this.porProjeto.delete(projetoId);
    return vivos;
  }

  /** Saída explícita (o técnico fechou a tela) — o TTL cobriria, mas assim o colega vê na hora. */
  sair(projetoId: number, usuarioId: number): void {
    this.porProjeto.get(projetoId)?.delete(usuarioId);
  }
}
