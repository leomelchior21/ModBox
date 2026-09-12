import { defineConfig } from 'vitest/config';

/* Tests cover the educational interpreter and mission validation — the parts
   where a regression would quietly break a student's understanding. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    reporters: ['default'],
  },
});
