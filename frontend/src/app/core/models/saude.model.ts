/** Diagnóstico da infraestrutura do próprio Painel (GET /api/saude).
 *
 * Não confundir com o `saude` numérico do Centro de Monitoramento, que é o percentual de
 * projetos saudáveis — negócio, não máquina. */
export type NivelSaude = 'ok' | 'aviso' | 'critico' | 'desconhecido';

export interface ItemSaude {
  /** 'banco' | 'backup' | 'guardiao' | 'docservice' | 'transcricao' | 'email' */
  chave: string;
  titulo: string;
  nivel: NivelSaude;
  mensagem: string;
  /** O que fazer, ou o número exato. Vem vazio quando não há o que acrescentar. */
  detalhe: string;
}

export interface ResultadoSaude {
  /** O pior dos itens. */
  nivel: NivelSaude;
  itens: ItemSaude[];
  verificadoEm: string;
}

export const ROTULO_NIVEL: Record<NivelSaude, string> = {
  ok: 'Tudo certo',
  aviso: 'Atenção',
  critico: 'Crítico',
  desconhecido: 'Sem informação',
};
