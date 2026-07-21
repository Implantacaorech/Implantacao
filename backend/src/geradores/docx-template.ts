import { Document, Packer } from 'docx';
import { existsSync, readFileSync } from 'fs';
import JSZip from 'jszip';

/** Equivalente em Node/TypeScript de `_common.style_base()` (§4.2/§4.7 dos Padrões da Rech).
 *
 * O Python abre `tools/templates/base_<tipo>.docx`, REMOVE todos os filhos do corpo menos o
 * `<w:sectPr>` e escreve o conteúdo novo por cima. O que sobrevive é exatamente o que faz o
 * documento ser "da Rech": margens, seção, cabeçalhos e rodapés (o timbre), estilos e as
 * imagens do logo.
 *
 * Em Node não existe um python-docx: a lib `docx` só CRIA documentos, não abre. A estratégia
 * aqui é a mesma em espírito — usar o .docx do template como base do pacote (assim todas as
 * partes que não tocamos seguem intactas: header*.xml, footer*.xml, styles.xml, media/, rels)
 * e trocar só o miolo do `word/document.xml`, mantendo o `<w:sectPr>` original.
 */

/** Miolo do corpo de um .docx gerado pela lib `docx`, já sem o `<w:sectPr>` dela. */
function corpoGerado(xml: string): string {
  const inicio = xml.indexOf('<w:body>');
  const fim = xml.lastIndexOf('</w:body>');
  if (inicio < 0 || fim < 0) throw new Error('documento gerado sem <w:body>');
  const corpo = xml.slice(inicio + '<w:body>'.length, fim);
  // A seção quem manda é a do template — a do documento gerado é descartada.
  const sect = corpo.lastIndexOf('<w:sectPr');
  return sect >= 0 ? corpo.slice(0, sect) : corpo;
}

/** `<w:sectPr>...</w:sectPr>` do template: margens, tamanho da página e as referências de
 * cabeçalho/rodapé. É o único filho do corpo que o original preserva. */
function secaoDoTemplate(xml: string): string {
  const inicio = xml.lastIndexOf('<w:sectPr');
  if (inicio < 0) return '';
  const fim = xml.indexOf('</w:sectPr>', inicio);
  // `<w:sectPr .../>` sem filhos é válido; nesse caso fecha na própria tag.
  if (fim < 0) {
    const autofecho = xml.indexOf('/>', inicio);
    return autofecho < 0 ? '' : xml.slice(inicio, autofecho + 2);
  }
  return xml.slice(inicio, fim + '</w:sectPr>'.length);
}

/** Espaçamento 1.15 no estilo "Normal", como o original faz depois de abrir o template.
 * 1.15 × 240 = 276 vinte-avos de ponto, que é a unidade do OOXML. */
function aplicarEspacamentoNormal(estilosXml: string): string {
  const marca = 'w:styleId="Normal"';
  const posEstilo = estilosXml.indexOf(marca);
  if (posEstilo < 0) return estilosXml;
  const fimEstilo = estilosXml.indexOf('</w:style>', posEstilo);
  if (fimEstilo < 0) return estilosXml;
  const trecho = estilosXml.slice(posEstilo, fimEstilo);
  if (/<w:spacing[^>]*w:line=/.test(trecho)) return estilosXml; // já definido

  const espacamento = '<w:spacing w:line="276" w:lineRule="auto"/>';
  const posPpr = trecho.indexOf('<w:pPr>');
  if (posPpr >= 0) {
    const corte = posEstilo + posPpr + '<w:pPr>'.length;
    return estilosXml.slice(0, corte) + espacamento + estilosXml.slice(corte);
  }
  // Sem <w:pPr> no estilo: cria um logo após a abertura de <w:style ...>.
  const fimAbertura = estilosXml.indexOf('>', posEstilo);
  if (fimAbertura < 0 || fimAbertura > fimEstilo) return estilosXml;
  return (
    estilosXml.slice(0, fimAbertura + 1) +
    `<w:pPr>${espacamento}</w:pPr>` +
    estilosXml.slice(fimAbertura + 1)
  );
}

/** Gera o .docx aplicando o conteúdo de `doc` sobre o template, preservando seção, timbre e
 * estilos. Se o template não existir, devolve o documento sozinho — mesmo fallback do
 * original (`style_base` retorna um Document novo quando falta o arquivo). */
export async function gerarSobreTemplate(
  caminhoTemplate: string,
  doc: Document,
): Promise<{ buffer: Buffer; usouTemplate: boolean }> {
  const gerado = await Packer.toBuffer(doc);
  if (!existsSync(caminhoTemplate)) {
    return { buffer: gerado, usouTemplate: false };
  }

  const zipGerado = await JSZip.loadAsync(gerado);
  const docGerado = zipGerado.file('word/document.xml');
  if (!docGerado) throw new Error('documento gerado sem word/document.xml');
  const xmlGerado = await docGerado.async('string');

  const zipTemplate = await JSZip.loadAsync(readFileSync(caminhoTemplate));
  const docTemplate = zipTemplate.file('word/document.xml');
  if (!docTemplate) throw new Error('template sem word/document.xml');
  const xmlTemplate = await docTemplate.async('string');

  const inicioCorpo = xmlTemplate.indexOf('<w:body>');
  const fimCorpo = xmlTemplate.lastIndexOf('</w:body>');
  if (inicioCorpo < 0 || fimCorpo < 0) throw new Error('template sem <w:body>');

  const novoXml =
    xmlTemplate.slice(0, inicioCorpo + '<w:body>'.length) +
    corpoGerado(xmlGerado) +
    secaoDoTemplate(xmlTemplate) +
    xmlTemplate.slice(fimCorpo);

  zipTemplate.file('word/document.xml', novoXml);

  const estilos = zipTemplate.file('word/styles.xml');
  if (estilos) {
    zipTemplate.file(
      'word/styles.xml',
      aplicarEspacamentoNormal(await estilos.async('string')),
    );
  }

  return {
    buffer: await zipTemplate.generateAsync({ type: 'nodebuffer' }),
    usouTemplate: true,
  };
}
