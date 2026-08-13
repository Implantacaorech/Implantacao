import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/** Guarda automática do **Guia Mestre de Arquitetura de Desenvolvimento**
 * (`vault/23 - Padrões/Guia Mestre de Arquitetura de Desenvolvimento.md`), adotado pelo
 * ADR-0002.
 *
 * Irmã de `conformidade-stack.spec.ts` e pela mesma razão: desvio de arquitetura não entra
 * por decisão, entra por pressa. Um `@InjectRepository` no controller "só pra resolver
 * agora", um `NotFoundException` dentro do repository, um módulo novo sem `.module.ts`.
 * Roda em `npm test` — logo, em todo push e no CI.
 *
 * **O que estes testes NÃO afirmam:** que o backend inteiro já está adequado ao guia. Não
 * está — a adequação é faseada (plano em `docs/pendencias.md`). Eles travam o que JÁ é
 * verdade, para que a fase seguinte comece de onde a anterior parou. */
const SRC = join(__dirname, '..');

/** Módulo-piloto: estrutura completa do guia (repositories/ + os 6 docs). É o que se copia
 * ao adequar o próximo módulo, então precisa continuar íntegro. */
const MODULO_PILOTO = 'plano-cronograma';

const DOCS_OBRIGATORIOS = [
  'README.md',
  'arquitetura.md',
  'api.md',
  'regras-negocio.md',
  'casos-de-uso.md',
  'fluxo.md',
];

/** Exceções à regra "controller não fala com banco", cada uma com o motivo. Lista vazia é o
 * estado desejado — acrescentar item aqui é decisão de arquitetura, não conveniência. */
const CONTROLLERS_QUE_PODEM_TOCAR_O_BANCO: Record<string, string> = {};

