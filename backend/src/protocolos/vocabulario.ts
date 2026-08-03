/** Vocabulário enviado ao Whisper como `hotwords` — a lista de termos que ele deve
 * "esperar ouvir" na gravação.
 *
 * Motivo concreto (relatado em 2026-07-30): a transcrição escreveu **IVEA** onde a pessoa
 * disse *IVIAN*, e **ormai** onde disse *ouro*. Não é falha de áudio: sem contexto, o modelo
 * escolhe a sequência de sons mais provável do português GERAL, e nome próprio e jargão de
 * ERP são justamente o que quase nunca aparece nesse português geral. Dizer a ele quais
 * palavras são esperadas nesta reunião desempata a favor delas.
 *
 * A ordem importa: o que vem primeiro pesa mais, e a janela de contexto do Whisper é curta
 * (~224 tokens). Por isso o que o usuário digitou vem na frente, depois o cliente, e o
 * glossário fixo entra só com o que sobra. */

/** Núcleo do jargão da casa. Curto de propósito: cada termo aqui ocupa espaço que poderia
 * ser de um nome de participante, que é o caso em que o modelo mais erra. */
export const TERMOS_RECH = [
  'SIGER',
  'Rech',
  'RNS',
  'SICLA',
  'implantação',
  'levantamento',
  'faturamento',
  'conciliação bancária',
  'matriz de integração',
  'NF-e',
  'CFOP',
  'centro de custo',
];

/** Teto de caracteres do vocabulário. Passar disso não melhora — a janela de contexto do
 * modelo é curta, e um prompt gigante dilui os termos que realmente importam. */
const LIMITE = 400;

export interface FontesVocabulario {
  /** Nomes e termos digitados por quem grava — a informação mais valiosa. */
  digitado?: string;
  cliente?: string;
  titulo?: string;
}

/** Monta a string de hotwords: termos digitados, cliente, título e o glossário da casa,
 * sem repetir e sem estourar o limite. */
export function montarVocabulario(fontes: FontesVocabulario): string {
  const bruto = [
    ...(fontes.digitado ?? '').split(/[,;\n]/),
    fontes.cliente ?? '',
    fontes.titulo ?? '',
    ...TERMOS_RECH,
  ];

  const vistos = new Set<string>();
  const termos: string[] = [];
  for (const item of bruto) {
    const termo = item.trim().replace(/\s+/g, ' ');
    if (!termo) continue;
    const chave = termo.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    // Corta ao chegar no limite em vez de truncar no meio de uma palavra — meia palavra
    // como hotword não ajuda o modelo e pode atrapalhar.
    const tamanhoComEste = termos.join(', ').length + termo.length + 2;
    if (termos.length > 0 && tamanhoComEste > LIMITE) break;
    termos.push(termo);
  }
  return termos.join(', ');
}
