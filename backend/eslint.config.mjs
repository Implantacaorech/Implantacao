// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      // O prefixo "_" marca o que é descartado DE PROPÓSITO. O uso principal aqui é o
      // idioma que remove segredo da resposta da API — `const { senha: _senha, ...cfg }`
      // em config-email/config-imap/config-disponibilidade e `senhaHash: _senhaHash` em
      // users. Sem esta configuração o ESLint acusa "variável não usada" e a correção
      // ingênua (apagar a desestruturação) faria a senha voltar a sair no JSON.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    // Testes (unit/e2e) leem corpo de resposta HTTP via supertest, que é `any` por natureza —
    // tipar cada `res.body.data.x` traria zero valor real de segurança de tipos aqui.
    files: ['test/**/*.ts', 'src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // Mesma razão das quatro acima, para o caso de PASSAR adiante o que veio do supertest
      // (`.send(res.body.data.campos)`). Ficou de fora quando as outras foram desligadas e
      // acumulou 14 avisos — acima do orçamento de 10 do CI, que reprovava o passo de lint
      // mesmo sem erro nenhum. Desligar aqui é o que já valia para as irmãs; o rigor
      // continua inteiro fora de `test/` e dos `.spec.ts`.
      '@typescript-eslint/no-unsafe-argument': 'off',
      // Dublê de teste precisa ter a MESMA assinatura do colaborador real: se o de verdade
      // devolve Promise, o falso também devolve, mesmo que o corpo seja síncrono e não tenha
      // o que esperar. Trocar por `Promise.resolve()` só para calar a regra deixaria o teste
      // menos parecido com o que ele substitui.
      '@typescript-eslint/require-await': 'off',
    },
  },
);