function arquivos(sufixo: string, raiz = SRC): string[] {
  const achados: string[] = [];
  const pilha = [raiz];
  while (pilha.length) {
    const dir = pilha.pop() as string;
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, item.name);
      if (item.isDirectory()) pilha.push(caminho);
      else if (item.name.endsWith(sufixo)) achados.push(caminho);
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

/** Falha com uma mensagem ACIONÁVEL em vez do diff cru de array: quem esbarrar na regra
 * precisa saber o que fazer, não só onde foi pego.
 *
 * (O `expect(valor, mensagem)` que o spec de padrões do frontend usa é do Vitest; o Jest
 * aceita só um argumento — daí montar o relatório dentro do próprio valor comparado.) */
function exigirVazio(achados: string[], comoCorrigir: string): void {
  const relatorio = achados.length
    ? [comoCorrigir, ...achados.map((a) => `  - ${a}`)].join('\n')
    : '';
  expect(relatorio).toBe('');
}

describe('Conformidade com o Guia Mestre de Arquitetura', () => {
  describe('Controller: entrada apenas, nunca persistência', () => {
    // A regra do guia é "Controller: receber requisição, validar entrada, chamar Service,
    // retornar resposta — nunca conter regra de negócio". Acesso a banco na camada de
    // entrada é a forma mais comum de furá-la, e é detectável com precisão.
    it('nenhum controller injeta repositório ou DataSource', () => {
      const infratores = arquivos('.controller.ts')
        .filter((c) => !c.endsWith('.spec.ts'))
        .filter((c) => /@InjectRepository|@InjectDataSource/.test(ler(c)))
        .map(rel)
        .filter((r) => !CONTROLLERS_QUE_PODEM_TOCAR_O_BANCO[r]);

      exigirVazio(
        infratores,
        `Controller não acessa banco. Mova para um Service + Repository (modelo: src/${MODULO_PILOTO}/):`,
      );
    });

    it('nenhum controller importa o TypeORM', () => {
      const infratores = arquivos('.controller.ts')
        .filter((c) => !c.endsWith('.spec.ts'))
        .filter((c) => /from '(typeorm|@nestjs\/typeorm)'/.test(ler(c)))
        .map(rel)
        .filter((r) => !CONTROLLERS_QUE_PODEM_TOCAR_O_BANCO[r]);

      exigirVazio(infratores, 'Controller não conhece ORM:');
    });
  });

  describe('Repository: persistência apenas', () => {
    const repositorios = arquivos('.repository.ts').filter(
      (r) => !r.endsWith('.spec.ts'),
    );

    it('existe pelo menos um repository (a camada não sumiu)', () => {
      expect(repositorios.length).toBeGreaterThan(0);
    });

    it('todo repository mora numa pasta repositories/', () => {
      const fora = repositorios
        .map(rel)
        .filter((r) => !r.includes('/repositories/'));
      exigirVazio(
        fora,
        'Mova para <modulo>/repositories/ (ou database/repositories/ se a entidade for transversal):',
      );
    });

    it('nenhum repository lança exceção HTTP — quem traduz "não achei" é o Service', () => {
      const infratores = repositorios
        .filter((r) =>
          /(NotFound|BadRequest|Forbidden|Unauthorized|Conflict|UnprocessableEntity|InternalServerError)Exception/.test(
            ler(r),
          ),
        )
        .map(rel);
      exigirVazio(
        infratores,
        'Repository não conhece protocolo: devolva null/vazio e deixe o Service traduzir para HTTP:',
      );
    });

    it('nenhum repository depende de um Service (a seta aponta só para baixo)', () => {
      const infratores = repositorios
        .filter((r) => /import .*\bfrom '.*\.service'/.test(ler(r)))
        .map(rel);
      exigirVazio(infratores, 'Repository → Service inverte a camada:');
    });
  });

  describe('Adequação faseada — a dívida de Repository nos Services não CRESCE (A18)', () => {
    // A regra central do ADR-0002 é "Service não injeta Repository<T> direto — vai pela camada
    // Repository". A adequação é faseada (fase 2 do plano em docs/pendencias.md): há uma dívida
    // conhecida de Services que ainda injetam `@InjectRepository`. Esta catraca NÃO exige zerar
    // já — exige NÃO PIORAR: um módulo novo (ou uma alteração) que injete Repository num Service
    // sobe o número e QUEBRA aqui, forçando a passar pela camada certa. Achado A18.
    //
    // Baseline medido em 2026-08-13. Ao portar um módulo para a camada Repository, o número
    // CAI — atualize o baseline PARA BAIXO (nunca para cima) para a catraca acompanhar o ganho.
    const BASELINE_SERVICES_COM_REPOSITORY = 43;

    it('o nº de Services que injetam @InjectRepository não passa do baseline', () => {
      const services = arquivos('.service.ts').filter(
        (s) => !s.endsWith('.spec.ts'),
      );
      const comRepository = services
        .filter((s) => /@InjectRepository\(/.test(ler(s)))
        .map(rel)
        .sort();
      // expect(valor, msg) é do Vitest; o Jest só aceita um argumento — por isso a mensagem
      // acionável vai DENTRO do valor comparado (mesmo idioma de `exigirVazio`).
      const relatorio =
        comRepository.length > BASELINE_SERVICES_COM_REPOSITORY
          ? `Service injetando Repository<T> direto sobe a dívida do ADR-0002 (baseline ` +
            `${BASELINE_SERVICES_COM_REPOSITORY}, agora ${comRepository.length}). Use a ` +
            `camada Repository (copie do piloto plano-cronograma):\n` +
            comRepository.map((s) => `  - ${s}`).join('\n')
          : '';
      expect(relatorio).toBe('');
    });
  });

  describe('Injeção de dependência', () => {
    it('nenhum Service instancia outro Service/Repository com `new`', () => {
      // O guia é explícito: "nunca instanciar dependências com new". `new` de Date, Error,
      // Map, DTO etc. é legítimo — a regra vale para as dependências injetáveis.
      const infratores: string[] = [];
      for (const arquivo of arquivos('.service.ts')) {
        if (arquivo.endsWith('.spec.ts')) continue;
        const fonte = ler(arquivo);
        for (const m of fonte.matchAll(
          /new\s+(\w+(?:Service|Repository))\s*\(/g,
        )) {
          infratores.push(`${rel(arquivo)} → new ${m[1]}()`);
        }
      }
      exigirVazio(
        infratores,
        'Injete pelo construtor em vez de instanciar com `new`:',
      );
    });
  });

  describe('Estrutura de módulo', () => {
    it('toda pasta de módulo com controller tem o seu .module.ts', () => {
      const semModulo: string[] = [];
      for (const controller of arquivos('.controller.ts')) {
        if (controller.endsWith('.spec.ts')) continue;
        const pasta = join(controller, '..');
        const temModulo = readdirSync(pasta).some((f) =>
          f.endsWith('.module.ts'),
        );
        if (!temModulo) semModulo.push(rel(controller));
      }
      exigirVazio(semModulo, 'Controller sem .module.ts na mesma pasta:');
    });
  });

  describe(`Módulo-piloto (${MODULO_PILOTO}) — referência a ser copiada`, () => {
    const piloto = join(SRC, MODULO_PILOTO);

    it('mantém a camada Repository', () => {
      const repos = readdirSync(join(piloto, 'repositories')).filter((f) =>
        f.endsWith('.repository.ts'),
      );
      expect(repos.length).toBeGreaterThanOrEqual(3);
    });

    it('mantém os 6 documentos exigidos pelo guia, com conteúdo', () => {
      const problemas: string[] = [];
      for (const doc of DOCS_OBRIGATORIOS) {
        const caminho = join(piloto, 'docs', doc);
        if (!existe(caminho)) {
          problemas.push(`${doc} — faltando`);
          continue;
        }
        // Documento vazio "passa" numa checagem de existência e não serve para nada — a
        // exigência do guia é documentação, não placeholder.
        const tamanho = ler(caminho).trim().length;
        if (tamanho < 200) problemas.push(`${doc} — só ${tamanho} caracteres`);
      }
      exigirVazio(
        problemas,
        `Documentos exigidos em src/${MODULO_PILOTO}/docs/:`,
      );
    });

    it('o controller do piloto não voltou a depender do TypeORM', () => {
      const fonte = ler(join(piloto, `${MODULO_PILOTO}.controller.ts`));
      expect(fonte).not.toMatch(/typeorm/);
      expect(fonte).toMatch(/PlanoCronogramaService/);
    });
  });

  describe('Segurança (§Segurança do guia)', () => {
    const main = ler(join(SRC, 'main.ts'));
    const appModule = ler(join(SRC, 'app.module.ts'));

    it('Helmet, CORS e validação global continuam ligados', () => {
      expect(main).toMatch(/helmet\(/);
      expect(main).toMatch(/enableCors\(/);
      expect(main).toMatch(/useGlobalPipes\(\s*new ValidationPipe\(/);
    });

    it('a CSP libera blob: em frame-src (pré-visualização de PDF)', () => {
      // Sem esta diretiva o frame-src cai no default-src 'self' e o navegador bloqueia o
      // <iframe src="blob:…"> da pré-visualização — falha silenciosa, só visível na tela.
      expect(main).toMatch(/'frame-src':\s*\[[^\]]*blob:/);
    });

    it('a validação global recusa campo não declarado no DTO', () => {
      // whitelist sem forbidNonWhitelisted descarta em silêncio; juntos, recusam com 400.
      expect(main).toMatch(/whitelist:\s*true/);
      expect(main).toMatch(/forbidNonWhitelisted:\s*true/);
    });

    it('o rate limit está registrado como guard global', () => {
      expect(appModule).toMatch(/ThrottlerModule\.forRootAsync/);
      expect(appModule).toMatch(
        /provide:\s*APP_GUARD,\s*useClass:\s*ThrottlerGuard/,
      );
    });
  });
});
