import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'src-tauri/target/**', 'graphify-out/**'] },
  // JS files - basic linting
  {
    files: ['src/v4/**/*.js', 'tests/v4/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-constant-binary-expression': 'error'
    }
  },
  // TS files - basic linting without type-checking
  ...tseslint.configs.recommended,
  {
    files: ['src/v4/**/*.ts', 'tests/v4/**/*.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unsafe-declaration-merging': 'off'
    }
  },
  {
    files: ['src/react/**/*.ts', 'src/react/**/*.tsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unsafe-declaration-merging': 'off'
    }
  }
];
