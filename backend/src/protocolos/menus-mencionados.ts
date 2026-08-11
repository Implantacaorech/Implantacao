/**
 * Descobre quais MENUS do SIGER foram citados numa transcrição, casando o texto contra o
 * catálogo real de menus (o do Dicionário, via `MenusSigerService`).
 *
 * Por que isto existe — o defeito que ele resolve:
 *
 * O usuário relatou em 2026-08-11 que a transcrição "não trouxe os menus de uso mencionados
 * no vídeo". A causa não é o prompt da IA (ele PEDE os menus, com formato e tudo): é que o
 * código do menu quase nunca chega íntegro ao texto. Ninguém fala "um ponto quatro traço i"
 * de forma limpa, e "1.4-I" não existe no português geral — então o Whisper escreve o que é
 * mais provável na língua: "um ponto quatro i", "1.4 i", "menu um quatro".
 *
 * A tentação é resolver isso no Whisper, mandando os menus como `hotwords`. **Não cabe**: a
 * janela de contexto dele é de ~224 tokens e o catálogo tem 416 menus (medido na base de
 * produção em 2026-08-11, sobre os 87 documentos do Dicionário). Empurrar mais termos
 * ainda ROUBA espaço dos nomes de participantes, que é onde ele mais erra (ver
 * `vocabulario.ts`).
 *
 * Então a resolução acontece DEPOIS da transcrição, aqui, contra a lista verdadeira. O
 * resultado não é a resposta final: é a lista de CANDIDATOS entregue à IA, para que ela
 * escolha dentro do que existe em vez de adivinhar. Menu que não está no catálogo do SIGER
 * não pode ser citado — e menu que foi citado de forma mastigada deixa de sumir.
 */

/** Um menu do catálogo, como o `MenusSigerService` entrega (mais a sigla do módulo). */
export interface MenuCatalogo {
  sigla: string;
  codigo: string;
  opcao: string;
  programa: string;
}

export interface MenuMencionado {
  codigo: string;
  /** MÓDULOS em que este código existe. Quase sempre um; às vezes muitos, e isso é real:
   * cada módulo do SIGER tem o seu "Empresa do módulo" em `1.2-M/I/A`, então esse código
   * sozinho aparece em AUE, COM, CST, EST, FAT, FIN, FPA, GPA e LFI. Agrupar em UMA linha,
   * dizendo em quais módulos existe, informa a ambiguidade — nove linhas quase idênticas só
   * afogariam o prompt. */
  siglas: string[];
  programas: string[];
  opcao: string;
  /** Como ele apareceu no texto — é o que permite conferir o acerto na revisão. */
  trecho: string;
  /** `codigo` = achou o código; `programa` = achou o nome do programa (ex.: FAT101);
   * `nome` = achou o nome da opção do menu. */
  via: 'codigo' | 'programa' | 'nome';
}

/**
 * Formato de um código de menu do SIGER: `2.3-N`, `1.2-M/I/A`.
 *
 * O filtro NÃO é preciosismo. A tabela "Caminho | Opção | Programa" dos documentos do
 * Dicionário também é usada para listar FONTES (`BDA001.CBL`), e sem esta checagem o catálogo
 * vinha com 1.724 entradas em vez de ~360 — a maioria nome de arquivo COBOL, que casaria com
 * qualquer conversa e encheria o prompt de lixo. Descoberto ao validar contra a base real de
 * produção, em 2026-08-11; os testes sintéticos não pegavam porque usavam só códigos válidos.
 */
const CODIGO_MENU = /^\d+\.\d+-[A-Za-z](?:\/[A-Za-z])*$/;

/** Só o que é código de menu de verdade entra na busca. */
export function apenasMenusValidos(catalogo: MenuCatalogo[]): MenuCatalogo[] {
  return catalogo.filter((m) => CODIGO_MENU.test((m.codigo || '').trim()));
}

