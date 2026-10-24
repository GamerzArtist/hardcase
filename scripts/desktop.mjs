import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { createServer } from 'vite';
import { root } from './package-runtime.mjs';

if (!process.argv.includes('--dev')) throw new Error('Use npm run desktop:dev or npm run desktop:build.');
const origin = 'http://127.0.0.1:4337';
const vite = await createServer({ root: join(root, 'apps/web'), server: { host: '127.0.0.1', port: 4337, strictPort: true } });
await vite.listen();
const config = JSON.stringify({ build: { beforeDevCommand: '', devUrl: `${origin}/app` } });
const child = spawn(process.execPath, [join(root, 'node_modules/@tauri-apps/cli/tauri.js'), 'dev', '--config', config], { cwd: resolve(root, 'apps/web'), windowsHide: true, stdio: 'inherit', env: { ...process.env, HARDCASE_ENGINE_ROOT: root, HARDCASE_NODE_BINARY: process.execPath, HARDCASE_DESKTOP_DEV_ORIGIN: origin } });
child.on('error', async error => { console.error(error.message); await vite.close(); process.exitCode = 1; });
child.on('exit', async code => { await vite.close(); process.exitCode = code ?? 1; });
