import { join } from 'node:path';
import { createEngine } from '../api/server.js';
const engine = await createEngine();
const origin = await engine.listen();
engine.app.log.info({ event: 'engine_started', origin, sessionFile: join(engine.config.dataDir, 'session.json') }, 'Local engine ready');
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  if (stopping) return; stopping = true;
  void engine.close().then(() => process.exit(0), error => { console.error(JSON.stringify({ event: 'shutdown_failed', message: String(error) })); process.exit(1); });
});
