import { Document, Paragraph, TextRun } from 'docx';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OUT_DIR, carregarYaml, slug } from './comum';
import { tabelaComCabecalho, tituloRech } from './comum-docx';
import { gerarSobreTemplate } from './docx-template';

/** Porte de `tools/gerar_termo_encerramento.py` para Node/TS (§4.2/§4.7 dos Padrões da Rech).
 *
 * Gera o Termo de Encerramento do Projeto de Implantação (.docx) — documento OBRIGATÓRIO —
 * fiel ao template real da Rech. O conteúdo é montado aqui e aplicado sobre
 * `tools/templates/base_termo.docx`, que fornece margens, seção, cabeçalhos e rodapés
 * (o timbre) e os estilos. Porte de EQUIVALÊNCIA — prova em
 * `gerar-termo-encerramento.spec.ts`, que compara também cabeçalhos e rodapés. */

export const CAMINHO_TEMPLATE = join(
  process.cwd(),
  '..',
  'tools',
  'templates',
  'base_termo.docx',
);

export function templateExiste(): boolean {
  return existsSync(CAMINHO_TEMPLATE);
}

/** Tamanhos de título por nível — `_HS` do original. */
const TAMANHO_TITULO: Record<number, number> = { 1: 13, 2: 12, 3: 11 };

/** Estilo de lista do template Rech ("List Paragraph"). O original tenta primeiro
 * "List Bullet"; como o template não tem esse estilo, cai no fallback: aplica
 * "List Paragraph" e escreve o glifo COMO TEXTO. O glifo faz parte do conteúdo, não da
 * formatação — é assim que sai no documento real. */
const ESTILO_LISTA = 'PargrafodaLista';
const GLIFO = '•  ';

interface Alteracao {
  modulo?: string;
  rotina?: string;
  descricao?: string;
}
interface ResumoModulo {
  modulo?: string;
  adicional?: string;
  processo?: string;
  status_uso?: string;
  obs?: string;
}
interface Pendencia {
  pendencia?: string;
  tecnico?: string;
  detalhamento?: string;
}
interface DadosTermo {
  cliente?: string;
  numero_projeto?: string | number;
  data_validacao?: string;
  alteracoes?: Alteracao[];
  resumo_modulos?: ResumoModulo[];
  observacoes?: string[];
  pendencias?: Pendencia[];
  cidade_data?: string;
}

function P(texto = '', negrito = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: texto, bold: negrito })],
  });
}

function marcador(texto: string): Paragraph {
  return new Paragraph({
    style: ESTILO_LISTA,
    children: [new TextRun({ text: GLIFO + texto })],
  });
}

const CONTATOS_SUPORTE = [
  'Dúvidas pontuais de uso e situações que necessitem suporte técnico deverão ser reportadas ao setor de Suporte da Rech®:',
  'Os contatos receberão prioridade de retorno na seguinte ordem:',
  '1º Contatos via telefone (51-3582.4001) – (atendimento prioritário)',
  '2º Contatos via e-mail (suporte@rech.com.br)',
  '3º Contatos via Teams',
  'Horário de funcionamento do suporte será conforme previsto em contrato.',
  'O Sistema SIGER® também dispõe de um manual próprio que pode ser consultado pela tecla de atalho “F1”, quando estiver acessando qualquer módulo.',
  'Quando detectadas demandas de natureza diferente ao propósito do suporte Rech®, estes serão redirecionados para um contato do setor de “Consultoria” da Rech® Sistemas de Gestão.',
];

