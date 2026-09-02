import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: '.',
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'signer-next/.next/**'],
  },
})
