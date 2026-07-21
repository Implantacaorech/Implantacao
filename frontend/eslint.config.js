// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

/** ESLint do frontend Angular — exigido pelo §4.8.2 dos Padrões de Desenvolvimento da Rech
 * (ESLint + Prettier configurados, versionados e rodando no pipeline). Espelha a config do
 * backend (`backend/eslint.config.mjs`), adicionando as regras específicas de Angular. */
module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', '.angular/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    // As regras de acessibilidade entram como AVISO, não erro: há 16 achados pré-existentes
    // nos templates (autofocus, label sem controle, clique sem equivalente de teclado). São
    // débito real, registrado em docs/pendencias.md — corrigi-los muda comportamento de UI e
    // é mudança separada de "instalar o lint". Assim o pipeline não quebra por dívida antiga,
    // mas os achados continuam visíveis a cada execução.
    rules: {
      '@angular-eslint/template/no-autofocus': 'warn',
      '@angular-eslint/template/label-has-associated-control': 'warn',
      '@angular-eslint/template/click-events-have-key-events': 'warn',
      '@angular-eslint/template/interactive-supports-focus': 'warn',
    },
  },
);
