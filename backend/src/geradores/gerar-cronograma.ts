import { Document, Packer, Paragraph, TextRun } from 'docx';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OUT_DIR, carregarYaml, slug } from './comum';
import { tabelaComCabecalho, tituloRech } from './comum-docx';
import { resolverModulos } from './catalogo';

/** Porte de `tools/gerar_cronograma.py` para Node/TS (§4.2/§4.7 dos Padrões da Rech).
 *
 * Gera o Cronograma de Implantação do SIGER® (.docx) — documento OBRIGATÓRIO. Distribui as
 * agendas conforme as horas (cobradas + bonificadas), com os macro tópicos por etapa, datas
 * previstas em dias úteis e modalidade. Porte de EQUIVALÊNCIA — prova em
 * `gerar-cronograma.spec.ts`.
 *
 * O original chama `_common.style_base("cronograma")`, que carregaria
 * `tools/templates/base_cronograma.docx` se ele existisse — e NÃO existe. Hoje o Python cai
 * no ramo de documento em branco, e é esse comportamento real que este porte reproduz. Se
 * algum dia o template for adicionado, o Python passa a usá-lo e este porte diverge; o teste
 * `gerar-cronograma.spec.ts` vigia exatamente isso e falha para avisar. */

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** Caminho do template que o original procuraria — usado só pela guarda do teste. */
export const CAMINHO_TEMPLATE_BASE = join(
  process.cwd(),
  '..',
  'tools',
  'templates',
  'base_cronograma.docx',
);

export function templateBaseExiste(): boolean {
  return existsSync(CAMINHO_TEMPLATE_BASE);
}

interface Agenda {
  etapa?: string;
  topicos?: string;
  horas?: string | number;
  data?: string;
  modalidade?: string;
}
interface DadosCronograma {
  cliente?: string;
  numero_projeto?: string | number;
  consultor?: string;
  modalidade_padrao?: string;
  cadencia_dias?: string | number;
  horas?: {
    cobradas?: string | number;
    bonificadas?: string | number;
    total?: string | number;
  };
  horas_total?: string | number;
  agendas?: Agenda[];
  modulos_contratados?: (string | number)[];
  modulos?: (string | number)[];
  data_inicio?: string;
  data?: string;
  observacoes?: string[];
  cidade_data?: string;
}

/** Valor vindo do YAML que estes utilitários aceitam. Objeto aqui é bug, não uso — mesmo
 * critério já aplicado em `slug()` e `parseData()` de `comum.ts`. */
type ValorYaml = string | number | null | undefined;

/** Primeiro número do texto, com vírgula decimal aceita — `_num()`. */
export function num(s: ValorYaml): number {
  const m = /\d+(?:[.,]\d+)?/.exec(String(s ?? ''));
  return m ? parseFloat(m[0].replace(',', '.')) : 0;
}

/** Inteiro quando exato, senão uma casa decimal — `_fmt()`. */
export function fmt(x: number): string {
  const v = x || 0;
  return v === Math.trunc(v) ? String(Math.trunc(v)) : v.toFixed(1);
}

