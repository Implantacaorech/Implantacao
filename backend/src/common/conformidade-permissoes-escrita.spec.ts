import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/** Guarda automática do achado **M2** (Auditoria de Prontidão dos 9 eixos, 2026-08-12).
 *
 * A regra: uma rota que MUDA estado (`@Post`/`@Put`/`@Patch`/`@Delete`) não pode ficar protegida
 * apenas por `@Permissao(menu)` de nível `consulta` (o default do decorator) — quem só tem
 * consulta não deve escrever. O nível efetivo de uma rota é o `@Permissao` do próprio método,
 * ou, na falta dele, o `@Permissao` da CLASSE. Se esse nível efetivo for `consulta` numa rota de
 * escrita, é violação — salvo as exceções catalogadas abaixo, cada uma com o porquê.
 *
 * Irmã de `conformidade-stack.spec.ts` e `conformidade-arquitetura.spec.ts`, e pela mesma razão:
 * o furo não entra por decisão, entra por pressa — um `@Post` novo herdando o `consulta` da
 * classe "só pra funcionar agora". Roda em `npm test`, logo em todo push e no CI.
 *
 * **O que NÃO está no escopo:** rotas sem `@Permissao` nenhum (ex.: os downloads de
 * `documentos`, liberados a quem só consulta por exigência do processo) — essas passam pelo
 * guard e são governadas por `@Roles`/regra de serviço, não por este teste. Aqui só se cobra
 * coerência de NÍVEL onde o gate de menu existe. */
const SRC = join(__dirname, '..');

/** Exceções conscientes: rota de escrita que permanece em `consulta` de propósito. Lista
 * pequena e com motivo — acrescentar item aqui é decisão de arquitetura, não conveniência. */
const ESCRITA_CONSULTA_PERMITIDA: {
  arquivo: string;
  rota: string;
  motivo: string;
}[] = [
  {
    arquivo: 'passos/passos.controller.ts',
    rota: 'passos/:numero/concluir',
    motivo:
      'O Comercial tem só consulta em `carteira` mas é o responsável pelos passos 1 e 5; ' +
      'o gate real e mais estrito é PassosService.podeExecutar (perfil responsável + ' +
      'designação, RN-10). Exigir alteração aqui rebreakearia o achado de 2026-08-05.',
  },
  {
    arquivo: 'dicionario/dicionario.controller.ts',
    rota: 'perguntar',
    motivo:
      'POST de CONSULTA (pergunta ao RAG) — não persiste estado do cliente; o menu ' +
      'dicionário é só-ADM por padrão. É um POST por carregar corpo, não uma escrita.',
  },
];

function controllers(): string[] {
  const achados: string[] = [];
  const pilha = [SRC];
  while (pilha.length) {
    const dir = pilha.pop() as string;
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, item.name);
      if (item.isDirectory()) pilha.push(caminho);
      else if (item.name.endsWith('.controller.ts')) achados.push(caminho);
    }
  }
  return achados;
}

const rel = (caminho: string): string =>
  caminho.slice(SRC.length + 1).replace(/\\/g, '/');

/** Nível de um `@Permissao('menu')` ou `@Permissao('menu', 'alteracao')`; default `consulta`. */
function nivelDeTexto(texto: string): 'consulta' | 'alteracao' | null {
  const m = /@Permissao\(\s*'[^']*'\s*(?:,\s*'(\w+)')?\s*\)/.exec(texto);
  if (!m) return null;
  return m[1] === 'alteracao' ? 'alteracao' : 'consulta';
}

