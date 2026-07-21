import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { OUT_DIR, carregarYaml, hoje, slug } from './comum';
import { GRADE, celula, celulaRotulo, tabelaComCabecalho } from './comum-docx';

/** Porte de `tools/gerar_aceite_uat.py` para Node/TS (§4.2/§4.7 dos Padrões da Rech).
 *
 * Gera o Termo de Aceite de Testes (SIT/UAT) em .docx — o documento de sign-off que serve de
 * gate para autorizar a virada oficial. Porte de EQUIVALÊNCIA — prova em
 * `gerar-aceite-uat.spec.ts`. */

interface Cliente {
  nome?: string;
  codigo_sicla?: string;
  rns_implantacao?: string;
  data_virada_prevista?: string;
}
interface Projeto {
  numero?: string | number;
  consultor_responsavel?: string;
}
interface DadosCliente {
  cliente?: Cliente;
  projeto?: Projeto;
}
interface Modulo {
  nome?: string;
  casos?: unknown[];
}
interface DadosRoteiros {
  modulos?: Modulo[];
}

/** Monta o documento. Separado de `gerar()` para o teste inspecionar sem gravar. */
export function montarDocumento(
  cli: DadosCliente = carregarYaml<DadosCliente>('exemplo_cliente.yaml'),
  rot: DadosRoteiros = carregarYaml<DadosRoteiros>('roteiros_teste.yaml'),
): Document {
  const cliente = cli.cliente ?? {};
  const projeto = cli.projeto ?? {};
  const modulos = rot.modulos ?? [];
  const nome = cliente.nome ?? '';

  const identificacao = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: GRADE,
    rows: (
      [
        ['Cliente', nome],
        ['Código SICLA', cliente.codigo_sicla ?? ''],
        ['RNS de Implantação', cliente.rns_implantacao ?? ''],
        ['Consultor responsável', projeto.consultor_responsavel ?? ''],
        ['Virada prevista', cliente.data_virada_prevista ?? ''],
        ['Data do aceite', hoje()],
      ] as [string, string][]
    ).map(
      ([k, v]) =>
        new TableRow({ children: [celulaRotulo(k), celula(String(v))] }),
    ),
  });

  // Aprovados/Reprovados/Pendentes saem em branco de propósito: são preenchidos à mão a
  // partir da aba "Resumo e Sign-off" da planilha de roteiros.
  const porModulo = tabelaComCabecalho(
    ['Módulo', 'Casos', 'Aprovados', 'Reprovados', 'Pendentes'],
    modulos.map((mod) => [
      mod.nome ?? '',
      String((mod.casos ?? []).length),
      '',
      '',
      '',
    ]),
  );

  const criterios = [
    '≥ 95% dos casos UAT com status Aprovado.',
    'Zero defeitos de severidade Crítica em aberto.',
    'Defeitos de severidade Alta com plano de ação acordado.',
    'Remessas bancárias e integrações com terceiros homologadas (quando aplicável).',
  ];

  const papeis = [
    'Consultor de Implantação — Rech',
    `Usuário Líder — ${nome}`,
    'Gerente do Projeto — Rech',
  ];

  return new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: 'TERMO DE ACEITE DE TESTES (SIT / UAT)',
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `${nome} — Projeto nº ${projeto.numero ?? ''}`,
                italics: true,
              }),
            ],
          }),
          new Paragraph({}),
          new Paragraph(
            'Este termo registra a conclusão e o aceite dos testes do sistema SIGER® para o cliente ' +
              `${nome}, abrangendo o Teste Integrado (SIT) e o Aceite do Usuário (UAT) ` +
              'dos módulos no escopo. O aceite formaliza que os processos foram validados e autoriza a ' +
              'preparação da virada oficial.',
          ),
          new Paragraph({
            text: 'Identificação',
            heading: HeadingLevel.HEADING_1,
          }),
          identificacao,
          new Paragraph({
            text: 'Resultado por módulo',
            heading: HeadingLevel.HEADING_1,
          }),
          porModulo,
          // O original faz `.italic = True` no parágrafo devolvido por add_paragraph(); em
          // python-docx isso só cria um atributo solto, sem efeito no documento. Como o porte
          // é de equivalência, reproduzimos o comportamento REAL (sem itálico), não a intenção.
          new Paragraph(
            'Preencher Aprovados/Reprovados/Pendentes a partir da planilha de roteiros (aba “Resumo e Sign-off”).',
          ),
          new Paragraph({
            text: 'Critério de liberação (gate da virada)',
            heading: HeadingLevel.HEADING_1,
          }),
          ...criterios.map(
            (t) => new Paragraph({ text: t, bullet: { level: 0 } }),
          ),
          new Paragraph({
            text: 'Assinaturas',
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({}),
          ...papeis.flatMap((papel) => [
            new Paragraph('__________________________________________'),
            new Paragraph({
              children: [new TextRun({ text: papel, italics: true })],
            }),
            new Paragraph({}),
          ]),
        ],
      },
    ],
  });
}

/** Gera o arquivo em `exemplos/`, com o mesmo nome do original. */
export async function gerar(): Promise<string> {
  const cli = carregarYaml<DadosCliente>('exemplo_cliente.yaml');
  const doc = montarDocumento(cli);
  mkdirSync(OUT_DIR, { recursive: true });
  const caminho = join(
    OUT_DIR,
    `Termo_Aceite_UAT_${slug(cli.cliente?.nome)}.docx`,
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