const NUMEROS: Record<string, string> = {
  um: '1',
  uma: '1',
  dois: '2',
  duas: '2',
  tres: '3',
  quatro: '4',
  cinco: '5',
  seis: '6',
  sete: '7',
  oito: '8',
  nove: '9',
  dez: '10',
  onze: '11',
  doze: '12',
  treze: '13',
  catorze: '14',
  quatorze: '14',
  quinze: '15',
  dezesseis: '16',
  dezessete: '17',
  dezoito: '18',
  dezenove: '19',
  vinte: '20',
};

/** Minúsculas e sem acento — o texto vem com acentuação e o catálogo nem sempre. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Converte número por extenso em dígito quando ele participa de um código de menu.
 *
 * "um ponto quatro i" -> "1.4 i" · "dois virgula tres n" -> "2.3 n"
 *
 * Só troca quando há um separador falado no meio ("ponto", "virgula", "traco", "hifen"),
 * justamente para não transformar "quatro pedidos" em "4 pedidos" no meio de uma frase
 * comum — o que encheria o resultado de falso positivo.
 */
export function digitarNumerosFalados(texto: string): string {
  const nums = Object.keys(NUMEROS).join('|');
  const sep = 'ponto|virgula|traco|hifen';
  return normalizar(texto).replace(
    new RegExp(
      `\\b(${nums}|\\d{1,2})\\s+(?:${sep})\\s+(${nums}|\\d{1,2})\\b`,
      'g',
    ),
    (_t, a: string, b: string) => `${NUMEROS[a] ?? a}.${NUMEROS[b] ?? b}`,
  );
}

/** Códigos compostos do catálogo (`1.2-M/I/A`) valem por três: 1.2-M, 1.2-I e 1.2-A. */
export function expandirCodigo(codigo: string): string[] {
  const m = /^(\d+\.\d+)-([A-Za-z](?:\/[A-Za-z])*)$/.exec(codigo.trim());
  if (!m) return [codigo.trim()];
  return m[2].split('/').map((letra) => `${m[1]}-${letra.toUpperCase()}`);
}

