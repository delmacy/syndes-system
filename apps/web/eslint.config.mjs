import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default defineConfig(...tseslint.configs.recommended, prettier, {
  ignores: ['.next/**', 'node_modules/**'],
});
