import { resolve } from 'node:path';
import { z } from 'zod';
export const ConfigSchema = z.strictObject({
  dataDir: z.string().min(1), artifactDir: z.string().min(1),
  port: z.number().int().min(0).max(65535), host: z.literal('127.0.0.1'),
  token: z.string().min(32).max(256).optional(),
  allowedOrigins: z.array(z.string()).max(8),
  maxConcurrentJobs: z.number().int().min(1).max(2), maxQueuedJobs: z.number().int().min(1).max(20),
  heartbeatTimeoutMs: z.number().int().min(1000).max(30000), cancellationGraceMs: z.number().int().min(100).max(5000),
  logger: z.boolean(),
});
export type EngineConfig = z.infer<typeof ConfigSchema>;
export function loadConfig(overrides: Partial<EngineConfig> = {}): EngineConfig {
  const dataDir = resolve(overrides.dataDir ?? process.env.ENGINE_DATA_DIR ?? '.engine');
  const config = ConfigSchema.parse({
    dataDir, artifactDir: resolve(overrides.artifactDir ?? process.env.ENGINE_ARTIFACT_DIR ?? `${dataDir}/artifacts`),
    port: Number(process.env.ENGINE_PORT ?? 4318), host: '127.0.0.1', token: process.env.ENGINE_TOKEN,
    allowedOrigins: process.env.ENGINE_ALLOWED_ORIGINS?.split(',').filter(Boolean) ?? [],
    maxConcurrentJobs: Number(process.env.ENGINE_MAX_JOBS ?? 1), maxQueuedJobs: 20,
    heartbeatTimeoutMs: 10000, cancellationGraceMs: 2000, logger: true,
    ...overrides,
  });
  for (const origin of config.allowedOrigins) {
    if (origin === 'tauri://localhost') continue;
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]', 'tauri.localhost'].includes(url.hostname) || url.origin !== origin) throw new Error('CORS origins must be explicit local application origins');
  }
  return config;
}
