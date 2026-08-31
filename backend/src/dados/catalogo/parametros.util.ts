import { ConsultaCatalogo, ParametroConsulta } from './catalogo.types';

/** Valor aceito de um bind depois de validado. */
export type ValorBind = string | number | null;

export interface ResultadoValidacao {
  ok: boolean;
  /** Mensagens em pt-BR, uma por parâmetro problemático — é o corpo do 400. */
  erros: string[];
  /** Binds prontos para o driver, já convertidos ao formato que o SQL espera. */
  binds: Record<string, ValorBind>;
  /** O SQL que deve ser executado. Igual ao vigente, EXCETO quando há parâmetro
   * `lista_texto`: aí `:nome` vira `(:nome_0, :nome_1, …)`. */
  sql: string;
}

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const RE_COMPETENCIA = /^\d{4}-\d{2}$/;
const RE_DATAHORA_MINUTO = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

/** Tamanho padrão de um parâmetro de texto quando a consulta não declara o seu. Vale como
 * teto de segurança: `LIKE` com termo gigante é o jeito mais fácil de pendurar o Oracle. */
const MAX_TEXTO_PADRAO = 200;

/** `AAAA-MM-DD` é o formato-contrato de TODA data que entra e sai do Painel — inclusive na
 * borda com o SICLA, onde o SQL faz `TO_DATE(:bind, 'YYYY-MM-DD')`. Validar aqui (e não no
 * driver) é o que impede um `data_ini` malformado virar erro ORA cru na cara do consumidor. */
function dataValida(valor: string): boolean {
  if (!RE_DATA.test(valor)) return false;
  const [ano, mes, dia] = valor.split('-').map(Number);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  // Rejeita 2026-02-31 e afins: o Date normaliza em silêncio para 03-03.
  return (
    d.getUTCFullYear() === ano &&
    d.getUTCMonth() === mes - 1 &&
    d.getUTCDate() === dia
  );
}

function converter(
  p: ParametroConsulta,
  bruto: unknown,
): { valor?: ValorBind; erro?: string } {
  const texto = typeof bruto === 'string' ? bruto.trim() : String(bruto);

  switch (p.tipo) {
    case 'data':
      return dataValida(texto)
        ? { valor: texto }
        : { erro: `"${p.nome}" deve ser uma data no formato AAAA-MM-DD.` };

    case 'competencia':
      if (!RE_COMPETENCIA.test(texto)) {
        return {
          erro: `"${p.nome}" deve ser uma competência no formato AAAA-MM.`,
        };
      }
      // A view de indicadores do SICLA guarda a competência como texto AAAA/MM e o filtro
      // compara texto — a conversão mora aqui para o consumidor externo nunca precisar
      // saber disso (ele manda AAAA-MM, como em toda outra data da API).
      return { valor: texto.replace('-', '/') };

    case 'datahora_minuto':
      return RE_DATAHORA_MINUTO.test(texto)
        ? { valor: texto }
        : { erro: `"${p.nome}" deve estar no formato AAAA-MM-DD HH:MM.` };

    case 'inteiro': {
      const n = Number(texto);
      return Number.isInteger(n)
        ? { valor: n }
        : { erro: `"${p.nome}" deve ser um número inteiro.` };
    }

    case 'lista_texto':
      // Tratado fora do `converter`: uma lista vira N binds e REESCREVE o SQL — as duas
      // coisas que este switch, que devolve um valor só, não sabe fazer.
      return { erro: `"${p.nome}" é uma lista e não passa por aqui.` };

    case 'texto':
    case 'texto_busca': {
      const max = p.maxTamanho ?? MAX_TEXTO_PADRAO;
      if (!texto) return { erro: `"${p.nome}" não pode ser vazio.` };
      if (texto.length > max) {
        return { erro: `"${p.nome}" passa do limite de ${max} caracteres.` };
      }
      // O curinga é aplicado AQUI, não pelo consumidor: os SELECTs de busca do SICLA
      // recebem o termo já com `%` (contrato herdado de clientes-sicla.constants.ts), e
      // deixar isso na mão de quem chama é convite a resultado silenciosamente vazio.
      return { valor: p.tipo === 'texto_busca' ? `%${texto}%` : texto };
    }
  }
}

