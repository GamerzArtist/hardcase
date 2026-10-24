import { resolve, join } from 'node:path';
import { createInterface } from 'node:readline';
import { createEngine } from '../dist/api/server.js';

if (!process.env.ENGINE_DATA_DIR) throw new Error('Desktop launcher must supply its private data directory.');
const origins = ['tauri://localhost', 'http://tauri.localhost'];
if (process.env.HARDCASE_DESKTOP_DEV_ORIGIN) {
  const url = new URL(process.env.HARDCASE_DESKTOP_DEV_ORIGIN);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.origin !== process.env.HARDCASE_DESKTOP_DEV_ORIGIN) throw new Error('Invalid desktop development origin.');
  origins.push(url.origin);
}
const dataDir = resolve(process.env.ENGINE_DATA_DIR);
const engine = await createEngine({ dataDir, artifactDir: join(dataDir, 'artifacts'), port: 0, allowedOrigins: origins, logger: false });
let stopping = false;
async function stop() { if (stopping) return; stopping = true; await engine.close(); process.exit(0); }
const input = createInterface({ input: process.stdin });
input.on('line', line => { if (line === 'shutdown') void stop(); });
// Closing the parent pipe also cleans up if the native window crashes.
input.on('close', () => void stop());
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => void stop());
try {
  const origin = await engine.listen();
  // This line is a private parent-child pipe, never a console log or web resource.
  process.stdout.write(`${JSON.stringify({ origin, token: engine.token })}\n`);
} catch (error) { await engine.close(); throw error; }
