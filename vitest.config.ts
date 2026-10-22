import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  include: ['tests/**/*.test.ts'], testTimeout: 180000, hookTimeout: 30000,
  fileParallelism: false, maxWorkers: 1, sequence: { concurrent: false },
} });
