import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'], globals: true, testTimeout: 30000 },
  // Next 14 + React 18 compile JSX with the automatic runtime; esbuild defaults
  // to the classic one, which makes any test that renders a component fail with
  // "React is not defined". Match the app.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      // `server-only` is a build-time guard for Next; in Node tests it is a no-op.
      'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts'),
      '@': path.resolve(__dirname, '.'),
    },
  },
});
