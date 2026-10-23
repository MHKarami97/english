import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist', 'node_modules', 'public'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, __APP_VERSION__: 'readonly' },
    },
    rules: {
      'no-var': 'error',
      'prefer-const': 'error',
      'vue/multi-word-component-names': 'off',
      "no-useless-assignment": "off",
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  prettier,
];