/** Monta o documento. Separado de `gerar()` para o teste inspecionar sem gravar. */
export function montarDocumento(
  d: DadosTermo = carregarYaml<DadosTermo>('termo.yaml'),
): Document {
  const cliente = d.cliente ?? '';
  const numero = d.numero_projeto ?? '';
  const numeroTexto = numero ? ` (nº ${numero})` : '';
  const titulo = (texto: string, nivel = 1): Paragraph =>
    tituloRech(texto, TAMANHO_TITULO[nivel] ?? 12);

  const alteracoes = d.alteracoes ?? [];
  const blocoAlteracoes: Paragraph[] =
    alteracoes.length > 0
      ? alteracoes.flatMap((a) => {
          const linhas: Paragraph[] = [];
          if (a.modulo) linhas.push(P(a.modulo, true));
          if (a.rotina) linhas.push(P(a.rotina, true));
          if (a.descricao) linhas.push(P(a.descricao));
          return linhas;
        })
      : [
          P(
            'Não houve alterações significativas no projeto original, tais como substituição, ' +
              'cancelamento ou incrementos de módulos e mudanças de rotinas que impactassem no ' +
              'objetivo final de uso do SIGER®.',
          ),
        ];

  const pendencias = d.pendencias ?? [];
  const blocoPendencias: Paragraph[] =
    pendencias.length > 0
      ? pendencias.flatMap((p) => [
          P(`Pendência: ${p.pendencia ?? ''}`, true),
          P(`Técnico responsável: ${p.tecnico ?? ''}`),
          P(`Detalhamento da ação: ${p.detalhamento ?? ''}`),
        ])
      : [
          P(
            'Não há pendências a serem sequenciadas após o encerramento do projeto.',
          ),
        ];

  return new Document({
    sections: [
      {
        children: [
          tituloRech(
            'Termo de encerramento do projeto de implantação do SIGER®',
            16,
            true,
          ),
          P(`Cliente: ${cliente}`, true),

          titulo('Processo de transição e finalização da implantação'),
          P(
            'O presente termo tem por finalidade oficializar o encerramento da implantação do ERP ' +
              `SIGER® junto à empresa ${cliente}, cujo escopo do projeto original${numeroTexto} fora ` +
              `estabelecido e validado entre as partes na data de ${d.data_validacao ?? '____'}.`,
          ),
          P(
            'Diante do encerramento do projeto referenciado neste termo, a empresa supracitada ' +
              'desvincula-se do atendimento do setor de implantação da Rech, passando a ter como canal ' +
              'principal de atendimento o setor de suporte, cujos meios de contatos são indicados a seguir:',
          ),
          ...CONTATOS_SUPORTE.map(marcador),

          titulo('Do encerramento'),
          P('Considerações para encerramento do projeto de implantação.'),
          P(
            'As rotinas aplicadas atenderam as necessidades previstas com a implantação do ERP SIGER® ' +
              'descritas no projeto o qual está referenciada neste termo.',
          ),
          P(
            'No ato de formalização deste termo, ratificamos a inexistência de pendências ou restrições ' +
              'ao processo de implantação por parte da contratante.',
          ),

          titulo(
            'Das alterações e incrementos tratados fora do escopo original',
          ),
          P(
            'Neste tópico serão apresentados aspectos que refletiram em incrementos, mudanças de ' +
              'definições e alterações do processo inicialmente mapeado e da sua efetiva aderência.',
          ),
          ...blocoAlteracoes,

          titulo('Do resumo geral da implantação'),
          tabelaComCabecalho(
            [
              'Módulo',
              'Adicional',
              'Processo de Implantação',
              'Status de Uso',
              'Obs.',
            ],
            (d.resumo_modulos ?? []).map((m) => [
              m.modulo ?? '',
              m.adicional ?? '',
              m.processo ?? '',
              m.status_uso ?? '',
              m.obs ?? '',
            ]),
          ),
          ...(d.observacoes ?? []).map((obs, i) =>
            P(`Observação ${i + 1}: ${obs}`),
          ),

          titulo(
            'Dos pontos que serão sequenciados e entregues pelo setor de implantação mesmo após o encerramento do projeto',
          ),
          ...blocoPendencias,

          new Paragraph({}),
          P(d.cidade_data ?? ''),
          new Paragraph({}),
          P('Assinatura Rech\t\t\tAssinatura Cliente'),
        ],
      },
    ],
  });
}

/** Gera o .docx aplicando o conteúdo sobre o template oficial da Rech. */
export async function gerarBuffer(d?: DadosTermo): Promise<Buffer> {
  const dados = d ?? carregarYaml<DadosTermo>('termo.yaml');
  const { buffer } = await gerarSobreTemplate(
    CAMINHO_TEMPLATE,
    montarDocumento(dados),
  );
  return buffer;
}

/** Gera o arquivo em `exemplos/`, com o mesmo nome do original. */
export async function gerar(): Promise<string> {
  const d = carregarYaml<DadosTermo>('termo.yaml');
  mkdirSync(OUT_DIR, { recursive: true });
  const caminho = join(OUT_DIR, `Termo_Encerramento_${slug(d.cliente)}.docx`);
  writeFileSync(caminho, await gerarBuffer(d));
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