/** Valida a entrada do consumidor contra o contrato declarado no catálogo e devolve os
 * binds prontos.
 *
 * `sqlVigente` existe porque parte do SQL é EDITÁVEL pelo Administrador (Sistema →
 * Consultas BD): se ele salvar uma versão sem `:data_ini`, mandar o bind assim mesmo faz o
 * driver recusar a execução inteira. Então só vai o bind que o texto vigente referencia —
 * mesma regra que o BI de Implantação já aplicava à mão. */
export function validarParametros(
  consulta: ConsultaCatalogo,
  entrada: Record<string, unknown> | undefined,
  sqlVigente: string,
): ResultadoValidacao {
  const dados = entrada ?? {};
  const erros: string[] = [];
  const binds: Record<string, ValorBind> = {};
  let sql = sqlVigente;

  const declarados = new Set(consulta.parametros.map((p) => p.nome));
  for (const chave of Object.keys(dados)) {
    if (!declarados.has(chave)) {
      erros.push(
        `Parâmetro "${chave}" não existe em ${consulta.nome}. Aceitos: ${
          consulta.parametros.map((p) => p.nome).join(', ') || '(nenhum)'
        }.`,
      );
    }
  }

  for (const p of consulta.parametros) {
    const bruto = dados[p.nome];

    if (p.tipo === 'lista_texto') {
      // A expansão acontece MESMO com lista vazia (vira `(NULL)`): deixar `:nome` cru no
      // SQL faria o driver recusar a execução inteira por bind não fornecido.
      const {
        sql: sqlNovo,
        binds: bindsLista,
        erro,
      } = expandirLista(p, bruto, sql);
      if (erro) erros.push(erro);
      else {
        sql = sqlNovo;
        Object.assign(binds, bindsLista);
      }
      continue;
    }

    const ausente = bruto === undefined || bruto === null || bruto === '';
    if (ausente) {
      if (p.obrigatorio) erros.push(`"${p.nome}" é obrigatório.`);
      continue;
    }

    const { valor, erro } = converter(p, bruto);
    if (erro) {
      erros.push(erro);
      continue;
    }
    // `\b` não serve como fronteira à direita de um bind (`:data_ini` seguido de `_`
    // casaria); a checagem usa o nome seguido de qualquer coisa que não seja letra,
    // dígito ou `_`.
    const referenciado = new RegExp(`:${p.nome}(?![A-Za-z0-9_])`).test(sql);
    if (referenciado) binds[p.nome] = valor as ValorBind;
  }

  return { ok: erros.length === 0, erros, binds, sql };
}

/** Troca `:nome` por `(:nome_0, :nome_1, …)` e devolve os binds correspondentes.
 *
 * Herdado do `expandirTecnicos` da Disponibilidade: o node-oracledb não expande lista em
 * bind, ao contrário do SQLAlchemy que o Painel Flask usava. Subiu para o catálogo na fase 2
 * do ADR-0003 — é comportamento de execução, não de um módulo. */
function expandirLista(
  p: ParametroConsulta,
  bruto: unknown,
  sql: string,
): { sql: string; binds: Record<string, ValorBind>; erro?: string } {
  // Duas regexes: a global só para o replace. `test()` numa regex global avança o
  // `lastIndex` e transformaria a checagem em algo dependente de ordem.
  const token = new RegExp(`:${p.nome}(?![A-Za-z0-9_])`, 'g');
  if (!new RegExp(`:${p.nome}(?![A-Za-z0-9_])`).test(sql)) {
    return { sql, binds: {} };
  }

  if (bruto !== undefined && bruto !== null && !Array.isArray(bruto)) {
    return {
      sql,
      binds: {},
      erro: `"${p.nome}" deve ser uma lista de textos.`,
    };
  }
  // Só string/número viram item: um objeto no meio da lista viraria "[object Object]" e
  // entraria como bind silenciosamente errado.
  const valores = ((bruto as unknown[]) ?? [])
    .map((v) =>
      typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '',
    )
    .filter(Boolean);

  if (valores.length === 0) {
    return { sql: sql.replace(token, '(NULL)'), binds: {} };
  }
  const max = p.maxTamanho ?? MAX_TEXTO_PADRAO;
  const grande = valores.find((v) => v.length > max);
  if (grande) {
    return {
      sql,
      binds: {},
      erro: `Um item de "${p.nome}" passa do limite de ${max} caracteres.`,
    };
  }

  const binds: Record<string, ValorBind> = {};
  const nomes = valores.map((v, i) => {
    const nome = `${p.nome}_${i}`;
    binds[nome] = v;
    return `:${nome}`;
  });
  return { sql: sql.replace(token, `(${nomes.join(', ')})`), binds };
}
