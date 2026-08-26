import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/** Guarda automática da REGRA DA API DE DADOS (ADR-0003, decidida em 2026-08-25):
 *
 *   **Toda e qualquer consulta a banco de dados EXTERNO passa por uma API.**
 *
 * Irmã de `conformidade-stack.spec.ts` e `conformidade-arquitetura.spec.ts`, e pela mesma
 * razão: a regra não é furada por decisão, é furada por pressa. Um `import oracledb` num
 * módulo novo "só pra resolver agora", um `executarSql` copiado de outro service, um SQL
 * montado com concatenação de string.
 *
 * **O que estes testes NÃO afirmam:** que o backend inteiro já está do outro lado da
 * fronteira. Não está — a migração é faseada (plano em `docs/pendencias.md`):
 *
 * - **fase 0 (2026-08-25):** o módulo `src/dados/` nasce, com catálogo, executor e contrato;
 * - **fase 1 (2026-08-25):** os 10 módulos passam a pedir a consulta PELO NOME — a dívida
 *   de `executarSql` zerou;
 * - **fase 2 (2026-08-25):** `oracledb` e `mysql2` mudaram para `src/dados/conexoes/`, e a
 *   Disponibilidade virou domínio puro. Restou UMA exceção de driver, permanente e
 *   justificada (ver `PODEM_IMPORTAR_DRIVER`).
 *
 * O que eles travam é o que JÁ é verdade, com CATRACA: os números só podem CAIR. */
const SRC = join(__dirname, '..');
const RAIZ_DADOS = join(SRC, 'dados');

/** Drivers de banco. Quem importa um destes está abrindo conexão — é exatamente o que a
 * regra quer que exista num lugar só. */
const DRIVERS = ['oracledb', 'mysql2', 'better-sqlite3'];

/** Arquivos fora de `dados/` que podem importar driver, cada um com o motivo. Esta lista é
 * o TETO: acrescentar item aqui é decisão de arquitetura (e contraria o ADR-0003), não
 * conveniência de implementação.
 *
 * **Na fase 2 caiu de 3 para 1.** Os executores do SICLA (Oracle) e do Portal Rech (MySQL)
 * mudaram para `dados/conexoes/`. Sobrou UMA exceção, e ela é PERMANENTE por decisão, não
 * dívida — o motivo está no item. */
const PODEM_IMPORTAR_DRIVER: Record<string, string> = {
  'consultor-siger/consultor-siger.service.ts':
    'EXCEÇÃO PERMANENTE. A base do Consultor SIGER não é um banco VINCULADO: é um artefato ' +
    'DERIVADO (SQLite gerado por um indexador externo a partir do código-fonte), um arquivo ' +
    'local aberto em READONLY, sem credencial, sem rede e sem outro consumidor. O módulo já ' +
    'É a API dele (/api/consultor-siger/*), e suas 7 consultas são busca full-text com ' +
    'aridade variável — encaixá-las num catálogo de consultas NOMEADAS distorceria os dois ' +
    'lados sem fechar risco nenhum. O risco que o ADR-0003 endereça (credencial circulando, ' +
    'SQL solto contra sistema de terceiro, execução sem auditoria) não existe aqui.',
};

/** Módulos que ainda chamam o executor direto em vez de pedir a consulta pelo nome.
 *
 * **ZERADA na fase 1 (2026-08-25):** os 10 módulos que estavam aqui — agenda, bi-*,
 * clientes/modulos/tecnicos/funcoes-sicla e rns — passaram a pedir a consulta PELO NOME
 * (`DadosService.consultar`). A lista fica no código, vazia, de propósito: é a catraca. Um
 * módulo novo que chame `executarSql` quebra o teste seguinte, e acrescentar item aqui para
 * "destravar" é reabrir a dívida — contraria o ADR-0003. */
const DIVIDA_EXECUTAR_SQL: string[] = [];

/** Pastas que podem conter o executor por definição. Depois da fase 2 é UMA só: o módulo da
 * API de Dados. A Disponibilidade saiu da lista quando o driver mudou de casa — hoje ela é
 * domínio puro e consome o catálogo como qualquer outro módulo. */
