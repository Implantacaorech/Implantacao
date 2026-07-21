import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { OUT_DIR, carregarYaml, hoje, slug } from './comum';
import { tabelaComCabecalho } from './comum-docx';

/** Porte de `tools/gerar_dossie_cliente.py` para Node/TS (§4.2/§4.7 dos Padrões da Rech).
 *
 * Gera o Dossiê do Cliente (.docx): o documento vivo onde "mora" o estado consolidado de cada
 * implantação — identificação, escopo, status por etapa, RNS vinculadas, artefatos e links.
 * Porte de EQUIVALÊNCIA — prova em `gerar-dossie-cliente.spec.ts`. */

interface Cnpj {
  sigla?: string;
  cnpj?: string;
}
interface Cliente {
  nome?: string;
  codigo_sicla?: string;
  cnpjs?: Cnpj[];
  rns_implantacao?: string;
  usuario_lider?: string;
  contato_fone?: string;
  data_virada_prevista?: string;
}
interface Projeto {
  consultor_responsavel?: string;
  area?: string;
  modulos?: string[];
}
interface DadosCliente {
  cliente?: Cliente;
  projeto?: Projeto;
}
interface DadosDossie {
  status_etapas?: { etapa?: string; status?: string }[];
  rns_vinculadas?: {
    tipo?: string;
    numero?: string;
    descricao?: string;
    status?: string;
  }[];
  artefatos?: string[];
  links?: { nome?: string; url?: string }[];
}

function titulo(texto: string): Paragraph {
  return new Paragraph({ text: texto, heading: HeadingLevel.HEADING_1 });
}

function marcadores(itens: string[]): Paragraph[] {
  return itens.map((t) => new Paragraph({ text: t, bullet: { level: 0 } }));
}

/** Monta o documento. Separado de `gerar()` para o teste inspecionar sem gravar. */
export function montarDocumento(
  cli: DadosCliente = carregarYaml<DadosCliente>('exemplo_cliente.yaml'),
  dos: DadosDossie = carregarYaml<DadosDossie>('dossie.yaml'),
): Document {
  const cliente = cli.cliente ?? {};
  const projeto = cli.projeto ?? {};
  const cnpjs = (cliente.cnpjs ?? [])
    .map((c) => `${c.sigla} — ${c.cnpj}`)
    .join('; ');

  return new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: `Dossiê de Implantação — ${cliente.nome ?? ''}`,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `Atualizado em ${hoje()}`, italics: true }),
            ],
          }),

          titulo('Identificação'),
          tabelaComCabecalho(
            ['Campo', 'Valor'],
            [
              ['Cliente', cliente.nome ?? ''],
              ['Código SICLA', cliente.codigo_sicla ?? ''],
              ['CNPJ(s) / Sigla(s)', cnpjs],
              ['RNS de Implantação', cliente.rns_implantacao ?? ''],
              ['Consultor responsável', projeto.consultor_responsavel ?? ''],
              ['Área', projeto.area ?? ''],
              ['Usuário líder', cliente.usuario_lider ?? ''],
              ['Contato', cliente.contato_fone ?? ''],
              ['Virada prevista', cliente.data_virada_prevista ?? ''],
            ].map(([k, v]) => [String(k), String(v)]),
          ),

          titulo('Escopo (módulos)'),
          ...marcadores(projeto.modulos ?? []),

          titulo('Status por etapa'),
          tabelaComCabecalho(
            ['Etapa', 'Status'],
            (dos.status_etapas ?? []).map((e) => [
              e.etapa ?? '',
              e.status ?? '',
            ]),
          ),

          titulo('RNS vinculadas'),
          tabelaComCabecalho(
            ['Tipo', 'Número', 'Descrição', 'Status'],
            (dos.rns_vinculadas ?? []).map((r) => [
              r.tipo ?? '',
              String(r.numero ?? ''),
              r.descricao ?? '',
              r.status ?? '',
            ]),
          ),

          titulo('Artefatos gerados'),
          ...marcadores(dos.artefatos ?? []),

          titulo('Links'),
          tabelaComCabecalho(
            ['Recurso', 'Link'],
            (dos.links ?? []).map((l) => [l.nome ?? '', l.url ?? '']),
          ),

          titulo('Observações'),
          new Paragraph(
            '________________________________________________________________',
          ),
          new Paragraph(
            '________________________________________________________________',
          ),
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
  const caminho = join(OUT_DIR, `Dossie_${slug(cli.cliente?.nome)}.docx`);
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
