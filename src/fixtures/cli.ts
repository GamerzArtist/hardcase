import { resolve } from 'node:path';
import { startFixture } from './app.js';
const variant = process.argv.includes('--clean') ? 'clean' : 'faulty';
const fixture = await startFixture({ variant, directory: resolve(process.env.FIXTURE_DATA_DIR ?? '.engine/standalone-fixture'), port: 4319 });
console.log(JSON.stringify({ event: 'fixture_started', origin: fixture.baseUrl, variant, synthetic: true }));
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { if (stopping) return; stopping = true; void fixture.close().then(() => process.exit(0), error => { console.error(String(error)); process.exit(1); }); });