const DONOS_DO_EXECUTOR = ['dados/'];

function arquivosTs(raiz: string): string[] {
  const achados: string[] = [];
  const pilha = [raiz];
  while (pilha.length) {
    const dir = pilha.pop() as string;
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, item.name);
      if (item.isDirectory()) pilha.push(caminho);
      else if (item.name.endsWith('.ts') && !item.name.endsWith('.spec.ts')) {
        achados.push(caminho);
      }
    }
  }
  return achados;
}

const rel = (caminho: string): string =>
  caminho.slice(SRC.length + 1).replace(/\\/g, '/');
const ler = (caminho: string): string => readFileSync(caminho, 'utf8');

function existe(caminho: string): boolean {
  try {
    statSync(caminho);
    return true;
  } catch {
    return false;
  }
}

/** Falha com mensagem ACIONÁVEL — quem esbarrar precisa saber o que fazer, não só onde foi
 * pego. (Mesmo idioma de `exigirVazio` em conformidade-arquitetura.spec.ts: o Jest aceita
 * um argumento só em `expect`, então o relatório vai dentro do valor comparado.) */
function exigirVazio(achados: string[], comoCorrigir: string): void {
  const relatorio = achados.length
    ? [comoCorrigir, ...achados.map((a) => `  - ${a}`)].join('\n')
    : '';
  expect(relatorio).toBe('');
}

