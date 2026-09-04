/** Chave do menu no painel de Permissões.
 *
 * **NÃO é `atividade`** (singular), que já existe e é outra tela: o feed/KPIs de uso da
 * operação, no grupo Gestão. Duas chaves que diferem por uma letra seriam armadilha em
 * `permissoes_menu`, então esta é explicitamente `controle_atividades`. */
export const MENU_CONTROLE_ATIVIDADES = 'controle_atividades';

/** Catálogo FIXO de etiquetas. Fixo, e não tabela, porque são as etiquetas do processo de
 * implantação — iguais em todo quadro. Uma tabela + tela de cadastro para cinco valores
 * seria custo sem retorno; vira tabela no dia em que houver etiqueta por cliente. */
export const ETIQUETAS: { chave: string; nome: string }[] = [
  { chave: 'conv', nome: 'Conversão' },
  { chave: 'fisc', nome: 'Fiscal' },
  { chave: 'trei', nome: 'Treinamento' },
  { chave: 'risc', nome: 'Risco' },
  { chave: 'infra', nome: 'Infra' },
];
export const ETIQUETA_CHAVES = ETIQUETAS.map((e) => e.chave);

/** Colunas com que um quadro novo nasce (decisão 3 do §8 do desenho).
 *
 * `Bastidor Rech` nasce interna: é a coluna de bastidor, e o cliente não a enxerga nem
 * vazia. As outras quatro são compartilhadas — o que o cliente vê DENTRO delas continua
 * dependendo do cartão. */
export const COLUNAS_PADRAO: { titulo: string; visivelCliente: boolean }[] = [
  { titulo: 'A fazer', visivelCliente: true },
  { titulo: 'Em andamento', visivelCliente: true },
  { titulo: 'Com o cliente', visivelCliente: true },
  { titulo: 'Concluído', visivelCliente: true },
  { titulo: 'Bastidor Rech', visivelCliente: false },
];

/** Título da coluna que marca cartão como concluído ao receber um arraste. Comparado sem
 * acento/caixa para sobreviver a um rename cosmético da coluna. */
export const COLUNA_CONCLUIDO = 'Concluído';

/** Teto de linhas da consulta geral. Existe para a busca não virar um dump do banco quando
 * alguém procura por "a"; a tela avisa quando truncou. */
export const TETO_BUSCA = 50;

/** Mínimo de caracteres para a consulta geral rodar. Abaixo disso ela nem consulta. */
export const MIN_BUSCA = 2;