/** Recorta um pedaço do texto em torno de uma posição, para a revisão poder conferir. */
function trechoEm(texto: string, pos: number, tamanho = 90): string {
  const ini = Math.max(0, pos - tamanho / 2);
  return texto
    .slice(ini, pos + tamanho / 2)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nome de opção curto demais vira falso positivo ("Notas", "Empresa" aparecem em qualquer
 * conversa). Só nomes distintivos entram pela via `nome`. */
const MINIMO_NOME = 14;

/**
 * Devolve os menus do catálogo que aparecem na transcrição, sem repetir, na ordem em que
 * foram citados.
 *
 * `limite` existe porque a lista vai para dentro do prompt da IA: uma reunião longa pode
 * citar dezenas de menus, e uma lista gigante dilui a instrução em vez de ajudar.
 */
export function menusMencionados(
  transcricao: string,
  catalogo: MenuCatalogo[],
  limite = 40,
): MenuMencionado[] {
  const validos = apenasMenusValidos(catalogo);
  if (!transcricao?.trim() || validos.length === 0) return [];

  const original = transcricao;
  const normalizado = normalizar(transcricao);
  const comDigitos = digitarNumerosFalados(transcricao);

  // Chave é o CÓDIGO, não código+módulo: o mesmo menu em vários módulos vira uma entrada só,
  // com a lista de módulos. Ver o comentário de `siglas` em MenuMencionado.
  const achados = new Map<string, MenuMencionado>();
  const jaVisto = new Set<string>();
  const chaveDe = (m: MenuCatalogo) => m.codigo.trim().toUpperCase();

  const registrar = (
    menu: MenuCatalogo,
    via: MenuMencionado['via'],
    pos: number,
    ondeBuscou: string,
  ) => {
    const chave = chaveDe(menu);
    jaVisto.add(chave);
    const existente = achados.get(chave);
    if (existente) {
      if (!existente.siglas.includes(menu.sigla))
        existente.siglas.push(menu.sigla);
      const prog = (menu.programa || '').trim();
      if (prog && !existente.programas.includes(prog))
        existente.programas.push(prog);
      return;
    }
    // A posição vem do texto em que a busca ocorreu; o trecho sai do original quando os
    // comprimentos batem (busca no texto normalizado preserva posição).
    const base = ondeBuscou.length === original.length ? original : ondeBuscou;
    achados.set(chave, {
      codigo: menu.codigo.trim(),
      siglas: [menu.sigla],
      programas: (menu.programa || '').trim() ? [menu.programa.trim()] : [],
      opcao: menu.opcao || '',
      via,
      trecho: trechoEm(base, pos),
    });
  };

  for (const menu of validos) {
    // 1) Código, na forma escrita e na falada. `1.2-M/I/A` casa por qualquer uma das letras.
    for (const codigo of expandirCodigo(menu.codigo)) {
      const m = /^(\d+\.\d+)-([A-Za-z])$/.exec(codigo);
      if (!m) continue;
      const [, numero, letra] = m;
      // Tolera o que o Whisper produz: "1.4-I", "1.4 I", "1.4I", "1.4.I", "1.4 - i".
      const re = new RegExp(
        `${numero.replace('.', '\\.')}\\s*[-.\\s]?\\s*${letra}\\b`,
        'i',
      );
      for (const texto of [normalizado, comDigitos]) {
        const achou = re.exec(texto);
        if (achou) {
          registrar(menu, 'codigo', achou.index, texto);
          break;
        }
      }
      if (jaVisto.has(chaveDe(menu))) break;
    }
    // Já achado pelo código: não faz sentido procurar o mesmo menu pelo programa ou pelo
    // nome. A chave é o CÓDIGO — a mesma entrada acumula os módulos em que ele existe.
    if (jaVisto.has(chaveDe(menu))) continue;

    // 2) Nome do programa (FAT101). O Whisper às vezes separa: "FAT 101".
    const prog = (menu.programa || '').trim();
    const mProg = /^([A-Za-z]{2,4})\s*(\d{2,4})$/.exec(prog);
    if (mProg) {
      const re = new RegExp(`\\b${mProg[1]}\\s*${mProg[2]}\\b`, 'i');
      const achou = re.exec(normalizado);
      if (achou) {
        registrar(menu, 'programa', achou.index, normalizado);
        continue;
      }
    }

    // 3) Nome da opção, só quando é distintivo o bastante para não casar por acaso.
    const nome = normalizar((menu.opcao || '').replace(/\.$/, '').trim());
    if (nome.length >= MINIMO_NOME) {
      const pos = normalizado.indexOf(nome);
      if (pos !== -1) registrar(menu, 'nome', pos, normalizado);
    }
  }

  return [...achados.values()].slice(0, limite);
}

/** Formata os candidatos para dentro do prompt da IA — uma linha por menu, curta. */
export function formatarParaPrompt(menus: MenuMencionado[]): string {
  if (menus.length === 0) return '';
  return menus
    .map((m) => {
      const modulos = m.siglas.join('/');
      const prog = m.programas.length ? `, ${m.programas.join('/')}` : '';
      const nome = m.opcao ? ` — ${m.opcao.replace(/\.$/, '')}` : '';
      // Ambiguidade DECLARADA: o mesmo código existe em vários módulos (todo módulo tem o
      // seu "Empresa do módulo" em 1.2-M/I/A), e quem decide qual vale é o contexto da
      // gravação. Esconder isso faria a IA escolher no escuro.
      const aviso =
        m.siglas.length > 1
          ? ' [existe em vários módulos — confirme pelo contexto]'
          : '';
      return `- ${m.codigo} (${modulos}${prog})${nome}${aviso}`;
    })
    .join('\n');
}