describe('Conformidade com a API de Dados (ADR-0003)', () => {
  const todos = arquivosTs(SRC);

  describe('A fronteira existe', () => {
    it('o módulo src/dados/ está no lugar, com catálogo, executor e contrato', () => {
      const faltando = [
        'dados.module.ts',
        'dados.service.ts',
        'dados.controller.ts',
        'catalogo/catalogo.ts',
        'catalogo/catalogo.types.ts',
        'conexoes/conexoes.service.ts',
      ].filter((f) => !existe(join(RAIZ_DADOS, f)));
      exigirVazio(faltando, 'Peça essencial da API de Dados sumiu:');
    });

    it('o DadosModule está registrado no AppModule', () => {
      // Sem isto a API some da aplicação e nenhum outro teste percebe: o catálogo continua
      // íntegro, os specs de unidade continuam verdes, e só o consumidor descobre — em 404.
      const app = ler(join(SRC, 'app.module.ts'));
      expect(app).toContain('DadosModule');
    });
  });

  describe('Driver de banco mora num lugar só', () => {
    it('nenhum arquivo novo importa oracledb/mysql2/better-sqlite3', () => {
      const padrao = new RegExp(
        `(from|require\\()\\s*['"](${DRIVERS.join('|')})(/[\\w-]+)?['"]`,
      );
      const infratores = todos
        .filter((a) => padrao.test(ler(a)))
        .map(rel)
        .filter((r) => !r.startsWith('dados/'))
        .filter((r) => !PODEM_IMPORTAR_DRIVER[r]);

      exigirVazio(
        infratores,
        'Driver de banco só dentro de src/dados/conexoes/. Peça a consulta ao catálogo (DadosService.executar) em vez de abrir conexão:',
      );
    });

    it('a lista de exceções não cresce — a fase 2 a levou de 3 para 1', () => {
      expect(Object.keys(PODEM_IMPORTAR_DRIVER).length).toBeLessThanOrEqual(1);
    });

    it('toda exceção declarada ainda existe (lista sem item morto)', () => {
      // Exceção que aponta para arquivo removido vira permissão fantasma: o dia em que
      // alguém recriar aquele caminho, ele já nasce liberado.
      const fantasmas = Object.keys(PODEM_IMPORTAR_DRIVER).filter(
        (r) => !existe(join(SRC, r)),
      );
      exigirVazio(fantasmas, 'Exceção apontando para arquivo que não existe:');
    });
  });

  describe('Executor de SQL: catraca da migração', () => {
    const chamadores = todos
      .filter((a) => /\.executarSql\(/.test(ler(a)))
      .map(rel)
      .filter((r) => !DONOS_DO_EXECUTOR.some((d) => r.startsWith(d)))
      .sort();

    it('nenhum módulo NOVO chama o executor direto', () => {
      const novos = chamadores.filter((r) => !DIVIDA_EXECUTAR_SQL.includes(r));
      exigirVazio(
        novos,
        'Consulta a banco externo passa pela API de Dados: declare a consulta em src/dados/catalogo/catalogo.ts e chame DadosService.executar(nome, parametros). Ver src/dados/docs/api.md:',
      );
    });

    it('a dívida não cresce (catraca)', () => {
      expect(chamadores.length).toBeLessThanOrEqual(DIVIDA_EXECUTAR_SQL.length);
    });

    it('a lista de dívida não guarda módulo já migrado', () => {
      // Item que sobra na lista depois da migração deixa a catraca frouxa — abre espaço
      // para um módulo novo entrar sem quebrar nada.
      const jaMigrados = DIVIDA_EXECUTAR_SQL.filter(
        (r) => !chamadores.includes(r),
      );
      exigirVazio(
        jaMigrados,
        'Módulo migrado ainda listado em DIVIDA_EXECUTAR_SQL — remova a entrada para a catraca apertar:',
      );
    });
  });

  describe('O contrato não vaza SQL para quem chama', () => {
    it('o DTO de EXECUÇÃO não aceita sql, conexão nem limite', () => {
      // É a diferença entre "toda consulta tem uma API" e "trocamos o transporte do mesmo
      // SQL solto". Este é o DTO que o CONSUMIDOR preenche: se um destes campos aparecer
      // aqui, a regra virou fachada.
      const proibidos = /\b(sql|conexao|limite|limiteLinhas)\s*[?]?\s*:/;
      const dto = join(RAIZ_DADOS, 'dto', 'executar-consulta.dto.ts');
      const infratores = proibidos.test(ler(dto)) ? [rel(dto)] : [];
      exigirVazio(
        infratores,
        'O DTO de execução não aceita SQL/conexão/limite — esses são do servidor:',
      );
    });

    it('só os DTOs de ADMINISTRAÇÃO podem falar de SQL', () => {
      // DEFINIR uma consulta (o Administrador, em Sistema → Consultas BD) é o oposto de
      // EXECUTÁ-LA (o consumidor). O primeiro obviamente recebe SQL; o segundo nunca pode.
      // Esta lista é o teto: um DTO novo que fale de SQL precisa ser justificado aqui, e
      // a rota dele tem de estar sob `@Roles(PERFIS_SISTEMA)`.
      const PODEM_FALAR_DE_SQL = [
        'dados/dto/consulta-publicada.dto.ts',
        // Veio de `disponibilidade/dto/` em 2026-08-26, junto com a tela Consultas BD, que
        // passou a ser exclusiva do Portal API. É o mesmo caso do de cima: quem preenche é
        // o ADMINISTRADOR, definindo a consulta — não o consumidor, executando-a. A rota
        // está sob `@Roles(PERFIS_SISTEMA)`.
        'dados/dto/salvar-consulta-bd.dto.ts',
      ];
      const proibidos = /\b(sql|conexao|limite|limiteLinhas)\s*[?]?\s*:/;
      const infratores = arquivosTs(join(RAIZ_DADOS, 'dto'))
        .filter((a) => proibidos.test(ler(a)))
        .map(rel)
        .filter((r) => !PODEM_FALAR_DE_SQL.includes(r));
      exigirVazio(
        infratores,
        'DTO que aceita SQL/conexão/limite sem ser de administração:',
      );
    });

    it('o catálogo é a única fonte de SQL dentro de src/dados/', () => {
      // Vale para SQL ESCRITO no código. O texto que o Administrador cadastra pela tela
      // vive no banco, não aqui — e por isso não aparece nesta varredura.
      const foraDoCatalogo = arquivosTs(RAIZ_DADOS)
        .filter((a) => /\bSELECT\b[\s\S]{0,400}\bFROM\b/i.test(ler(a)))
        .map(rel)
        .filter((r) => !r.startsWith('dados/catalogo/'));
      exigirVazio(
        foraDoCatalogo,
        'SQL dentro do módulo dados/ só em catalogo/ (é lá que o contrato é conferido pelos testes):',
      );
    });
  });
});
