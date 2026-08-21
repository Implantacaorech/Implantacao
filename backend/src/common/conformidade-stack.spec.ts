import { Dirent, existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import configuration from '../config/configuration';

/** Guarda automática da stack obrigatória do Padrão Rech §4.8 (Angular · NestJS + TypeORM ·
 * MariaDB · entrega em processo único) — ver CLAUDE.md e `PADRAO-DESENVOLVIMENTO-RECH.md`
 * (documento único; a §4.8 é a mesma seção, na Parte I).
 *
 * Existe porque o desvio entra sempre pela porta de trás, não por decisão: um driver novo
 * numa dependência, uma URL de banco de outro dialeto que o config aceitava em silêncio
 * (era assim até 2026-07-29: qualquer prefixo desconhecido virava Postgres), um script
 * Python novo "só pra resolver rápido". Estes testes rodam em `npm test` — logo, em todo
 * push e no CI. */
const RAIZ = join(__dirname, '..', '..', '..');

/** Drivers de banco permitidos no backend, cada um com o motivo. Acrescentar item aqui é
 * decisão de arquitetura — não conveniência de implementação. */
const DRIVERS_PERMITIDOS: Record<string, string> = {
  mysql2: 'MariaDB — banco obrigatório da §4.8 (produção)',
  'better-sqlite3':
    'banco descartável de desenvolvimento/teste (sem MIGRACAO_DB_URL)',
  oracledb:
    'LEITURA da base externa de disponibilidade dos consultores — sistema de terceiro, não é banco do painel',
};

/** Pastas onde ainda há Python, com o motivo. §4.2 trata Python como antipadrão (deveria
 * ser Node/TS ou Ruby); o que resta está no plano de adequação em docs/pendencias.md
 * ("Porte dos componentes Python"). Esta lista é o teto: nenhum .py novo fora dela.
 *
 * - `docservice/`  geração fiel de documentos + transcrição (faster-whisper) — a transcrição
 *                  depende de exceção §4.3 a validar com o DevTools;
 * - `tools/`       geradores Office originais + fixtures de caracterização do porte para TS;
 * - `webapp/`      ponte `legado_cli.py` do assistente administrativo legado;
 * - `ia_admin/`    1 script que converte o YAML de uso de IA em `dados.js` — o mais barato
 *                  de portar (próximo da fila).
 *
 * `projeto_old/` (painel Flask, 39 arquivos) saiu do repositório em 2026-07-29. */
const PASTAS_COM_PYTHON = ['docservice', 'tools', 'webapp', 'ia_admin'];

const PODAR = new Set([
  'node_modules',
  '.git',
  '.venv',
  'venv',
  '__pycache__',
  'dist',
  '.angular',
  'coverage',
  '.pytest_cache',
]);

function lerPackageJson(rel: string): {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} {
  return JSON.parse(readFileSync(join(RAIZ, rel), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
}

function lerPasta(caminho: string): Dirent[] {
  try {
    return readdirSync(caminho, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** Varre a raiz do repositório procurando arquivos com a extensão dada, devolvendo o
 * caminho relativo. Poda o que não é código-fonte do projeto (node_modules, venv, build). */
function procurar(extensao: string): string[] {
  const achados: string[] = [];
  const pilha: string[] = [''];
  while (pilha.length) {
    const rel = pilha.pop() as string;
    // Pasta sem permissão/removida no meio da varredura: ignora e segue.
    const itens = lerPasta(join(RAIZ, rel));
    for (const item of itens) {
      if (item.name.startsWith('.') && item.isDirectory()) continue;
      if (PODAR.has(item.name)) continue;
      const filho = rel ? `${rel}/${item.name}` : item.name;
      if (item.isDirectory()) pilha.push(filho);
      else if (item.name.endsWith(extensao)) achados.push(filho);
    }
  }
  return achados;
}

describe('Conformidade com a stack obrigatória (Padrão Rech §4.8)', () => {
  describe('banco: MariaDB é o único dialeto de produção aceito', () => {
    const semUrl = { ...process.env };

    beforeEach(() => {
      // Apontar para um banco REAL faz `configuration()` exigir os segredos de JWT. Eles
      // existem no ambiente de quem desenvolve, e por isso o teste passava aqui e falhava no
      // CI, que não os define. Definir no próprio teste tira a suíte da dependência do
      // ambiente e, mais importante, garante que o que estamos medindo é o DIALETO — sem
      // isto, `toThrow(/MariaDB/)` casava com a mensagem do segredo faltando, e o caso
      // passaria mesmo se a guarda de dialeto fosse removida (achado de 2026-08-21).
      process.env.MIGRACAO_JWT_SECRET = 'teste-conformidade-0000000000';
      process.env.MIGRACAO_JWT_REFRESH_SECRET = 'teste-conformidade-1111111111';
    });

    afterEach(() => {
      process.env = { ...semUrl };
    });

    it('URL mysql:// e mariadb:// são aceitas como MariaDB', () => {
      process.env.MIGRACAO_DB_URL = 'mysql://u:s@host:3306/painel_novo';
      expect(configuration().db).toEqual({
        type: 'mariadb',
        url: 'mysql://u:s@host:3306/painel_novo',
      });
      process.env.MIGRACAO_DB_URL = 'mariadb://u:s@host:3306/painel_novo';
      expect(configuration().db.type).toBe('mariadb');
    });

    it('URL de qualquer outro banco falha o boot em vez de conectar fora do padrão', () => {
      for (const url of [
        'postgresql://u:s@host:5432/painel',
        'postgres://u:s@host:5432/painel',
        'mongodb://host:27017/painel',
        'sqlserver://host/painel',
      ]) {
        process.env.MIGRACAO_DB_URL = url;
        // Casa com a mensagem da guarda de DIALETO (`exigirMariaDb`), não com um /MariaDB/
        // solto que qualquer outro erro do boot satisfaria.
        expect(() => configuration()).toThrow(
          /MIGRACAO_DB_URL aponta para .*banco obrigatório do Padrão Rech/s,
        );
      }
    });

    it('sem MIGRACAO_DB_URL usa o SQLite descartável (dev/teste), nunca produção', () => {
      delete process.env.MIGRACAO_DB_URL;
      expect(configuration().db.type).toBe('better-sqlite3');
    });
  });

  describe('dependências', () => {
    it('o backend declara NestJS + TypeORM + o driver do MariaDB', () => {
      const deps = lerPackageJson('backend/package.json').dependencies ?? {};
      for (const pacote of [
        '@nestjs/core',
        '@nestjs/typeorm',
        'typeorm',
        'mysql2',
      ]) {
        expect(deps[pacote]).toBeDefined();
      }
    });

    it('o frontend é Angular', () => {
      const deps = lerPackageJson('frontend/package.json').dependencies ?? {};
      expect(deps['@angular/core']).toBeDefined();
    });

    it('não há driver de banco fora da lista permitida', () => {
      const pkg = lerPackageJson('backend/package.json');
      const todas = Object.keys({
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
      });
      // Só os nomes conhecidos de driver — evita falso positivo com nome parecido.
      const conhecidos = [
        'pg',
        'pg-native',
        'mysql',
        'mysql2',
        'better-sqlite3',
        'sqlite3',
        'oracledb',
        'mongodb',
        'mongoose',
        'mssql',
        'tedious',
        'ibm_db',
        'sql.js',
        '@sap/hana-client',
      ];
      const encontrados = todas.filter((p) => conhecidos.includes(p));
      for (const driver of encontrados) {
        expect(DRIVERS_PERMITIDOS[driver]).toBeDefined();
      }
    });
  });

  describe('migrations versionadas (§4.8.4)', () => {
    it('as migrations do MariaDB existem e não estão vazias', () => {
      const mariadb = join(RAIZ, 'backend/src/database/migrations-mariadb');
      expect(existsSync(mariadb)).toBe(true);
      expect(
        readdirSync(mariadb).filter((f) => f.endsWith('.ts')).length,
      ).toBeGreaterThan(0);
    });

    it('nenhuma migration de outro dialeto volta ao projeto', () => {
      // `migrations/` guardava DDL de Postgres do tempo do Flask — removida em 2026-07-29.
      // A asserção é sobre CONTEÚDO, não sobre a pasta: o OneDrive recria pasta vazia
      // sozinho depois do `git rm`, e uma pasta vazia não é desvio de padrão.
      const antiga = join(RAIZ, 'backend/src/database/migrations');
      expect(lerPasta(antiga).map((d) => d.name)).toEqual([]);
    });

    it('nenhuma fonte aponta para a pasta de migrations de outro dialeto', () => {
      for (const arquivo of [
        'backend/src/database/data-source.ts',
        'backend/src/database/database.module.ts',
      ]) {
        const fonte = readFileSync(join(RAIZ, arquivo), 'utf8');
        expect(fonte).not.toMatch(/migrations\/\*/);
        expect(fonte).not.toMatch(/'postgres'/);
      }
    });
  });

  describe('linguagens (§4.2: Python é antipadrão)', () => {
    it('não aparece Python fora das pastas já declaradas no plano de adequação', () => {
      const fora = procurar('.py').filter(
        (rel) => !PASTAS_COM_PYTHON.some((p) => rel.startsWith(`${p}/`)),
      );
      expect(fora).toEqual([]);
    });

    it('o código da aplicação (backend/frontend) é só TypeScript', () => {
      for (const app of ['backend/src', 'frontend/src']) {
        expect(procurar('.py').filter((rel) => rel.startsWith(app))).toEqual(
          [],
        );
      }
    });
  });
});