/** Aceita aaaa-mm-dd, dd/mm/aaaa e dd/mm/aa; cai para HOJE se não reconhecer — `_parse_date()`. */
export function parseDataCronograma(s: ValorYaml): Date {
  const texto = String(s ?? '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(texto);
  // %y do Python: 00-68 -> 2000-2068, 69-99 -> 1969-1999.
  if (m) {
    const aa = +m[3];
    return new Date(aa <= 68 ? 2000 + aa : 1900 + aa, +m[2] - 1, +m[1]);
  }
  return new Date();
}

/** Adianta para o próximo dia útil — `_prox_util()`. */
export function proximoUtil(d: Date): Date {
  const r = new Date(d);
  while (r.getDay() === 0 || r.getDay() === 6) r.setDate(r.getDate() + 1);
  return r;
}

/** Soma `n` dias ÚTEIS — `_add_uteis()`. */
export function somarUteis(d: Date, n: number): Date {
  const r = new Date(d);
  let faltam = n;
  while (faltam > 0) {
    r.setDate(r.getDate() + 1);
    if (r.getDay() !== 0 && r.getDay() !== 6) faltam -= 1;
  }
  return r;
}

function ddmmaaaa(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Reparte `total` horas pelos pesos (método do maior resto) — `_distribuir()`.
 * Sem total informado, usa peso*2 como horas. */
export function distribuir(total: number, pesos: number[]): number[] {
  if (total <= 0) return pesos.map((p) => Math.max(1, Math.round(p * 2)));
  const soma = pesos.reduce((a, b) => a + b, 0) || 1;
  const exatos = pesos.map((p) => (total * p) / soma);
  const base = exatos.map((x) => Math.trunc(x));
  let resto = Math.round(total) - base.reduce((a, b) => a + b, 0);
  const ordem = pesos
    .map((_, i) => i)
    .sort((a, b) => exatos[b] - base[b] - (exatos[a] - base[a]));
  let i = 0;
  while (resto > 0 && ordem.length > 0) {
    base[ordem[i % ordem.length]] += 1;
    resto -= 1;
    i += 1;
  }
  return base;
}

/** Plano padrão da implantação SIGER®: (etapa, macro tópicos, peso) — `_plano_automatico()`. */
export function planoAutomatico(
  modulos: (string | number)[] | undefined,
): [string, string, number][] {
  const { achados } = resolverModulos(modulos ?? []);
  const plano: [string, string, number][] = [
    [
      'Abertura + Parametrização inicial',
      'Criação de empresas e siglas; parâmetros gerais (1.1.P) e por empresa (1.2.A); ' +
        'compartilhamento de cadastros (1.2.M); tabelas genéricas.',
      2.0,
    ],
  ];
  for (const m of achados) {
    const desc = m.descricao || m.abrev || 'Módulo';
    plano.push([
      `Treinamento — ${desc}`,
      'Tabelas e cadastros do módulo; importações via layout do SIGER®; ' +
        'rotinas do processo; relatórios.',
      2.0,
    ]);
  }
  if (achados.length === 0) {
    plano.push([
      'Treinamento das rotinas',
      'Tabelas e cadastros; importações via layout; rotinas dos processos.',
      4.0,
    ]);
  }
  plano.push(
    [
      'Simulação de microprocessos',
      'Teste das rotinas treinadas por processo; ajustes finos.',
      1.5,
    ],
    [
      'Simulação do macroprocesso',
      'Ensaio do processo completo (cenário real); validação ponta a ponta.',
      1.5,
    ],
    [
      'Conversão — prévia',
      'Carga de teste; reconciliação origem × destino; validação de amostras.',
      1.0,
    ],
    [
      'Conversão — oficial / ponto de corte',
      'Conversão oficial; conferência de saldos; definição do ponto de corte.',
      1.0,
    ],
    [
      'Virada oficial (go-live)',
      'Início do uso em produção; acompanhamento full time; primeiros lançamentos.',
      1.5,
    ],
    [
      'Acompanhamento / Hypercare',
      'Estabilização; micro ajustes; primeiros fechamentos.',
      1.0,
    ],
    [
      'Encerramento',
      'Revisão de pendências; Termo de Encerramento; transição ao Suporte.',
      0.5,
    ],
  );
  return plano;
}

/** Monta o documento. Separado de `gerar()` para o teste inspecionar sem gravar. */
export function montarDocumento(
  d: DadosCronograma = carregarYaml<DadosCronograma>('cronograma.yaml'),
): Document {
  const cliente = d.cliente ?? '';
  const numeroProjeto = d.numero_projeto ?? '';
  const consultor = d.consultor ?? '';
  const modalidade = d.modalidade_padrao ?? 'A combinar';
  const cadencia = Math.trunc(num(d.cadencia_dias ?? 5)) || 5;

  const horas = d.horas ?? {};
  const cobradas = num(horas.cobradas);
  const bonificadas = num(horas.bonificadas);
  // O original é `cob + bon or _num(...)`: a soma só é descartada quando dá zero.
  let total = cobradas + bonificadas || num(horas.total ?? d.horas_total);

  // Agendas explícitas têm prioridade; senão, plano automático pelos módulos.
  let agendas: Agenda[] = d.agendas ?? [];
  if (agendas.length === 0) {
    const plano = planoAutomatico(d.modulos_contratados ?? d.modulos ?? []);
    const hs = distribuir(
      total,
      plano.map(([, , peso]) => peso),
    );
    if (total <= 0) total = hs.reduce((a, b) => a + b, 0);
    agendas = plano.map(([etapa, topicos], i) => ({
      etapa,
      topicos,
      horas: hs[i],
    }));
  }

  // Datas previstas (dias úteis), espaçadas pela cadência.
  const dt0 = proximoUtil(parseDataCronograma(d.data_inicio ?? d.data));
  agendas.forEach((ag, i) => {
    if (!ag.data) {
      ag.data = ddmmaaaa(i === 0 ? dt0 : somarUteis(dt0, cadencia * i));
    }
    ag.modalidade = ag.modalidade ?? modalidade;
    ag.horas = ag.horas ?? '';
  });
  const somaHoras = agendas.reduce((acc, a) => acc + num(a.horas), 0);

  const linha: string[] = [];
  if (numeroProjeto) linha.push(`Projeto nº ${numeroProjeto}`);
  if (consultor) linha.push(`Consultor: ${consultor}`);
  linha.push(
    `Horas: ${fmt(cobradas)} contratadas + ${fmt(bonificadas)} bonificadas = ${fmt(total)}`,
  );

  const observacoes = d.observacoes ?? [
    'Datas previstas, sujeitas a ajuste conforme a disponibilidade das partes.',
    'Agendas registradas no SICLA no nome do cliente; treinamento/parametrização interna como tipo 84.',
    'Cronograma compartilhado via Google Drive (link enviado ao usuário líder).',
    'Cliente de menor porte: cronograma simplificado, deixando claro o que será e o que não será atendido.',
  ];

  const hoje = new Date();
  const cidadeData =
    d.cidade_data ??
    `Novo Hamburgo, ${hoje.getDate()} de ${MESES[hoje.getMonth()]} de ${hoje.getFullYear()}.`;

  // Linha de total: só as colunas "Macro tópicos" e "Horas" são preenchidas, como no original.
  const linhasAgenda = agendas.map((ag, i) => {
    const h = num(ag.horas);
    return [
      String(i + 1),
      ag.data ?? '',
      ag.etapa ?? '',
      ag.topicos ?? '',
      h ? `${fmt(h)} h` : '',
      ag.modalidade ?? '',
    ];
  });
  linhasAgenda.push(['', '', '', 'Total', `${fmt(somaHoras)} h`, '']);

  return new Document({
    sections: [
      {
        children: [
          tituloRech('Cronograma de Implantação do SIGER®', 16, true),
          new Paragraph({
            children: [
              new TextRun({ text: `Cliente: ${cliente}`, bold: true }),
            ],
          }),
          new Paragraph(linha.join(' · ')),
          new Paragraph(
            'Este cronograma organiza a distribuição das agendas (horas contratadas + bonificadas), ' +
              'com os macro tópicos de cada visita/treinamento. As datas são previstas e podem ser ' +
              'ajustadas em comum acordo; o limite de 5 dias úteis após a liberação do levantamento é ' +
              'balizador. As agendas serão incluídas no SICLA (no nome do cliente) e compartilhadas com ' +
              'o usuário líder.',
          ),
          tabelaComCabecalho(
            [
              '#',
              'Data prevista',
              'Etapa / Treinamento',
              'Macro tópicos',
              'Horas',
              'Modalidade',
            ],
            linhasAgenda,
          ),
          new Paragraph({}),
          tituloRech('Observações', 12),
          ...observacoes.map(
            (it) => new Paragraph({ text: it, bullet: { level: 0 } }),
          ),
          new Paragraph({}),
          new Paragraph(cidadeData),
        ],
      },
    ],
  });
}

/** Gera o arquivo em `exemplos/`, com o mesmo nome do original. */
export async function gerar(): Promise<string> {
  const d = carregarYaml<DadosCronograma>('cronograma.yaml');
  const doc = montarDocumento(d);
  mkdirSync(OUT_DIR, { recursive: true });
  const caminho = join(
    OUT_DIR,
    `Cronograma_Implantacao_${slug(d.cliente)}.docx`,
  );
  writeFileSync(caminho, await Packer.toBuffer(doc));
  return caminho;
}

if (require.main === module) {
  gerar()
    .then((caminho) => console.log(`OK: ${caminho}`))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });
}