/** `@Permissao` de CLASSE = o que aparece na coluna 0 (decorators de classe não são indentados). */
function nivelClasse(linhas: string[]): 'consulta' | 'alteracao' | null {
  const linha = linhas.find((l) => /^@Permissao\(/.test(l));
  return linha ? nivelDeTexto(linha) : null;
}

/** Bloco de decorators de um handler: do decorator HTTP até a assinatura do método, pulando
 * corretamente decorators multi-linha (`@UseInterceptors(...)`, `@ApiOperation({...})`). Conta
 * profundidade de parênteses/chaves com as strings removidas, para um `(` dentro de um texto de
 * `summary` não desbalancear a contagem. */
function blocoDoHandler(linhas: string[], inicio: number): string {
  const bloco: string[] = [];
  let i = inicio;
  let prof = 0;
  while (i < linhas.length) {
    bloco.push(linhas[i]);
    const semStrings = linhas[i]
      .replace(/'[^']*'/g, '')
      .replace(/"[^"]*"/g, '')
      .replace(/`[^`]*`/g, '');
    for (const ch of semStrings) {
      if (ch === '(' || ch === '{' || ch === '[') prof++;
      else if (ch === ')' || ch === '}' || ch === ']') prof--;
    }
    i++;
    if (prof <= 0) {
      // Pula linhas em branco E comentários entre um decorator e o próximo (um `@Permissao`
      // pode vir depois de um comentário que explica o porquê) — senão o bloco terminaria cedo
      // demais e o nível de método passaria despercebido.
      const ehComentario = (s: string): boolean =>
        s.startsWith('//') || s.startsWith('*') || s.startsWith('/*');
      let j = i;
      while (
        j < linhas.length &&
        (linhas[j].trim() === '' || ehComentario(linhas[j].trim()))
      ) {
        j++;
      }
      if (j < linhas.length && linhas[j].trim().startsWith('@')) {
        i = j; // próximo decorator do mesmo handler
        continue;
      }
      if (j < linhas.length) bloco.push(linhas[j]); // a assinatura do método
      break;
    }
  }
  return bloco.join('\n');
}

function permitido(arquivo: string, rota: string): boolean {
  return ESCRITA_CONSULTA_PERMITIDA.some(
    (e) => rel(arquivo).endsWith(e.arquivo) && rota === e.rota,
  );
}

describe('Conformidade — rota de escrita não fica em @Permissao de consulta (M2)', () => {
  it('toda rota @Post/@Put/@Patch/@Delete com gate de menu exige nível de alteração', () => {
    const escritaRe = /@(Post|Put|Patch|Delete)\(/;
    const violacoes: string[] = [];

    for (const arq of controllers()) {
      const linhas = readFileSync(arq, 'utf8').split(/\r?\n/);
      const classe = nivelClasse(linhas);
      for (let i = 0; i < linhas.length; i++) {
        const m = escritaRe.exec(linhas[i]);
        // Só decorators INDENTADOS são de método; o da coluna 0 é de classe (não existe HTTP na
        // classe, mas a guarda mantém o critério explícito).
        if (!m || !/^\s+@/.test(linhas[i])) continue;
        const bloco = blocoDoHandler(linhas, i);
        const rota =
          /@(?:Post|Put|Patch|Delete)\(\s*'([^']*)'/.exec(linhas[i])?.[1] ?? '';
        const efetivo = nivelDeTexto(bloco) ?? classe;
        if (efetivo == null || efetivo === 'alteracao') continue; // sem gate ou já correto
        if (permitido(arq, rota)) continue;
        violacoes.push(`${rel(arq)} @${m[1]} '${rota}'`);
      }
    }

    // Jest só aceita um argumento em expect — a mensagem acionável vai DENTRO do valor comparado
    // (mesmo idioma de exigirVazio em conformidade-arquitetura.spec.ts).
    const relatorio = violacoes.length
      ? "Rota de escrita protegida só por consulta. Declare @Permissao(menu, 'alteracao') no " +
        'método (ou registre a exceção com motivo em ESCRITA_CONSULTA_PERMITIDA):\n' +
        violacoes.map((v) => `  - ${v}`).join('\n')
      : '';
    expect(relatorio).toBe('');
  });
});
